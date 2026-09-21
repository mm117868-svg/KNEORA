import {TrackingQuality} from '../tracking-quality.mjs';
import {RehabCoach} from '../rehab-coach.mjs';
/* What the patient sees drawn over the picture: the operated leg and nothing else.

   The pose model always returns the whole body. These checks run the real preview loop from index.html with a
   whole-body result and a drawing surface that records every call, then look at where ink actually went. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pickSide, JointFilter, kneeFlexionDeg} from '../kneerec.js';
import {FLUID, FluidOutline, PictureClock, drawOutline, drawHipOutline, drawToeOutline, drawLandmarkPath} from '../fluid-outline.mjs';
import {trendCI95} from '../confidence.mjs';
import {inspectExerciseLeg} from '../pose-gate.js';
import {raisedHandState, RAISED_HAND, WaveDetector} from '../raised-hand.mjs';
import {highFiveState,HIGH_FIVE_SETTINGS} from '../high-five.mjs';
import {slrView,slrKeyLandmarks,slrToeLandmarks} from '../slr-view.mjs';
import {squatLandmarkPaths} from '../squat-view.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const between = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a); assert.ok(a >= 0 && b > a, `${from} … ${to}`); return html.slice(a, b); };
const source = between('const clearOverlay', 'const ANGLE_WINDOW_MS').replace(/^\/\*[\s\S]*?\*\/\s*/, '') +
  between('const HAND_HOLD_START_S', 'function cameraFailed(e)') + between('let previewId = 0', 'function startSession()');

const W = 1280, H = 720;
/* A whole body, every landmark confidently visible, each at its own place so a stray mark can be traced. */
const body = Array.from({length: 33}, (_, i) => ({x: .05 + (i % 8) * .11, y: .08 + Math.floor(i / 8) * .2, visibility: .99, presence: .99}));
Object.assign(body[23], {x: .30, y: .50}); Object.assign(body[25], {x: .45, y: .40}); Object.assign(body[27], {x: .60, y: .55});   // left hip, knee, ankle
Object.assign(body[24], {x: .32, y: .60}); Object.assign(body[26], {x: .47, y: .70}); Object.assign(body[28], {x: .62, y: .80});   // right hip, knee, ankle
Object.assign(body[29], {x:.69,y:.55});Object.assign(body[31],{x:.69,y:.42});
Object.assign(body[30], {x:.71,y:.80});Object.assign(body[32],{x:.71,y:.67});
const px = i => [body[i].x * W, body[i].y * H];
/* The same body with the left hand held well above the left shoulder. */
const raised = body.map(p => ({...p})); Object.assign(raised[11], {x: .5, y: .4}); Object.assign(raised[23], {x: .3, y: .5}); Object.assign(raised[15], {x: .55, y: .02}); Object.assign(raised[13], {x: .53, y: .15}); Object.assign(raised[0], {x: .5, y: .3});

function run(side, {found = true, palm = false, frames = 6, exercise = 'heel_slide'} = {}) {
  const marks = [], labels = [], elements = new Map();
  const ctx = {clearRect() { marks.length = 0; }, beginPath() {}, stroke() {}, fill() {}, save() {}, restore() {}, closePath() {}, setLineDash() {}, strokeText() {},
    fillText(text, x, y) { marks.push([x, y]); labels.push(text); }, moveTo(x, y) { marks.push([x, y]); }, lineTo(x, y) { marks.push([x, y]); }, arc(x, y) { marks.push([x, y]); }};
  const $ = id => { if (!elements.has(id)) elements.set(id, {hidden: true, dataset:{}, style: {}, textContent: '', innerHTML: '', className: '', value: id === 'side' ? side : '', checked: id === 'showangle', classList: {add() {}, remove() {}, toggle() {}}, addEventListener() {}}); return elements.get(id); };
  let now = 1000, handUp = false;
  const openPalm={gestures:[[{categoryName:'Open_Palm',score:.9}]],landmarks:[Array.from({length:21},()=>({x:.5,y:.5}))]};
  const noPalm={gestures:[],landmarks:[]};
  const context = vm.createContext({trackingQuality:new TrackingQuality(),rehabCoach:new RehabCoach(),rehabVoice:{trySpeak(){}},coachEnabled:false,cameraDisplay:{draw(){}},$, ctx, canvas: {width: W, height: H}, video: {readyState: 4, currentTime: 0, videoWidth: W}, stream: {}, running: false, current: {id:exercise,kind:'reps'},
    pickSide, JointFilter, FLUID, FluidOutline, PictureClock, drawOutline, drawHipOutline, drawToeOutline, drawLandmarkPath, squatLandmarkPaths, trendCI95, kneeFlexionDeg, inspectExerciseLeg, raisedHandState, RAISED_HAND, WaveDetector, highFiveState, HIGH_FIVE_SETTINGS, slrView, slrKeyLandmarks, slrToeLandmarks, drawRaisedHand() {}, pct: d => d, performance: {now: () => now},
    angleDisplay: {reset(){this.shown=NaN;},shown: NaN, sample: [], sampleTimes: [], update(a) { this.shown = a; this.sample = [a - 1, a + 1, a - 1, a + 1]; this.sampleTimes = [0, 33, 66, 100]; return a; }}, hipAngleDisplay: {update(a){return a;}}, toeAngleDisplay:{update(a){return a;}}, appVoice: {play() { return true; }, stop() {}}, refreshHint() {}, setExerciseSidebar() {}, startSession() {},
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {}, landmarker: {detectForVideo: () => ({landmarks: found ? [handUp ? raised : body] : []})},
    handRecognizer: {recognizeForVideo: () => palm ? openPalm : noPalm},
    requestAnimationFrameUnused: null});
  vm.runInContext(source, context);
  for (let i = 0; i < frames + (palm ? 30 : 0); i++) { now += 40; context.video.currentTime += .04; handUp = palm && i >= 30; context.previewStep(); }   // with a signal: a second with the hand down, then the hand up   // the pose runs on every third frame
  return {marks,labels,angle:elements.get('angle')?.textContent,hipAngle:elements.get('hipAngle')?.textContent,toeAngle:elements.get('toeAngle')?.textContent,counting:vm.runInContext('countdownStart !== null',context)};
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

test('straight leg raise shows only shoulder, hip, knee, ankle, heel and toe, with the three live angles',()=>{
  const result=run('left',{exercise:'straight_leg_raise',frames:18}),key=[11,23,25,27,29,31],other=[0,12,13,14,15,16,24,26,28,30,32];
  for(const i of key)assert.ok(result.marks.some(([x,y])=>Math.hypot(x-px(i)[0],y-px(i)[1])<12),`key landmark ${i} is shown`);
  for(const i of other)assert.ok(!result.marks.some(([x,y])=>Math.hypot(x-px(i)[0],y-px(i)[1])<12),`unneeded landmark ${i} stays hidden`);
  assert.ok(result.labels.some(text=>String(text).startsWith('HIP ')),'hip angle is labelled on the picture');
  assert.ok(result.labels.some(text=>String(text).startsWith('TOE ')),'toe direction is labelled on the picture');
  assert.ok(result.labels.some(text=>/^\d+°/.test(String(text))),'knee angle is labelled on the picture');
  assert.match(result.hipAngle,/^\d+$/,'hip angle tile is live');
  assert.match(result.toeAngle,/^\d+$/,'toe angle tile is live');
  assert.match(result.angle,/^\d+$/,'knee angle tile is live');
});

test('the patient screen no longer has any way to draw the whole skeleton', () => {
  assert.doesNotMatch(html, /drawSkeleton|SkeletonAverage|POSE_CONNECTIONS/);
  assert.doesNotMatch(html, /drawLeg\(/);
  assert.equal((html.match(/drawOutline\(ctx, /g) || []).length, 1, 'one place draws a body part, and it draws one leg');
  assert.match(html, /aimOutline\(previewLeg, rawBody, previewLastVideoTime\)/);
  assert.match(html, /aimOutline\(displayLeg, rawBody, lastVideoTime\)/);
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
test('a separately recognised open palm starts the countdown without drawing the hand', () => {
  assert.equal(run('right', {palm: true, frames: 60}).counting, true);
  assert.equal(run('right', {palm: false, frames: 60}).counting, false);
});
