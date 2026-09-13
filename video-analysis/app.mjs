import {assessPose, clinicalQAB, slrAssessment} from './analysis.mjs';
import {EXERCISES, analyseExercise, chooseSide, compactReport} from './exercises.mjs';
import {recoveryContext} from './evidence.mjs';
import {videoRepetitionCount,trackingFeedback} from '../measurement-quality.mjs';
const $=id=>document.getElementById(id),video=$('video');
let fileURL,model,report,loading,cancelled=false,busy=false,sourceName='',duration=0,metadata={},bridgeToken=null;
const embedded=new URLSearchParams(location.search).get('embedded')==='1';
const fmt=(n,unit='°')=>Number.isFinite(n)?`${n.toFixed(1)}${unit}`:'Not available';
let lastProgressSent=0;
function status(text){
  $('status').textContent=text;
  if(embedded&&bridgeToken&&(!text.startsWith('Analysing ')||Date.now()-lastProgressSent>500)){
    lastProgressSent=Date.now();window.parent.postMessage({type:'exercise-analysis-status',token:bridgeToken,text},location.origin);
  }
}
function waitEvent(target,event,action,timeout=15000){return new Promise((resolve,reject)=>{
  let timer;const clean=()=>{clearTimeout(timer);target.removeEventListener(event,ok);target.removeEventListener('error',bad);};
  const ok=()=>{clean();resolve();},bad=()=>{clean();reject(Error('The browser could not decode this video. Try MP4 (H.264) or WebM.'));};
  target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true});timer=setTimeout(()=>{clean();reject(Error('Video decoding timed out. Try a shorter MP4 clip.'));},timeout);action();
});}
function settingsChanged(){
  const slr=$('exercise').value==='straight_leg_raise';
  document.querySelectorAll('[data-slr-setting]').forEach(el=>el.hidden=!slr);
  $('exerciseHint').textContent=EXERCISES[$('exercise').value].motion+'. Include complete movements that return to their starting position. No timed starting pause is needed.';
}
$('exercise').onchange=settingsChanged;
settingsChanged();
async function loadRecording(blob, info={}){
  if(busy)return;
  $('run').disabled=true;$('results').hidden=true;report=null;metadata=info;
  if(fileURL)URL.revokeObjectURL(fileURL);
  sourceName=blob.name||info.fileName||'Live exercise recording';
  if(EXERCISES[info.exercise])$('exercise').value=info.exercise;
  if(['auto','left','right'].includes(info.side))$('side').value=info.side;
  $('daysPostOp').value=Number.isInteger(info.daysPostOp)&&info.daysPostOp>=0?info.daysPostOp:'';
  $('start').value='0';$('progress').value=0;settingsChanged();
  try{
    fileURL=URL.createObjectURL(blob);
    await waitEvent(video,'loadeddata',()=>{video.src=fileURL;video.load();});
    // MediaRecorder WebM can omit its duration. Seek to the end to let the decoder
    // establish the timeline before seeking individual frames during analysis.
    if(!Number.isFinite(video.duration)){
      await waitEvent(video,'seeked',()=>{video.currentTime=1e10;});
      await waitEvent(video,'seeked',()=>{video.currentTime=0;});
    }
    duration=Number.isFinite(video.duration)?video.duration:info.duration;
    if(!Number.isFinite(duration)||duration>300||duration<1)throw Error('Choose a video between 1 second and 5 minutes long.');
    $('recordingName').textContent=sourceName;
    status(`Ready: ${duration.toFixed(1)} seconds. Select Analyse exercise. Targets are optional.`);$('run').disabled=false;
    return true;
  }catch(e){status(e.message);return false;}
}
$('file').onchange=()=>{const file=$('file').files[0];if(file)loadRecording(file);};
async function loadModel(){
  if(model)return model;
  status('Loading movement tracking. Your video stays on this device.');
  const {FilesetResolver,PoseLandmarker}=await import('./vendor/vision_bundle.mjs');
  const files=await FilesetResolver.forVisionTasks(new URL('./vendor/wasm',import.meta.url).href);
  model=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/pose_landmarker_full.task',import.meta.url).href,delegate:'CPU'},runningMode:'IMAGE',numPoses:2,minPoseDetectionConfidence:0.2,minPosePresenceConfidence:0.2});return model;
}
function waitForModel(){
  if(!loading)loading=loadModel().catch(e=>{loading=null;throw e;});
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const timer=setInterval(()=>{if(cancelled||Date.now()-started>45000){clearInterval(timer);reject(Error(cancelled?'Cancelled':'Tracking model loading timed out. Reload the page and retry.'));}},100);
    loading.then(value=>{clearInterval(timer);resolve(value);},e=>{clearInterval(timer);reject(e);});
  });
}
$('cancel').onclick=()=>{cancelled=true;status('Cancelling analysis…');};
$('run').onclick=run;
async function run(){
  if(busy||!fileURL)return;
  const config={exercise:$('exercise').value};
  for(const key of ['start','targetLift','targetHold','targetLower','bendTolerance']){
    if(key!=='start'&&config.exercise!=='straight_leg_raise'){config[key]=key==='bendTolerance'?10:null;continue;}
    if(['targetLift','targetHold','targetLower'].includes(key)&&!$(key).value){config[key]=null;continue;}
    if(!$(key).value||!$(key).checkValidity()){$(key).reportValidity();status('Check the values you entered.');return;}config[key]=Number($(key).value);
  }
  if(!$('visibilityThreshold').value||!$('visibilityThreshold').checkValidity()){$('visibilityThreshold').reportValidity();return;}
  if(!$('daysPostOp').checkValidity()){$('daysPostOp').reportValidity();return;}
  config.minVisibility=Number($('visibilityThreshold').value)/100;
  config.requestedSide=$('side').value;config.duration=duration;
  const daysPostOp=$('daysPostOp').value===''?null:Number($('daysPostOp').value);
  if(config.start>duration-1){status('Leave at least one second after the start time.');return;}
  busy=true;cancelled=false;report=null;$('results').hidden=true;$('run').disabled=true;$('file').disabled=true;$('settings').disabled=true;$('cancel').hidden=false;video.pause();video.controls=false;
  try{
    const detector=await waitForModel();if(cancelled)return;
    const pairs=[],canvas=document.createElement('canvas');
    const scale=Math.min(1,960/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    const ctx=canvas.getContext('2d'),count=Math.floor((duration-config.start)*10);
    for(let i=0;i<count;i++){
      if(cancelled)return;
      const t=config.start+i/10;
      if(Math.abs(video.currentTime-t)>0.001)await waitEvent(video,'seeked',()=>{video.currentTime=t;});
      if(cancelled)return;
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const result=detector.detect(canvas);
      pairs.push({t,poseCount:result.landmarks.length,left:assessPose(result.landmarks,canvas.width,canvas.height,'left',config.minVisibility),right:assessPose(result.landmarks,canvas.width,canvas.height,'right',config.minVisibility)});
      $('progress').value=(i+1)/count;status(`Analysing ${t.toFixed(1)} / ${duration.toFixed(1)} seconds…`);
      await new Promise(r=>setTimeout(r,0));
    }
    config.side=chooseSide(pairs,config.requestedSide,config.exercise);
    const samples=pairs.map(p=>({t:p.t,poseCount:p.poseCount,...p[config.side]}));
    report={...analyseExercise(samples,config),fileName:sourceName,createdAt:new Date().toISOString(),
      recovery:recoveryContext(config.exercise,daysPostOp),session:{startedAt:metadata.startedAt??null,operationDate:metadata.operationDate??null,prescribedReps:metadata.prescribedReps??null},
      method:'MediaPipe 2D pose; prototype rules, no clinical validation',modelVersion:'pose_landmarker_full/float16/1',softwareVersion:'0.10.22-rc.20250304'};
    render(report);notifyParent();$('results').scrollIntoView({behavior:'smooth',block:'start'});status('Analysis complete. Review the measurements and tracking coverage.');
  }catch(e){status(`Analysis could not finish: ${e.message}`);}
  finally{busy=false;video.controls=true;$('run').disabled=false;$('file').disabled=false;$('settings').disabled=false;$('cancel').hidden=true;if(cancelled)status('Analysis cancelled. No report was saved.');}
}
function addMetric(label,value){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label+': ';p.append(strong,document.createTextNode(String(value)));$('sessionMetrics').append(p);}
function render(r){
  $('results').hidden=false;
  const slr=r.exercise==='straight_leg_raise',ex=EXERCISES[r.exercise];
  $('reportTitle').textContent=r.exerciseName+' report';
  $('clinicalQAB').hidden=!slr;$('slrResult').hidden=!slr;
  for(const id of ['qabSLR','qabContraction','qabLag'])$(id).value='';
  if(slr)updateQAB();
  const measuredCount=videoRepetitionCount(r);
  $('summary').textContent=`${measuredCount===null?'Repetitions not measured. Tracking was not clear enough to establish a count. '+trackingFeedback(r):measuredCount+' complete repetitions observed.'} ${Math.round(r.metrics.repetitionTrackingCoverage*100)}% of sampled frames supported ${slr?'knee and hip':'knee'} tracking for this exercise. ${r.incomplete} interrupted or incomplete movements excluded. Any opening movement without a visible starting position is not counted.`;
  $('quality').textContent=r.metrics.warning+' '+r.limitations;
  $('sessionMetrics').replaceChildren();
  for(const [label,value] of [
    ['Video duration',fmt(r.config.duration,' s')],['Analysed duration',fmt(r.metrics.analysedDuration,' s')],
    ['Leg assessed',r.config.side+(r.config.requestedSide==='auto'?' (automatically selected; confirm this is the intended leg)':'')],
    ['Postoperative day',r.recovery.daysPostOp??'Not entered'],['Visibility threshold',`${Math.round(r.config.minVisibility*100)}%`],
    ['Frames sampled',r.metrics.sampledFrames],['Fully tracked frames',r.metrics.fullyTrackedFrames],
    ['Mean landmark visibility',Number.isFinite(r.metrics.visibility?.mean)?`${(r.metrics.visibility.mean*100).toFixed(1)}% (not accuracy)`:'Not available'],
    ['Reference knee bend',fmt(r.baseline?.kneeBend)],['Least knee bend observed',fmt(r.metrics.bestObservedStraightening)],
    ['Greatest knee bend observed',fmt(r.metrics.maximumObservedBend)],['Average cycle',fmt(r.metrics.meanCycleDuration,' s')],
    [ex.outward+' time, average',fmt(r.metrics.meanOutwardDuration,' s')],['Average hold near peak',fmt(r.metrics.meanHold,' s')],
    [ex.returning+' time, average',fmt(r.metrics.meanReturnDuration,' s')],['Cadence of complete cycles',fmt(r.metrics.observedCadence,' /min')]])addMetric(label,value);
  $('rejections').textContent=`Fully accepted: ${r.metrics.fullyTrackedFrames}. Partially usable: ${r.metrics.partialFrames}. Fully rejected: ${r.metrics.rejectedFrames}. Reasons (a frame may have several): ${Object.entries(r.metrics.rejectionCounts).map(([reason,count])=>reason.replaceAll('_',' ')+': '+count).join(' | ')||'None'}.`;
  $('metricRows').replaceChildren();
  for(const [key,label] of [['kneeBend','Knee bend'],['hipFlexion','Approximate hip flexion'],['hipIncludedAngle','Trunk to thigh included angle'],['motion',ex.motion]]){
    const m=r.metrics[key],tr=document.createElement('tr');
    for(const value of [label,fmt(m?.minimum),fmt(m?.maximum),fmt(m?.range),fmt(m?.mean),fmt(m?.median),fmt(m?.peakTime,' s'),m?`${m.frames} (${Math.round(m.coverage*100)}%)`:'0']){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('metricRows').append(tr);
  }
  $('repHead').replaceChildren();
  for(const label of ['Repetition','Cycle','Motion range','Least knee bend','Greatest knee bend','Peak hip estimate',ex.outward,'Hold',ex.returning,...(slr?['Extra knee bend','Optional criteria']:[])]){const th=document.createElement('th');th.textContent=label;$('repHead').append(th);}
  $('rows').replaceChildren();$('feedback').replaceChildren();
  r.reps.forEach((rep,i)=>{
    const tr=document.createElement('tr'),td=document.createElement('td'),button=document.createElement('button');button.textContent=`${i+1} · ${rep.start.toFixed(1)} s`;
    button.onclick=()=>{video.currentTime=rep.start;video.play().catch(()=>{});};td.append(button);tr.append(td);
    for(const value of [fmt(rep.cycleDuration,' s'),fmt(rep.peakLift),fmt(rep.minimumKneeBend),fmt(rep.maximumKneeBend),fmt(rep.peakHipFlexion),fmt(rep.outwardDuration,' s'),fmt(rep.hold,' s'),fmt(rep.returnDuration,' s'),...(slr?[fmt(rep.maxAdditionalBend),rep.score===null?'No targets':`${rep.score}/${rep.scoreOutOf}`]:[])]){const cell=document.createElement('td');cell.textContent=value;tr.append(cell);}$('rows').append(tr);
    const p=document.createElement('p');p.textContent=`Repetition ${i+1}: ${rep.feedback.join(' ')}`;$('feedback').append(p);
  });
  if(!r.reps.length)$('feedback').textContent='No complete cycles could be measured. Available joint measurements are still shown above. Include a return to the starting position and keep the selected leg visible.';
  $('plotDescription').textContent=ex.motion+' over time. Breaks indicate missing measurements. Select a repetition to play from its start.';
  drawPlot(r);renderEvidence(r.recovery);
}
function drawPlot(r){
  const c=$('plot'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle='#d3ddd6';ctx.beginPath();ctx.moveTo(35,145);ctx.lineTo(990,145);ctx.stroke();ctx.fillStyle='#536b60';ctx.font='13px system-ui';ctx.fillText('0°',3,149);
  const max=Math.max(30,...r.trace.filter(s=>Number.isFinite(s.lift)).map(s=>s.lift));ctx.fillText(`${Math.round(max)}°`,0,20);ctx.strokeStyle='#24664f';ctx.lineWidth=2;ctx.beginPath();let previous=null;
  for(const s of r.trace){if(!Number.isFinite(s.lift)){previous=null;continue;}const x=35+(s.t-r.config.start)/(r.config.duration-r.config.start)*950,y=145-s.lift/max*125;if(previous!==null&&s.t-previous<=0.25)ctx.lineTo(x,y);else ctx.moveTo(x,y);previous=s.t;}ctx.stroke();
}
function renderEvidence(e){
  $('comparison').textContent=e.comparison;
  $('recoveryDay').textContent=e.daysPostOp===null?'Postoperative day not entered.':'This recording: day '+e.daysPostOp+' after surgery.';
  $('milestones').replaceChildren();
  for(const m of e.milestones){const row=document.createElement('tr');for(const text of [m.time,m.observation]){const td=document.createElement('td');td.textContent=text;row.append(td);}const td=document.createElement('td'),a=document.createElement('a');a.href=e.sources[m.source].url;a.textContent=e.sources[m.source].name;a.target='_blank';a.rel='noopener';td.append(a);row.append(td);$('milestones').append(row);}
  $('recoveryNote').textContent=e.interpretation;
  $('broaderAssessment').textContent=e.broaderAssessment;
}
function saveText(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download').onclick=()=>{if(report)saveText(JSON.stringify(report,null,2),`${report.exercise}-analysis.json`,'application/json');};
$('csv').onclick=()=>{if(!report)return;const keys=['t','valid','frameStatus','rejectionReasons','poseCount','bend','hipFlexion','hipAngle','lift','visibility'];saveText([keys.join(','),...report.trace.map(s=>keys.map(k=>s[k]??'').join(','))].join('\n'),`${report.exercise}-frames.csv`,'text/csv');};
$('textReport').onclick=()=>{if(!report)return;saveText(['EXERCISE VIDEO MEASUREMENT REPORT',`Exercise: ${report.exerciseName}`,`File: ${report.fileName}`,`Created: ${report.createdAt}`,`Rules: ${report.ruleVersion}`,$('summary').textContent,$('quality').textContent,$('sessionMetrics').innerText,$('rejections').textContent,$('metricsTable').innerText,$('rows').innerText,$('feedback').innerText,...(report.exercise==='straight_leg_raise'?[$('qabResult').textContent,$('slrResult').innerText]:[]),$('evidence').innerText,JSON.stringify(report.recovery,null,2),JSON.stringify(report.clinicalScore??null,null,2)].join('\n\n'),`${report.exercise}-report.txt`,'text/plain');};
function updateQAB(){
  if(!report||report.exercise!=='straight_leg_raise')return;
  const value=id=>$(id).value===''?null:Number($(id).value);
  report.clinicalScore=clinicalQAB({straightLegRaise:value('qabSLR'),quadricepsContraction:value('qabContraction'),extensionLag:value('qabLag')});
  const q=report.clinicalScore;report.slrAssessment=slrAssessment(report,value('qabSLR'));const slr=report.slrAssessment;
  $('slrVideoScore').textContent=slr.videoEstimate===null?'Video estimate: not assessable':`Video estimate: ${slr.videoEstimate}/2 (unvalidated adaptation)`;
  $('slrClinicalScore').textContent=slr.clinicalScore===null?'Paper SLR component score: awaiting clinical assessment':`Clinician-entered SLR component score: ${slr.clinicalScore}/2`;
  $('slrReason').textContent=slr.reason;
  $('qabResult').textContent=q.complete?`Clinician-entered QAB total: ${q.total}/6. This is not an automated video score.`:`QAB total: not available. ${Object.values(q.components).filter(v=>v!=null).length}/3 tests entered. Missing tests are not scored as zero.`;
  notifyParent();
}
for(const id of ['qabSLR','qabContraction','qabLag'])$(id).onchange=updateQAB;
function notifyParent(){if(embedded&&bridgeToken&&report)window.parent.postMessage({type:'exercise-analysis-complete',token:bridgeToken,report:compactReport(report)},location.origin);}
if(embedded){
  $('backLink').hidden=true;$('uploadField').hidden=true;$('recordingHeading').textContent='Your recording';
  addEventListener('message',async event=>{
    if(event.origin!==location.origin||event.source!==window.parent)return;
    const d=event.data;
    if(d?.type==='exercise-analysis-load'&&d.blob instanceof Blob&&!busy){
      bridgeToken=d.token;
      if(await loadRecording(d.blob,d.metadata))run();
    }
  });
  window.parent.postMessage({type:'exercise-analysis-ready'},location.origin);
}
addEventListener('pagehide',()=>{cancelled=true;if(fileURL)URL.revokeObjectURL(fileURL);model?.close();});
