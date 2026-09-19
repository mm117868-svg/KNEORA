import {loadPose} from './kneerec.js?v=endpoint-heavy-images-1';
import {kneeFrame,summariseEndpoint} from './recovery-measurements.mjs?v=interval-1';
import {raisedHandState,drawRaisedHand} from './raised-hand.mjs?v=1';
import {EndpointGesture} from './endpoint-gesture.mjs';
import {EndpointPreviewAverage} from './endpoint-smoothing.mjs?v=steadiness-1';
import {FluidOutline,drawOutline} from './fluid-outline.mjs?v=fluid-1';
import {trendCI95} from './confidence.mjs?v=1';
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
   the hand. Each picture to be measured is copied to `workCanvas`, which is never shown and never drawn on.

   The outline is repainted on every screen refresh, not only when a picture has been measured: fluid-outline.mjs
   carries it between results, fades it in and out, and draws the arc at the knee with the steadiness band of the
   live reading (confidence.mjs). Display only. What is saved comes from the measured pictures alone. */
export function createEndpointCamera({video,canvas,workCanvas=null,onStatus=()=>{},onResult=()=>{},onReady=()=>{},onCaptureStart=()=>{},onGesture=()=>{},onAngle=()=>{},onTrigger=null,modelLoader=loadPose,getStream=()=>navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false})}){
 let generation=0,stream=null,model=null,raf=null,timer=null,bucket=null,lastVideo=-1,lastInference=0,side='left',modelName='';
 const gesture=new EndpointGesture();let gesturePaused=false;
 const smoother=new EndpointPreviewAverage();
 const outline=new FluidOutline();let shown=null,handsSeen=null,handsAt=-Infinity;
 const ctx=canvas.getContext('2d');
 // Outside a browser (the unit tests) there is no document, and one surface serves both purposes as it used to.
 const work=workCanvas||(typeof document!=='undefined'?document.createElement('canvas'):canvas),workCtx=work===canvas?ctx:work.getContext('2d');
 /* The layer over the video. With a separate work canvas it is wiped and redrawn every refresh. Outside a browser
    the one canvas also holds the picture, so it is only ever drawn on, straight after a picture has been measured. */
 function paint(now){
  if(work!==canvas)ctx.clearRect(0,0,canvas.width,canvas.height);
  for(const part of outline.at(now/1000))drawOutline(ctx,part.points,{alpha:part.alpha,scale:canvas.width/1100,angle:part.fading?null:shown?.angle,halfWidth:shown?.halfWidth});
  if(now-handsAt<=450)drawRaisedHand(ctx,handsSeen,canvas.width,canvas.height);
 }
 const forget=now=>{smoother.reset();shown=null;outline.lose(now/1000);onAngle(null);};
 function stop(){generation++;cancelAnimationFrame(raf);clearTimeout(timer);bucket=null;gesture.reset();smoother.reset();outline.reset();shown=null;handsSeen=null;handsAt=-Infinity;onAngle(null);stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;model?.close();model=null;onReady(false);onGesture({stage:'off',progress:0});}
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
   model=result.landmarker;modelName=result.model;
   onReady(true);onGesture({stage:'ready',progress:0});
   onStatus('Camera ready. Once positioned, raise one hand above your shoulder for two seconds, or use the red capture button. Use the countdown to settle comfortably.');
   function tick(now){
    if(token!==generation||!model)return;raf=requestAnimationFrame(tick);
    if(video.readyState<2||video.currentTime===lastVideo){if(now-lastInference>500&&shown)forget(now);if(work!==canvas)paint(now);return;}
    if(now-lastInference<80){if(work!==canvas)paint(now);return;}
    lastVideo=video.currentTime;lastInference=now;const began=performance.now();
    // Setting a canvas size clears it, so sizes are only touched when the camera's own size changes.
    for(const surface of work===canvas?[canvas]:[work,canvas])if(surface.width!==video.videoWidth||surface.height!==video.videoHeight){surface.width=video.videoWidth;surface.height=video.videoHeight;}
    outline.resize(canvas.height);
    workCtx.drawImage(video,0,0,work.width,work.height);
    let body;   // the whole-body result of this picture: null when nobody, or more than one person, was found
    try{
     // The work canvas is a fresh still image. IMAGE detection runs independently on
     // each picture, and no overlay is ever drawn onto the picture that is measured.
     const result=model.detect(work),frame=kneeFrame(result.landmarks,work.width,work.height,side);
     const lm=result.landmarks?.length===1?result.landmarks[0]:null,ids=side==='left'?[23,25,27]:[24,26,28];
     body=lm;
     const preview=smoother.update(frame.angle,lm?ids.map(id=>lm[id]):null,now);
     if(preview){
      // the steadiness of the live reading: the 95% interval of the last few pictures' angles about their own trend (display only)
      const steadiness=trendCI95(preview.times,preview.angles);shown={angle:preview.angle,halfWidth:steadiness?steadiness.halfWidth:null};
      const sure=Math.min(...ids.map(id=>Number.isFinite(lm[id].visibility)?lm[id].visibility:1));
      outline.target(preview.points.map(p=>[p.x*canvas.width,p.y*canvas.height]),now/1000,sure);
      onAngle({...preview,halfWidth:shown.halfWidth});
     }else{shown=null;outline.lose(now/1000);onAngle(null);}
     samplePicture(frame,now);
    }catch(error){forget(now);samplePicture({angle:null,reason:'Pose inference failed'},now);}
    // A raised hand is read from the same pose result: no second model runs. A poor knee
    // view can still trigger capture, but cannot produce a falsely usable result.
    if(body!==undefined&&!bucket&&!gesturePaused){
     handsSeen=body;handsAt=now;
     const signal=gesture.update(raisedHandState(body,work.width,work.height),now,video.currentTime);
     if(signal.trigger)requestCapture('raised_hand');
     else onGesture({stage:signal.progress>0?'holding':signal.armed?'ready':'release',progress:signal.progress});
    }else handsSeen=null;
    paint(now+(performance.now()-began));   // measuring the picture took a while, and the outline is carried to the moment it is drawn
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
