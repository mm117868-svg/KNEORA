/* The 95% confidence interval of a recovery check: worked out from the accepted pictures, saved with the result,
   shown where the result is shown, and never allowed to decide anything. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {summariseEndpoint, saveMeasurement, readMeasurements, depthImport, RECOVERY_KEY, MEASUREMENT_VERSION} from '../recovery-measurements.mjs';
import {maximumMovementTrend, combinedMovementChart} from '../recovery-trends.mjs';
import {createEndpointCamera} from '../recovery-camera.mjs';
import {EndpointPreviewAverage} from '../endpoint-smoothing.mjs';
import {t95} from '../confidence.mjs';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
const memory = () => { const map = new Map(); return {getItem: k => map.get(k) || null, setItem: (k, v) => map.set(k, v)}; };

test('the interval comes from the accepted pictures alone, by Student\'s t on the sample standard deviation', () => {
  const angles = [88, 90, 91, 89, 92, 90, 91, 89, 90, 90];
  const s = summariseEndpoint([...angles.map((angle, i) => ({angle, time_ms: i * 550})), {angle: null, reason: 'Knee hidden'}]);
  const mean = angles.reduce((a, b) => a + b, 0) / 10, sd = Math.sqrt(angles.reduce((a, b) => a + (b - mean) ** 2, 0) / 9), half = t95(9) * sd / Math.sqrt(10);
  assert.equal(s.mean, mean); close(s.ci95.half_width, half); close(s.ci95.low, mean - half); close(s.ci95.high, mean + half);
  assert.ok(s.ci95.low > s.minimum && s.ci95.high < s.maximum, 'the interval of the average is narrower than the range of the readings');
});

test('the interval never changes what is accepted, what is warned about or the value that is saved', () => {
  const steady = Array.from({length: 10}, (_, i) => ({angle: 90 + i % 2, time_ms: i * 550})), moving = [80, 100, 115].map(angle => ({angle}));
  assert.equal(summariseEndpoint(steady).mean, 90.5); assert.deepEqual(summariseEndpoint(steady).warnings, []);
  const wide = summariseEndpoint(moving);
  assert.equal(wide.warnings.length, 2, 'a moving knee is still saved with the same two notes as before');
  assert.ok(wide.ci95.half_width > 40, 'and its interval is honestly wide');
  assert.throws(() => summariseEndpoint(moving.slice(0, 2)), /Not enough/);
  assert.equal(MEASUREMENT_VERSION, 'endpoint-3-flexible', 'results with and without an interval stay in one series');
});

test('a saved camera result carries its interval; a clinical entry has none; records saved before this still read', () => {
  const options = {patientId: 'TEST', operationDate: '2026-09-01', today: '2026-09-13', storage: memory(), idFactory: () => 'id'};
  const input = {date: '2026-09-13', side: 'left', motion: 'bend', mode: 'active', position: 'supine', confirmed: true, captured_at: '2026-09-13T10:00:00Z'};
  const camera = saveMeasurement({...input, source: {kind: 'mediapipe_2d', device: 'TEST model', method: 'endpoint'}, frames: [89, 90, 91, 90, 90].map(angle => ({angle}))}, options);
  assert.equal(camera.value, 90); close(camera.summary.ci95.low + camera.summary.ci95.high, 180);
  const clinical = saveMeasurement({...input, value: 95, source: {kind: 'clinical', device: 'goniometer'}}, options);
  assert.equal(clinical.summary, null);
  const stored = JSON.parse(options.storage.getItem(RECOVERY_KEY)); delete stored[0].summary.ci95;   // as saved by the previous version
  options.storage.setItem(RECOVERY_KEY, JSON.stringify(stored));
  assert.equal(readMeasurements(options.storage).length, 2);
});

test('an imported depth-camera result gets the same interval from its own frames', () => {
  const context = {patient_id: 'TEST', operation_date: '2026-09-01', side: 'left', motion: 'bend', mode: 'active', position: 'seated', date: '2026-09-13'};
  const bent = degrees => { const r = (180 - degrees) * Math.PI / 180; return {valid: true, time_ms: 0, hip: [0, 0.4, 2], knee: [0, 0, 2], ankle: [0.4 * Math.sin(r), 0.4 * Math.cos(r), 2]}; };
  const result = depthImport({schema: 'knee-depth-endpoint-v1', units: 'm', captured_at: '2026-09-13T10:00:00Z', ...context,
    source: {kind: 'depth_3d', coordinates: 'depth-derived-joint-centres', device: 'SYNTHETIC depth camera', calibration: 'TEST'}, frames: [59, 60, 61, 60, 60, 61, 59].map(bent)}, context);
  close(result.summary.mean, 60, 1e-6); assert.ok(result.summary.ci95.half_width > 0.5 && result.summary.ci95.half_width < 1.5);
});

const operationDate = '2026-09-01';
const row = (date, value, extra = {}) => ({patient_id: 'TEST', operation_date: operationDate, side: 'left', motion: 'bend', mode: 'active', position: 'supine', version: 'endpoint-3-flexible',
  source: {kind: 'mediapipe_2d', device: 'SYNTHETIC camera', method: 'TEST', calibration: ''}, date, value, ...extra});
test('the graph draws a whisker through a result that has an interval, inside the axes, and none through one that has not', () => {
  const rows = [row('2026-09-03', 80, {summary: {ci95: {low: 76, high: 84}}}), row('2026-09-07', 95), row('2026-09-09', 2, {motion: 'straighten', summary: {ci95: {low: -3, high: 7}}})];
  const bend = maximumMovementTrend(rows, 'bend', '', operationDate).points, straighten = maximumMovementTrend(rows, 'straighten', '', operationDate).points;
  const svg = combinedMovementChart({bend, straighten}, 12), whiskers = [...svg.matchAll(/<path data-graph-interval d="M([\d.]+) ([\d.]+)V([\d.]+)M/g)];
  assert.equal(whiskers.length, 2);
  const y = value => 268 - value / 150 * 216;
  close(+whiskers.find(w => Math.abs(+w[2] - y(84)) < 1e-6)[3], y(76), 1e-6);                   // bending: 76° to 84°
  close(+whiskers.find(w => Math.abs(+w[2] - y(7)) < 1e-6)[3], y(0), 1e-6);                     // straightening: never drawn below straight
  assert.match(svg, /Bending · Day 2 · [^<]*: 80° · 95% confidence interval 76° to 84°/);
  assert.match(svg, /Straightening · Day 8 · [^<]*: 2° bend remaining · 95% confidence interval 0° to 7°/);
  assert.doesNotMatch(svg, /Day 6[^<]*confidence interval/);
  assert.doesNotMatch(svg, /NaN/);
});

test('the live reading carries a steadiness band once four pictures stand behind it', async t => {
  let callback; const readings = [];
  const raf = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = fn => { callback = fn; return 1; }; globalThis.cancelAnimationFrame = () => {};
  t.after(() => { globalThis.requestAnimationFrame = raf; globalThis.cancelAnimationFrame = cancel; });
  const ctx = new Proxy({}, {get: (_, name) => name === 'canvas' ? undefined : () => ({addColorStop() {}}), set: () => true});
  const surface = () => ({width: 0, height: 0, getContext: () => ctx});
  let ankleX = .5;
  const body = () => { const lm = Array.from({length: 33}, () => null); for (const [id, x, y] of [[23, .2, .5], [25, .5, .5], [27, ankleX, .8]]) lm[id] = {x, y, visibility: .99, presence: .99}; return lm; };
  const video = {srcObject: null, readyState: 2, currentTime: 0, videoWidth: 1280, videoHeight: 720, play: async () => {}};
  const camera = createEndpointCamera({video, canvas: surface(), workCanvas: surface(), getStream: async () => ({getTracks: () => [{stop() {}}]}), onAngle: reading => readings.push(reading),
    modelLoader: async () => ({model: 'TEST pose', landmarker: {setOptions: async () => {}, detect: () => ({landmarks: [body()]}), close() {}}}), handLoader: async () => { throw Error('no hand model in this test'); }});
  await camera.start('left'); readings.length = 0;
  for (let i = 1; i <= 5; i++) { ankleX = .5 + (i % 2 ? .01 : -.01); video.currentTime = i / 10; callback(i * 100); }
  assert.deepEqual(readings.map(r => r.samples), [1, 2, 3, 4, 5]);
  assert.deepEqual(readings.slice(0, 3).map(r => r.halfWidth), [null, null, null], 'too few pictures give no band: a line through three points leaves almost nothing over');
  assert.ok(readings.slice(3).every(r => r.halfWidth > 0 && r.halfWidth < 10));
  camera.stop(); assert.equal(readings.at(-1), null);
});

test('the preview average hands on the angles behind it, so the band can be worked out', () => {
  const filter = new EndpointPreviewAverage(), points = [{x: .2, y: .2}, {x: .4, y: .4}, {x: .6, y: .6}];
  filter.update(90, points, 0); const second = filter.update(92, points, 100); assert.deepEqual(second.angles, [90, 92]); assert.deepEqual(second.times, [0, 100]);
});

test('the patient is told what the interval is, and what it is not, wherever it is shown', () => {
  const page = fs.readFileSync(new URL('../recovery-summary.mjs', import.meta.url), 'utf8');
  assert.match(page, /95% confidence interval of the average/);
  assert.match(page, /how steady the pictures were, not how accurate the camera is/);
  assert.match(page, /how steady the reading is, not how accurate/);
  assert.match(page, /'95% confidence interval low','95% confidence interval high'\]/, 'and the download carries it in two new columns at the end');
});
