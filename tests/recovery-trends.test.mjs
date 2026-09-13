import test from 'node:test';
import assert from 'node:assert/strict';
import {maximumMovementTrend,movementChart} from '../recovery-trends.mjs';
import {measurementSeriesKey} from '../recovery-measurements.mjs';
const operationDate='2026-09-01';
const base={patient_id:'TEST',operation_date:operationDate,side:'left',motion:'bend',mode:'active',position:'supine',source:{kind:'mediapipe_2d',device:'SYNTHETIC camera',method:'TEST',calibration:''},version:'endpoint-2'};
const row=(date,value,extra={})=>({...base,date,value,...extra});
test('bending plots the highest daily averaged measurement, without filling missing days',()=>{
 const rows=[row('2026-09-03',80),row('2026-09-03',90),row('2026-09-07',100),row('2026-09-09',95)];
 const result=maximumMovementTrend(rows,'bend','',operationDate);
 assert.deepEqual(result.points.map(p=>[p.day,p.value]),[[2,90],[6,100],[8,95]]);assert.equal(result.best.value,100);
});
test('straightening plots lowest bend remaining and retains a real zero',()=>{
 const rows=[row('2026-09-03',8,{motion:'straighten'}),row('2026-09-03',5,{motion:'straighten'}),row('2026-09-07',0,{motion:'straighten'})];
 const result=maximumMovementTrend(rows,'straighten','',operationDate);
 assert.deepEqual(result.points.map(p=>p.value),[5,0]);assert.equal(result.best.value,0);
 assert.match(movementChart(result.points,'straighten',12),/0° bend remaining/);
});
test('separate knee, patient, assistance, source and method never enter the selected graph',()=>{
 const first=row('2026-09-03',90),key=measurementSeriesKey(first);
 const alternatives=[{side:'right'},{patient_id:'OTHER'},{operation_date:'2026-08-01'},{mode:'assisted'},{position:'seated'},{source:{...base.source,kind:'clinical'}},{version:'endpoint-1'}];
 const result=maximumMovementTrend([first,...alternatives.map(extra=>row('2026-09-07',150,extra))],'bend',key,operationDate);
 assert.equal(result.points.length,1);assert.equal(result.best.value,90);
});
test('without surgery date no invented x coordinates or measurement value is plotted',()=>{
 const result=maximumMovementTrend([row('2026-09-03',90)],'bend','','');assert.deepEqual(result.points,[]);
 const svg=movementChart([],'bend',null);assert.match(svg,/No measurements yet/);assert.doesNotMatch(svg,/NaN|<circle/);
});
