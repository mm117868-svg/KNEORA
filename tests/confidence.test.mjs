/* The 95% interval: the numbers behind it, and whether it does what it says. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {t95, meanCI95, trendCI95, intervalText} from '../confidence.mjs';

const close = (a, b, tol, message) => assert.ok(Math.abs(a - b) <= tol, `${message || ''} ${a} is not within ${tol} of ${b}`);

test("Student's t at 95%: the table, and the expansion beyond it, agree with published values", () => {
  for (const [df, t] of [[1, 12.706], [2, 4.303], [4, 2.776], [9, 2.262], [10, 2.228], [29, 2.045], [30, 2.042]]) assert.equal(t95(df), t);
  // beyond the table, against the standard tables to three decimal places
  for (const [df, t] of [[31, 2.040], [35, 2.030], [40, 2.021], [50, 2.009], [60, 2.000], [80, 1.990], [100, 1.984], [120, 1.980], [1000, 1.962]]) close(t95(df), t, 0.0006, `df ${df}:`);
  close(t95(1e9), 1.959964, 1e-6);
  assert.ok(t95(30) > t95(31) && t95(31) > t95(32), 'no step where the table hands over to the expansion');
  for (const bad of [0, -3, 2.5, NaN, undefined, '9']) assert.ok(Number.isNaN(t95(bad)));
});

test('the interval of a small sample, worked by hand', () => {
  const ci = meanCI95([1, 2, 3, 4, 5]);
  assert.equal(ci.n, 5); assert.equal(ci.mean, 3);
  close(ci.sd, Math.sqrt(2.5), 1e-12);                       // sample standard deviation, n - 1
  close(ci.halfWidth, 2.776 * Math.sqrt(2.5) / Math.sqrt(5), 1e-12);
  close(ci.low, 3 - 1.9630, 1e-3); close(ci.high, 3 + 1.9630, 1e-3);
});

test('too few readings give no interval, and readings that are not numbers are left out', () => {
  assert.equal(meanCI95([]), null); assert.equal(meanCI95([60]), null); assert.equal(meanCI95([60, 61]), null);
  assert.equal(meanCI95(null), null); assert.equal(meanCI95([60, NaN, Infinity, 61]), null);
  const ci = meanCI95([60, NaN, 61, undefined, 62, Infinity]);
  assert.equal(ci.n, 3); assert.equal(ci.mean, 61);
});

test('identical readings give an interval of no width; more scatter gives a wider one; more readings a narrower one', () => {
  assert.equal(meanCI95([62, 62, 62, 62]).halfWidth, 0);
  assert.ok(meanCI95([60, 62, 64, 62]).halfWidth > meanCI95([61, 62, 63, 62]).halfWidth);
  const few = meanCI95([61, 63, 61, 63]), many = meanCI95([61, 63, 61, 63, 61, 63, 61, 63, 61, 63]);
  assert.ok(many.halfWidth < few.halfWidth);
});

/* The claim itself. Independent readings scattered about a true angle: the interval should hold the true angle
   about 95 times in 100, for the small samples the app actually has. Seeded, so the check never flickers. */
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
test('with independent readings the interval holds the true angle about 95 times in 100', () => {
  const random = seeded(20260919), normal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  for (const n of [3, 5, 10, 40]) {
    let held = 0; const trials = 6000, truth = 62;
    for (let i = 0; i < trials; i++) { const ci = meanCI95(Array.from({length: n}, () => truth + 2.5 * normal())); if (ci.low <= truth && truth <= ci.high) held++; }
    close(held / trials, 0.95, 0.012, `${n} readings:`);
  }
});

/* And the caution written at the top of confidence.mjs, shown rather than asserted: readings that lean on the one
   before, as consecutive video frames do, make the interval too narrow. This is why the live band is described
   as steadiness and never as accuracy. */
test('readings that follow one another, like video frames, make the interval too narrow', () => {
  const random = seeded(7), normal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  let held = 0; const trials = 4000, truth = 62, r = 0.8;
  for (let i = 0; i < trials; i++) {
    let e = normal(); const values = [];
    for (let k = 0; k < 10; k++) { e = r * e + Math.sqrt(1 - r * r) * normal(); values.push(truth + 2.5 * e); }
    const ci = meanCI95(values); if (ci.low <= truth && truth <= ci.high) held++;
  }
  assert.ok(held / trials < 0.75, `coverage ${held / trials} should fall well short of 0.95`);
});

/* The live band. A knee moving smoothly gives readings that differ because the knee moved. About their plain mean that
   looks like unsteadiness; about their own trend it does not. */
test('about its own trend, a smoothly moving reading is as steady as its noise, and a still one is judged as before', () => {
  const times = Array.from({length: 10}, (_, i) => i * 33), moving = times.map((t, i) => 40 + 0.06 * t + (i % 2 ? 0.3 : -0.3));   // 60 degrees a second, 0.3 degrees of jitter
  const plain = meanCI95(moving), trend = trendCI95(times, moving);
  assert.ok(plain.halfWidth > 3.5, `about the mean the band is ${plain.halfWidth.toFixed(1)} degrees wide, which is the movement`);
  assert.ok(trend.halfWidth < 0.3, `about the trend it is ${trend.halfWidth.toFixed(2)} degrees, which is the jitter`);
  close(trend.slope, 0.06, 0.003);
  const still = times.map((_, i) => 62 + [0.4, -0.2, 0.1, -0.5, 0.3, 0, -0.1, 0.2, -0.3, 0.1][i]);
  close(trendCI95(times, still).halfWidth, meanCI95(still).halfWidth, 0.15);
  assert.equal(trendCI95(times, moving).n, 10); close(trendCI95(times, moving).mean, plain.mean, 1e-12);
});
test('the trend interval is worked by hand, needs four readings, and copes with readings that share one instant', () => {
  // y = 1, 3, 2, 4 at t = 0..3: slope 0.8, residuals -0.3, 0.9, -0.9, 0.3, SSE 1.8, s = sqrt(1.8 / 2)
  const ci = trendCI95([0, 1, 2, 3], [1, 3, 2, 4]);
  close(ci.slope, 0.8, 1e-12); close(ci.sd, Math.sqrt(0.9), 1e-12); close(ci.halfWidth, 4.303 * Math.sqrt(0.9) / 2, 1e-9);
  assert.equal(trendCI95([0, 1, 2], [1, 2, 3]), null); assert.equal(trendCI95(null, null), null); assert.equal(trendCI95([0, 1, 2, NaN], [1, 2, 3, 4]), null);
  close(trendCI95([5, 5, 5, 5], [1, 2, 3, 4]).halfWidth, meanCI95([1, 2, 3, 4]).halfWidth, 1e-12);
});
test('with independent readings about a moving knee, the trend interval still holds the true level about 95 times in 100', () => {
  const random = seeded(99), normal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  let held = 0; const trials = 6000, times = Array.from({length: 10}, (_, i) => i * 33), mid = times.reduce((a, b) => a + b, 0) / 10;
  for (let i = 0; i < trials; i++) { const ci = trendCI95(times, times.map(t => 40 + 0.06 * t + 1.5 * normal())); if (ci.low <= 40 + 0.06 * mid && 40 + 0.06 * mid <= ci.high) held++; }
  close(held / trials, 0.95, 0.012);
});

test('the interval in words: whole degrees, one decimal place when both ends would read the same, never below straight', () => {
  assert.equal(intervalText({low: 60.6, high: 63.2}), '61° to 63°');
  assert.equal(intervalText({low: 61.8, high: 62.3}), '61.8° to 62.3°');
  assert.equal(intervalText({low: -1.4, high: 3.2}), '0° to 3°');
  assert.equal(intervalText({low: -0.3, high: 0.2}), '0.0° to 0.2°');
  assert.equal(intervalText(null), ''); assert.equal(intervalText({low: NaN, high: 3}), '');
});
