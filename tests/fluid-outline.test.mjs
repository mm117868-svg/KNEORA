/* The moving outline, held to account against a leg whose true position is known.

   A joint follows a known path. The pose model reports it a few times a second, a little late and a little
   noisily, exactly as the app receives it. The screen draws sixty times a second. Two ways of drawing are
   compared with where the joint really is at each refresh: holding the last result until the next one arrives,
   which is what the app used to do, and FluidOutline. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {FluidOutline, FLUID, drawOutline, drawHipOutline, drawToeOutline} from '../fluid-outline.mjs';
import {kneeFlexionDeg} from '../kneerec.js';

function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
const H = 720;

/* truth(t) is the joint's x in pixels. Results come poseHz times a second, describe the picture `latency` seconds
   before they arrive, carry `noise` pixels of scatter, and arrive up to `unevenMs` early or late. */
function watch({poseHz, truth, noise = 0, latency = 0, unevenMs = 0, seconds = 20, settings = FLUID}) {
  const random = seeded(11), normal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const outline = new FluidOutline(H, settings), fluid = [], stepped = [], real = [];
  let nextResult = 0, held = null;
  for (let k = 0; k < seconds * 60; k++) {
    const t = k / 60;
    if (t >= nextResult - 1e-9) { held = truth(t - latency) + noise * normal(); outline.target([[held, 100], [held, 300], [held, 500]], t - latency, 1); nextResult += 1 / poseHz + unevenMs / 1000 * (random() - .5); }
    const live = outline.at(t).find(part => !part.fading);
    if (live && t > 1) { fluid.push(live.points[1][0]); stepped.push(held); real.push(truth(t)); }
  }
  const rms = drawn => Math.sqrt(drawn.reduce((sum, v, i) => sum + (v - real[i]) ** 2, 0) / drawn.length);
  const roughness = drawn => sd(drawn.slice(2).map((v, i) => v - 2 * drawn[i + 1] + drawn[i]));   // change of speed between refreshes
  return {fluid, stepped, real, rmsFluid: rms(fluid), rmsStepped: rms(stepped), roughFluid: roughness(fluid), roughStepped: roughness(stepped),
    runOn: Math.max(Math.max(...fluid) - Math.max(...real), Math.min(...real) - Math.min(...fluid))};
}
/* A movement like the exercises: 1.5 s out, a second's pause, 1.5 s back, a second's pause, each stroke smooth. */
const stroke = x => 10 * x ** 3 - 15 * x ** 4 + 6 * x ** 5;
const exercise = size => t => { const u = t % 5; return 300 + size * (u < 1.5 ? stroke(u / 1.5) : u < 2.5 ? 1 : u < 4 ? 1 - stroke((u - 2.5) / 1.5) : 0); };

test('between results the outline keeps moving: no refresh stands still and none jumps', () => {
  const {fluid, stepped} = watch({poseHz: 10, truth: t => 100 + 120 * t, seconds: 6});
  const steps = fluid.slice(1).map((v, i) => v - fluid[i]), held = stepped.slice(1).filter((v, i) => v === stepped[i]).length;
  assert.ok(held / (stepped.length - 1) > 0.8, 'drawn only when a result arrives, five refreshes in six show no movement at all');
  assert.ok(steps.every(s => s > 0), 'the outline advances on every refresh');
  assert.ok(Math.max(...steps) < 1.5 * (120 / 60) && Math.min(...steps) > 0.5 * (120 / 60), `every step is close to the true 2 px a refresh: ${Math.min(...steps).toFixed(2)} to ${Math.max(...steps).toFixed(2)}`);
});

test('on a steadily moving leg the outline sits on the leg, even though every result is 50 ms old', () => {
  const late = watch({poseHz: 30, truth: t => 100 + 300 * t, latency: 0.05, seconds: 3});   // 300 px a second
  assert.ok(late.rmsStepped > 15, `drawn as it arrives, the outline trails by ${late.rmsStepped.toFixed(1)} px`);
  assert.ok(late.rmsFluid < 0.5, `carried forward it is within ${late.rmsFluid.toFixed(2)} px`);
});

for (const poseHz of [30, 15, 10]) {
  test(`an exercise-like movement at ${poseHz} results a second: closer to the leg than stepped drawing, and far smoother`, () => {
    const r = watch({poseHz, truth: exercise(250), noise: 0.7, latency: 0.05, unevenMs: 10});
    assert.ok(r.rmsFluid < 0.6 * r.rmsStepped, `distance from the leg ${r.rmsFluid.toFixed(1)} px against ${r.rmsStepped.toFixed(1)} px`);
    assert.ok(r.roughFluid < 0.3 * r.roughStepped, `roughness ${r.roughFluid.toFixed(2)} against ${r.roughStepped.toFixed(2)}`);
    assert.ok(r.runOn < 0.05 * 250, `at the turn of the movement it runs on ${r.runOn.toFixed(1)} px of a 250 px stroke`);
  });
}

test('expecting a slowing joint to stop is what keeps the run-on small', () => {
  const free = watch({poseHz: 10, truth: exercise(250), latency: 0.05, settings: {...FLUID, brake: false}}), braked = watch({poseHz: 10, truth: exercise(250), latency: 0.05});
  assert.ok(braked.runOn < 0.75 * free.runOn, `${braked.runOn.toFixed(1)} px against ${free.runOn.toFixed(1)} px`);
  assert.ok(braked.rmsFluid <= free.rmsFluid);
});

test('a result is never carried further than a tenth of the picture height, however fast the joint seemed to move', () => {
  const outline = new FluidOutline(H);
  outline.target([[100, 100], [100, 300], [100, 500]], 0); outline.target([[230, 100], [230, 300], [230, 500]], 0.1);   // 1300 px a second
  for (let t = 0.1; t < 0.5; t += 1 / 60) for (const part of outline.at(t)) if (!part.fading) assert.ok(part.points[1][0] - 230 <= FLUID.maxLeadFraction * H + 1e-9);
});

test('a still leg is drawn steadier than the results it is drawn from', () => {
  for (const poseHz of [30, 10]) {
    const r = watch({poseHz, truth: () => 400, noise: 0.7});
    assert.ok(sd(r.fluid) < 0.8 * sd(r.stepped), `${poseHz} Hz: ${sd(r.fluid).toFixed(2)} px against ${sd(r.stepped).toFixed(2)} px`);
    assert.ok(r.roughFluid < 0.5 * r.roughStepped);
  }
});

const leg = x => [[x, 100], [x + 40, 300], [x, 500]];
test('the outline fades in when the leg is found, and is drawn fainter when the pose model is unsure', () => {
  const sure = new FluidOutline(H); sure.target(leg(300), 0, 0.95);
  assert.equal(sure.at(0)[0].alpha, 0);
  assert.ok(Math.abs(sure.at(FLUID.fadeInS / 2)[0].alpha - 0.5) < 1e-9);
  assert.equal(sure.at(FLUID.fadeInS * 2)[0].alpha, 1);
  const unsure = new FluidOutline(H); unsure.target(leg(300), 0, 0.2);
  assert.equal(unsure.at(1 / 3)[0].alpha, FLUID.faintest, 'never invisible while it is being tracked');
  const middling = new FluidOutline(H); middling.target(leg(300), 0, 0.5);
  assert.ok(middling.at(1 / 3)[0].alpha > FLUID.faintest && middling.at(1 / 3)[0].alpha < 1);
});

test('when the leg is lost the outline fades out where it was, and then nothing is drawn', () => {
  const outline = new FluidOutline(H); outline.target(leg(300), 0); outline.at(0.3); outline.lose(0.3);
  const fading = outline.at(0.3 + FLUID.fadeOutS / 2);
  assert.equal(fading.length, 1); assert.equal(fading[0].fading, true); assert.ok(Math.abs(fading[0].alpha - 0.5) < 1e-9);
  assert.deepEqual(fading[0].points, leg(300));
  assert.deepEqual(outline.at(0.3 + FLUID.fadeOutS + 0.01), []);
});

test('an outline with no recent result behind it is not kept on screen', () => {
  const outline = new FluidOutline(H); outline.target(leg(300), 0); outline.at(0.2);
  const late = outline.at(FLUID.staleS + 0.1);
  assert.ok(late.every(part => part.fading), 'only the fade-out remains');
  assert.deepEqual(outline.at(FLUID.staleS + FLUID.fadeOutS + 0.1), []);
});

/* A device that manages one result every second or two. While a patient settles into position the leg is still, and
   the outline should stay on it; once the leg moves, a result that old says nothing about where the leg is now. */
test('on a slow device a still leg keeps a steady outline, and a moving leg is not shown where it no longer is', () => {
  const still = new FluidOutline(H); let shownAt = [];
  for (let k = 0; k <= 5; k++) { still.target(leg(300 + (k % 2) * 0.5), k * 2); for (let t = k * 2 + 1.2; t < k * 2 + 2; t += 0.1) if (still.at(t).some(p => !p.fading && p.alpha > 0.9)) shownAt.push(k); }   // each result is 1.2 s old before it can first be painted
  assert.deepEqual([...new Set(shownAt)], [1, 2, 3, 4, 5], 'from the second result on, the outline is there at every refresh');
  assert.ok(still.at(10 + 1.6 * 2 + 0.3).every(p => p.fading), 'and it goes once the next result is well overdue');

  const moving = new FluidOutline(H); shownAt = [];
  for (let k = 0; k <= 5; k++) { moving.target(leg(300 + k * 100), k * 2); for (let t = k * 2 + 1.2; t < k * 2 + 2; t += 0.1) if (moving.at(t).some(p => !p.fading)) shownAt.push(k); }   // 50 px a second
  assert.deepEqual(shownAt, [], 'a result 1.2 s old about a moving leg is never drawn');
});

test('at ordinary rates a moving leg that stops being reported is gone in under half a second, however long it had been tracked', () => {
  const outline = new FluidOutline(H);
  for (let k = 0; k < 60; k++) { outline.target(leg(300 + k * 5), k / 30); outline.at(k / 30); }   // 150 px a second, thirty results a second
  const last = 59 / 30;
  assert.ok(outline.at(last + 0.4).some(p => !p.fading)); assert.ok(outline.at(last + FLUID.staleS + 0.02).every(p => p.fading));
});

test('a leg that reappears somewhere else is drawn there, not dragged across the picture', () => {
  const outline = new FluidOutline(H); outline.target(leg(200), 0); outline.at(0.3);
  outline.target(leg(200 + 0.5 * H), 0.333);                       // half a picture height away in one result
  const parts = outline.at(0.35), live = parts.find(p => !p.fading), ghost = parts.find(p => p.fading);
  assert.deepEqual(live.points, leg(200 + 0.5 * H)); assert.ok(live.alpha < 0.2, 'and it fades in there');
  assert.deepEqual(ghost.points, leg(200), 'while the old one fades out where it was');
});

test('unusable results are treated as the leg being lost; the same instant twice is not a reappearance', () => {
  const outline = new FluidOutline(H); outline.target(leg(300), 0); outline.at(0.3);
  outline.target(leg(302), 0.3); outline.target(leg(303), 0.3);
  assert.equal(outline.at(0.31).filter(p => p.fading).length, 0);
  outline.target([[NaN, 1], [2, 3], [4, 5]], 0.4);
  assert.ok(outline.at(0.41).every(p => p.fading));
  assert.deepEqual(new FluidOutline(H).at(1), []); assert.deepEqual(new FluidOutline(H).at(NaN), []);
});

/* ---------------- the drawing ---------------- */
function recorder() {
  const calls = [], ctx = {};
  for (const name of ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'stroke', 'fill', 'fillText', 'strokeText', 'setLineDash']) ctx[name] = (...args) => { calls.push([name, ...args]); };
  ctx.createLinearGradient = () => ({addColorStop() {}}); ctx.createRadialGradient = () => ({addColorStop() {}});
  return {ctx, calls, of: name => calls.filter(c => c[0] === name)};
}
const swept = ([, , , , from, to, anticlockwise]) => { const tau = 2 * Math.PI, d = (((anticlockwise ? from - to : to - from) % tau) + tau) % tau; return d * 180 / Math.PI; };

test('the arc at the knee spans the bend the app reports, whichever way the leg faces', () => {
  for (const points of [[[300, 300], [500, 320], [520, 520]], [[900, 300], [700, 320], [680, 520]], [[300, 300], [500, 300], [700, 301]], [[400, 200], [420, 400], [600, 300]]]) {
    const {ctx, of} = recorder(); drawOutline(ctx, points, {angle: 62});
    const arcs = of('arc').filter(c => c.length === 7 && c[1] === points[1][0] && c[2] === points[1][1] && !(c[4] === 0 && Math.abs(c[5] - 2 * Math.PI) < 1e-9));
    const arc = arcs.at(-1), bend = kneeFlexionDeg(...points);
    assert.ok(Math.abs(swept(arc) - bend) < 1e-6, `arc ${swept(arc).toFixed(2)}°, bend ${bend.toFixed(2)}°`);
  }
});

test('the label carries the reading and, when there is one, its 95% interval; the wedge spans that interval either side of the shin', () => {
  const points = [[300, 300], [500, 320], [520, 520]];
  let r = recorder(); drawOutline(r.ctx, points, {angle: 61.6, halfWidth: 2.2});
  assert.equal(r.of('fillText')[0][1], '62° ±2');
  const wedge = r.of('arc').find(c => Math.abs(c[3] - Math.hypot(20, 200)) < 1e-9);           // drawn at the length of the shin
  assert.ok(Math.abs(swept(wedge) - 4.4) < 1e-6, 'the wedge is twice the half-width across');
  r = recorder(); drawOutline(r.ctx, points, {angle: 61.6, halfWidth: 0.3});
  assert.equal(r.of('fillText')[0][1], '62°', 'an interval too narrow to see is not drawn or written');
  assert.equal(r.of('arc').filter(c => Math.abs(c[3] - Math.hypot(20, 200)) < 1e-9).length, 0);
  r = recorder(); drawOutline(r.ctx, points, {angle: 61.6, halfWidth: 80});
  assert.ok(swept(r.of('arc').find(c => Math.abs(c[3] - Math.hypot(20, 200)) < 1e-9)) <= 50 + 1e-6, 'a very wide interval is capped so it cannot cover the picture');
  r = recorder(); drawOutline(r.ctx, points, {});
  assert.equal(r.of('fillText').length, 0, 'with the angle switched off only the leg is drawn');
});

test('straight leg raise draws a shoulder to hip reference and labels the live hip angle',()=>{
  const points=[[200,400],[500,400],[700,300]],r=recorder();drawHipOutline(r.ctx,points,{angle:26.6});
  assert.ok(r.of('moveTo').some(c=>c[1]===points[0][0]&&c[2]===points[0][1]));
  assert.ok(r.of('lineTo').some(c=>c[1]===points[1][0]&&c[2]===points[1][1]));
  assert.equal(r.of('fillText').at(-1)[1],'HIP 27°');
});

test('hip reference draws nothing when its key landmarks are missing',()=>{
  for(const points of [null,[[1,1],[2,2]],[[1,1],[1,1],[2,2]]]){const r=recorder();drawHipOutline(r.ctx,points,{angle:20});assert.equal(r.calls.length,0);}
});

test('straight leg raise draws heel to toe against a vertical-up reference and labels the direction',()=>{
  const points=[[500,500],[500,420]],r=recorder();drawToeOutline(r.ctx,points,{angle:0});
  assert.ok(r.of('moveTo').some(c=>c[1]===500&&c[2]===500));
  assert.ok(r.of('lineTo').some(c=>c[1]===500&&c[2]<500),'the ceiling reference points up');
  assert.equal(r.of('fillText').at(-1)[1],'TOE 0°');
});

test('toe reference draws nothing when heel or toe is missing',()=>{
  for(const points of [null,[[1,1]],[[1,1],[1,1]]]){const r=recorder();drawToeOutline(r.ctx,points,{angle:20});assert.equal(r.calls.length,0);}
});

test('nothing is drawn for a leg that is invisible, incomplete or has no length, and the drawing state is put back', () => {
  for (const [points, options] of [[[[300, 300], [500, 320], [520, 520]], {alpha: 0}], [[[300, 300], [500, 320]], {}], [[[300, 300], [300, 300], [520, 520]], {}], [[[NaN, 300], [500, 320], [520, 520]], {}], [null, {}]]) {
    const {ctx, calls} = recorder(); drawOutline(ctx, points, options); assert.equal(calls.length, 0);
  }
  const {ctx, calls} = recorder(); drawOutline(ctx, [[300, 300], [500, 320], [520, 520]], {alpha: 0.5, angle: 40, halfWidth: 3});
  assert.equal(calls[0][0], 'save'); assert.equal(calls.at(-1)[0], 'restore'); assert.equal(ctx.globalAlpha, 0.5);
});
