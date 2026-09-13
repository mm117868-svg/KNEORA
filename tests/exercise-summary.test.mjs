import test from 'node:test';
import assert from 'node:assert/strict';
import {basicExerciseSummary,renderBasicExerciseSummary,timeWords} from '../exercise-summary.mjs';
import {mountExerciseAnalysis} from '../video-analysis/live.mjs';
const record=(exercise='heel_slide')=>({patient_id:'TEST',operation_date:'2026-09-01',started_at:'2026-09-13T10:00:00+01:00',exercise,count_source:'monitoring',duration_s:90,monitoring:{repetitions:10,tempo_s_per_rep:5},measurement:{side:'left',peak_flexion_deg:95,min_extension_deg:5},patient:{pain_0_10:null}});
const report=(r,overrides={})=>({...r,exercise_analysis:{exercise:r.exercise,config:{side:'left',minVisibility:.5},reps:[{maxAdditionalBend:7,peakLift:32,kneeExcursion:80,maximumKneeBend:95,returnKneeBend:5},{maxAdditionalBend:5,peakLift:30,kneeExcursion:78,maximumKneeBend:93,returnKneeBend:3}],metrics:{repetitionTrackingCoverage:1,maximumObservedBend:95,bestObservedStraightening:5,hipFlexion:{maximum:35},meanCycleDuration:6,meanOutwardDuration:2,meanHold:1,meanReturnDuration:3,analysedDuration:90,...overrides}}});
test('summary uses recorded postoperative date, real time, live count and matching counter tempo',()=>{
 const s=basicExerciseSummary(record());assert.equal(s.day,12);assert.equal(s.duration,'1 min 30 sec');assert.equal(s.count,10);assert.equal(s.tempo,5);assert.equal(s.cadence,12);assert.equal(s.movement[0].value,'About 95°');
});
test('spoken count cannot inherit unrelated background camera tempo',()=>{
 const r=record();r.count_source='patient_voice';r.patient_count={repetitions:8};const s=basicExerciseSummary(r);assert.equal(s.count,8);assert.equal(s.tempo,null);assert.equal(s.cadence,null);assert.equal(s.countNote,'Your spoken count');
});
test('one live count does not yield invented pace, zero and missing remain distinct',()=>{
 const r=record();r.monitoring.repetitions=1;assert.equal(basicExerciseSummary(r).tempo,null);r.monitoring.repetitions=0;assert.equal(basicExerciseSummary(r).count,0);delete r.monitoring;assert.equal(basicExerciseSummary(r).count,null);assert.equal(timeWords(null),'Not recorded');assert.equal(timeWords(0),'0 sec');assert.equal(timeWords(59.7),'1 min');
});
test('SLR summary shows knee control, hip bend and lift rather than treating knee bend as lift height',()=>{
 const r=report(record('straight_leg_raise')),s=basicExerciseSummary(r);assert.equal(s.count,2);assert.match(s.countNote,/Live camera count: 10/);assert.equal(s.cadence,10);assert.match(s.movement[0].value,/7° extra bend/);assert.equal(s.movement[1].value,'About 35°');assert.match(s.movement[2].value,/32° above/);assert.equal(s.stages,'Lift: 2 sec · Hold: 1 sec · Lower: 3 sec');
 const live=basicExerciseSummary(record('straight_leg_raise'));assert.equal(live.movement[1].value,'Not measured');assert.equal(live.movement[2].value,'Not measured');
});
test('seated extension preserves straightening meaning and does not call it clinical lag',()=>{
 const s=basicExerciseSummary(report(record('seated_extension')));assert.equal(s.movement[0].value,'About 5° of bend remaining');assert.equal(s.movement[1].value,'About 80°');assert.match(s.quality,/hands-on check/);assert.match(s.stages,/Straighten: 2 sec/);
});
test('heel slides show true return endpoint and plain repetition consistency',()=>{
 const s=basicExerciseSummary(report(record()));assert.equal(s.movement[1].value,'About 4° of bend remaining, on average');assert.equal(s.movement[3].value,'Your deepest bends ranged from 93° to 95°');
 const old=report(record());old.exercise_analysis.reps.forEach(p=>delete p.returnKneeBend);assert.equal(basicExerciseSummary(old).movement[1].value,'Not measured');
});
test('failed video tracking does not claim zero performed repetitions or derive video tempo',()=>{
 const r=report(record(),{repetitionTrackingCoverage:0});r.exercise_analysis.reps=[];const s=basicExerciseSummary(r);assert.equal(s.count,10);assert.match(s.countNote,/video count unavailable/);assert.equal(s.tempo,null);assert.match(s.quality,/did not capture enough clear movement/);
});
test('partial analysis is labelled and total session time is not shortened',()=>{
 const r=report(record(),{analysedDuration:40});r.exercise_analysis.config.start=50;const s=basicExerciseSummary(r);assert.equal(s.duration,'1 min 30 sec');assert.match(s.countNote,/analysed part/);assert.match(s.quality,/40 sec/);
});
test('personal comparison is limited to compatible earlier measurements and never called a recovery grade',()=>{
 const earlier=report(record(),{maximumObservedBend:85});earlier.started_at='2026-09-12T10:00:00+01:00';
 const now=report(record());assert.match(basicExerciseSummary(now,[earlier]).comparison,/10° more/);
 earlier.exercise_analysis.config.side='right';assert.equal(basicExerciseSummary(now,[earlier]).comparison,null);
 earlier.exercise_analysis.config.side='left';earlier.exercise_analysis.config.minVisibility=.8;assert.equal(basicExerciseSummary(now,[earlier]).comparison,null);
});
test('reported zero pain is displayed and HTML escapes record text',()=>{
 const r=record();r.patient.pain_0_10=0;r.patient.difficulty_1_5=2;r.measurement.side='<script>bad</script>';
 assert.equal(basicExerciseSummary(r).symptoms,'Pain afterwards: 0/10 · Effort: 2/5');const html=renderBasicExerciseSummary(r);assert.ok(!html.includes('<script>bad'));assert.ok(html.includes('&lt;script&gt;'));
});
function fakePage(){
 const elements=[],listeners=new Map(),heading={focused:false,focus(){this.focused=true;}};
 class Element {constructor(tag){this.tag=tag;this.children=[];this.contentWindow={postMessage:payload=>this.sent=payload};elements.push(this);}append(...children){this.children.push(...children);}setAttribute(){}showModal(){this.open=true;}close(){this.open=false;}remove(){this.removed=true;}}
 const original={document:globalThis.document,window:globalThis.window,location:globalThis.location};
 globalThis.document={createElement:tag=>new Element(tag),body:new Element('body'),querySelector:()=>heading};globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};globalThis.location={origin:'http://localhost:8767'};
 return {elements,heading,host:new Element('host'),send:data=>listeners.get('message')?.(data),restore:()=>Object.assign(globalThis,original)};
}
test('first completed analysis returns to the simple summary, later detailed reanalysis stays open',()=>{
 const page=fakePage();try{
  let saved=0;const dispose=mountExerciseAnalysis(page.host,{blob:new Blob(['fixture']),metadata:{exercise:'heel_slide'},returnToSummary:true,onReport:()=>saved++});
  const button=page.elements.find(e=>e.textContent==='Analyse exercise');button.onclick();const dialog=page.elements.find(e=>e.tag==='dialog'),iframe=page.elements.find(e=>e.tag==='iframe');
  page.send({origin:location.origin,source:iframe.contentWindow,data:{type:'exercise-analysis-ready'}});const complete={type:'exercise-analysis-complete',token:iframe.sent.token,report:report(record()).exercise_analysis};
  page.send({origin:'https://other.invalid',source:iframe.contentWindow,data:complete});assert.equal(saved,0);assert.equal(dialog.open,true);
  page.send({origin:location.origin,source:iframe.contentWindow,data:complete});assert.equal(saved,1);assert.equal(dialog.open,false);assert.equal(page.heading.focused,true);assert.equal(button.textContent,'Open full video report');
  button.onclick();page.send({origin:location.origin,source:iframe.contentWindow,data:complete});assert.equal(saved,2);assert.equal(dialog.open,true);
  dispose();assert.equal(dialog.removed,true);
 }finally{page.restore();}
});
