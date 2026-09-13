import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPTURE_RULES,RECOVERY_KEY,kneeFrame,kneeAngle3D,summariseEndpoint,saveMeasurement,readMeasurements,scopedMeasurements,endpointOverview,measurementSeriesKey,depthImport,compareSources} from '../recovery-measurements.mjs';
import {recoveryExerciseContext} from '../recovery-summary.mjs';
import {createEndpointCamera,cameraMessage} from '../recovery-camera.mjs';
const frames=(n=90)=>Array.from({length:12},(_,i)=>({angle:n+i%2,time_ms:i*100}));
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
const base={date:'2026-09-13',side:'left',motion:'bend',mode:'active',position:'supine',confirmed:true,source:{kind:'mediapipe_2d',device:'full model',method:'endpoint'},captured_at:'2026-09-13T10:00:00Z',capture_group:'same-hold',frames:frames()};
const options=()=>({patientId:'TEST',operationDate:'2026-09-01',today:'2026-09-13',storage:memory(),idFactory:(()=>{let id=0;return ()=>String(++id);})()});
function pose(){const lm=Array(33).fill(null);for(const [id,x,y] of [[23,.2,.5],[25,.5,.5],[27,.5,.8]])lm[id]={x,y,visibility:.99,presence:.99};return lm;}
test('dedicated knee geometry uses image aspect ratio and does not require a shoulder',()=>{
 assert.equal(kneeFrame([pose()],1000,500,'left').angle,90);const p=pose();p[27]={x:.8,y:.8,visibility:.99};const r=kneeFrame([p],1000,500,'left');assert.ok(Math.abs(r.angle-26.565)<.001);assert.equal(kneeFrame([p],1000,500,'auto').angle,null);
});
test('occluded joints, offscreen joints and multiple people are rejected',()=>{
 const p=pose();p[25].visibility=.1;assert.equal(kneeFrame([p],1000,500,'left').angle,null);p[25].visibility=.99;p[27].x=1.1;assert.equal(kneeFrame([p],1000,500,'left').angle,null);assert.equal(kneeFrame([pose(),pose()],1000,500,'left').angle,null);
});
test('endpoint averaging excludes failed frames, preserves zero and exposes spread',()=>{
 const r=summariseEndpoint([...frames(0),{angle:null}]);assert.equal(r.mean,.5);assert.equal(r.accepted,12);assert.equal(r.sampled,13);assert.equal(r.minimum,0);assert.equal(r.maximum,1);assert.equal(r.sd,.5);assert.equal(r.frames.at(-1).angle,null);
});
test('short, poorly tracked and moving sequences do not produce a saved endpoint',()=>{
 assert.throws(()=>summariseEndpoint(frames().slice(0,4)),/Not enough/);assert.throws(()=>summariseEndpoint([...frames(),...Array(20).fill({angle:null})]),/Too much/);assert.throws(()=>summariseEndpoint([...frames(),{angle:130}]),/changed too much/);assert.throws(()=>summariseEndpoint(Array(601).fill({angle:90})),/600/);
});
test('3D angle is translation and scale invariant and rejects degenerate joints',()=>{
 assert.equal(kneeAngle3D([0,.4,0],[0,0,0],[.4,0,0]),90);assert.equal(kneeAngle3D([5,9,5],[5,5,5],[9,5,5]),90);assert.equal(kneeAngle3D([0,.4,0],[0,0,0],[0,-.4,0]),0);assert.equal(kneeAngle3D([0,0,0],[0,0,0],[1,0,0]),null);assert.equal(kneeAngle3D([0,'1',0],[0,0,0],[1,0,0]),null);
});
test('dedicated measurements retain provenance, confirmation and operation day',()=>{
 const opts=options(),r=saveMeasurement(base,opts);assert.equal(r.value,90.5);assert.equal(r.days_post_op,12);assert.equal(r.patient_confirmed_limit,true);assert.equal(r.source.kind,'mediapipe_2d');assert.equal(readMeasurements(opts.storage).length,1);
 assert.equal(scopedMeasurements([r],'OTHER',opts.operationDate).length,0);assert.equal(scopedMeasurements([r],'TEST','2026-08-01').length,0);assert.equal(scopedMeasurements([r],'TEST',opts.operationDate,'right').length,0);assert.equal(scopedMeasurements([r],'TEST',opts.operationDate,'left','2026-09-12').length,0);
});
test('missing confirmation, future or malformed date and missing knee are rejected',()=>{
 const opts=options();for(const x of [{confirmed:false},{confirmed:'true'},{date:'2026-09-14'},{date:'2026-02-30'},{side:'auto'},{mode:'unknown'}])assert.throws(()=>saveMeasurement({...base,...x},opts));assert.equal(readMeasurements(opts.storage).length,0);
});
test('clinical zero is retained and blank, unsupported angle and missing method fail',()=>{
 const opts=options(),input={...base,motion:'straighten',source:{kind:'clinical',device:'Goniometer'},value:0};assert.equal(saveMeasurement(input,opts).value,0);for(const x of [{value:''},{value:null},{value:-5},{source:{kind:'clinical'}}])assert.throws(()=>saveMeasurement({...input,...x},opts));
});
test('corrupt or full storage cannot report successful saving or erase existing data',()=>{
 const opts=options();opts.storage.setItem(RECOVERY_KEY,'{broken');assert.throws(()=>saveMeasurement(base,opts),/could not be read/);assert.equal(opts.storage.getItem(RECOVERY_KEY),'{broken');opts.storage={getItem:()=>null,setItem:()=>{throw Error('Quota exceeded');}};assert.throws(()=>saveMeasurement(base,opts),/Quota/);
});
test('endpoints compare only matching device, method, side, assistance and position',()=>{
 const opts=options(),first=saveMeasurement({...base,date:'2026-09-12',frames:frames(80)},opts),second=saveMeasurement(base,opts);assert.equal(endpointOverview([first,second],'bend').change,10);
 for(const x of [{side:'right'},{mode:'assisted'},{position:'seated'},{source:{...base.source,kind:'depth_3d',calibration:'cal',device:'3D'}},{source:{...base.source,device:'lite'}}]){const r=saveMeasurement({...base,...x},opts);assert.notEqual(measurementSeriesKey(r),measurementSeriesKey(first));assert.equal(endpointOverview([first,r],'bend').change,null);}
});
function depth(context){return {schema:'knee-depth-endpoint-v1',...context,units:'m',captured_at:'2026-09-13T10:00:00.500Z',capture_group:'same-hold',source:{kind:'depth_3d',coordinates:'depth-derived-joint-centres',device:'TEST depth camera',calibration:'TEST calibration'},frames:Array.from({length:12},(_,i)=>({time_ms:i*100,valid:true,hip:[0,.4,2],knee:[0,0,2],ankle:[.4,0,2]}))};}
const context={patient_id:'TEST',operation_date:'2026-09-01',date:base.date,side:base.side,motion:base.motion,mode:base.mode,position:base.position};
test('depth import computes actual XYZ angles with metre or millimetre units',()=>{
 const data=depth(context);assert.equal(depthImport(data,context).summary.mean,90);data.units='mm';data.frames.forEach(f=>['hip','knee','ankle'].forEach(k=>f[k]=f[k].map(v=>v*1000)));assert.equal(depthImport(data,context).summary.mean,90);
});
test('depth import rejects wrong identity, assistance, predicted depth and missing calibration',()=>{
 for(const x of [{patient_id:'OTHER'},{side:'right'},{mode:'assisted'},{units:'cm'},{captured_at:null},{source:{kind:'mediapipe_3d'}},{source:{...depth(context).source,calibration:''}}])assert.throws(()=>depthImport({...depth(context),...x},context));const data=depth(context);data.frames.forEach(f=>f.valid=false);assert.throws(()=>depthImport(data,context),/Not enough/);
});
test('paired averages need two real source types and a matching confirmed capture',()=>{
 const opts=options(),a=saveMeasurement(base,opts),b=saveMeasurement({...base,...depthImport(depth(context),context)},opts),r=compareSources(a,b,true);assert.equal(r.available,true);assert.equal(r.mean,90.25);assert.equal(r.difference,.5);assert.equal(compareSources(a,b).available,false);assert.equal(compareSources(a,a,true).available,false);for(const x of [{capture_group:'other'},{captured_at:null},{captured_at:'2026-09-13T10:01:00Z'},{position:'seated'},{date:'2026-09-12'}])assert.equal(compareSources(a,{...b,...x},true).available,false);
});
test('exercise participation is scoped and is not extrapolated into strength or maximum range',()=>{
 const rec={patient_id:'TEST',operation_date:'2026-09-01',started_at:'2026-09-13T10:00:00',exercise:'straight_leg_raise',measurement:{side:'left'},patient:{pain_0_10:0,difficulty_1_5:2},exercise_analysis:{exercise:'straight_leg_raise',config:{side:'left'},reps:[{maxAdditionalBend:3}]}};
 const ctx=recoveryExerciseContext([rec,{...rec,patient_id:'OTHER'},{...rec,measurement:{side:'right'},exercise_analysis:null},{...rec,started_at:'2026-09-14T10:00:00'}],{patientId:'TEST',operationDate:'2026-09-01',side:'left',asOf:'2026-09-13'});assert.equal(ctx.days,1);assert.equal(ctx.recent.length,1);assert.equal(ctx.extraBend,3);assert.equal(ctx.symptoms.patient.pain_0_10,0);assert.equal(ctx.strength,undefined);assert.equal(ctx.maximumRange,undefined);
});
test('camera permission message explains recovery without presenting a measurement',()=>{assert.match(cameraMessage({name:'NotAllowedError'}),/Privacy & Security/);assert.match(cameraMessage({name:'NotFoundError'}),/No camera/);});
test('camera denial can be retried and a late stream is stopped after cancellation',async t=>{
 const old=globalThis.cancelAnimationFrame;globalThis.cancelAnimationFrame=()=>{};t.after(()=>{if(old)globalThis.cancelAnimationFrame=old;else delete globalThis.cancelAnimationFrame;});
 let resolve,stopped=0,attempts=0;const messages=[],ready=[];
 const camera=createEndpointCamera({video:{srcObject:null},canvas:{getContext:()=>({})},onStatus:s=>messages.push(s),onReady:r=>ready.push(r),getStream:async()=>{attempts++;if(attempts===1)throw Object.assign(Error('Denied'),{name:'NotAllowedError'});return await new Promise(r=>resolve=r);}});
 await camera.start('left');assert.match(messages.at(-1),/blocked/);const pending=camera.start('left');camera.stop();resolve({getTracks:()=>[{stop:()=>stopped++}]});await pending;assert.equal(stopped,1);assert.equal(ready.at(-1),false);
});
test('live endpoint capture measures unique frames and cancellation discards incomplete capture',async t=>{
 const oldRaf=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;let nextFrame;
 globalThis.requestAnimationFrame=cb=>{nextFrame=cb;return 1;};globalThis.cancelAnimationFrame=()=>{};
 t.after(()=>{if(oldRaf)globalThis.requestAnimationFrame=oldRaf;else delete globalThis.requestAnimationFrame;if(oldCancel)globalThis.cancelAnimationFrame=oldCancel;else delete globalThis.cancelAnimationFrame;});
 t.mock.timers.enable({apis:['setTimeout']});let stopped=0,closed=0;const results=[];
 const video={srcObject:null,readyState:2,currentTime:0,videoWidth:1000,videoHeight:500,play:async()=>{}};
 const ctx={drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};
 const camera=createEndpointCamera({video,canvas:{getContext:()=>ctx},onResult:r=>results.push(r),getStream:async()=>({getTracks:()=>[{stop:()=>stopped++}]}),handLoader:async()=>null,modelLoader:async()=>({model:'TEST model',landmarker:{setOptions:async()=>{},detect:()=>({landmarks:[pose()]}),close:()=>closed++}})});
 await camera.start('left');assert.equal(camera.capture(),true);for(let i=0;i<20;i++){video.currentTime+=.1;nextFrame(100+i*100);}t.mock.timers.tick(2000);assert.equal(results.length,1);assert.equal(results[0].summary.mean,90);assert.equal(results[0].summary.accepted,10);assert.equal(results[0].source.kind,'mediapipe_2d');
 camera.capture();camera.stop();t.mock.timers.tick(2000);assert.equal(results.length,1);assert.equal(stopped,1);assert.equal(closed,1);
});
