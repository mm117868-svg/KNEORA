/* Straight leg raise: the hip angle and the other-knee setup check, from a pose result. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {slrView, SLR_VIEW} from '../slr-view.mjs';

const W = 1000, H = 1000;
/* Lying on the back, head to the left: trunk along the floor, operated (left) leg raised by `raise` degrees, other knee bent by `otherBend`. */
function lying(raise, otherBend, seen = .9) {
  const lm = Array.from({length: 33}, () => ({x: .5, y: .5, visibility: 0})), put = (i, x, y, v = seen) => { lm[i] = {x: x / W, y: y / H, visibility: v}; };
  const r = raise * Math.PI / 180, b = otherBend * Math.PI / 180;
  put(11, 200, 700); put(12, 200, 700); put(23, 500, 700); put(24, 500, 700);
  put(25, 500 + 250 * Math.cos(r), 700 - 250 * Math.sin(r)); put(27, 500 + 500 * Math.cos(r), 700 - 500 * Math.sin(r));
  put(26, 500 + 250 * Math.cos(.6), 700 - 250 * Math.sin(.6)); put(28, 500 + 250 * Math.cos(.6) + 250 * Math.cos(.6 - b), 700 - 250 * Math.sin(.6) - 250 * Math.sin(.6 - b)); return lm;
}
test('the hip angle is the lift of the thigh away from the line of the trunk', () => {
  for (const raise of [0, 20, 45, 70]) assert.ok(Math.abs(slrView(lying(raise, 80), 'left', W, H).hip - raise) < 1e-6);
});
test('the other knee counts as bent from 40 degrees, and is unknown when it cannot be seen', () => {
  assert.equal(slrView(lying(30, 80), 'left', W, H).otherBent, true);
  assert.equal(slrView(lying(30, 10), 'left', W, H).otherBent, false);
  assert.ok(Math.abs(slrView(lying(30, 80), 'left', W, H).otherKnee - 80) < 1e-6); assert.equal(SLR_VIEW.otherKneeBentFrom, 40);
  const hidden = lying(30, 80); hidden[26].visibility = .1;
  assert.deepEqual(slrView(hidden, 'left', W, H), {hip: slrView(lying(30, 80), 'left', W, H).hip, otherKnee: null, otherBent: null});
  assert.deepEqual(slrView(null, 'left', W, H), {hip: null, otherKnee: null, otherBent: null});
});
test('it is shown for the straight leg raise only, and the other-knee advice only before recording starts', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /current\?\.id === "straight_leg_raise" && \$\("showangle"\)\.checked/);
  assert.match(html, /showSlr\(previewAll, true\)/); assert.match(html, /showSlr\(lastAll, false\)/);
});
test('repetitions come from the joint angle: the knee, or the hip for a straight leg raise', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /repCounter\.update\(repSignal\.read\(lastAll, canvas\.width, canvas\.height\), t\)/); assert.match(html, /"angle_hysteresis"/);
  assert.doesNotMatch(html, /positionCounter\.update|readPositionFrame\(video|monitor\.update\(video/);
});

import {RepSignal} from '../rep-signal.mjs';
import {EXERCISE_PROFILES, exerciseProfile} from '../exercise-profiles.mjs';
test('every live exercise has its own profile, and the straight leg raise is watched by how far the leg is lifted', () => {
  for (const id of ['heel_slide', 'seated_extension', 'straight_leg_raise']) assert.ok(EXERCISE_PROFILES[id].tracks && EXERCISE_PROFILES[id].holdAt);
  assert.equal(new Set(['heel_slide', 'seated_extension', 'straight_leg_raise'].map(id => JSON.stringify([EXERCISE_PROFILES[id].signal, EXERCISE_PROFILES[id].direction]))).size, 3, 'no two of the three are counted the same way');
  assert.equal(exerciseProfile('something_new').direction, 'either');
  for (const raise of [0, 20, 45]) { const lift = new RepSignal('straight_leg_raise', 'left').read(lying(raise, 80), W, H); assert.ok(Math.abs(lift - raise) < 1e-6, `lifted ${raise}: read ${lift}`); }
  const mirrored = lying(30, 80).map(p => ({...p, x: 1 - p.x})); assert.ok(Math.abs(new RepSignal('straight_leg_raise', 'left').read(mirrored, W, H) - 30) < 1e-6, 'the same whichever way the patient faces');
  const unsure = lying(30, 80); unsure[27].visibility = .3; assert.ok(Number.isNaN(new RepSignal('straight_leg_raise', 'left').read(unsure, W, H)), 'never read from a joint the model is unsure of');
  assert.ok(Math.abs(new RepSignal('seated_extension', 'left').read(lying(0, 80), W, H)) < 1e-6);
});
