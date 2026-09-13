import test from 'node:test';
import assert from 'node:assert/strict';
import {exercisePerformanceMetrics,EXERCISE_EVIDENCE,EXERCISE_SOURCES,renderExerciseEvidenceSummary,renderExerciseEvidenceGuide} from '../exercise-evidence.mjs';
import {normaliseExerciseContext,exerciseContextKey,exerciseContextFacts,mountExerciseContext} from '../exercise-context.mjs';
import {renderDetailedExerciseSummary} from '../exercise-details.mjs';
import {METRICS,seriesFor} from '../progress-data.mjs';
const record=()=>({patient_id:'SOFTWARE TEST',operation_date:'2026-09-01',exercise:'straight_leg_raise',started_at:'2026-09-13T10:00:00Z',patient:{},exercise_analysis:{exercise:'straight_leg_raise',config:{side:'left'},metrics:{},reps:[2,4,6,80].map(n=>({maxAdditionalBend:n,minimumKneeBend:10,maximumKneeBend:n+10,kneeExcursion:n,peakLift:30,returnKneeBend:10}))}});
test('typical extra bend is a true median and does not imply a fully straight knee',()=>{
 const r=record(),m=exercisePerformanceMetrics(r);assert.equal(m.extraBend.median,5);assert.equal(m.extraBend.maximum,80);assert.equal(m.straightening.median,10);
 assert.match(renderExerciseEvidenceSummary(r),/About 5°/);assert.match(renderExerciseEvidenceSummary(r),/About 10°/);assert.match(renderExerciseEvidenceSummary(r),/does not necessarily mean a fully straight knee/);
});
test('wrong exercise and invalid values never become knee metrics, zero remains zero',()=>{
 const r=record();r.exercise_analysis.exercise='heel_slide';assert.equal(exercisePerformanceMetrics(r).extraBend,null);
 r.exercise_analysis.exercise=r.exercise;r.exercise_analysis.reps=[0,null,'2',NaN,Infinity,-1,181].map(n=>({maxAdditionalBend:n}));
 const d=exercisePerformanceMetrics(r).extraBend;assert.equal(d.count,1);assert.equal(d.median,0);assert.equal(d.standardDeviation,null);
});
test('all three summaries retain exercise-specific boundaries and source links',()=>{
 for(const exercise of Object.keys(EXERCISE_EVIDENCE)){
  const r=record();r.exercise=exercise;r.exercise_analysis.exercise=exercise;const html=renderDetailedExerciseSummary(r);
  assert.match(html,/What matters for this exercise/);assert.match(html,/not a validated exercise grade/);assert.match(html,/pubmed.ncbi.nlm.nih.gov/);
  assert.doesNotMatch(html,/undefined|NaN|Infinity/);
  for(const id of EXERCISE_EVIDENCE[exercise].sources)assert.match(EXERCISE_SOURCES[id].url,/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/);
 }
 assert.match(renderExerciseEvidenceGuide(),/not mandatory deadlines/);
});
test('unknown context stays unknown; zero pain is not missing; only explicitly weighted load survives',()=>{
 assert.deepEqual(normaliseExerciseContext(),{assistance:'unknown',resistance:'unknown',load_kg:null,pain_during_0_10:null});
 assert.equal(normaliseExerciseContext({pain_during_0_10:0}).pain_during_0_10,0);
 for(const pain of [-1,11,2.5,'2'])assert.equal(normaliseExerciseContext({pain_during_0_10:pain}).pain_during_0_10,null);
 assert.equal(normaliseExerciseContext({resistance:'band',load_kg:5}).load_kg,null);
 assert.equal(normaliseExerciseContext({resistance:'weight',load_kg:0}).load_kg,null);
 assert.equal(normaliseExerciseContext({resistance:'weight',load_kg:2.5}).load_kg,2.5);
});
test('assistance and load separate movement comparison series, including unknown old records',()=>{
 const base=record(),records=[base];
 for(const context of [{assistance:'none'},{assistance:'person'},{resistance:'weight',load_kg:1},{resistance:'weight',load_kg:2}]){
  const next=structuredClone(base);next.patient.exercise_context=context;records.push(next);
 }
 const metric=METRICS.straight_leg_raise.find(m=>m.id==='typicalExtraBend');
 assert.equal(seriesFor(records,'straight_leg_raise',metric).length,5);assert.equal(metric.get(base),5);
 const after=JSON.parse(JSON.stringify(records[4]));assert.equal(exerciseContextKey(after),exerciseContextKey(records[4]));
 assert.match(exerciseContextFacts(after)[2][1],/2 kg/);
});
function form(){
 const fields=Object.fromEntries(['assistance','resistance','load_kg','pain_during_0_10'].map(key=>[key,{value:'',checkValidity(){return this.value===''||Number(this.value)>0;}}]));
 const weight={hidden:true},status={textContent:''},host={innerHTML:'',querySelector:selector=>selector==='[data-weight]'?weight:selector==='[data-context-status]'?status:fields[selector.match(/"([^"]+)"/)[1]],querySelectorAll:()=>Object.values(fields)};
 return {host,fields,weight,status,change(key,value){fields[key].value=value;fields[key].onchange();}};
}
test('optional answers save with the session, clear stale weights and survive rendering',()=>{
 const r=record(),f=form();let saved;
 mountExerciseContext(f.host,r,()=>saved=JSON.parse(JSON.stringify(r)));
 assert.equal(saved,undefined);assert.equal(f.fields.assistance.value,'unknown');
 f.change('assistance','none');f.change('resistance','weight');assert.equal(f.weight.hidden,false);
 f.change('load_kg','2.5');f.change('pain_during_0_10','0');
 assert.equal(saved.patient.exercise_context.load_kg,2.5);assert.equal(saved.patient.exercise_context.pain_during_0_10,0);
 assert.match(renderDetailedExerciseSummary(saved),/2.5 kg/);assert.match(renderDetailedExerciseSummary(saved),/Worst pain during exercise/);
 f.change('load_kg','-1');assert.match(f.status.textContent,/positive weight/);
 f.change('resistance','none');assert.equal(f.weight.hidden,true);assert.equal(saved.patient.exercise_context.load_kg,null);
});
test('a failed persistence callback does not announce successful saving',()=>{
 const f=form();mountExerciseContext(f.host,record(),()=>{throw Error('Storage full');});f.change('pain_during_0_10','3');
 assert.match(f.status.textContent,/could not be saved/);assert.doesNotMatch(f.status.textContent,/Saved with/);
});
