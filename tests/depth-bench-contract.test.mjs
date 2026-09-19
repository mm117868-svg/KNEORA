/* The app's side of the contract with the depth bench.

   depth-bench/ writes knee-depth-endpoint-v1 files and the recovery summary imports them. The bench also
   repeats the importer's acceptance rules so that it can warn before a file is carried over. Both halves now
   live in this repository, and these checks read the same fixture as depth-bench/tests/test_contract.py, so
   the format and the rules cannot change on one side only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {depthImport, saveMeasurement, DEPTH_CAPTURE_RULES, RECOVERY_KEY} from '../recovery-measurements.mjs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const fixture = () => JSON.parse(read('../depth-bench/tests/fixtures/knee-depth-endpoint-v1.sample.json'));
const contextOf = data => Object.fromEntries(['patient_id', 'operation_date', 'side', 'motion', 'mode', 'position', 'date'].map(k => [k, data[k]]));

test("the importer accepts the bench's export and reads the bend that was constructed", () => {
  const data = fixture(), result = depthImport(data, contextOf(data));
  assert.equal(result.summary.sampled, 12);
  assert.equal(result.summary.accepted, 11);                      // one frame was refused by the bench
  assert.ok(Math.abs(result.summary.mean - 60) < 1e-6, `mean ${result.summary.mean}`);
  assert.ok(result.summary.maximum - result.summary.minimum < DEPTH_CAPTURE_RULES.maximumSpread);
  assert.equal(result.source.kind, 'depth_3d');
  assert.match(result.source.device, /D415/);
  assert.equal(result.capture_group, data.capture_group);
  assert.equal(result.captured_at, data.captured_at);
});

test('the imported hold saves as a depth measurement, kept apart from the image-plane series', () => {
  const data = fixture(), context = contextOf(data), rows = new Map();
  const storage = {getItem: k => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, v)};
  const record = saveMeasurement({...context, confirmed: true, ...depthImport(data, context)},
    {patientId: context.patient_id, operationDate: context.operation_date, today: context.date, storage, idFactory: () => 'fixture'});
  assert.equal(record.source.kind, 'depth_3d');
  assert.ok(Math.abs(record.value - 60) < 1e-6);
  assert.equal(JSON.parse(rows.get(RECOVERY_KEY)).length, 1);
});

test('a file for another patient, knee or day is refused', () => {
  const data = fixture();
  for (const change of [{patient_id: 'P002'}, {side: 'right'}, {date: '2026-09-18'}, {motion: 'straighten'}])
    assert.throws(() => depthImport(data, {...contextOf(data), ...change}), /does not match/);
});

test("the bench's copy of the acceptance rules is the importer's", () => {
  const bench = JSON.parse(read('../depth-bench/depth_bench/export.py').match(/DEPTH_RULES = (\{[^}]*\})/)[1]);
  assert.equal(bench.minimum_frames, DEPTH_CAPTURE_RULES.minimumFrames);
  assert.equal(bench.minimum_coverage, DEPTH_CAPTURE_RULES.minimumCoverage);
  assert.equal(bench.maximum_spread, DEPTH_CAPTURE_RULES.maximumSpread);
  const importer = read('../recovery-measurements.mjs'), geometry = read('../depth-bench/depth_bench/geometry.py');
  assert.ok(importer.includes(`data.frames.length>${bench.maximum_frames}`), 'frame cap');
  const segment = name => +geometry.match(new RegExp(`${name}: float = ([0-9.]+)`))[1];
  assert.ok(importer.includes(`n>=${String(segment('min_segment_m')).replace(/^0/, '')}&&n<=${String(segment('max_segment_m')).replace(/^0/, '')}`), 'segment length gate');
});

test('the 2 MB limit is the same on both sides', () => {
  assert.ok(read('../depth-bench/depth_bench/export.py').includes('2 * 1024 * 1024'));
  assert.ok(read('../recovery-summary.mjs').includes('file.size>2*1024*1024'));
});
