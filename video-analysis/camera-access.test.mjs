import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Run the actual inline camera functions with a controlled browser surface.
// This checks permission recovery without needing or granting webcam access.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const openSource=html.slice(html.indexOf('async function openCamera(gen)'),html.indexOf('/* ---------------- repetition-count layer'));
const errorSource=html.slice(html.indexOf('function cameraFailed(e)'),html.indexOf('function preview()',html.indexOf('function cameraFailed(e)')));
function setup(getUserMedia){
  const elements=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,{style:{},textContent:'',hidden:false,value:'',className:'',classList:{add(){},remove(){},contains(){return true;}}});return elements.get(id);};
  const context=vm.createContext({$,openGen:1,stream:null,location:{origin:'http://localhost:8767',pathname:'/'},navigator:{mediaDevices:{getUserMedia}},video:{videoWidth:1280,videoHeight:720,srcObject:null,play:async()=>{}},canvas:{},listCams:async()=>{},stopCamera(){},refreshHint(){},startTracker(){},fitCameraView(){},preview(){}});
  vm.runInContext('const screenOpen = gen => gen === openGen && $("ex").classList.contains("open");\n'+openSource+'\n'+errorSource,context);
  return {context,$};
}
const error=name=>Object.assign(new Error(name==='NotAllowedError'?'Permission denied by system':'Camera unavailable'),{name});
const mediaStream=()=>({getTracks:()=>[{stop(){}}]});
test('permission denial followed by grant recovers through the real Try again handler',async()=>{
  let requests=0,plays=0;
  const {context,$}=setup(async()=>{if(++requests===1)throw error('NotAllowedError');return mediaStream();});
  context.video.play=async()=>{plays++;};$('camsel').value='preferred-camera';
  await context.openCamera(1);
  assert.equal(requests,1);assert.equal($('spin').style.display,'none');assert.match($('veilTitle').textContent,/permission is blocked/);
  await $('veilBtn').onclick();
  assert.equal(context.openGen,2);assert.equal(requests,2);assert.equal(plays,1);assert.equal($('track').textContent,'camera on');
});
test('a denied retry returns to the error instead of leaving a spinner running',async()=>{
  const {context,$}=setup(async()=>{throw error('NotAllowedError');});await context.openCamera(1);await $('veilBtn').onclick();
  assert.equal($('spin').style.display,'none');assert.equal($('veilBtn').style.display,'inline-block');assert.equal($('cameraUpload').hidden,false);
});
test('a camera granted after leaving the screen is stopped',async()=>{
  let resolve,stopped=0,plays=0;
  const {context}=setup(()=>new Promise(r=>resolve=r));context.video.play=async()=>plays++;
  const opening=context.openCamera(1);context.openGen=2;resolve({getTracks:()=>[{stop(){stopped++;}}]});await opening;
  assert.equal(stopped,1);assert.equal(plays,0);
});
test('an unavailable preferred camera retries with the default device',async()=>{
  const constraints=[];const {context,$}=setup(async c=>{constraints.push(structuredClone(c));if(constraints.length===1)throw error('OverconstrainedError');return mediaStream();});
  $('camsel').value='missing-camera';await context.openCamera(1);
  assert.equal(constraints.length,2);assert.equal(constraints[0].video.deviceId.exact,'missing-camera');assert.equal(constraints[1].video.deviceId,undefined);
});
test('missing browser camera API provides an actionable fallback',async()=>{
  const {context,$}=setup(null);context.navigator.mediaDevices=undefined;await context.openCamera(1);
  assert.match($('veilMsg').textContent,/Chrome or Safari/);assert.equal($('spin').style.display,'none');
});
