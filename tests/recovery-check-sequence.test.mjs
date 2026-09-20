import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../recovery-summary.mjs',import.meta.url),'utf8');
test('the recovery summary offers one bending-then-straightening check',()=>{
  assert.match(source,/data-start-sequence>Measure bending and straightening/);
  assert.doesNotMatch(source,/data-start-motion=/);
  assert.match(source,/value="both"/);assert.match(source,/field\('motion'\)\.value='straighten'/);
  assert.match(source,/Save both measurements/);
});

test('an unset operation date is stated once rather than repeated beside the summary date',()=>{
  assert.match(source,/Operation date not set/);
  assert.match(source,/textContent=operationDate\?dayLabel\(postOpDay\(summaryDate\.value,operationDate\)\):''/);
});
