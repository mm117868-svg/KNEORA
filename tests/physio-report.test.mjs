/* The physio report: every line from a measurement, none without one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {physioReport, renderPhysioReport} from '../physio-report.mjs';

const reps = (n, {size = 60, away = 4, hold = 5, fade = 0} = {}) => Array.from({length: n}, (_, i) => ({t: 5 * i, status: 'accepted', excursion_deg: size * (1 - fade * i / Math.max(1, n - 1)), away_s: away, hold_s: hold}));
const session = (over = {}) => ({exercise: 'heel_slide', prescribed_reps: 10, started_at: '2026-09-19T10:00:00', measurement: {frames_total: 1000, frames_with_angle: 950, p95_flexion_deg: 92, p05_extension_deg: 4},
  angle_count: {repetitions: 10, events: reps(10)}, app: {aim: {kind: 'bend', deg: 90}, hold_target_s: 5}, ...over});
const has = (list, pattern) => assert.ok(list.some(line => pattern.test(line)), `${pattern} not in: ${list.join(' | ')}`);

test('a full, held, consistent set that reaches the bend is praised for each, with nothing to change', () => {
  const r = physioReport(session());
  has(r.well, /completed all 10/); has(r.well, /held every repetition for your 5 seconds/); has(r.well, /similar size/); assert.equal(r.well.length, 4);
  assert.deepEqual(r.improve, ['Nothing to change. Do the same again next time.']);
});
test('short holds, a rushed pace, tiring, a bend short of the aim and a part set each get one plain line', () => {
  has(physioReport(session({angle_count: {repetitions: 10, events: reps(10, {hold: 2})}})).improve, /holds were about 2 s\. Aim for 5 s/);
  has(physioReport(session({app: {aim: {kind: 'bend', deg: 90}, hold_target_s: 0}, angle_count: {repetitions: 10, events: reps(10, {away: 1.2, hold: 1.2})}})).improve, /quick, about 1 s/);
  has(physioReport(session({angle_count: {repetitions: 9, events: reps(9, {fade: 0.5})}})).improve, /smaller towards the end/);
  has(physioReport(session({measurement: {frames_total: 1000, frames_with_angle: 950, p95_flexion_deg: 71, p05_extension_deg: 4}})).improve, /about 71°; this stage works towards 90°/);
  const part = physioReport(session({angle_count: {repetitions: 4, events: reps(4)}})); has(part.improve, /4 of 10 repetitions counted/);
  const most = physioReport(session({angle_count: {repetitions: 7, events: reps(7)}})); has(most.well, /most of the set: 7 of 10/); has(most.improve, /Build up to the full 10/);
});
test('a camera estimate within 5 degrees of the aim counts as reaching it', () => {
  has(physioReport(session({measurement: {frames_total: 10, frames_with_angle: 10, p95_flexion_deg: 86}})).well, /reached this stage's bend of 90°/);
});
test('a leg the camera kept losing is said first, and nothing counted is blamed on the camera, not the patient', () => {
  const r = physioReport(session({measurement: {frames_total: 1000, frames_with_angle: 400}, angle_count: {repetitions: 0, events: []}}));
  assert.match(r.improve[0], /camera lost sight of your leg at times, so nothing could be counted/); assert.equal(r.well.length, 1); assert.match(r.well[0], /logged/);
});
test('straightening exercises are judged on the straightest knee, and a straight leg raise on the knee staying straight', () => {
  const ext = session({exercise: 'seated_extension', app: {aim: {kind: 'straight', deg: 10}, hold_target_s: 5}});
  has(physioReport(ext).well, /knee fully straight/); has(physioReport({...ext, measurement: {...ext.measurement, p05_extension_deg: 10}}).well, /close to straight, with about 10° of bend remaining/);
  has(physioReport({...ext, measurement: {...ext.measurement, p05_extension_deg: 24}}).improve, /about 24° short of straight/);
  const slr = session({exercise: 'straight_leg_raise', app: {aim: {kind: 'straight', deg: 10}, hold_target_s: 5}, measurement: {frames_total: 100, frames_with_angle: 100, p05_extension_deg: 5, p95_flexion_deg: 38}});
  has(physioReport(slr).improve, /Lock it straight first/);
});
test('a best yet against earlier kept sessions of the same exercise leads the report; rejected and other exercises are ignored', () => {
  const earlier = over => ({exercise: 'heel_slide', started_at: '2026-09-18T10:00:00', measurement: {p95_flexion_deg: 80}, ...over});
  assert.match(physioReport(session(), [earlier()]).well[0], /best bend yet.*about 12° more/);
  assert.doesNotMatch(physioReport(session(), [earlier({measurement: {p95_flexion_deg: 91}})]).well[0], /best bend yet/);
  assert.doesNotMatch(physioReport(session(), [earlier({measurement: {p95_flexion_deg: 95}}), earlier({rejected: true})]).well.join(' '), /yet/);
  assert.doesNotMatch(physioReport(session(), [earlier({exercise: 'squat'})]).well.join(' '), /yet/);
});
test('timed holds report their cycles; an empty record still gives a report and never NaN', () => {
  has(physioReport({exercise: 'quad_set', prescribed_reps: 10, hold: {cycles_completed: 10}, app: {aim: {kind: 'straight', deg: 10}}}).well, /all 10 holds/);
  const html = renderPhysioReport({exercise: 'heel_slide'}); assert.match(html, /Done well/); assert.match(html, /To work on next time/); assert.doesNotMatch(html, /NaN|undefined|—/);
  assert.match(html, /never replaces it/);
});
