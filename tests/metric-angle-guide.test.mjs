import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {METRIC_ANGLE_DIAGRAMS} from '../metric-angle-guide.mjs';

test('knee, hip and toe explanations each include a labelled angle diagram',()=>{
  assert.deepEqual(Object.keys(METRIC_ANGLE_DIAGRAMS),['knee','hip','toe']);
  for(const [name,svg] of Object.entries(METRIC_ANGLE_DIAGRAMS)){
    assert.match(svg,/<svg/);assert.match(svg,/class="angle"/);assert.match(svg,/role="img"/);assert.match(svg,/°/);assert.match(svg,new RegExp(name,'i'));
  }
});

test('each angle explanation includes a modern human figure as well as the measurement',()=>{
  for(const svg of Object.values(METRIC_ANGLE_DIAGRAMS)){
    assert.match(svg,/human-head/);assert.match(svg,/human-body/);assert.match(svg,/measurement/);assert.match(svg,/reference/);
  }
});

test('Patient details leaves the recovery calendar visible in its right-hand column',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const rule=html.match(/\.details-view #recoveryHome[^\n]+/)[0];
  assert.doesNotMatch(rule,/#progress/);assert.match(html,/renderHomeActivity\(\$\("progress"\)/);
});

test('Exercises today continues with the complete programme grouped by week',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const rule=html.match(/\.exercises-view #recoveryHome[^\n]+/)[0];
  assert.doesNotMatch(rule,/\.phasepick|#weeks/);assert.match(html,/Your programme, week by week/);assert.match(html,/id="weeks"/);
});
