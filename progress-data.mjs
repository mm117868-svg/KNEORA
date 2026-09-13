import {exercisePerformanceMetrics} from './exercise-evidence.mjs?v=pubmed-1';
import {normaliseExerciseContext,exerciseContextKey,exerciseContextFacts} from './exercise-context.mjs?v=pubmed-1';
import {recordedCount} from './patient-progress.js?v=high-five-small-1';
export const EXERCISE_NAMES = {straight_leg_raise:'Straight leg raise',seated_extension:'Seated knee extension',heel_slide:'Heel slides'};
export const finite = n => typeof n === 'number' && Number.isFinite(n) ? n : null;
const values = xs => xs.map(finite).filter(n=>n!==null);
const mean = xs => {const a=values(xs);return a.length?a.reduce((s,n)=>s+n,0)/a.length:null;};
const maximum = xs => {const a=values(xs);return a.length?Math.max(...a):null;};
const spread = xs => {const a=values(xs);return a.length>=2?Math.sqrt(a.reduce((s,n)=>s+(n-mean(a))**2,0)/a.length):null;};
const report = r => r.exercise_analysis?.exercise === r.exercise ? r.exercise_analysis : null;
const m = r => report(r)?.metrics || {};
const reps = r => report(r)?.reps || [];
const metric = (id,label,unit,get,interpretation,best='range',target=null,source='video') => ({id,label,unit,get,interpretation,best,target,source});
const timing = 'Follow the pace prescribed by your physiotherapist. There is no validated universal time target for this exercise after knee replacement. Timing alone does not measure control.';
const common = [
  metric('painDuring','Worst pain reported during exercise','/10',r=>normaliseExerciseContext(r.patient?.exercise_context).pain_during_0_10,'Patient recall of the worst pain during this session, separate from pain afterwards. Interpret with activity, assistance and the individual plan.','range',null,'patient'),
  metric('addedWeight','Reported added weight','kg',r=>normaliseExerciseContext(r.patient?.exercise_context).load_kg,'Only an explicitly reported added weight. This is exercise context, not measured quadriceps force or advice to increase resistance.','range',null,'patient'),
  metric('cycle','Repetition time (average)','s',r=>m(r).meanCycleDuration,timing),
  metric('outward','Outward movement time (average)','s',r=>m(r).meanOutwardDuration,timing),
  metric('return','Return time (average)','s',r=>m(r).meanReturnDuration,timing,'target','targetLower'),
  metric('hold','Hold time (average)','s',r=>m(r).meanHold,timing,'target','targetHold'),
  metric('cycles','Complete repetitions in video','reps',r=>report(r)?reps(r).length:null,'Compare with your prescribed count. More repetitions do not by themselves indicate better recovery.'),
  metric('cadence','Repetition rate','reps/min',r=>m(r).observedCadence,timing),
  metric('kneeMean','Knee bend (average across video)','°',r=>m(r).kneeBend?.mean,'A whole-video average depends on time spent resting and moving. It is not a maximum range test.'),
  metric('kneeRange','Knee movement range across video','°',r=>m(r).kneeBend?.range,'Observed maximum minus minimum bend, including rest. Interpret alongside the individual exercise and symptoms.'),
  metric('coverage','Frames usable for repetition tracking','%',r=>{const v=finite(m(r).repetitionTrackingCoverage);return v===null?null:v*100;},'Higher coverage means fewer gaps. It does not establish angle accuracy or good technique.'),
  metric('sampled','Video frames sampled','frames',r=>m(r).sampledFrames,'Frames sampled by the analyser, not necessarily every frame in the original recording.'),
  metric('rejected','Video frames rejected','frames',r=>m(r).rejectedFrames,'Frames excluded by the configured tracking quality rules.'),
  metric('pain','Pain reported after exercise','/10',r=>r.patient?.pain_0_10,'Track the pattern alongside activity and your care plan. There is no universal pain score that must be reached on a particular day.','min',null,'patient'),
  metric('difficulty','Exercise difficulty reported','/5',r=>r.patient?.difficulty_1_5,'A patient-reported exercise rating, not a validated overall recovery score.','min',null,'patient'),
  metric('count','Recorded live repetitions','reps',recordedCount,'The chosen counting method is kept separate from video analysis. Follow your prescribed exercise amount.','range',null,'live'),
  metric('liveBend','Live typical best knee bend (95th percentile)','°',r=>r.measurement?.p95_flexion_deg,'Older live measurements are shown separately from analysed video angles. Live automatic leg selection may have changed during a recording.','range',null,'live')
];
export const METRICS = {
 straight_leg_raise:[
  metric('typicalExtraBend','Typical extra knee bend during lift','°',r=>exercisePerformanceMetrics(r).extraBend?.median,'Median extra bend across completed lifts. Less extra bend may describe better maintenance of the starting position, but absolute knee bend matters too. Not clinical extension lag.','min'),
  metric('extraBend','Additional knee bend during lift','°',r=>maximum(reps(r).map(p=>p.maxAdditionalBend)),'Less additional bend may indicate better maintenance of the starting knee position. Aim to retain the extension available to you, as advised by your physiotherapist. This is not clinical extension lag.','min'),
  metric('hip','Approximate hip flexion (peak)','°',r=>m(r).hipFlexion?.maximum,'A trunk-relative 2D estimate. Lift to the range prescribed for you; a higher lift is not automatically better.'),
  metric('lift','Hip lift range above lowered position','°',r=>maximum(reps(r).map(p=>p.peakLift)),'Largest lift in a completed repetition, measured relative to the observed lowered position. Compare with an entered exercise target, not a universal postoperative angle.','target','targetLift'),
  ...common.map(m=>({...m,label:m.id==='return'?'Lowering time (average)':m.id==='outward'?'Lifting time (average)':m.label})),
  metric('qab','Manually entered clinical QAB total','/6',r=>report(r)?.clinicalScore?.total ?? report(r)?.slrAssessment?.clinicalScore?.total,'The complete clinician-assessed Quadriceps Activation Battery has three components, each 0 to 2. Six is the scale maximum, not a deadline or a measure of all recovery. Video estimates are excluded.','max',null,'clinical')
 ],
 seated_extension:[
  metric('typicalStraightening','Typical bend remaining at straightest point','°',r=>exercisePerformanceMetrics(r).straightening?.median,'Median of the least bend in each completed repetition. Less bend describes a straighter knee in this task, not a clinical extension-lag measurement.','min'),
  metric('straighteningVariation','Variation in straightening endpoints','°',r=>exercisePerformanceMetrics(r).straightening?.standardDeviation,'Standard deviation across at least two completed repetitions. A smaller spread means more similar endpoints, not proven muscle control.'),
  metric('leastBend','Least knee bend achieved','°',r=>m(r).bestObservedStraightening,'Less observed bend indicates a straighter knee in this task. The camera cannot distinguish hyperextension or establish a clinical extension lag. Passive extension must be assessed separately.','min'),
  metric('straightening','Straightening range in a repetition','°',r=>maximum(reps(r).map(p=>p.kneeExcursion)),'Largest observed range in a completed repetition. Interpret the starting position and least bend together; a larger excursion is not always a better result.'),
  ...common,
  metric('returnVariation','Variation in return timing','s',r=>spread(reps(r).map(p=>p.returnDuration)),'Spread (standard deviation) across at least two complete repetitions. A smaller spread means more consistent timing, not proven smoothness or control.','min')
 ],
 heel_slide:[
  metric('typicalPeakBend','Typical deepest bend per slide','°',r=>exercisePerformanceMetrics(r).peakBend?.median,'Median peak bend across completed slides. Compare comfortable movements with the same assistance and setup; this is not a separate maximum active range test.','max'),
  metric('greatestBend','Greatest knee bend achieved','°',r=>m(r).maximumObservedBend,'Greater comfortable bend can indicate increasing observed range. Compare with your own plan and symptoms. Published active-flexion ranges provide context, not a pass mark for an assisted slide.','max'),
  metric('returnBend','Knee bend at the end of the return','°',r=>mean(reps(r).map(p=>p.returnKneeBend)),'Average bend at the end of completed returns. Less bend indicates a straighter observed return. This endpoint was not stored in older reports; reanalyse their recording if available.','min'),
  metric('slideRange','Movement range in a repetition','°',r=>maximum(reps(r).map(p=>p.kneeExcursion)),'Largest bend-to-straighten excursion in a completed repetition. Compare under the same assistance and camera setup.'),
  metric('consistency','Variation in peak bend between repetitions','°',r=>spread(reps(r).map(p=>p.maximumKneeBend)),'Spread (standard deviation) of peak bend across at least two completed repetitions. Less spread means more consistent peaks, but does not prove adequate range or technique.','min'),
  ...common
 ]
};
export function dayNumber(date) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date || ''))return null;
 const t=Date.parse(date+'T12:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===date?Math.floor(t/864e5):null;
}
export const dayAt = n => new Date(n*864e5).toISOString().slice(0,10);
export const localDate = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function postOpDay(date,operationDate) {const a=dayNumber(date),b=dayNumber(operationDate);return a===null||b===null?null:a-b;}
export function measurementSeries(r, metric) {
 const a=report(r), c=a?.config || {};
 const side=metric.source==='video'?c.side:r.pose_validation?.side||r.measurement?.side;
 const base=[r.patient_id,r.operation_date||'',r.exercise,metric.source];
 if(metric.source==='video')base.push(exerciseContextKey(r));
 if(metric.source==='video')base.push(side||'unknown',a?.ruleVersion||'legacy',a?.method||'',a?.modelVersion||'',JSON.stringify(m(r).qualityRules||{}),c.minVisibility??null,!!c.smallMovement,c.bendTolerance??null,c.targetLift??null,c.targetHold??null,c.targetLower??null);
 if(metric.source==='live')base.push(side||'unknown',r.count_source||'monitoring',!!r.hold,r.measurement?.stats_min_visibility??null,r.pose_validation?.version||'',r.pose_validation?.raw_source||'');
 if(metric.source==='clinical')base.push(side||'unknown');
 return JSON.stringify(base);
}
export function seriesFor(records,exercise,metric) {
 const groups=new Map();
 for(const r of records.filter(r=>r.exercise===exercise).sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at))){
  if(metric.source==='video'&&!report(r))continue;
  if(metric.source==='clinical'&&finite(metric.get(r))===null)continue;
  const key=measurementSeries(r,metric),a=report(r),side=metric.source==='video'?a?.config?.side:r.pose_validation?.side||r.measurement?.side;
  const context=exerciseContextFacts(r);
  const label=metric.source==='patient'?'Patient reports':metric.source==='clinical'?'Manual clinical assessment':`${side?side[0].toUpperCase()+side.slice(1):'Unknown'} leg · ${metric.source==='video'?`analysed video · ${context[0][1]} · ${context[1][1]}${normaliseExerciseContext(r.patient?.exercise_context).load_kg!==null?' · '+normaliseExerciseContext(r.patient.exercise_context).load_kg+' kg':''}`:'live recording'}`;
  if(!groups.has(key))groups.set(key,{key,label,records:[]});
  groups.get(key).records.push(r);
 }
 return [...groups.values()].sort((a,b)=>Date.parse(a.records.at(-1).started_at)-Date.parse(b.records.at(-1).started_at));
}
export function dailyRows(records,metric,from,to,operationDate) {
 const start=dayNumber(from),end=dayNumber(to);
 if(start===null||end===null||end<start||end-start>365)throw Error('Choose a date range of up to 366 days.');
 const byDay=new Map();
 for(const record of [...records].sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at))){
  const key=String(record.started_at).slice(0,10);if(dayNumber(key)===null)continue;
  if(!byDay.has(key))byDay.set(key,[]);byDay.get(key).push(record);
 }
 return Array.from({length:end-start+1},(_,i)=>{
  const date=dayAt(start+i),sessions=byDay.get(date)||[],measured=sessions.filter(r=>finite(metric.get(r))!==null),r=measured.at(-1);
  return {date,day:postOpDay(date,operationDate),sessions,measured:measured.length,value:r?finite(metric.get(r)):null,record:r||null};
 });
}
export function metricSummary(records,metric) {
 const measured=records.map(record=>({record,value:finite(metric.get(record))})).filter(p=>p.value!==null).sort((a,b)=>Date.parse(a.record.started_at)-Date.parse(b.record.started_at));
 if(!measured.length)return {latest:null,best:null,change:null,min:null,max:null};
 const latest=measured.at(-1),first=measured[0],target=finite(report(latest.record)?.config?.[metric.target]);
 const min=Math.min(...measured.map(p=>p.value)),max=Math.max(...measured.map(p=>p.value));
 let best=null;
 if(metric.best==='min'||metric.best==='max')best=measured.find(p=>p.value===(metric.best==='min'?min:max));
 if(metric.best==='target'&&target!==null&&target>0)best=measured.reduce((a,b)=>Math.abs(b.value-target)<Math.abs(a.value-target)?b:a);
 return {latest,best,first,target,change:measured.length>1?latest.value-first.value:null,min,max};
}
export const formatValue=(v,unit='')=>finite(v)===null?'Not recorded':`${Number(v.toFixed(unit==='frames'||unit==='reps'?0:1))}${unit==='°'||unit==='%'||unit.startsWith('/')?'':' '}${unit}`.trim();
export function csvText(rows) {return rows.map(row=>row.map(v=>{let s=String(v??'');if(typeof v==='string'&&/^[=+@\-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
