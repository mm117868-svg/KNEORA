import {loadPose} from './kneerec.js';
import {kneeFrame,summariseEndpoint} from './recovery-measurements.mjs';

export function cameraMessage(error){
 if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return 'Camera access is blocked. Allow this site in your browser and, on a Mac, allow the browser under System Settings > Privacy & Security > Camera. You can also open this page in Chrome or Safari, or use a sequence of photos below.';
 if(error?.name==='NotFoundError')return 'No camera was found. Connect a camera or use a sequence of photos below.';
 if(error?.name==='NotReadableError')return 'The camera is busy or unavailable. Close other apps using it, then try again.';
 return error?.message||'The camera could not start. Try again or use a sequence of photos.';
}
export function createEndpointCamera({video,canvas,onStatus=()=>{},onResult=()=>{},onReady=()=>{},modelLoader=loadPose,getStream=()=>navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false})}){
 let generation=0,stream=null,model=null,raf=null,timer=null,bucket=null,lastVideo=-1,lastInference=0,side='left',modelName='';
 const ctx=canvas.getContext('2d');
 function stop(){generation++;cancelAnimationFrame(raf);clearTimeout(timer);bucket=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;model?.close();model=null;onReady(false);}
 async function load(token){
  let timeout;
  const promise=modelLoader({variant:'full'}).then(async result=>{if(token!==generation){result.landmarker.close();throw Error('Camera setup cancelled.');}try{await result.landmarker.setOptions({numPoses:2});return result;}catch(error){result.landmarker.close();throw error;}});
  try{return await Promise.race([promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('The pose model took too long to load. Try again.')),20000);})]);}finally{clearTimeout(timeout);}
 }
 async function start(chosenSide){
  stop();const token=generation;side=chosenSide;lastVideo=-1;lastInference=0;onStatus('Opening the camera. Allow access when your browser asks.');
  try{
   const incoming=await getStream();if(token!==generation){incoming.getTracks().forEach(t=>t.stop());return;}
   stream=incoming;video.srcObject=stream;await video.play();if(token!==generation)return;onStatus('Loading the movement model.');
   const result=await load(token);if(token!==generation){result.landmarker.close();return;}
   model=result.landmarker;modelName=result.model;onReady(true);onStatus('Camera ready. Move to your comfortable limit, then press the capture button.');
   function tick(now){
    if(token!==generation||!model)return;raf=requestAnimationFrame(tick);
    if(video.readyState<2||video.currentTime===lastVideo||now-lastInference<80)return;
    lastVideo=video.currentTime;lastInference=now;
    canvas.width=video.videoWidth;canvas.height=video.videoHeight;ctx.drawImage(video,0,0,canvas.width,canvas.height);
    try{
     const result=model.detectForVideo(video,now),frame=kneeFrame(result.landmarks,canvas.width,canvas.height,side);
     const lm=result.landmarks?.length===1?result.landmarks[0]:null,ids=side==='left'?[23,25,27]:[24,26,28];
     if(frame.angle!==null&&lm){ctx.strokeStyle='#dc682e';ctx.fillStyle='#fff';ctx.lineWidth=5;ctx.beginPath();ids.forEach((id,i)=>{const p=lm[id];i?ctx.lineTo(p.x*canvas.width,p.y*canvas.height):ctx.moveTo(p.x*canvas.width,p.y*canvas.height);});ctx.stroke();for(const id of ids){ctx.beginPath();ctx.arc(lm[id].x*canvas.width,lm[id].y*canvas.height,7,0,2*Math.PI);ctx.fill();}}
     if(bucket)bucket.frames.push({...frame,time_ms:now-bucket.start});
    }catch(error){if(bucket)bucket.frames.push({angle:null,time_ms:now-bucket.start,reason:'Pose inference failed'});}
   }
   raf=requestAnimationFrame(tick);
  }catch(error){if(token===generation){stop();onStatus(cameraMessage(error));}}
 }
 function capture(){
  if(!model||!stream||bucket)return false;
  const token=generation;bucket={start:performance.now(),captured_at:new Date().toISOString(),frames:[]};
  onStatus('Capturing this position for about one second. Stay only as long as is comfortable.');
  timer=setTimeout(()=>{
   if(token!==generation||!bucket)return;
   const result=bucket;bucket=null;
   try{const summary=summariseEndpoint(result.frames);onResult({frames:result.frames,summary,captured_at:result.captured_at,source:{kind:'mediapipe_2d',device:modelName,method:'Side-view live endpoint sequence'}});onStatus('Capture ready to review. You can relax your leg.');}
   catch(error){onStatus(error.message);onResult(null);}
  },1400);return true;
 }
 async function images(files,chosenSide){
  stop();const token=generation;
  if(files.length<6||files.length>60){onStatus('Choose between 6 and 60 images of the same comfortable end position.');return;}
  if(files.some(f=>!f.type.startsWith('image/')||f.size>20*1024*1024)){onStatus('Use image files smaller than 20 MB each.');return;}
  onStatus('Analysing the selected images on this device.');
  try{
   const result=await load(token);if(token!==generation){result.landmarker.close();return;}model=result.landmarker;
   const frames=[];
   for(let i=0;i<files.length;i++){
    if(token!==generation)return;
    const bitmap=await createImageBitmap(files[i]);
    try{if(token!==generation)return;const detected=model.detectForVideo(bitmap,performance.now()+i);frames.push({...kneeFrame(detected.landmarks,bitmap.width,bitmap.height,chosenSide),time_ms:null});}finally{bitmap.close();}
    onStatus(`Analysed ${i+1} of ${files.length} images.`);
   }
   const summary=summariseEndpoint(frames);model.close();model=null;
   onResult({frames,summary,captured_at:null,source:{kind:'mediapipe_2d',device:result.model,method:'Side-view uploaded endpoint images'}});onStatus('Image sequence ready. Confirm its assessment date and end position before saving.');
  }catch(error){if(token===generation){stop();onStatus(cameraMessage(error));onResult(null);}}
 }
 return {start,stop,capture,images};
}
