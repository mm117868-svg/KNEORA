// One SDK owner supplies both colour and depth; never open its RGB stream twice.
export const INTEL_CAMERA_ID = 'intel-realsense-depth';
export function distanceLabel(depth) {
  return depth?.available && Number.isFinite(depth.knee_distance_m) && depth.knee_distance_m > 0
    ? `${depth.knee_distance_m.toFixed(2)} m` : 'Unavailable';
}
export async function intelAvailable() {
  try { const r=await fetch('/api/intel/status',{signal:AbortSignal.timeout(1500)});return r.ok&&(await r.json()).service==='kneora-intel'; } catch {return false;}
}
export function createIntelExerciseCamera({onDistance=()=>{},onError=()=>{}}={}) {
  let token=null,stream=null,timer=null,watchdog=null,generation=0,lastFrameAt=0;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  async function api(path,body){const r=await fetch('/api/intel/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});let data;try{data=await r.json();}catch{throw Error('Open Kneora using Open Intel exercises.command to use Intel depth.');}if(!r.ok)throw Error(data.error||'Intel camera unavailable.');return data;}
  async function release(old){if(old)try{await api('stop',{token:old});}catch{}}
  function stop(){generation++;clearTimeout(timer);clearInterval(watchdog);stream?.getTracks().forEach(t=>t.stop());stream=null;const old=token;token=null;onDistance(null);return release(old);}
  async function start(side,profile={}){
    await stop();const gen=++generation;
    try{
      const opened=await api('start',{side});if(gen!==generation){await release(opened.token);throw Error('Camera setup cancelled.');}token=opened.token;
      async function frame(){
        const requestedAt=performance.now();const data=await api('frame',{token,...profile});if(gen!==generation)return false;
        const image=new Image();image.src='data:image/jpeg;base64,'+data.image;await image.decode();if(gen!==generation)return false;
        if(performance.now()-requestedAt>1500)throw Error('Intel camera frames are arriving too slowly. Please restart the camera.');
        if(canvas.width!==data.width||canvas.height!==data.height){canvas.width=data.width;canvas.height=data.height;}
        ctx.drawImage(image,0,0);lastFrameAt=performance.now();stream?.getVideoTracks()[0]?.requestFrame?.();onDistance(data.depth);return true;
      }
      if(!await frame())throw Error('Camera setup cancelled.');
      stream=canvas.captureStream(0);stream.getVideoTracks()[0].requestFrame();
      async function poll(){try{if(!await frame())return;timer=setTimeout(poll,30);}catch(e){if(gen===generation){stop();onError(e);}}}
      timer=setTimeout(poll,30);
      watchdog=setInterval(()=>{if(gen===generation&&performance.now()-lastFrameAt>1500){stop();onError(Error('Intel camera connection lost. Distance is unavailable.'));}},250);
      return stream;
    }catch(e){if(gen===generation)await stop();throw e;}
  }
  addEventListener('pagehide',()=>{if(token)navigator.sendBeacon('/api/intel/stop',new Blob([JSON.stringify({token})],{type:'application/json'}));});
  return {start,stop};
}
