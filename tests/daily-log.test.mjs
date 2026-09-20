/* The day's log: kept sessions averaged per day and exercise, rejected ones left out, each exercise with its own key figure. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyLog, exerciseRangeSeries, renderDailyLog} from '../daily-log.mjs';
import {patientRecords} from '../patient-progress.js';

const scope = {patientId: 'TEST', operationDate: '2026-09-01', side: 'left'};
const session = (exercise, at, reps, measurement, extra = {}) => ({patient_id: 'TEST', operation_date: '2026-09-01', exercise, started_at: at, prescribed_reps: 12, count_source: 'angle_hysteresis',
  angle_count: {repetitions: reps, count_status: 'counted', events: [{status: 'accepted', hold_s: 4}, {status: 'accepted', hold_s: 6}]}, measurement: {side: 'left', ...measurement}, patient: {pain_0_10: 3}, ...extra});
const records = [session('heel_slide', '2026-09-14T09:00:00', 10, {p95_flexion_deg: 80}), session('heel_slide', '2026-09-14T17:00:00', 12, {p95_flexion_deg: 90}),
  session('heel_slide', '2026-09-14T18:00:00', 2, {p95_flexion_deg: 150}, {rejected: true}), session('seated_extension', '2026-09-14T10:00:00', 12, {p05_extension_deg: 8}),
  session('straight_leg_raise', '2026-09-15T10:00:00', 9, {median_flexion_deg: 14}), session('heel_slide', '2026-09-15T09:00:00', 11, {p95_flexion_deg: 95}, {measurement: {side: 'right', p95_flexion_deg: 95}})];

test('a repeated exercise is averaged over the sessions kept that day, and a rejected session is left out', () => {
  const day = dailyLog(records, scope).find(d => d.date === '2026-09-14'), slides = day.exercises.find(e => e.exercise === 'heel_slide');
  assert.equal(slides.sessions, 2); assert.equal(slides.repetitions, 11); assert.equal(slides.key.value, 85); assert.equal(slides.key.label, 'Furthest bend'); assert.equal(slides.hold_s, 5); assert.equal(day.day, 13);
  assert.equal(patientRecords(records, 'TEST', '2026-09-01').length, 5, 'the rejected session is also left out of every other count');
});
test('each exercise logs its own key figure, newest day first, for the chosen knee only', () => {
  const log = dailyLog(records, scope);
  assert.deepEqual(log.map(d => d.date), ['2026-09-15', '2026-09-14']);
  assert.deepEqual(log[0].exercises.map(e => [e.exercise, e.key.label, e.key.value]), [['straight_leg_raise', 'Knee kept straight', 14]]);
  assert.equal(log[1].exercises.find(e => e.exercise === 'seated_extension').key.label, 'Straightest knee');
});
test('the recovery scatter keeps every usable exercise session and adds straightening from a straight leg raise', () => {
  const s = exerciseRangeSeries(records, scope);
  assert.deepEqual(s.bend.map(p => [p.day, p.value]), [[13, 80], [13, 90]]);
  assert.deepEqual(s.straighten.map(p => [p.day, p.value, p.exercise]), [[13, 8, 'seated_extension'], [14, 14, 'straight_leg_raise']]);
  assert.match(s.straighten[1].label,/Straight leg raise/);
});
test('the log reads plainly and says when there is nothing yet', () => {
  const html = renderDailyLog(dailyLog(records, scope));
  assert.match(html, /Heel slides <small>average of 2<\/small>/); assert.match(html, /85°/); assert.doesNotMatch(html, /NaN|undefined|150°/);
  assert.match(renderDailyLog([]), /Nothing logged yet/);
});
