import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const feedback=fs.readFileSync(new URL('../progress-to-date.mjs',import.meta.url),'utf8');

test('the former metrics tab is labelled as physiotherapy feedback throughout',()=>{
  assert.match(page,/>Physiotherapy feedback<\/a>/);
  assert.match(page,/PAGE_VIEW === "progress-to-date" \? "Physiotherapy feedback"/);
  assert.match(feedback,/<h1>Physiotherapy feedback<\/h1>/);
});

test('latest exercise sessions show what went well and what to improve',()=>{
  assert.match(feedback,/import \{physioReport\}/);
  assert.match(feedback,/<h3>What went well<\/h3>/);
  assert.match(feedback,/<h3>What to improve<\/h3>/);
  assert.match(feedback,/Missing measurements are not treated as poor performance/);
});

test('the page does not imply that generated feedback is a physiotherapist review',()=>{
  assert.match(feedback,/Feedback from the camera, not a personal review by your physiotherapist/);
  assert.match(feedback,/Detailed measurements and recovery context/);
});
