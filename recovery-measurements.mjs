import {dayNumber,localDate,postOpDay,finite} from './progress-data.mjs';
import {assessPose} from './video-analysis/analysis.mjs';

export const RECOVERY_KEY='kr_recovery_measurements_v1';
export const MEASUREMENT_VERSION='endpoint-1';
export const CAPTURE_RULES=Object.freeze({minimumFrames:6,minimumCoverage:.5,maximumSpread:8,minVisibility:.5});
export const SOURCE_NAMES={mediapipe_2d:'MediaPipe 2D',depth_3d:'Imported depth camera',clinical:'Clinical measurement entered'};
export const MOTION_NAMES={bend:'Knee bending',straighten:'Knee straightening'};
export const MODE_NAMES={active:'Without assistance',assisted:'With assistance',passive:'Clinician-assessed passive range'};
export const POSITION_NAMES={supine:'Lying on your back',seated:'Seated'};
const mean=a=>a.reduce((n,x)=>n+x,0)/a.length;
const validAngle=n=>finite(n)!==null&&n>=0&&n<=180;

export function kneeFrame(poses,width,height,side){
 if(!['left','right'].includes(side))return {angle:null,reason:'Choose a knee'};
 if(!(width>0&&height>0))return {angle:null,reason:'Image not ready'};
 const r=assessPose(poses,width,height,side,CAPTURE_RULES.minVisibility);
 // The shoulder is not needed for a dedicated hip-knee-ankle range measurement.
 return {angle:validAngle(r.bend)?r.bend:null,reason:r.bend===null?r.rejectionReasons:''};
}
export function summariseEndpoint(frames){
 if(!Array.isArray(frames)||frames.length>600)throw Error('Use a short sequence of at most 600 frames.');
 const valid=frames.filter(f=>validAngle(f.angle)),angles=valid.map(f=>f.angle);
 if(angles.length<CAPTURE_RULES.minimumFrames)throw Error('Not enough clear frames. Keep the hip, knee and ankle visible and try again.');
 const coverage=valid.length/frames.length;
 if(coverage<CAPTURE_RULES.minimumCoverage)throw Error('Too much of this sequence could not be measured. Reposition the camera and try again.');
 const minimum=Math.min(...angles),maximum=Math.max(...angles),average=mean(angles);
 if(maximum-minimum>CAPTURE_RULES.maximumSpread)throw Error('The readings changed too much during this check. Rest, then repeat at one comfortable end position.');
 return {mean:average,minimum,maximum,sd:Math.sqrt(mean(angles.map(a=>(a-average)**2))),accepted:valid.length,sampled:frames.length,coverage,
  frames:frames.map(f=>({time_ms:finite(f.time_ms),angle:validAngle(f.angle)?f.angle:null,reason:String(f.reason||'').slice(0,150)})),rules:{...CAPTURE_RULES}};
}
export function kneeAngle3D(hip,knee,ankle){
 if(![hip,knee,ankle].every(p=>Array.isArray(p)&&p.length===3&&p.every(v=>finite(v)!==null)))return null;
 const u=hip.map((n,i)=>n-knee[i]),v=ankle.map((n,i)=>n-knee[i]),a=Math.hypot(...u),b=Math.hypot(...v);
 if(a<1e-6||b<1e-6)return null;
 return 180-Math.acos(Math.max(-1,Math.min(1,u.reduce((n,x,i)=>n+x*v[i],0)/(a*b))))*180/Math.PI;
}
export function validateContext(input,{patientId,operationDate='',today=localDate()}={}){
 if(!patientId?.trim())throw Error('Set the patient ID first.');
 if(operationDate&&dayNumber(operationDate)===null)throw Error('Set a valid operation date.');
 if(dayNumber(input.date)===null||input.date>today)throw Error('Choose a valid measurement date no later than today.');
 if(!['left','right'].includes(input.side)||!MOTION_NAMES[input.motion]||!MODE_NAMES[input.mode]||!POSITION_NAMES[input.position])throw Error('Choose the knee, movement, assistance and position.');
 if(input.confirmed!==true)throw Error('Confirm that the patient reported reaching their comfortable limit.');
 return {patient_id:patientId,operation_date:operationDate,date:input.date,days_post_op:postOpDay(input.date,operationDate),side:input.side,motion:input.motion,mode:input.mode,position:input.position,patient_confirmed_limit:true};
}
export function readMeasurements(storage=localStorage){
 const raw=storage.getItem(RECOVERY_KEY);if(!raw)return [];
 let rows;try{rows=JSON.parse(raw);}catch{throw Error('Saved recovery measurements could not be read. They have not been overwritten.');}
 if(!Array.isArray(rows)||rows.some(r=>!r||r.schema_version!==1||typeof r.id!=='string'||typeof r.patient_id!=='string'||typeof r.operation_date!=='string'||typeof r.saved_at!=='string'||dayNumber(r.date)===null||!['left','right'].includes(r.side)||!MOTION_NAMES[r.motion]||!MODE_NAMES[r.mode]||!POSITION_NAMES[r.position]||!SOURCE_NAMES[r.source?.kind]||!validAngle(r.value)))throw Error('Saved recovery measurements have an unsupported format. They have not been overwritten.');
 return rows;
}
export function scopedMeasurements(rows,patientId,operationDate='',side=null,asOf=localDate()){
 return rows.filter(r=>r.patient_id===patientId&&r.operation_date===operationDate&&(!side||r.side===side)&&dayNumber(r.date)!==null&&r.date<=asOf)
  .sort((a,b)=>a.date.localeCompare(b.date)||a.saved_at.localeCompare(b.saved_at));
}
export function saveMeasurement(input,options={}){
 const {storage=localStorage,idFactory=()=>crypto.randomUUID()}=options,context=validateContext(input,options),rows=readMeasurements(storage);
 if(!SOURCE_NAMES[input.source?.kind])throw Error('Choose a measurement source.');
 let summary=null,value;
 if(input.source.kind==='clinical'){
  if(input.value===''||input.value===null||input.value===undefined||typeof input.value==='boolean')throw Error('Enter the measured angle.');
  value=Number(input.value);if(!validAngle(value))throw Error('Use degrees of knee bend from 0 to 180, where 0 means straight.');
  if(!String(input.source.device||'').trim())throw Error('Record the clinical instrument or assessment method.');
 }else{summary=summariseEndpoint(input.frames);value=summary.mean;}
 if(input.source.kind==='depth_3d'&&(!input.source.device||!input.source.calibration))throw Error('The depth-camera device and calibration reference are required.');
 const record={schema_version:1,version:MEASUREMENT_VERSION,id:idFactory(),...context,value,summary,
  source:{kind:input.source.kind,device:String(input.source.device||'').slice(0,160),method:String(input.source.method||'').slice(0,160),calibration:String(input.source.calibration||'').slice(0,160)},
  capture_group:String(input.capture_group||'').slice(0,100),captured_at:input.captured_at||null,note:String(input.note||'').slice(0,1000),saved_at:new Date().toISOString()};
 if(record.captured_at&&!Number.isFinite(Date.parse(record.captured_at)))throw Error('Invalid capture timestamp.');
 rows.push(record);storage.setItem(RECOVERY_KEY,JSON.stringify(rows));return record;
}
export function measurementSeriesKey(r){return JSON.stringify([r.patient_id,r.operation_date,r.side,r.motion,r.mode,r.position,r.source.kind,r.source.device,r.source.method,r.source.calibration,r.version]);}
export function endpointOverview(rows,motion){
 const latest=rows.filter(r=>r.motion===motion).at(-1);if(!latest)return {latest:null,previous:null,change:null};
 const comparable=rows.filter(r=>r.motion===motion&&measurementSeriesKey(r)===measurementSeriesKey(latest)),previous=comparable.at(-2)||null;
 return {latest,previous,change:previous?latest.value-previous.value:null};
}
export function depthImport(data,context){
 if(data?.schema!=='knee-depth-endpoint-v1'||data.source?.kind!=='depth_3d'||data.source.coordinates!=='depth-derived-joint-centres')throw Error('This must be a knee-depth-endpoint-v1 export with depth-derived joint coordinates, not MediaPipe world landmarks.');
 for(const key of ['patient_id','operation_date','side','motion','mode','position','date'])if(data[key]!==context[key])throw Error(`The imported ${key.replaceAll('_',' ')} does not match this measurement.`);
 if(!['m','mm'].includes(data.units)||!data.source.device||!data.source.calibration)throw Error('Record units (m or mm), device and calibration reference in the depth export.');
 if(!Array.isArray(data.frames)||data.frames.length>600)throw Error('The depth export must contain a short frame sequence.');
 const scale=data.units==='mm'?.001:1;
 const frames=data.frames.map(f=>{
  const pts=[f.hip,f.knee,f.ankle].map(p=>Array.isArray(p)?p.map(v=>typeof v==='number'?v*scale:NaN):null);
  const lengths=pts.every(p=>p?.length===3&&p.every(v=>finite(v)!==null))?[Math.hypot(...pts[0].map((v,i)=>v-pts[1][i])),Math.hypot(...pts[2].map((v,i)=>v-pts[1][i]))]:[];
  const angle=f.valid===true&&lengths.length===2&&lengths.every(n=>n>=.1&&n<=.8)?kneeAngle3D(...pts):null;
  return {time_ms:f.time_ms,angle,reason:angle===null?'Depth frame invalid or joint geometry unusable':''};
 });
 const summary=summariseEndpoint(frames);
 if(typeof data.captured_at!=='string'||!Number.isFinite(Date.parse(data.captured_at)))throw Error('The depth export needs its actual capture timestamp.');
 return {frames,summary,source:{kind:'depth_3d',device:data.source.device,calibration:data.source.calibration,method:'3D unsigned knee bend from imported joint centres'},captured_at:data.captured_at,capture_group:String(data.capture_group||'')};
}
export function compareSources(a,b,confirmed=false){
 const nope=reason=>({available:false,reason});
 if(!a||!b||!confirmed)return nope('Select two results from the same patient-reported hold and confirm the pairing.');
 for(const key of ['patient_id','operation_date','date','side','motion','mode','position'])if(a[key]!==b[key])return nope('Different patient, date, knee or assessment setup.');
 if(new Set([a.source.kind,b.source.kind]).size!==2||![a,b].every(r=>['mediapipe_2d','depth_3d'].includes(r.source.kind)))return nope('Compare a MediaPipe 2D result with a separate depth-camera result.');
 if(!a.capture_group||a.capture_group!==b.capture_group)return nope('These results do not share a capture reference. Do not average separate attempts.');
 const times=[Date.parse(a.captured_at),Date.parse(b.captured_at)];
 if(times.some(t=>!Number.isFinite(t))||Math.abs(times[0]-times[1])>2000)return nope('The capture timestamps are missing or do not identify the same short hold.');
 return {available:true,difference:Math.abs(a.value-b.value),mean:(a.value+b.value)/2,reason:'Equal-weight comparison only. Agreement and accuracy have not been established.'};
}
