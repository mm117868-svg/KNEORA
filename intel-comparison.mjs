import {createCameraDisplay} from './camera-display.mjs';
const $=id=>document.getElementById(id), display=createCameraDisplay(),ctx=$('picture').getContext('2d');
let token=null,generation=0,timer=null,rows=[],busy=false,lastFrameAt=0;
setInterval(()=>{if(token&&performance.now()-lastFrameAt>1500){clear();$("status").textContent="Waiting for a fresh camera frame. Distance unavailable.";}},500);
const metric=(value,suffix)=>Number.isFinite(value)?value.toFixed(1)+suffix:'Unavailable';
let patientId='';try{patientId=localStorage.getItem('kr_patient')||'';}catch{}
const profileKey='kneora_comparison_body_v1:'+patientId;
try{const p=JSON.parse(localStorage.getItem(profileKey)||'{}');$('height').value=p.height_cm??'';$('weight').value=p.weight_kg??'';$('side').value=p.side||'left';}catch{}
function settings(){return {patient_id:patientId,height_cm:$('height').value?Number($('height').value):null,weight_kg:$('weight').value?Number($('weight').value):null,side:$('side').value,reference_group:$('referenceGroup').value,height_3d_enabled:$('height3dEnabled').checked};}
async function api(path,body){const r=await fetch('/api/intel/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});let d;try{d=await r.json();}catch{throw Error('Open this page using Open Intel comparison.command. A normal website server cannot read Intel depth.');}if(!r.ok)throw Error(d.error||'Camera unavailable');return d;}
function clear(){for(const id of ['depth','estimate','difference','depthAngle','estimateAngle','angleDifference','hipDifference','kneeDifference','ankleDifference','researchDistance','researchAngle','researchDifference'])$(id).textContent='Unavailable';}
function controls(active){$('start').disabled=active;$('stop').disabled=!active;for(const id of ['height','weight','side','referenceGroup','height3dEnabled'])$(id).disabled=active;}
async function stop(){generation++;clearTimeout(timer);const old=token;token=null;controls(false);clear();$('picture').hidden=true;$('empty').hidden=false;if(old)try{await api('stop',{token:old});}catch{} }
$('stop').onclick=async()=>{await stop();$('status').textContent='Camera stopped. Distance readings cleared.';};
$('start').onclick=async()=>{
 if(busy||!$('height').reportValidity()||!$('weight').reportValidity())return;busy=true;controls(true);const gen=++generation;
 const profile=settings();rows=[];$('save').disabled=true;$('summary').textContent='No paired readings yet.';display.reset();
 try{localStorage.setItem(profileKey,JSON.stringify(profile));}catch{}
 $('status').textContent='Opening Intel colour and depth streams...';
 try{const opened=await api('start',{side:profile.side});if(gen!==generation){await api('stop',{token:opened.token});return;}token=opened.token;$('status').textContent=opened.device;await poll(gen,profile);}
 catch(e){if(gen===generation){await stop();$('status').textContent=e.message;}}finally{busy=false;}
};
async function poll(gen,profile){
 try{const data=await api('frame',{token,...profile});if(gen!==generation)return;
 const image=new Image();image.src='data:image/jpeg;base64,'+data.image;await image.decode();if(gen!==generation)return;
 image.videoWidth=image.naturalWidth;image.videoHeight=image.naturalHeight;
 if($('picture').width!==data.width||$('picture').height!==data.height){$('picture').width=data.width;$('picture').height=data.height;}
 lastFrameAt=performance.now();display.draw(ctx,image);$('picture').hidden=false;$('empty').hidden=true;
 ctx.strokeStyle='#ffe075';ctx.fillStyle='#ffe075';ctx.lineWidth=3;ctx.beginPath();data.points_px.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();for(const [x,y] of data.points_px){ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();}
 const research=data.height_3d;
 $('researchDistance').textContent=metric(research?.available?research.knee_distance_m*100:null,' cm');
 $('researchAngle').textContent=metric(research?.available?research.angle_deg:null,'°');
 $('researchDifference').textContent=research?.available?`${metric(research.angle_difference_deg,'°')} · ${metric(research.distance_difference_cm,' cm')}`:'Unavailable';
 $('researchReason').textContent=research?.available?`Experimental fit. Largest landmark adjustment: ${research.maximum_adjustment_cm.toFixed(1)} cm. Accuracy improvement has not been established.`:research?.reason||'Restart the Intel service to enable the research comparison.';
 $('depth').textContent=metric(data.depth.available?data.depth.knee_distance_m*100:null,' cm');
 $('estimate').textContent=metric(data.estimate.available?data.estimate.knee_distance_m*100:null,' cm');
 $('difference').textContent=metric(data.difference?.distance_cm,' cm');
 $('depthAngle').textContent=metric(data.depth.angle_deg,'°');$('estimateAngle').textContent=metric(data.estimate.angle_deg,'°');$('angleDifference').textContent=metric(data.difference?.angle_deg,'°');
 ['hipDifference','kneeDifference','ankleDifference'].forEach((id,i)=>$(id).textContent=metric(data.difference?.landmark_separation_cm?.[i],' cm'));
 $('depthReason').textContent=data.depth.reason||'';$('estimateReason').textContent=data.estimate.reason||'';
 const {image:discard,...record}=data;rows.push({...record,profile});if(rows.length>1800)rows.shift();$('save').disabled=false;
 const paired=rows.filter(r=>r.difference),n=paired.length;
 $('summary').textContent=n?`${n} paired readings. Mean signed distance difference: ${(paired.reduce((s,r)=>s+r.difference.distance_cm,0)/n).toFixed(1)} cm. Mean absolute difference: ${(paired.reduce((s,r)=>s+Math.abs(r.difference.distance_cm),0)/n).toFixed(1)} cm. Last 1,800 readings retained.`:'No paired readings yet.';
 $('status').textContent=data.device+' · Live comparison';timer=setTimeout(()=>poll(gen,profile),50);
 }catch(e){if(gen===generation){await stop();$('status').textContent=e.message;}}
}
$('save').onclick=()=>{const blob=new Blob([JSON.stringify({schema:'kneora-depth-height-comparison-v1',exported_at:new Date().toISOString(),rows},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='kneora-camera-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
addEventListener('pagehide',()=>{if(token)navigator.sendBeacon('/api/intel/stop',new Blob([JSON.stringify({token})],{type:'application/json'}));});

let priorGeneration=0;
async function updatePrior(){const gen=++priorGeneration;try{const p=await api('height-prior',settings());if(gen!==priorGeneration)return;$('bonePrior').textContent=p.available?`Estimated radiographic femur: ${(p.lengths_m[0]*100).toFixed(1)} cm · tibia: ${(p.lengths_m[1]*100).toFixed(1)} cm. Based on ${p.reference_n} study observations within ±3 cm of this height. Individual lengths may differ.`:p.reason;}catch{$('bonePrior').textContent='Start or restart Open Intel comparison.command to load the research reference.';}}
$('height').addEventListener('input',updatePrior);$('referenceGroup').addEventListener('change',updatePrior);updatePrior();
