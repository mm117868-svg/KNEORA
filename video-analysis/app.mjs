import {assessPose,analyse,clinicalQAB,slrAssessment} from './analysis.mjs';
const $=id=>document.getElementById(id),video=$('video');
let fileURL,model,report,loading,cancelled=false,busy=false;
function status(text){$('status').textContent=text;}
function waitEvent(target,event,action,timeout=15000){return new Promise((resolve,reject)=>{
  let timer;const clean=()=>{clearTimeout(timer);target.removeEventListener(event,ok);target.removeEventListener('error',bad);};
  const ok=()=>{clean();resolve();},bad=()=>{clean();reject(Error('The browser could not decode this video. Try MP4 (H.264) or WebM.'));};
  target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true});timer=setTimeout(()=>{clean();reject(Error('Video decoding timed out. Try a shorter MP4 clip.'));},timeout);action();
});}
$('file').onchange=async()=>{
  $('run').disabled=true;$('results').hidden=true;report=null;
  if(fileURL)URL.revokeObjectURL(fileURL);
  const file=$('file').files[0];if(!file)return;
  try{fileURL=URL.createObjectURL(file);await waitEvent(video,'loadeddata',()=>{video.src=fileURL;video.load();});
    if(!Number.isFinite(video.duration)||video.duration>300||video.duration<1)throw Error('Choose a video between 1 second and 5 minutes long.');
    status(`Ready: ${video.duration.toFixed(1)} seconds. Select Analyse video. Targets are optional.`);$('run').disabled=false;
  }catch(e){status(e.message);}
};
async function loadModel(){
  if(model)return model;
  status('Loading the local movement tracking model. The video stays on this device.');

  const {FilesetResolver,PoseLandmarker}=await import('./vendor/vision_bundle.mjs');
  const files=await FilesetResolver.forVisionTasks('./vendor/wasm');
  model=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'./vendor/pose_landmarker_full.task',delegate:'CPU'},runningMode:'IMAGE',numPoses:2,minPoseDetectionConfidence:0.6});return model;
}
function waitForModel(){
  if(!loading)loading=loadModel().catch(e=>{loading=null;throw e;});
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const timer=setInterval(()=>{if(cancelled || Date.now()-started>45000){clearInterval(timer);reject(Error(cancelled?'Cancelled':'Tracking model loading timed out. Reload the page and retry.'));}},100);
    loading.then(value=>{clearInterval(timer);resolve(value);},e=>{clearInterval(timer);reject(e);});
  });
}
$('cancel').onclick=()=>{cancelled=true;status('Cancelling analysis…');};
$('run').onclick=async()=>{
  if(busy)return;
  const config={};for(const key of ['start','targetLift','targetHold','targetLower','bendTolerance']){
    if(['targetLift','targetHold','targetLower'].includes(key) && !$(key).value){config[key]=null;continue;}
    if(!$(key).value||!$(key).checkValidity()){$(key).reportValidity();status('Check the values you entered.');return;}config[key]=Number($(key).value);
  }
  if(!$('visibilityThreshold').value || !$('visibilityThreshold').checkValidity()){$('visibilityThreshold').reportValidity();return;}
  config.minVisibility=Number($('visibilityThreshold').value)/100;
  config.side=$('side').value;config.duration=video.duration;
  if(config.start>video.duration-1){status('Leave at least one second after the start time.');return;}
  busy=true;cancelled=false;report=null;$('results').hidden=true;$('run').disabled=true;$('file').disabled=true;$('settings').disabled=true;$('cancel').hidden=false;video.pause();video.controls=false;
  try{
    const detector=await waitForModel();if(cancelled)return;
    const samples=[],canvas=document.createElement('canvas');
    const scale=Math.min(1,960/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    const ctx=canvas.getContext('2d');
    const count=Math.floor((video.duration-config.start)*10);
    for(let i=0;i<count;i++){
      if(cancelled)return;
      const t=config.start+i/10;
      if(Math.abs(video.currentTime-t)>0.001)await waitEvent(video,'seeked',()=>{video.currentTime=t;});
      if(cancelled)return;
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const result=detector.detect(canvas);
      const m=assessPose(result.landmarks,canvas.width,canvas.height,config.side,config.minVisibility);
      samples.push({t,poseCount:result.landmarks.length,...m});
      $('progress').value=(i+1)/count;status(`Analysing ${t.toFixed(1)} / ${video.duration.toFixed(1)} seconds…`);
      await new Promise(r=>setTimeout(r,0));
    }
    report={...analyse(samples,config),fileName:$('file').files[0].name,createdAt:new Date().toISOString(),method:'MediaPipe 2D pose; prototype rules, no clinical validation',modelVersion:'pose_landmarker_full/float16/1',softwareVersion:'0.10.22-rc.20250304'};
    render(report);status('Analysis complete. Review the measurements and tracking coverage.');
  }catch(e){status(`Analysis could not finish: ${e.message}`);}
  finally{busy=false;video.controls=true;$('run').disabled=false;$('file').disabled=false;$('settings').disabled=false;$('cancel').hidden=true;if(cancelled)status('Analysis cancelled. No report was saved.');}
};
function render(r){
  $('results').hidden=false;
  for(const id of ['qabSLR','qabContraction','qabLag'])$(id).value='';
  updateQAB();
  $('summary').textContent=`${r.reps.length} complete repetitions assessed. ${Math.round(r.coverage*100)}% of frames supported full movement tracking. ${r.incomplete} interrupted or incomplete movements excluded. Measurements below include individually visible joints even when a whole repetition could not be assessed.`;
  $('quality').textContent=r.metrics.warning;
  const fmt=(n,unit='°')=>Number.isFinite(n)?`${n.toFixed(1)}${unit}`:'Not available';
  const metrics=[['Video duration',fmt(r.config.duration,' s')],['Analysed duration',fmt(r.metrics.analysedDuration,' s')],['Leg assessed',r.config.side],['Visibility threshold used',`${Math.round(r.metrics.qualityRules.minVisibility*100)}%`],['Frames sampled',r.metrics.sampledFrames],['Fully tracked frames',r.metrics.fullyTrackedFrames],['Mean landmark visibility',Number.isFinite(r.metrics.visibility?.mean)?`${(r.metrics.visibility.mean*100).toFixed(1)}% (model visibility, not accuracy)`:'Not available'],['Frames without full tracking',r.metrics.unusableFrames],['Reference knee bend',fmt(r.baseline?.kneeBend)],['Reference hip flexion estimate',r.baseline?fmt(180-r.baseline.hipAngle):'Not available'],['Average cycle duration',fmt(r.metrics.meanCycleDuration,' s')],['Average hold duration',fmt(r.metrics.meanHold,' s')],['Average lowering duration',fmt(r.metrics.meanLowering,' s')]];
  $('sessionMetrics').replaceChildren();
  for(const [label,value] of metrics){const p=document.createElement('p');const strong=document.createElement('strong');strong.textContent=label+': ';p.append(strong,document.createTextNode(String(value)));$('sessionMetrics').append(p);}
  $('rejections').textContent=`Fully accepted: ${r.metrics.fullyTrackedFrames}. Partially usable: ${r.metrics.partialFrames}. Fully rejected: ${r.metrics.rejectedFrames}. Reasons (one frame may have several): ${Object.entries(r.metrics.rejectionCounts).map(([reason,count])=>reason.replaceAll('_',' ')+': '+count).join(' | ')||'None'}.`;
  $('metricRows').replaceChildren();
  for(const [key,label] of [['bend','Knee bend'],['hipFlexion','Approximate hip flexion'],['hipAngle','Trunk–thigh included angle'],['lift','Lift above inferred lowered position']]){
    const mapping={bend:'kneeBend',hipAngle:'hipIncludedAngle'};const m=r.metrics[mapping[key]??key];const tr=document.createElement('tr');
    for(const value of [label,fmt(m?.minimum),fmt(m?.maximum),fmt(m?.range),fmt(m?.mean),fmt(m?.median),fmt(m?.peakTime,' s'),m?`${m.frames} (${Math.round(m.coverage*100)}%)`:'0 (0%)']){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('metricRows').append(tr);
  }
  $('rows').replaceChildren();$('feedback').replaceChildren();
  r.reps.forEach((rep,i)=>{
    const tr=document.createElement('tr'),td=document.createElement('td'),button=document.createElement('button');button.textContent=`${i+1} · ${rep.start.toFixed(1)} s`;
    button.onclick=()=>{video.currentTime=rep.start;video.play().catch(()=>{});};td.append(button);tr.append(td);
    for(const value of [rep.score===null?'Measured':`${rep.score}/${rep.scoreOutOf}`,`${rep.peakLift.toFixed(1)}°`,`${rep.maxAdditionalBend.toFixed(1)}°`,`${rep.hold.toFixed(1)} s`,`${rep.lower.toFixed(1)} s`]){const cell=document.createElement('td');cell.textContent=value;tr.append(cell);}$('rows').append(tr);
    const p=document.createElement('p');p.textContent=`Repetition ${i+1}: ${rep.feedback.join(' ')}`;$('feedback').append(p);
  });
  const c=$('plot'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle='#d3ddd6';ctx.beginPath();ctx.moveTo(35,145);ctx.lineTo(990,145);ctx.stroke();ctx.fillStyle='#536b60';ctx.font='13px system-ui';ctx.fillText('0°',3,149);
  const max=Math.max(30,...r.trace.filter(s=>Number.isFinite(s.lift)).map(s=>s.lift));ctx.fillText(`${Math.round(max)}°`,0,20);ctx.strokeStyle='#24664f';ctx.lineWidth=2;ctx.beginPath();let pen=false;
  for(const s of r.trace){if(!Number.isFinite(s.lift)){pen=false;continue;}const x=35+(s.t-r.config.start)/(video.duration-r.config.start)*950,y=145-s.lift/max*125;if(pen)ctx.lineTo(x,y);else ctx.moveTo(x,y);pen=true;}ctx.stroke();
}
$('download').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='straight-leg-raise-analysis.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

function saveText(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('csv').onclick=()=>{if(!report)return;const keys=['t','valid','frameStatus','rejectionReasons','poseCount','bend','hipFlexion','hipAngle','lift','visibility'];saveText([keys.join(','),...report.trace.map(s=>keys.map(k=>s[k]??'').join(','))].join('\n'),'exercise-frame-measurements.csv','text/csv');};
$('textReport').onclick=()=>{if(!report)return;saveText(['EXERCISE VIDEO MEASUREMENT REPORT',`File: ${report.fileName}`,`Created: ${report.createdAt}`,`Rules: ${report.ruleVersion}`,$('summary').textContent,$('quality').textContent,$('rejections').textContent,$('sessionMetrics').innerText,$('metricsTable').innerText,$('qabResult').textContent,$('slrResult').innerText,JSON.stringify(report.slrAssessment,null,2),JSON.stringify(report.clinicalScore,null,2),'Per repetition: number/start time, criteria met, peak lift, additional knee bend, hold, lowering',$('rows').innerText,$('feedback').innerText,'Hip flexion = 180 minus the shoulder-hip-knee angle. This is a 2D proxy, not calibrated anatomical hip flexion. Missing measurements are unavailable, not zero. Values describe observed frames only.'].join('\n\n'),'exercise-measurement-report.txt','text/plain');};

function updateQAB(){
  if(!report)return;
  const value=id=>$(id).value===''?null:Number($(id).value);
  report.clinicalScore=clinicalQAB({straightLegRaise:value('qabSLR'),quadricepsContraction:value('qabContraction'),extensionLag:value('qabLag')});
  const q=report.clinicalScore;
  report.slrAssessment=slrAssessment(report,value('qabSLR'));
  const slr=report.slrAssessment;
  $('slrVideoScore').textContent=slr.videoEstimate===null?'Video estimate: not assessable':`Video estimate: ${slr.videoEstimate}/2 (unvalidated adaptation)`;
  $('slrClinicalScore').textContent=slr.clinicalScore===null?'Paper SLR component score: awaiting clinical assessment':`Clinician-entered SLR component score: ${slr.clinicalScore}/2`;
  $('slrReason').textContent=slr.reason;
  $('qabResult').textContent=q.complete?`Clinician-entered QAB total: ${q.total}/6. This is not an automated video score.`:`QAB total: not available. ${Object.values(q.components).filter(v=>v!=null).length}/3 tests entered. Missing tests are not scored as zero.`;
}
for(const id of ['qabSLR','qabContraction','qabLag'])$(id).onchange=updateQAB;
