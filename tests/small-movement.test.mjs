import test from 'node:test';
import assert from 'node:assert/strict';
import {LegMotionGate} from '../pose-gate.js';
import {SwingCounter} from '../kneetrack.js';
import {analyseExercise} from '../video-analysis/exercises.mjs';
import {videoRepetitionCount} from '../measurement-quality.mjs';
function pose(degrees=0,seated=false,jitter=0){
 const a=degrees*Math.PI/180,p=Array(33),hip={x:.3,y:.5},knee={x:.5,y:.5},ankle=seated?{x:.5+.2*Math.sin(a),y:.5+.2*Math.cos(a)}:{x:.3+.4*Math.cos(a),y:.5-.4*Math.sin(a)};
 if(!seated){knee.x=.3+.2*Math.cos(a);knee.y=.5-.2*Math.sin(a);}
 for(const [i,q] of [[23,hip],[25,knee],[27,ankle]])p[i]={...q,y:q.y+(i===23?0:jitter),visibility:1,presence:1};return p;
}
for(const seated of [false,true])test(`small mode confirms a constructed two-degree ${seated?'extension':'lift'} and return`,()=>{
 const g=new LegMotionGate(seated?'seated_extension':'straight_leg_raise','left','knee_tracker',{smallMovement:true});
 for(let i=0;i<=26;i++)g.observe(pose(0,seated),i*.05,1000,1000);
 assert.ok(g.reference);
 for(let i=0;i<=80;i++){const t=1.5+i*.05;g.observe(pose(2*Math.sin(Math.PI*i/80),seated),t,1000,1000);if(i===40)g.candidate(t);}
 for(let i=0;i<10;i++)g.observe(pose(0,seated),5.55+i*.05,1000,1000);
 assert.equal(g.reps,1);assert.equal(g.summary().small_movement,true);
});
test('resting landmark jitter raises the threshold and cannot become tiny repetitions',()=>{
 const g=new LegMotionGate('straight_leg_raise','left','knee_tracker',{smallMovement:true});
 for(let i=0;i<100;i++){g.observe(pose(0,false,.004*Math.sin(i*1.7)),i*.05,1000,1000);if(i>30&&i%10===0)g.candidate(i*.05);}
 assert.equal(g.reps,0);assert.equal(g.summary().count_status,'unavailable');assert.ok(g.summary().motion_thresholds.noise>0);
});
for(const direction of [-1,1])test(`finer optical swing counter detects a first small cycle in direction ${direction}`,()=>{
 const c=new SwingCounter(30,.35,{orientFromStart:true});for(let i=0;i<60;i++)c.update(.02*Math.sin(i),i/30);assert.equal(c.reps,0);
 for(let i=0;i<180;i++)c.update(direction*1.5*Math.sin(Math.PI*i/180),2+i/30);assert.equal(c.reps,1);
});
function samples(exercise,noise=0){return Array.from({length:90},(_,i)=>{
 const t=i/10,v=t<2?0:t<4?(t-2)/2:t<5?1:t<7?(7-t)/2:0,offset=noise*Math.sin(i*1.7);
 return {t,valid:true,frameStatus:'accepted',bend:exercise==='seated_extension'?90-2*v+offset:exercise==='heel_slide'?10+2*v+offset:5,hipAngle:180-2*v+offset,hipFlexion:2*v-offset};
});}
for(const exercise of ['straight_leg_raise','seated_extension','heel_slide'])test(`video small mode detects two-degree ${exercise} attempts above quiet baseline`,()=>{
 const r=analyseExercise(samples(exercise),{exercise,start:0,duration:9,bendTolerance:10,smallMovement:true});assert.equal(r.reps.length,1);assert.ok(r.config.cycleSensitivity.minimumExcursion<2);
 if(exercise==='straight_leg_raise')assert.equal(r.slrAssessment.videoEstimate,null);
 const noisy=analyseExercise(samples(exercise,1.2),{exercise,start:0,duration:9,bendTolerance:10,smallMovement:true});assert.equal(noisy.reps.length,0);assert.equal(videoRepetitionCount(noisy),null);
});
