import test from 'node:test';
import assert from 'node:assert/strict';
import {maximumMovementTrend,combinedMovementChart} from '../recovery-trends.mjs';
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
 assert.match(combinedMovementChart({bend:[],straighten:result.points},12),/0° bend remaining/);
});
test('separate knee, patient, assistance, source and method never enter the selected graph',()=>{
 const first=row('2026-09-03',90),key=measurementSeriesKey(first);
 const alternatives=[{side:'right'},{patient_id:'OTHER'},{operation_date:'2026-08-01'},{mode:'assisted'},{position:'seated'},{source:{...base.source,kind:'clinical'}},{version:'endpoint-1'}];
 const result=maximumMovementTrend([first,...alternatives.map(extra=>row('2026-09-07',150,extra))],'bend',key,operationDate);
 assert.equal(result.points.length,1);assert.equal(result.best.value,90);
});
test('without surgery date no invented x coordinates or measurement value is plotted',()=>{
 const result=maximumMovementTrend([row('2026-09-03',90)],'bend','','');assert.deepEqual(result.points,[]);
 const svg=combinedMovementChart({bend:[],straighten:[]},null);assert.match(svg,/No measurements yet/);assert.doesNotMatch(svg,/NaN|<circle/);
});

test('both movements share one set of axes and retain distinct labels and shapes',()=>{
 const svg=combinedMovementChart({bend:[{day:12,date:'2026-09-13',value:90}],straighten:[{day:12,date:'2026-09-13',value:0}]},12);
 assert.equal((svg.match(/<svg/g)||[]).length,1);assert.equal((svg.match(/Days after surgery · surgery = day 0/g)||[]).length,1);
 assert.match(svg,/data-graph-series="bend"/);assert.match(svg,/data-graph-series="straighten"/);assert.match(svg,/Straightening · Day 12/);assert.match(svg,/Bending · Day 12/);assert.match(svg,/0° bend remaining/);assert.doesNotMatch(svg,/NaN/);
});
test('exercise results form a labelled scatter series and repeated sessions stay as separate points',()=>{
 const sessions={bend:[{day:12,date:'2026-09-13',value:90,label:'Heel slides: furthest bend'},{day:12,date:'2026-09-13',value:95,label:'Heel slides: furthest bend'}],straighten:[{day:12,date:'2026-09-13',value:8,label:'Straight leg raise: straightest knee observed'}]};
 const svg=combinedMovementChart({bend:[],straighten:[]},12,sessions);
 assert.match(svg,/Scatter graph/);assert.match(svg,/data-graph-series="exercise-scatter"/);
 assert.equal((svg.match(/Heel slides: furthest bend/g)||[]).length,2);assert.match(svg,/Straight leg raise: straightest knee observed/);
 const centres=[...svg.matchAll(/<circle cx="([\d.]+)"[^>]*><title>Heel slides/g)].map(m=>m[1]);assert.equal(centres.length,2);assert.notEqual(centres[0],centres[1]);
});
test('the vertical axis shows 0 to 150 degrees even with no data or a small early range',()=>{
 for(const bend of [[],[{day:1,date:'2026-09-02',value:30}]]){
  const svg=combinedMovementChart({bend,straighten:[]},1);
  for(const tick of [0,30,60,90,120,150])assert.match(svg,new RegExp(`>${tick}°</text>`));
  assert.match(svg,/Y · Knee bend/);assert.match(svg,/X · Days after surgery/);
 }
 const beyond=combinedMovementChart({bend:[{day:1,date:'2026-09-02',value:160}],straighten:[]},1);assert.match(beyond,/>180°<\/text>/);
});

const upright=svg=>[...svg.matchAll(/<line x1="([0-9.]+)" x2="\1"/g)].length;
test('the grid has an upright line for every day of a short recovery, with the weeks darker',()=>{
 const svg=combinedMovementChart({bend:[{day:8,date:'2026-09-09',value:110}],straighten:[]},8);
 assert.equal(upright(svg),15);                                   // days 0 to 14 inclusive
 assert.equal((svg.match(/stroke-opacity="\.85"/g)||[]).length,3); // days 0, 7 and 14
 assert.doesNotMatch(svg,/NaN/);
});
test('a long recovery widens the day step instead of filling the chart with lines',()=>{
 const svg=combinedMovementChart({bend:[{day:120,date:'2026-12-30',value:130}],straighten:[]},120);
 assert.ok(upright(svg)<=28,`${upright(svg)} upright lines`);assert.doesNotMatch(svg,/NaN/);
});
test('flat lines every ten degrees, labels still only every thirty',()=>{
 const svg=combinedMovementChart({bend:[],straighten:[]},7);
 assert.equal((svg.match(/<line x1="58" x2="474"/g)||[]).length,16);   // 0 to 150 every ten
 assert.equal((svg.match(/°<\/text>/g)||[]).length,6);
});

test('published figures are drawn for context, clipped to the days shown and to the days each paper covers',()=>{
 const svg=combinedMovementChart({bend:[{day:8,date:'2026-09-09',value:110}],straighten:[{day:8,date:'2026-09-09',value:9}]},8);
 assert.match(svg,/data-graph-reference="published"/);
 assert.equal((svg.match(/<polygon/g)||[]).length,1);            // one band, bending only
 assert.match(svg,/stroke-dasharray="6 4"/);                     // the straightening mean, a line not a band
 assert.match(svg,/Context, not a target/);
 assert.doesNotMatch(svg,/NaN/);
});
test('a recovery past the published range keeps one band and invents nothing beyond it',()=>{
 const svg=combinedMovementChart({bend:[{day:200,date:'2027-03-20',value:120}],straighten:[]},200);
 assert.equal((svg.match(/<polygon/g)||[]).length,1);
 assert.match(svg,/by day 90/);                                  // the band stops where Kittelson stops
 assert.doesNotMatch(svg,/NaN/);
});
