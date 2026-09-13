import test from 'node:test';
import assert from 'node:assert/strict';
import {METRICS,dayNumber,postOpDay,seriesFor,dailyRows,metricSummary,csvText} from '../progress-data.mjs';
import {KOOS_INTERVAL,scoreEntry,saveProm,readProms,scopedProms,promOverview} from '../patient-measures.mjs';
import {analyseExercise} from '../video-analysis/exercises.mjs';
const metric=(exercise,id)=>METRICS[exercise].find(m=>m.id===id);
const make=(date,bend,side='left',exercise='heel_slide')=>({patient_id:'TEST',operation_date:'2026-09-01',exercise,started_at:date,measurement:{side},exercise_analysis:{exercise,ruleVersion:'test',config:{side,minVisibility:.5},metrics:{maximumObservedBend:bend},reps:[]}});
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
test('calendar days handle DST, leap dates and postoperative day zero',()=>{
 assert.equal(postOpDay('2026-03-30','2026-03-28'),2);assert.equal(postOpDay('2026-09-01','2026-09-01'),0);assert.equal(postOpDay('2026-08-31','2026-09-01'),-1);assert.equal(postOpDay('2026-09-01',''),null);assert.equal(dayNumber('2026-02-30'),null);
});
test('daily results preserve recording date, real zero and gaps, selecting latest measurable session',()=>{
 const records=[make('2026-09-02T00:05:00+12:00',0),make('2026-09-02T12:00:00+12:00',null),make('2026-09-04T10:00:00+01:00',95),make('2026-09-04T15:00:00+01:00',90)];
 const rows=dailyRows(records,metric('heel_slide','greatestBend'),'2026-09-02','2026-09-04','2026-09-01');
 assert.deepEqual(rows.map(r=>r.value),[0,null,90]);assert.equal(rows[0].sessions.length,2);assert.equal(rows[1].sessions.length,0);assert.equal(rows[2].day,3);
 assert.equal(metricSummary(records,metric('heel_slide','greatestBend')).best.value,95);
});
test('daily result ranges fail clearly rather than silently truncating',()=>{assert.throws(()=>dailyRows([],metric('heel_slide','greatestBend'),'2020-01-01','2026-09-13',''),/366/);});
test('left, right, threshold, rule, patient and operation are never spliced into one video series',()=>{
 const base=make('2026-09-02T10:00:00Z',80),records=[base,make('2026-09-03T10:00:00Z',90,'right')];
 for(const change of [r=>r.exercise_analysis.config.minVisibility=.3,r=>r.exercise_analysis.ruleVersion='other',r=>r.patient_id='OTHER',r=>r.operation_date='2026-08-01']){const r=structuredClone(base);change(r);records.push(r);}
 assert.equal(seriesFor(records,'heel_slide',metric('heel_slide','greatestBend')).length,6);
});
test('shoulder loss and absent old return endpoints stay missing',()=>{
 const r=make('2026-09-02T10:00:00Z',85);assert.equal(metric('heel_slide','returnBend').get(r),null);assert.equal(metric('heel_slide','consistency').get(r),null);
 r.exercise_analysis.reps=[{maximumKneeBend:90,returnKneeBend:0},{maximumKneeBend:100,returnKneeBend:4}];assert.equal(metric('heel_slide','consistency').get(r),5);assert.equal(metric('heel_slide','returnBend').get(r),2);
});
test('new heel-slide reports retain the actual return endpoint',()=>{
 const samples=Array.from({length:81},(_,i)=>{const t=i/10,bend=t<=1?5:t<=3?5+(t-1)*40:t<=4?85:t<=6?85-(t-4)*40:5;return {t,bend,valid:true,hipFlexion:0,hipAngle:180,visibility:1};});
 const r=analyseExercise(samples,{exercise:'heel_slide',start:0,duration:8,minVisibility:.5});assert.equal(r.reps.length,1);assert.ok(r.reps[0].returnKneeBend<=8);assert.equal(r.metricSchemaVersion,2);
});
test('longer hold is not labelled best; entered target selects closest result',()=>{
 const records=[2,5,10].map((n,i)=>{const r=make(`2026-09-0${i+2}T10:00:00Z`,90,'left','straight_leg_raise');r.exercise_analysis.metrics.meanHold=n;return r;});
 const m=metric('straight_leg_raise','hold');assert.equal(metricSummary(records,m).best,null);
 for(const r of records)r.exercise_analysis.config.targetHold=4;assert.equal(metricSummary(records,m).best.value,5);
 records[1].exercise_analysis.config.targetHold=6;assert.equal(seriesFor(records,'straight_leg_raise',m).length,2);
});
test('patient pain zero survives and missing count is not zero',()=>{
 const r=make('2026-09-02T10:00:00Z',90);r.patient={pain_0_10:0};assert.equal(metric('heel_slide','pain').get(r),0);assert.equal(metric('heel_slide','count').get(r),null);
});
test('automated SLR estimate never enters clinical QAB trend',()=>{
 const r=make('2026-09-02T10:00:00Z',90,'left','straight_leg_raise');r.exercise_analysis.slrAssessment={videoEstimate:2};assert.equal(metricSummary([r],metric('straight_leg_raise','qab')).latest,null);
});
test('KOOS JR official conversion uses nonlinear endpoints and internal values',()=>{
 assert.equal(scoreEntry('koos_jr','raw',0).score,100);assert.equal(scoreEntry('koos_jr','raw',28).score,0);assert.equal(scoreEntry('koos_jr','raw',14).score,52.465);assert.equal(scoreEntry('koos_jr','raw',7).score,68.284);assert.equal(KOOS_INTERVAL.length,29);
 assert.throws(()=>scoreEntry('koos_jr','raw',7.5));assert.throws(()=>scoreEntry('koos_jr','raw',-1));assert.throws(()=>scoreEntry('koos_jr','official',''));assert.throws(()=>scoreEntry('oxford_knee','official',49));assert.throws(()=>scoreEntry('oxford_knee','raw',20));
});
const input={date:'2026-09-03',side:'left',instrument:'koos_jr',mode:'raw',value:14,confirmed:true};
test('dated PROM persists, isolates patient and operation, retains correction history',()=>{
 const storage=memory(),options={patientId:'TEST',operationDate:'2026-09-01',today:'2026-09-13',storage,idFactory:()=> 'fixed-id'};
 const a=saveProm(input,options);assert.equal(a.days_post_op,2);assert.equal(a.score,52.465);assert.equal(readProms(storage).length,1);
 const b=saveProm({...input,id:a.id,value:7},options);assert.equal(b.revisions[0].score,52.465);assert.equal(readProms(storage).length,1);assert.equal(scopedProms(readProms(storage),'OTHER','2026-09-01').length,0);assert.equal(scopedProms(readProms(storage),'TEST','2025-09-01').length,0);
});
test('PROM rejects future date, blank result, missing confirmation and wrong patient edits',()=>{
 const storage=memory(),opts={patientId:'TEST',storage,today:'2026-09-13'};
 assert.throws(()=>saveProm({...input,date:'2026-10-01'},opts));assert.throws(()=>saveProm({...input,value:''},opts));assert.throws(()=>saveProm({...input,confirmed:false},opts));assert.throws(()=>saveProm({...input,id:'other'},opts));assert.equal(readProms(storage).length,0);
});
test('corrupt or full storage never produces a false successful save',()=>{
 const bad={getItem:()=>'{broken',setItem:()=>assert.fail('must not overwrite')};assert.throws(()=>saveProm(input,{patientId:'TEST',storage:bad,today:'2026-09-13'}));
 const full={getItem:()=>null,setItem:()=>{throw Error('Quota exceeded');}};assert.throws(()=>saveProm(input,{patientId:'TEST',storage:full,today:'2026-09-13'}),/Quota/);
});
test('PROM overview separates scales and knees and retains zero',()=>{
 const records=[{instrument:'koos_jr',score:0,side:'left'},{instrument:'oxford_knee',score:40,side:'left'},{instrument:'koos_jr',score:70,side:'right'}];assert.equal(promOverview(records).length,3);assert.equal(promOverview(records)[0].latest.score,0);
});
test('export escapes multiline text and spreadsheet formulas',()=>{const csv=csvText([['=1+1','a"b','two\nlines',null]]);assert.ok(csv.includes("'=1+1"));assert.ok(csv.includes('a""b'));assert.ok(csv.endsWith('""'));});
