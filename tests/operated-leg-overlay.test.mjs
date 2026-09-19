/* What the patient sees drawn over the picture: the operated leg and nothing else.

   The pose model always returns the whole body. These checks run the real preview loop from index.html with a
   whole-body result and a drawing surface that records every call, then look at where ink actually went. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pickSide, drawLeg, JointFilter, kneeFlexionDeg} from '../kneerec.js';
import {inspectExerciseLeg} from '../pose-gate.js';
import {highFiveState, HIGH_FIVE_SETTINGS} from '../high-five.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const between = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return html.slice(a, b); };
const source = between('const clearOverlay', 'const ANGLE_WINDOW_MS').replace(/^\/\*[\s\S]*?\*\/\s*/, '') +
  between('const HAND_HOLD_START_S', 'function cameraFailed(e)') + between('let previewId = 0', 'function startSession()');

const W = 1280, H = 720;
/* A whole body, every landmark confidently visible, each at its own place so a stray mark can be traced. */
const body = Array.from({length: 33}, (_, i) => ({x: .05 + (i % 8) * .11, y: .08 + Math.floor(i / 8) * .2, visibility: .99, presence: .99}));
Object.assign(body[23], {x: .30, y: .50}); Object.assign(body[25], {x: .45, y: .40}); Object.assign(body[27], {x: .60, y: .55});   // left hip, knee, ankle
Object.assign(body[24], {x: .32, y: .60}); Object.assign(body[26], {x: .47, y: .70}); Object.assign(body[28], {x: .62, y: .80});   // right hip, knee, ankle
const px = i => [body[i].x * W, body[i].y * H];

function run(side, {found = true, palm = false, frames = 6} = {}) {
  const marks = [], elements = new Map();
  const ctx = {clearRect() { marks.length = 0; }, beginPath() {}, stroke() {}, fill() {}, fillText() {},
    moveTo(x, y) { marks.push([x, y]); }, lineTo(x, y) { marks.push([x, y]); }, arc(x, y) { marks.push([x, y]); }};
  const $ = id => { if (!elements.has(id)) elements.set(id, {hidden: true, style: {}, textContent: '', innerHTML: '', className: '', value: id === 'side' ? side : '', checked: id === 'showangle', classList: {add() {}, remove() {}, toggle() {}}, addEventListener() {}}); return elements.get(id); };
  let now = 1000;
  const context = vm.createContext({$, ctx, canvas: {width: W, height: H}, video: {readyState: 4, currentTime: 0, videoWidth: W}, stream: {}, running: false, current: {kind: 'reps'},
    pickSide, drawLeg, JointFilter, kneeFlexionDeg, inspectExerciseLeg, highFiveState, HIGH_FIVE_SETTINGS, drawHands() {}, pct: d => d, performance: {now: () => now},
    angleDisplay: {update: a => a}, appVoice: {play() { return true; }, stop() {}}, refreshHint() {}, setExerciseSidebar() {}, startSession() {},
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {}, landmarker: {detectForVideo: () => ({landmarks: found ? [body] : []})},
    handRecognizer: palm ? {recognizeForVideo: () => ({gestures: [[{categoryName: 'Open_Palm', score: .95}]], landmarks: [Array.from({length: 21}, (_, i) => ({x: .9 + (i % 4) * .01, y: .1 + Math.floor(i / 4) * .01}))]})} : null});
  vm.runInContext(source, context);
  for (let i = 0; i < frames; i++) { now += 40; context.video.currentTime += .04; context.previewStep(); }   // the pose runs on every third frame
  return {marks, angle: elements.get('angle')?.textContent, counting: vm.runInContext('countdownStart !== null', context)};
}

for (const [side, leg, other] of [['left', [23, 25, 27], [24, 26, 28]], ['right', [24, 26, 28], [23, 25, 27]]]) {
  test(`with the ${side} leg operated, ink lands only on that hip, knee and ankle`, () => {
    const {marks} = run(side), allowed = leg.map(px);
    assert.ok(marks.length >= 7, 'two segments and three joints are drawn');
    for (const [x, y] of marks) assert.ok(allowed.some(([ax, ay]) => Math.hypot(x - ax, y - ay) < 1), `stray mark at ${x.toFixed(0)}, ${y.toFixed(0)}`);
    for (const joint of allowed) assert.ok(marks.some(([x, y]) => Math.hypot(x - joint[0], y - joint[1]) < 1), 'each of the three joints is marked');
    for (const i of [...other, 0, 11, 12, 13, 14, 15, 16, 29, 30, 31, 32]) assert.ok(!marks.some(([x, y]) => Math.hypot(x - px(i)[0], y - px(i)[1]) < 1), `landmark ${i} must not be drawn`);
  });
}

test('the angle shown is still worked out from the unsmoothed joints of the operated leg', () => {
  const expected = kneeFlexionDeg(px(23), px(25), px(27));
  assert.equal(run('left').angle, expected.toFixed(0));
});

test('the patient screen no longer has any way to draw the whole skeleton', () => {
  assert.doesNotMatch(html, /drawSkeleton|SkeletonAverage|POSE_CONNECTIONS/);
  assert.equal((html.match(/drawLeg\(ctx, /g) || []).length, 2, 'one outline in the preview, one in the session');
  assert.match(html, /drawLeg\(ctx, previewLeg, legStyle\(\)\)/);
  assert.match(html, /drawLeg\(ctx, trace\.lastLm, legStyle\(\)\)/);
});

test('the picture is the video itself: the canvas is cleared, never painted with camera frames', () => {
  assert.doesNotMatch(html, /ctx\.drawImage\(video/);
  assert.match(html, /<div class="camera-view" id="cameraView"><video id="video" playsinline muted[^>]*><\/video><canvas id="canvas"/);
  assert.doesNotMatch(html, /\.stage video\{display:none\}/);
});

/* Before this change the preview asked for the operated leg of a skeleton that did not exist whenever the pose
   model found nobody, which threw, and the throw skipped the hand check on that frame. With the angle display on,
   as it is by default, an open palm therefore only ever worked while a body was being tracked. */
test('an open palm starts the countdown when no body is found at all, with the angle display on', () => {
  const result = run('left', {found: false, palm: true, frames: 60});   // 2.4 seconds of open palm in a corner, nobody tracked
  assert.equal(result.counting, true);
  assert.equal(result.marks.length, 0, 'and nothing is drawn for a body that is not there');
});
test('and the same palm starts it while a body is tracked', () => {
  assert.equal(run('right', {found: true, palm: true, frames: 60}).counting, true);
});
