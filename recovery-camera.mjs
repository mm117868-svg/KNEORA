import {loadPose} from './kneerec.js?v=endpoint-heavy-images-1';
import {kneeFrame,summariseEndpoint} from './recovery-measurements.mjs?v=endpoint-3-flexible';
import {loadHighFive,highFiveState,drawHands} from './high-five.mjs?v=palm-anywhere-1';
import {EndpointGesture} from './endpoint-gesture.mjs';
import {EndpointPreviewAverage} from './endpoint-smoothing.mjs';
export const ENDPOINT_CAPTURE_MS=6000;
export const ENDPOINT_PICTURES=10;
const PICTURE_INTERVAL_MS=550;

export function cameraMessage(error){
 if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return 'Camera access is blocked. Allow this site in your browser and, on a Mac, allow the browser under System Settings > Privacy & Security > Camera. You can also open this page in Chrome or Safari, or use a sequence of photos below.';
 if(error?.name==='NotFoundError')return 'No camera was found. Connect a camera or use a sequence of photos below.';
 if(error?.name==='NotReadableError')return 'The camera is busy or unavailable. Close other apps using it, then try again.';
 return error?.message||'The camera could not start. Try again or use a sequence of photos.';
}
/* The patient watches the camera's own video, played by the browser, so the picture stays smooth however long
   each pose inference takes. `canvas` lies over that video and carries only the outline of the measured leg and
   the hand. Each picture to be measured is copied to `workCanvas`, which is never shown and never drawn on. */
export function createEndpointCamera({video,canvas,workCanvas=null,onStatus=()=>{},onResult=()=>{},onReady=()=>{},onCaptureStart=()=>{},onGesture=()=>{},onAngle=()=>{},onTrigger=null,modelLoader=loadPose,handLoader=loadHighFive,getStream=()=>navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false})}){
 let generation=0,stream=null,model=null,hands=null,raf=null,timer=null,bucket=null,lastVideo=-1,lastInference=0,side='left',modelName='';
 const gesture=new EndpointGesture();let gesturePaused=false;
 const smoother=new EndpointPreviewAverage();
 const ctx=canvas.getContext('2d');
 // Outside a browser (the unit tests) there is no document, and one surface serves both purposes as it used to.
 const work=workCanvas||(typeof document!=='undefined'?document.createElement('canvas'):canvas),workCtx=work===canvas?ctx:work.getContext('2d');
 function stop(){generation++;cancelAnimationFrame(raf);clearTimeout(timer);bucket=null;gesture.reset();smoother.reset();onAngle(null);stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;model?.close();model=null;hands?.close();hands=null;onReady(false);onGesture({stage:'off',progress:0});}
 async function loadHands(token){
  let timeout,expired=false;
  const pending=Promise.resolve().then(()=>handLoader()).then(result=>{if(token!==generation||expired){result?.close();return null;}return result;});
  try{return await Promise.race([pending,new Promise((_,reject)=>{timeout=setTimeout(()=>{expired=true;reject(Error('Hand model loading timed out.'));},20000);})]);}
  finally{clearTimeout(timeout);}
 }
 async function load(token){
  let timeout,expired=false;
  const promise=modelLoader({variant:'heavy',runningMode:'IMAGE'}).then(async result=>{if(token!==generation||expired){result.landmarker.close();throw Error('Camera setup cancelled.');}try{await result.landmarker.setOptions({numPoses:2});if(token!==generation||expired)throw Error('Camera setup cancelled.');return result;}catch(error){result.landmarker.close();throw error;}});
  try{return await Promise.race([promise,new Promise((_,reject)=>{timeout=setTimeout(()=>{expired=true;reject(Error('The pose model took too long to load. Try again.'));},20000);})]);}finally{clearTimeout(timeout);}
 }
 async function start(chosenSide){
  stop();const token=generation;side=chosenSide;lastVideo=-1;lastInference=0;gesturePaused=false;onStatus('Opening the camera. Allow access when your browser asks.');
  try{
   const incoming=await getStream();if(token!==generation){incoming.getTracks().forEach(t=>t.stop());return;}
   stream=incoming;video.srcObject=stream;await video.play();if(token!==generation)return;onStatus('Loading the movement model.');
   const result=await load(token);if(token!==generation){result.landmarker.close();return;}
   model=result.landmarker;modelName=result.model;onStatus('Loading open-palm detection.');
   let loadedHands=null;try{loadedHands=await loadHands(token);}catch{}
   if(token!==generation){loadedHands?.close();return;}hands=loadedHands;
   onReady(true);onGesture({stage:hands?'ready':'unavailable',progress:0});
   onStatus(hands?'Camera ready. Once positioned, show your open palm towards the camera for two seconds. Use the countdown to settle comfortably.':'Open-palm detection is unavailable. Use the capture button below or reopen the camera to try again.');
   function tick(now){
    if(token!==generation||!model)return;raf=requestAnimationFrame(tick);
    if(video.readyState<2||video.currentTime===lastVideo){if(now-lastInference>500){smoother.reset();onAngle(null);}return;}
    if(now-lastInference<80)return;
    lastVideo=video.currentTime;lastInference=now;
    // Setting a canvas size clears it, so sizes are only touched when the camera's own size changes.
    for(const surface of work===canvas?[canvas]:[work,canvas])if(surface.width!==video.videoWidth||surface.height!==video.videoHeight){surface.width=video.videoWidth;surface.height=video.videoHeight;}
    workCtx.drawImage(video,0,0,work.width,work.height);
    if(work!==canvas)ctx.clearRect(0,0,canvas.width,canvas.height);
    try{
     // The work canvas is a fresh still image. IMAGE detection runs independently on
     // each picture, and no overlay is ever drawn onto the picture that is measured.
     const result=model.detect(work),frame=kneeFrame(result.landmarks,work.width,work.height,side);
     const lm=result.landmarks?.length===1?result.landmarks[0]:null,ids=side==='left'?[23,25,27]:[24,26,28];
     const preview=smoother.update(frame.angle,lm?ids.map(id=>lm[id]):null,now);onAngle(preview);
     if(preview){ctx.strokeStyle='#dc682e';ctx.fillStyle='#fff';ctx.lineWidth=5;ctx.beginPath();preview.points.forEach((p,i)=>{i?ctx.lineTo(p.x*canvas.width,p.y*canvas.height):ctx.moveTo(p.x*canvas.width,p.y*canvas.height);});ctx.stroke();for(const p of preview.points){ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,7,0,2*Math.PI);ctx.fill();}}
     samplePicture(frame,now);
    }catch(error){smoother.reset();onAngle(null);samplePicture({angle:null,reason:'Pose inference failed'},now);}
    // The hand signal is independent of body-pose visibility. A poor knee view
    // can still trigger capture, but cannot produce a falsely usable result.
    if(hands&&!bucket&&!gesturePaused){
     let handResult=null;try{handResult=hands.recognizeForVideo(video,now);drawHands(ctx,handResult,canvas.width,canvas.height);}catch{}
     const signal=gesture.update(highFiveState(handResult),now,video.currentTime);
     if(signal.trigger)requestCapture('open_palm');
     else onGesture({stage:signal.progress>0?'holding':signal.armed?'ready':'release',progress:signal.progress});
    }
   }
   raf=requestAnimationFrame(tick);
  }catch(error){if(token===generation){stop();onStatus(cameraMessage(error));}}
 }
 function samplePicture(frame,now){
  if(!bucket||bucket.frames.length>=ENDPOINT_PICTURES||now-bucket.lastSample<PICTURE_INTERVAL_MS)return;
  bucket.lastSample=now;bucket.frames.push({...frame,time_ms:Math.max(0,now-bucket.start)});
  onGesture({stage:'capturing',progress:bucket.frames.length/ENDPOINT_PICTURES});
 }
 function capture(trigger='button'){
  if(!model||!stream||bucket)return false;
  gesture.disarm();onCaptureStart({trigger});onGesture({stage:'capturing',progress:0});
  const token=generation;bucket={start:performance.now(),captured_at:new Date().toISOString(),frames:[],lastSample:-Infinity};
  onStatus('Taking pictures for six seconds. Small movements are fine. Stay near your comfortable limit; you do not need to be perfectly still.');
  timer=setTimeout(()=>{if(token===generation)finish();},ENDPOINT_CAPTURE_MS);return true;
 }
 function finish(){
   if(!bucket)return false;clearTimeout(timer);
   const result=bucket;bucket=null;resumeGesture();onGesture({stage:'complete',progress:1});
   try{const summary=summariseEndpoint(result.frames);onResult({frames:result.frames,summary,captured_at:result.captured_at,source:{kind:'mediapipe_2d',device:modelName,method:'Side-view live endpoint images (IMAGE mode, flexible six-second sequence)'}});onStatus('Capture ready to review. You can relax your leg.');}
   catch(error){onStatus(error.message);onResult(null);}
   return true;
 }
 function resumeGesture(){gesturePaused=false;gesture.disarm();}
 function requestCapture(trigger='button'){if(!model||!stream||bucket||gesturePaused)return false;if(!onTrigger)return capture(trigger);gesturePaused=true;gesture.disarm();onTrigger(trigger);return true;}
 async function images(files,chosenSide){
  stop();const token=generation;
  if(files.length<3||files.length>10){onStatus('Choose between 3 and 10 images from the same comfortable end-position attempt. Small movements are fine.');return;}
  if(files.some(f=>!f.type.startsWith('image/')||f.size>20*1024*1024)){onStatus('Use image files smaller than 20 MB each.');return;}
  onStatus('Analysing the selected images on this device.');
  try{
   const result=await load(token);if(token!==generation){result.landmarker.close();return;}model=result.landmarker;
   const frames=[];
   for(let i=0;i<files.length;i++){
    if(token!==generation)return;
    const bitmap=await createImageBitmap(files[i]);
    try{if(token!==generation)return;const detected=model.detect(bitmap);frames.push({...kneeFrame(detected.landmarks,bitmap.width,bitmap.height,chosenSide),time_ms:null});}finally{bitmap.close();}
    onStatus(`Analysed ${i+1} of ${files.length} images.`);
   }
   const summary=summariseEndpoint(frames);model.close();model=null;
   onResult({frames,summary,captured_at:null,source:{kind:'mediapipe_2d',device:result.model,method:'Side-view uploaded endpoint images (IMAGE mode)'}});onStatus('Image sequence ready. Confirm its assessment date and end position before saving.');
  }catch(error){if(token===generation){stop();onStatus(cameraMessage(error));onResult(null);}}
 }
 return {start,stop,capture,requestCapture,resumeGesture,finish,images};
}
