/* What the patient sees drawn over the picture: the operated leg and nothing else.

   The pose model always returns the whole body. These checks run the real preview loop from index.html with a
   whole-body result and a drawing surface that records every call, then look at where ink actually went. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pickSide, JointFilter, kneeFlexionDeg} from '../kneerec.js';
import {FluidOutline, PictureClock, drawOutline} from '../fluid-outline.mjs';
import {trendCI95} from '../confidence.mjs';
import {inspectExerciseLeg} from '../pose-gate.js';
import {raisedHandState, RAISED_HAND} from '../raised-hand.mjs';

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
/* The same body with the left hand held well above the left shoulder. */
const raised = body.map(p => ({...p})); Object.assign(raised[11], {x: .5, y: .3}); Object.assign(raised[23], {x: .3, y: .5}); Object.assign(raised[15], {x: .55, y: .05});

function run(side, {found = true, palm = false, frames = 6} = {}) {
  const marks = [], elements = new Map();
  const ctx = {clearRect() { marks.length = 0; }, beginPath() {}, stroke() {}, fill() {}, save() {}, restore() {}, closePath() {}, setLineDash() {}, strokeText() {},
    fillText(text, x, y) { marks.push([x, y]); }, moveTo(x, y) { marks.push([x, y]); }, lineTo(x, y) { marks.push([x, y]); }, arc(x, y) { marks.push([x, y]); }};
  const $ = id => { if (!elements.has(id)) elements.set(id, {hidden: true, style: {}, textContent: '', innerHTML: '', className: '', value: id === 'side' ? side : '', checked: id === 'showangle', classList: {add() {}, remove() {}, toggle() {}}, addEventListener() {}}); return elements.get(id); };
  let now = 1000;
  const context = vm.createContext({$, ctx, canvas: {width: W, height: H}, video: {readyState: 4, currentTime: 0, videoWidth: W}, stream: {}, running: false, current: {kind: 'reps'},
    pickSide, JointFilter, FluidOutline, PictureClock, drawOutline, trendCI95, kneeFlexionDeg, inspectExerciseLeg, raisedHandState, RAISED_HAND, drawRaisedHand() {}, pct: d => d, performance: {now: () => now},
    angleDisplay: {shown: NaN, sample: [], sampleTimes: [], update(a) { this.shown = a; this.sample = [a - 1, a + 1, a - 1, a + 1]; this.sampleTimes = [0, 33, 66, 100]; return a; }}, appVoice: {play() { return true; }, stop() {}}, refreshHint() {}, setExerciseSidebar() {}, startSession() {},
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {}, landmarker: {detectForVideo: () => ({landmarks: found ? [palm ? raised : body] : []})},
    requestAnimationFrameUnused: null});
  vm.runInContext(source, context);
  for (let i = 0; i < frames; i++) { now += 40; context.video.currentTime += .04; context.previewStep(); }   // the pose runs on every third frame
  return {marks, angle: elements.get('angle')?.textContent, counting: vm.runInContext('countdownStart !== null', context)};
}

for (const [side, leg, other] of [['left', [23, 25, 27], [24, 26, 28]], ['right', [24, 26, 28], [23, 25, 27]]]) {
  test(`with the ${side} leg operated, ink lands only on that leg and the angle arc at its knee`, () => {
    const {marks} = run(side), joints = leg.map(px), knee = joints[1];
    const shin = Math.hypot(joints[2][0] - knee[0], joints[2][1] - knee[1]), thigh = Math.hypot(joints[0][0] - knee[0], joints[0][1] - knee[1]);
    assert.ok(marks.length >= 7, 'two segments and three joints are drawn');
    // everything drawn belongs to the leg: a joint, or the arc, wedge, reference line and label, all of which sit round the knee
    for (const [x, y] of marks) assert.ok(joints.some(([ax, ay]) => Math.hypot(x - ax, y - ay) < 1) || Math.hypot(x - knee[0], y - knee[1]) <= Math.max(shin, thigh) + 1, `stray mark at ${x.toFixed(0)}, ${y.toFixed(0)}`);
    for (const joint of joints) assert.ok(marks.some(([x, y]) => Math.hypot(x - joint[0], y - joint[1]) < 1), 'each of the three joints is marked');
    for (const i of [...other, 0, 11, 12, 13, 14, 15, 16, 29, 30, 31, 32]) assert.ok(!marks.some(([x, y]) => Math.hypot(x - px(i)[0], y - px(i)[1]) < 12), `landmark ${i} must not be drawn`);
  });
}

test('the angle shown is still worked out from the unsmoothed joints of the operated leg', () => {
  const expected = kneeFlexionDeg(px(23), px(25), px(27));
  assert.equal(run('left').angle, expected.toFixed(0));
});

test('the patient screen no longer has any way to draw the whole skeleton', () => {
  assert.doesNotMatch(html, /drawSkeleton|SkeletonAverage|POSE_CONNECTIONS/);
  assert.doesNotMatch(html, /drawLeg\(/);
  assert.equal((html.match(/drawOutline\(ctx, /g) || []).length, 1, 'one place draws a body part, and it draws one leg');
  assert.match(html, /aimOutline\(previewLeg, previewLastVideoTime\)/);
  assert.match(html, /aimOutline\(trace\.lastLm, lastVideoTime\)/);
});

test('the picture is the video itself: the canvas is cleared, never painted with camera frames', () => {
  assert.doesNotMatch(html, /ctx\.drawImage\(video/);
  assert.match(html, /<div class="camera-view" id="cameraView"><video id="video" playsinline muted[^>]*><\/video><canvas id="canvas"/);
  assert.doesNotMatch(html, /\.stage video\{display:none\}/);
});

/* An earlier build asked for the operated leg of a skeleton that did not exist whenever the pose model found nobody,
   which threw on every frame. Nothing may throw with nobody in view, and nothing is drawn for a body that is not there. */
test('with nobody in view nothing throws, nothing is drawn and no countdown starts', () => {
  const result = run('left', {found: false, frames: 60});
  assert.equal(result.counting, false); assert.equal(result.marks.length, 0);
});
test('a hand held above the shoulder for two seconds starts the countdown, from the pose result alone', () => {
  assert.equal(run('right', {palm: true, frames: 60}).counting, true);
  assert.equal(run('right', {palm: false, frames: 60}).counting, false);
});
