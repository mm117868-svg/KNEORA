import test from 'node:test';
import assert from 'node:assert/strict';
import {createEndpointCamera} from '../recovery-camera.mjs';

test('uploaded pictures use Heavy IMAGE inference independently and release every image',async t=>{
 const oldCancel=globalThis.cancelAnimationFrame,oldBitmap=globalThis.createImageBitmap;
 let decoded=0,released=0,inferences=0,closed=0;const results=[];
 globalThis.cancelAnimationFrame=()=>{};
 globalThis.createImageBitmap=async()=>({width:1000,height:500,id:++decoded,close:()=>released++});
 t.after(()=>{globalThis.cancelAnimationFrame=oldCancel;globalThis.createImageBitmap=oldBitmap;});
 const landmarks=Array.from({length:33},()=>null);
 for(const [id,x,y] of [[24,.2,.5],[26,.5,.5],[28,.5,.8]])landmarks[id]={x,y,visibility:.99,presence:.99};
 const camera=createEndpointCamera({video:{srcObject:null},canvas:{getContext:()=>({})},onResult:r=>results.push(r),modelLoader:async options=>{
  assert.deepEqual(options,{variant:'heavy',runningMode:'IMAGE'});
  return {model:'heavy model',landmarker:{setOptions:async()=>{},detect:image=>{assert.equal(image.id,++inferences);return {landmarks:[landmarks]};},detectForVideo:()=>assert.fail('No temporal tracking for uploaded pictures'),close:()=>closed++}};
 }});
 await camera.images(Array.from({length:5},()=>({type:'image/png',size:100})),'right');
 assert.equal(results[0].summary.mean,90);assert.equal(results[0].summary.accepted,5);
 assert.match(results[0].source.method,/IMAGE mode/);assert.equal(results[0].captured_at,null);
 assert.equal(released,5);assert.equal(closed,1);
});

test('photo sets outside 3 to 10 images and oversized files are rejected before loading a model',async t=>{
 const old=globalThis.cancelAnimationFrame;globalThis.cancelAnimationFrame=()=>{};t.after(()=>{globalThis.cancelAnimationFrame=old;});
 let loads=0;const status=[],results=[];
 const camera=createEndpointCamera({video:{srcObject:null},canvas:{getContext:()=>({})},onStatus:s=>status.push(s),onResult:r=>results.push(r),modelLoader:async()=>{loads++;throw Error('Unexpected model load');}});
 for(const count of [0,2,11]){await camera.images(Array.from({length:count},()=>({type:'image/png',size:100})),'left');assert.match(status.at(-1),/between 3 and 10/);}
 await camera.images(Array.from({length:5},()=>({type:'image/png',size:21*1024*1024})),'left');assert.match(status.at(-1),/smaller than 20 MB/);
 assert.equal(loads,0);assert.deepEqual(results,[]);
});
