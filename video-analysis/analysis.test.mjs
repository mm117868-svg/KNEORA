import {test} from 'node:test';
import assert from 'node:assert/strict';
import {angle,measure,analyse,clinicalQAB,assessPose,slrAssessment} from './analysis.mjs';
const config={start:0,targetLift:25,targetHold:2,targetLower:2,bendTolerance:10};
function sample(){return Array.from({length:100},(_,i)=>{const t=i/10;let lift=0;if(t>=3&&t<4)lift=(t-3)*30;else if(t>=4&&t<6.5)lift=30;else if(t>=6.5&&t<9)lift=(9-t)*12;return {t,valid:true,hipAngle:180-lift,bend:5};});}
test('pixel geometry produces known angles',()=>{assert.equal(angle({x:0,y:0},{x:1,y:0},{x:2,y:0}),180);assert.equal(angle({x:0,y:1},{x:0,y:0},{x:1,y:0}),90);});
test('complete controlled lift meets criteria once',()=>{const r=analyse(sample(),config);assert.equal(r.reps.length,1);assert.equal(r.reps[0].score,4);assert.equal(r.baseline.kneeBend,5);});
test('resting sequence does not count',()=>{assert.equal(analyse(sample().map(s=>({...s,hipAngle:180})),config).reps.length,0);});
test('sustained additional knee bend fails knee control',()=>{const s=sample();s.forEach(p=>{if(p.t>=4&&p.t<=5)p.bend=25;});assert.equal(analyse(s,config).reps[0].checks.kneeControl,false);});
test('single bend outlier does not fail knee control',()=>{const s=sample();s[45].bend=40;assert.equal(analyse(s,config).reps[0].checks.kneeControl,true);});
test('tracking gap aborts repetition',()=>{const s=sample();s[45].valid=false;const r=analyse(s,config);assert.equal(r.reps.length,0);assert.equal(r.incomplete,1);});
test('incomplete final lift has no score',()=>{assert.equal(analyse(sample().slice(0,60),config).reps.length,0);});
test('moving or obscured opening uses reference later in clip',()=>{const s=sample();for(let i=0;i<20;i++)s[i].valid=false;assert.equal(analyse(s,config).reps.length,1);const moving=sample();moving[5].hipAngle=160;assert.equal(analyse(moving,config).reps.length,1);});
test('immediate lift needs no initial pause',()=>{const s=sample().filter(p=>p.t>=3).map(p=>({...p,t:p.t-3}));const r=analyse(s,config);assert.equal(r.reps.length,1);assert.equal(r.reps[0].score,4);});
test('mid-lift opening is skipped and later complete lift is counted',()=>{const s=sample();const combined=[...s,...s.map(p=>({...p,t:p.t+10}))].filter(p=>p.t>=4).map(p=>({...p,t:p.t-4}));assert.equal(analyse(combined,config).reps.length,1);});
test('insufficient tracking still cannot produce a baseline',()=>{const r=analyse(sample().map(s=>({t:s.t,valid:false})),config);assert.equal(r.baseline,null);assert.equal(r.metrics.kneeBend,null);assert.equal(r.metrics.fullyTrackedFrames,0);});
test('isolated high angle outlier does not shift reference',()=>{const s=sample().map(p=>({...p,hipAngle:p.hipAngle-20}));s[50].hipAngle=180;assert.equal(analyse(s,config).baseline.hipAngle,160);});
test('missing and low confidence landmarks rejected',()=>{assert.equal(measure(null,1920,1080,'left'),null);assert.equal(measure(Array.from({length:33},()=>({x:.5,y:.5,visibility:.2})),1920,1080,'left'),null);});
test('repeated cycles counted separately',()=>{const s=sample();const r=analyse([...s,...s.map(p=>({...p,t:p.t+10}))],config);assert.equal(r.reps.length,2);});
test('unachieved hold and range fail independently',()=>{const r=analyse(sample(),{...config,targetLift:50});assert.equal(r.reps[0].checks.range,false);assert.equal(r.reps[0].checks.hold,false);});

test('blank targets produce measurements without a made-up score',()=>{const r=analyse(sample(),{...config,targetLift:null,targetHold:null,targetLower:null});assert.equal(r.reps.length,1);assert.equal(r.reps[0].score,null);assert.equal(r.reps[0].scoreOutOf,0);assert.ok(r.reps[0].hold>2);});
test('one optional target scores only that target and knee control',()=>{const r=analyse(sample(),{...config,targetLift:null,targetLower:null});assert.equal(r.reps[0].scoreOutOf,2);assert.equal(r.reps[0].score,2);});

test('report contains observed metrics without complete repetitions',()=>{const r=analyse(sample().slice(0,60),config);assert.equal(r.reps.length,0);assert.equal(r.metrics.kneeBend.mean,5);assert.equal(r.metrics.hipFlexion.maximum,30);assert.equal(r.metrics.meanHold,null);});
test('isolated measurements survive without a usable baseline',()=>{const r=analyse([{t:0,valid:false,bend:12,hipAngle:null},{t:.1,valid:false,bend:null,hipAngle:150}],config);assert.equal(r.baseline,null);assert.equal(r.metrics.kneeBend.maximum,12);assert.equal(r.metrics.hipFlexion.maximum,30);assert.equal(r.metrics.lift,null);});

test('clinical QAB does not impute missing tests or confuse zero with missing',()=>{assert.equal(clinicalQAB({straightLegRaise:2}).total,null);assert.equal(clinicalQAB({straightLegRaise:0,quadricepsContraction:1,extensionLag:2}).total,3);assert.throws(()=>clinicalQAB({straightLegRaise:3}),/QAB/);});

function pose(){const lm=Array.from({length:33},()=>({x:.1,y:.1,visibility:.95,presence:.99}));for(const [i,x,y] of [[11,.2,.3],[23,.4,.3],[25,.6,.3],[27,.8,.3]])lm[i]={x,y,visibility:.95,presence:.99};return lm;}
test('quality gate accepts visible geometry and rejects no/multiple people',()=>{assert.equal(assessPose([pose()],1000,600,'left').frameStatus,'accepted');assert.equal(assessPose([],1000,600,'left').frameStatus,'rejected');assert.match(assessPose([pose(),pose()],1000,600,'left').rejectionReasons,/multiple_people/);});
test('hidden shoulder preserves knee only and low presence is rejected',()=>{const p=pose();p[11].visibility=.2;let r=assessPose([p],1000,600,'left');assert.equal(r.frameStatus,'partial');assert.equal(r.bend,0);assert.equal(r.hipAngle,null);p[25].presence=.1;r=assessPose([p],1000,600,'left');assert.equal(r.frameStatus,'rejected');assert.match(r.rejectionReasons,/knee:low_presence/);});
test('rejected knee cannot contaminate knee peak while hip remains usable',()=>{const p=pose();p[27].x=2;const q=assessPose([p],1000,600,'left');assert.equal(q.bend,null);assert.equal(q.frameStatus,'partial');const r=analyse([{t:0,...q}],config);assert.equal(r.metrics.kneeBend,null);assert.equal(r.metrics.rejectionCounts['ankle:outside_frame'],1);});

test('lowered visibility default accepts 60 percent, stricter override rejects it',()=>{const p=pose();for(const i of [11,23,25,27])p[i].visibility=.6;assert.equal(assessPose([p],1000,600,'left').frameStatus,'accepted');assert.equal(assessPose([p],1000,600,'left',.7).frameStatus,'rejected');p[25].presence=.1;assert.equal(assessPose([p],1000,600,'left',.3).frameStatus,'rejected');});
test('report records the chosen visibility threshold',()=>{assert.equal(analyse(sample(),{...config,minVisibility:.4}).metrics.qualityRules.minVisibility,.4);assert.throws(()=>assessPose([],1000,600,'left',0),/Visibility threshold/);});

test('SLR estimate withheld with poor tracking and does not confuse no lift with grade zero',()=>{const r=analyse(sample(),config);assert.equal(slrAssessment({...r,coverage:.05}).videoEstimate,null);assert.equal(slrAssessment({...r,reps:[]}).videoEstimate,null);assert.equal(slrAssessment(r).videoEstimate,2);assert.equal(slrAssessment(r,0).clinicalScore,0);});
test('SLR estimate uses observed bend while keeping clinical assessment separate',()=>{const s=sample();s.forEach(p=>{if(p.t>=4&&p.t<=5)p.bend=25;});const r=analyse(s,config),slr=slrAssessment(r);assert.equal(slr.videoEstimate,1);assert.equal(slr.clinicalScore,null);assert.equal(slr.videoEstimateValidated,false);});
