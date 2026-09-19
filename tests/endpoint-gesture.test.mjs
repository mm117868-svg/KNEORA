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
 const landmarks=Array.from({length:33},()=>({x:.5,y:.5,visibility:0,presence:0}));
 // Distinct knees confirm the camera keeps the operated side throughout capture.
 for(const [id,x,y] of [[23,.2,.5],[25,.5,.5],[27,.5,.8],[24,.2,.4],[26,.4,.4],[28,.6,.4]])landmarks[id]={x,y,visibility:.99,presence:.99};
 // The right arm: shoulder, hip and a wrist that is either held high or resting by the hip.
 landmarks[12]={x:.25,y:.2,visibility:.95};landmarks[11]={x:.26,y:.2,visibility:.4};
 const body=()=>{const lm=landmarks.map(p=>({...p}));lm[16]=hand==='wave'?{x:.3+.06*Math.sin(2*Math.PI*1.5*time/1000),y:.14,visibility:.95}:{x:.3,y:hand==='open'?.0:.42,visibility:hand==='absent'?0:.95};   // a wave: a little above the shoulder, side to side
 lm[14]={x:.28,y:hand==='open'?.1:.32,visibility:.9};if(missingKnee)lm[25].visibility=lm[26].visibility=0;return lm;};
 const camera=createEndpointCamera({video,canvas:{getContext:()=>ctx},onStatus:s=>status.push(s),onReady:r=>ready.push(r),onCaptureStart:s=>starts.push(s),onResult:r=>results.push(r),
  getStream:async()=>({getTracks:()=>[{stop:()=>stopped++}]}),
  modelLoader:async options=>{assert.equal(options.variant,'heavy');assert.equal(options.runningMode,'IMAGE');return {model:'TEST pose',landmarker:{setOptions:async()=>{},detect:()=>({landmarks:[body()]}),detectForVideo:()=>assert.fail('Endpoint pictures must use IMAGE detection'),close:()=>closed++}};},
 });
 return {camera,status,results,starts,ready,video,setHand:v=>hand=v,closed:()=>closed,stopped:()=>stopped,
  frames:n=>{for(let i=0;i<n;i++){time+=100;video.currentTime=time/1000;callback(time);}}};
}
test('a raised hand captures an averaged burst without a button and never repeats while held',async t=>{
 const h=setup(t);await h.camera.start('right');h.frames(21);assert.equal(h.starts.length,1);assert.equal(h.starts[0].trigger,'raised_hand');
 assert.equal(h.camera.capture(),false);h.frames(60);t.mock.timers.tick(5999);assert.equal(h.results.length,0);t.mock.timers.tick(1);
 assert.equal(h.results.length,1);assert.equal(h.results[0].summary.mean,0);assert.equal(h.results[0].summary.accepted,10);
 h.frames(40);assert.equal(h.starts.length,1);
 h.setHand('absent');h.frames(6);h.setHand('open');h.frames(21);assert.equal(h.starts.length,2);
 h.camera.stop();t.mock.timers.tick(6000);assert.equal(h.results.length,1);assert.equal(h.closed(),1);assert.equal(h.stopped(),1);
});
test('a wave captures too, within two seconds of starting it, once the hand has been seen down',async t=>{
 const h=setup(t);h.setHand('absent');await h.camera.start('right');h.frames(8);h.setHand('wave');h.frames(20);assert.equal(h.starts.length,1);assert.equal(h.starts[0].trigger,'wave');
});
test('a wave made before the hand has ever been seen down captures nothing',async t=>{
 const h=setup(t);h.setHand('wave');await h.camera.start('right');h.frames(40);assert.equal(h.starts.length,0);
});
test('button capture uses the same sequence, and no hand model is loaded',async t=>{
 const h=setup(t);h.setHand('absent');await h.camera.start('left');assert.equal(h.ready.at(-1),true);assert.match(h.status.at(-1),/wave a hand above your shoulder/);
 assert.equal(h.camera.capture(),true);assert.equal(h.starts[0].trigger,'button');h.frames(60);t.mock.timers.tick(6000);
 assert.equal(h.results[0].summary.mean,90);h.camera.stop();
});
test('a raised hand never substitutes for missing knee landmarks',async t=>{
 const h=setup(t,{missingKnee:true});await h.camera.start('right');h.frames(21);assert.equal(h.starts.length,1);h.frames(60);t.mock.timers.tick(6000);
 assert.equal(h.results[0],null);assert.match(h.status.at(-1),/Not enough clear pictures/);h.camera.stop();
});
test('frozen video and cancelled camera cannot produce a capture',async t=>{
 const h=setup(t);await h.camera.start('left');h.frames(10);h.video.readyState=1;h.frames(40);assert.equal(h.starts.length,0);
 h.camera.stop();h.frames(25);assert.equal(h.starts.length,0);
});
test('a patient can finish early with three pictures, without a later duplicate result',async t=>{
 const h=setup(t,{handFailure:true});await h.camera.start('left');h.camera.capture();h.frames(13);
 assert.equal(h.camera.finish(),true);assert.equal(h.results.length,1);assert.equal(h.results[0].summary.accepted,3);
 assert.equal(h.camera.finish(),false);t.mock.timers.tick(6000);assert.equal(h.results.length,1);h.camera.stop();
});
