import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyseExercise,chooseSide,compactReport} from './exercises.mjs';
import {recoveryContext} from './evidence.mjs';
import {finishRecording} from './live.mjs';
const config={start:0,duration:8,bendTolerance:10,targetLift:null,targetHold:null,targetLower:null};
function kneeCycle(exercise,offset=0){
 return Array.from({length:80},(_,i)=>{
   const t=i/10;const v=t<1?0:t<3?(t-1)/2:t<4?1:t<6?(6-t)/2:0;
   const bend=exercise==='seated_extension'?90-80*v:5+100*v;
   return {t:t+offset,bend,hipFlexion:null,hipAngle:null,valid:false,frameStatus:'partial',rejectionReasons:'shoulder:low_visibility'};
 });
}
for(const exercise of ['seated_extension','heel_slide']){
 test(`${exercise}: correct direction and range with obscured shoulder`,()=>{
   const r=analyseExercise(kneeCycle(exercise),{...config,exercise});
   assert.equal(r.reps.length,1);assert.equal(r.reps[0].score,null);
   assert.equal(r.metrics.hipFlexion,null);assert.equal(r.metrics.repetitionTrackingCoverage,1);
   assert.equal(r.metrics.kneeBend.minimum,exercise==='seated_extension'?10:5);
   assert.equal(r.metrics.kneeBend.maximum,exercise==='seated_extension'?90:105);
   assert.ok(r.reps[0].hold>=1-1e-9);assert.ok(r.reps[0].outwardDuration>1.5);assert.ok(r.reps[0].returnDuration>1.5);
   assert.ok(!r.slrAssessment);assert.equal(r.metrics.visibility,null);
 });
 test(`${exercise}: interrupted cycle is excluded but later cycle survives`,()=>{
   const samples=[...kneeCycle(exercise),...kneeCycle(exercise,8)];samples[25].bend=null;
   const r=analyseExercise(samples,{...config,duration:16,exercise});assert.equal(r.reps.length,1);assert.equal(r.incomplete,1);
 });
 test(`${exercise}: missing timestamps cannot be bridged`,()=>{
   const samples=kneeCycle(exercise).filter(s=>s.t<2||s.t>4);
   assert.equal(analyseExercise(samples,{...config,exercise}).reps.length,0);
 });
 test(`${exercise}: starts in motion without a strict initial hold`,()=>{
   const samples=[...kneeCycle(exercise),...kneeCycle(exercise,8)].filter(s=>s.t>=2.5).map(s=>({...s,t:s.t-2.5}));
   assert.equal(analyseExercise(samples,{...config,duration:13.5,exercise}).reps.length,1);
 });
 test(`${exercise}: no movement and failed tracking never become scores`,()=>{
   const samples=kneeCycle(exercise).map(s=>({...s,bend:null,frameStatus:'rejected'}));
   const r=analyseExercise(samples,{...config,exercise});assert.equal(r.baseline,null);assert.equal(r.reps.length,0);assert.equal(r.metrics.kneeBend,null);
   assert.equal(analyseExercise(kneeCycle(exercise).map(s=>({...s,bend:25})),{...config,exercise}).reps.length,0);
 });
}
test('side selection freezes the most measurable anatomical leg and respects explicit selection',()=>{
 const pairs=[{left:{valid:false,bend:10},right:{valid:true,bend:20}},{left:{valid:false,bend:30},right:{valid:false,bend:null}}];
 assert.equal(chooseSide(pairs,'auto','heel_slide'),'left');assert.equal(chooseSide(pairs,'auto','straight_leg_raise'),'right');assert.equal(chooseSide(pairs,'right','heel_slide'),'right');
});
test('SLR retains existing measurement and provisional grade semantics',()=>{
 const s=kneeCycle('heel_slide').map(p=>({...p,valid:true,bend:4,hipFlexion:(p.bend-5)*.3,hipAngle:180-(p.bend-5)*.3}));
 const r=analyseExercise(s,{...config,exercise:'straight_leg_raise'});assert.equal(r.reps.length,1);assert.equal(r.slrAssessment.videoEstimate,2);assert.equal(r.slrAssessment.videoEstimateValidated,false);
 assert.equal(analyseExercise(s.filter(p=>p.t<2||p.t>4),{...config,exercise:'straight_leg_raise'}).reps.length,0);
});
test('compact report keeps metrics and provenance without frame data',()=>{
 const r=analyseExercise(kneeCycle('heel_slide'),{...config,exercise:'heel_slide'}),c=compactReport(r);
 assert.ok(!('trace' in c));assert.deepEqual(c.metrics,r.metrics);c.config.start=2;assert.equal(r.config.start,0);
});
test('postoperative context is descriptive and does not impute day or a score',()=>{
 assert.equal(recoveryContext('heel_slide',null).daysPostOp,null);assert.equal(recoveryContext('heel_slide',-1).daysPostOp,null);
 const r=recoveryContext('heel_slide',14);assert.equal(r.daysPostOp,14);assert.ok(!('score' in r));assert.match(r.interpretation,/not a deadline/);
 assert.match(recoveryContext('seated_extension').comparison,/do not reproduce/);
});
test('unsupported pending exercises are rejected',()=>assert.throws(()=>analyseExercise([],{...config,exercise:'squat'}),/not supported/));
test('recording waits for the final data event before constructing the Blob',async()=>{
 const chunks=[];class Recorder extends EventTarget {state='recording';mimeType='video/webm';stop(){this.state='inactive';queueMicrotask(()=>{chunks.push(new Blob(['final chunk']));this.dispatchEvent(new Event('stop'));});}}
 const blob=await finishRecording(new Recorder(),chunks);assert.equal(await blob.text(),'final chunk');assert.equal(blob.type,'video/webm');
 assert.equal(await finishRecording(null,[]),null);
});
test('recording finalisation error rejects cleanly',async()=>{
 class Recorder extends EventTarget {state='recording';stop(){queueMicrotask(()=>this.dispatchEvent(new Event('error')));}}
 await assert.rejects(finishRecording(new Recorder(),[]),/finalised/);
});
