import test from 'node:test';
import assert from 'node:assert/strict';
import {EndpointGesture} from '../endpoint-gesture.mjs';
import {createEndpointCamera} from '../recovery-camera.mjs';

test('a sustained open palm triggers once, then needs a release and fresh hold',()=>{
 const gate=new EndpointGesture();let fired=0;
 for(let t=0;t<=5000;t+=100)fired+=gate.update('open',t,t/1000).trigger;
 assert.equal(fired,1);
 for(let t=5100;t<=5600;t+=100)assert.equal(gate.update('absent',t,t/1000).trigger,false);
 for(let t=5700;t<=7700;t+=100)fired+=gate.update('open',t,t/1000).trigger;
 assert.equal(fired,2);
});
test('unknown, interrupted, stale and repeated samples cannot complete a gesture',()=>{
 for(const interrupt of ['unknown','other','absent']){
  const gate=new EndpointGesture();for(let t=0;t<=1500;t+=100)assert.equal(gate.update('open',t,t/1000).trigger,false);
  gate.update(interrupt,1600,1.6);for(let t=1700;t<=3500;t+=100)assert.equal(gate.update('open',t,t/1000).trigger,false);
 }
 const stale=new EndpointGesture();stale.update('open',0,0);assert.equal(stale.update('open',2500,2.5).trigger,false);
 const frozen=new EndpointGesture();for(let t=0;t<4000;t+=100)assert.equal(frozen.update('open',t,0).trigger,false);
 const missing=new EndpointGesture();missing.disarm();for(let t=0;t<=2000;t+=100)missing.update('unknown',t,t/1000);assert.equal(missing.armed,false);
});

function setup(t,{missingKnee=false,handFailure=false}={}){
 let callback,hand='open',time=0,closed=0,stopped=0;
 const originalRAF=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame;
 globalThis.requestAnimationFrame=fn=>{callback=fn;return 1;};globalThis.cancelAnimationFrame=()=>{};
 t.after(()=>{globalThis.requestAnimationFrame=originalRAF;globalThis.cancelAnimationFrame=originalCancel;});
 t.mock.timers.enable({apis:['setTimeout']});
 const status=[],results=[],starts=[],ready=[];
 const video={srcObject:null,readyState:2,currentTime:0,videoWidth:1000,videoHeight:500,play:async()=>{}};
 const ctx={drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};
 const landmarks=Array.from({length:33},()=>null);
 // Distinct knees confirm the camera keeps the operated side throughout capture.
 for(const [id,x,y] of [[23,.2,.5],[25,.5,.5],[27,.5,.8],[24,.2,.4],[26,.4,.4],[28,.6,.4]])landmarks[id]={x,y,visibility:.99,presence:.99};
 const camera=createEndpointCamera({video,canvas:{getContext:()=>ctx},onStatus:s=>status.push(s),onReady:r=>ready.push(r),onCaptureStart:s=>starts.push(s),onResult:r=>results.push(r),
  getStream:async()=>({getTracks:()=>[{stop:()=>stopped++}]}),
  modelLoader:async options=>{assert.equal(options.variant,'heavy');assert.equal(options.runningMode,'IMAGE');return {model:'TEST pose',landmarker:{setOptions:async()=>{},detect:()=>({landmarks:missingKnee?[]:[landmarks]}),detectForVideo:()=>assert.fail('Endpoint pictures must use IMAGE detection'),close:()=>closed++}};},
  handLoader:async()=>{if(handFailure)throw Error('Missing model');return {close:()=>closed++,recognizeForVideo:()=>({landmarks:hand==='absent'?[]:[Array.from({length:21},()=>({x:.2,y:.2}))],gestures:hand==='absent'?[]:[[{categoryName:hand==='open'?'Open_Palm':'Closed_Fist',score:.9}]]})};}
 });
 return {camera,status,results,starts,ready,video,setHand:v=>hand=v,closed:()=>closed,stopped:()=>stopped,
  frames:n=>{for(let i=0;i<n;i++){time+=100;video.currentTime=time/1000;callback(time);}}};
}
test('open palm captures an averaged burst without a button and never repeats while held',async t=>{
 const h=setup(t);await h.camera.start('right');h.frames(21);assert.equal(h.starts.length,1);assert.equal(h.starts[0].trigger,'open_palm');
 assert.equal(h.camera.capture(),false);h.frames(12);t.mock.timers.tick(1999);assert.equal(h.results.length,0);t.mock.timers.tick(1);
 assert.equal(h.results.length,1);assert.equal(h.results[0].summary.mean,0);assert.equal(h.results[0].summary.accepted,12);
 h.frames(40);assert.equal(h.starts.length,1);
 h.setHand('absent');h.frames(6);h.setHand('open');h.frames(21);assert.equal(h.starts.length,2);
 h.camera.stop();t.mock.timers.tick(2000);assert.equal(h.results.length,1);assert.equal(h.closed(),2);assert.equal(h.stopped(),1);
});
test('button capture uses the same sequence and works without the hand model',async t=>{
 const h=setup(t,{handFailure:true});await h.camera.start('left');assert.equal(h.ready.at(-1),true);assert.match(h.status.at(-1),/unavailable/);
 assert.equal(h.camera.capture(),true);assert.equal(h.starts[0].trigger,'button');h.frames(12);t.mock.timers.tick(2000);
 assert.equal(h.results[0].summary.mean,90);h.camera.stop();
});
test('hand recognition never substitutes for missing knee landmarks',async t=>{
 const h=setup(t,{missingKnee:true});await h.camera.start('right');h.frames(21);assert.equal(h.starts.length,1);h.frames(12);t.mock.timers.tick(2000);
 assert.equal(h.results[0],null);assert.match(h.status.at(-1),/Not enough clear frames/);h.camera.stop();
});
test('frozen video and cancelled camera cannot produce a capture',async t=>{
 const h=setup(t);await h.camera.start('left');h.frames(10);h.video.readyState=1;h.frames(40);assert.equal(h.starts.length,0);
 h.camera.stop();h.frames(25);assert.equal(h.starts.length,0);
});
