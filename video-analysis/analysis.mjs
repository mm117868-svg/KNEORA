import {cycleSensitivity} from './sensitivity.mjs';
import {distribution} from './statistics.mjs';
// Pure measurement and segmentation functions. All thresholds are prototype rules.
export const RULE_VERSION = 'slr-prototype-10';
const median = xs => {const s = [...xs].sort((a,b)=>a-b); return s[Math.floor(s.length/2)];};
export function angle(a,b,c) {
  const u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y];
  const d=Math.hypot(...u)*Math.hypot(...v);
  return d<1e-8 ? NaN : Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/d)))*180/Math.PI;
}
export const QUALITY_RULES={minVisibility:0.2,minPresence:0.2,minSegmentPixels:20};
export function assessPose(poses,width,height,side,minVisibility=QUALITY_RULES.minVisibility){
  if(!Number.isFinite(minVisibility)||minVisibility<0.1||minVisibility>0.95)throw Error('Visibility threshold must be between 10% and 95%.');
  const empty=reason=>({valid:false,frameStatus:'rejected',rejectionReasons:reason,bend:null,hipAngle:null,hipFlexion:null,visibility:null});
  if(!poses?.length)return empty('no_person_detected');
  if(poses.length!==1)return empty('multiple_people_detected');
  const lm=poses[0],ids=side==='left'?[11,23,25,27]:[12,24,26,28];
  const names=['shoulder','hip','knee','ankle'],reasons=[];
  const points=ids.map((id,i)=>{
    const p=lm[id];let issue;
    if(!p)issue='missing';
    else if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)issue='outside_frame';
    else if(!Number.isFinite(p.visibility)||p.visibility<minVisibility)issue='low_visibility';
    else if(p.presence!=null && (!Number.isFinite(p.presence)||p.presence<QUALITY_RULES.minPresence))issue='low_presence';
    if(issue){reasons.push(names[i]+':'+issue);return null;}
    return {x:p.x*width,y:p.y*height,visibility:p.visibility};
  });
  function joint(a,b,c,name){
    if(!a||!b||!c)return null;
    if(Math.hypot(a.x-b.x,a.y-b.y)<QUALITY_RULES.minSegmentPixels||Math.hypot(c.x-b.x,c.y-b.y)<QUALITY_RULES.minSegmentPixels){reasons.push(name+':segment_too_short');return null;}
    const value=angle(a,b,c);return Number.isFinite(value)?value:null;
  }
  const [shoulder,hip,knee,ankle]=points;
  const kneeAngle=joint(hip,knee,ankle,'knee'),hipAngle=joint(shoulder,hip,knee,'hip');
  const bend=kneeAngle===null?null:180-kneeAngle,hipFlexion=hipAngle===null?null:180-hipAngle;
  const valid=bend!==null && hipFlexion!==null;
  return {valid,frameStatus:valid?'accepted':bend!==null||hipFlexion!==null?'partial':'rejected',rejectionReasons:reasons.join(';'),bend,hipAngle,hipFlexion,visibility:points.every(Boolean)?Math.min(...points.map(p=>p.visibility)):null};
}
export function measure(lm,width,height,side){
  const result=assessPose(lm?[lm]:[],width,height,side);
  return result.frameStatus==='rejected'?null:result;
}
export function summarise(trace,reps,config,baseline){
  function stats(key){
    const points=trace.filter(s=>Number.isFinite(s[key]));
    if(!points.length)return null;
    const values=points.map(s=>s[key]),result=distribution(values);
    return {...result,peakTime:points.find(s=>s[key]===result.maximum).t,minimumTime:points.find(s=>s[key]===result.minimum).t,frames:values.length,coverage:values.length/trace.length};
  }
  const tracked=trace.filter(s=>s.valid).length;
  const rejectionCounts={};
  for(const s of trace)for(const reason of (s.rejectionReasons??'').split(';').filter(Boolean))rejectionCounts[reason]=(rejectionCounts[reason]??0)+1;
  return {qualityRules:{...QUALITY_RULES,minVisibility:config.minVisibility??QUALITY_RULES.minVisibility},rejectionCounts,partialFrames:trace.filter(s=>s.frameStatus==='partial').length,rejectedFrames:trace.filter(s=>s.frameStatus==='rejected').length,sampledFrames:trace.length,fullyTrackedFrames:tracked,unusableFrames:trace.length-tracked,
    analysedDuration:config.duration!=null?config.duration-config.start:(trace.length?trace.at(-1).t-trace[0].t+0.1:0),
    kneeBend:stats('bend'),hipFlexion:stats('hipFlexion'),hipIncludedAngle:stats('hipAngle'),lift:stats('lift'),visibility:stats('visibility'),
    meanCycleDuration:reps.length?reps.reduce((sum,r)=>sum+r.end-r.start,0)/reps.length:null,
    meanHold:reps.length?reps.reduce((sum,r)=>sum+r.hold,0)/reps.length:null,
    meanLowering:reps.length?reps.reduce((sum,r)=>sum+r.lower,0)/reps.length:null,
    warning:tracked/Math.max(1,trace.length)<0.8?'Limited tracking: these are observations from visible frames only. Peaks and ranges may miss movement or contain tracking error.':'2D prototype estimates. Coverage does not establish measurement accuracy.',
    referenceAvailable:!!baseline};
}

export function analyse(samples,config) {
  for(const key of ['targetLift','targetHold','targetLower']) if(config[key]!=null && (!Number.isFinite(config[key])||config[key]<=0)) throw Error('Optional targets must be positive numbers when entered.');
  if(!Number.isFinite(config.bendTolerance)||config.bendTolerance<=0)throw Error('Knee bend tolerance must be a positive number.');
  // Infer the lowered position across the selected recording, without a timed pause.
  // Three consecutive tracked frames suppress isolated angle spikes and never bridge gaps.
  const selected=samples.filter(s=>s.t>=config.start);
  const sensitivity=cycleSensitivity(selected,s=>s.valid&&Number.isFinite(s.hipAngle)?180-s.hipAngle:null,config.smallMovement);
  config={...config,cycleSensitivity:sensitivity};
  const candidates=[];
  for(let i=1;i<selected.length-1;i++){
    const window=selected.slice(i-1,i+2);
    if(window.some(s=>!s.valid || !Number.isFinite(s.hipAngle) || !Number.isFinite(s.bend)))continue;
    if(window[1].t-window[0].t>0.25 || window[2].t-window[1].t>0.25)continue;
    candidates.push({t:selected[i].t,hipAngle:median(window.map(s=>s.hipAngle)),bend:median(window.map(s=>s.bend))});
  }
  if(candidates.length<1){
    const trace=selected.map(s=>({...s,hipFlexion:Number.isFinite(s.hipAngle)?180-s.hipAngle:null,lift:null}));
    return {ruleVersion:RULE_VERSION,config,baseline:null,coverage:trace.length?trace.filter(s=>s.valid).length/trace.length:0,reps:[],incomplete:0,trace,metrics:summarise(trace,[],config,null)};
  }
  const lowestObserved=Math.max(...candidates.map(s=>s.hipAngle));
  const reference=candidates.filter(s=>s.hipAngle>=lowestObserved-sensitivity.band);
  const baseHip=config.smallMovement&&sensitivity.resolved?180-sensitivity.baseline:median(reference.map(s=>s.hipAngle)),baseBend=median(reference.map(s=>s.bend));
  const trace=selected.map(s=>({...s,hipFlexion:Number.isFinite(s.hipAngle)?180-s.hipAngle:null,lift:Number.isFinite(s.hipAngle)?baseHip-s.hipAngle:null}));
  const reps=[];let pending=null,lastRest=null,incomplete=0,previousTime=null;
  for(const s of trace.filter(s=>s.t>=config.start)) {
    if(previousTime!==null && s.t-previousTime>0.25){if(pending){incomplete++;pending=null;}lastRest=null;}
    previousTime=s.t;
    if(!s.valid){if(pending){incomplete++;pending=null;}lastRest=null;continue;}
    if(s.lift<=sensitivity.return){
      if(pending){
        pending.push(s);const duration=s.t-pending[0].t;
        if(duration>=0.8 && duration<=30 && (!config.smallMovement || (sensitivity.resolved && Math.max(...pending.map(p=>p.lift))>=sensitivity.minimumExcursion))){
          const peak=Math.max(...pending.map(p=>p.lift));
          const peakIndex=pending.findIndex(p=>p.lift===peak);
          // Longest consecutive time within the target zone, never summed across gaps.
          let run=0,hold=0;
          for(let i=1;i<pending.length;i++){
            run=pending[i].lift>=(config.targetLift??peak)-sensitivity.band && pending[i-1].lift>=(config.targetLift??peak)-sensitivity.band ? run+pending[i].t-pending[i-1].t : 0;
            hold=Math.max(hold,run);
          }
          let lowerIndex=peakIndex;
          while(lowerIndex<pending.length-1 && pending[lowerIndex+1].lift>=peak-sensitivity.band)lowerIndex++;
          const lower=s.t-pending[lowerIndex].t;
          // A sustained loss (at least 0.3 s) is more robust than one noisy maximum.
          let bendRun=0,bendLost=false;
          for(let i=1;i<pending.length;i++){
            bendRun=pending[i].bend-baseBend>config.bendTolerance && pending[i-1].bend-baseBend>config.bendTolerance ? bendRun+pending[i].t-pending[i-1].t:0;
            if(bendRun>=0.3-1e-6)bendLost=true;
          }
          const hasTargets=['targetLift','targetHold','targetLower'].some(key=>config[key]!=null);
          const checks=hasTargets?{kneeControl:!bendLost}:{};
          if(config.targetLift!=null)checks.range=peak>=config.targetLift-3;
          if(config.targetHold!=null)checks.hold=hold>=config.targetHold-0.15;
          if(config.targetLower!=null)checks.lowering=lower>=config.targetLower-0.15;
          const feedback=[];
          if(bendLost)feedback.push('Additional knee bending was detected. Ask your physiotherapist to review this repetition before using its score to progress.');
          if(checks.range===false)feedback.push('The lift did not reach the entered target. Check this target with your physiotherapist.');
          if(checks.hold===false)feedback.push('The hold was shorter than the entered target.');
          if(checks.lowering===false)feedback.push('Lowering was faster than the entered target.');
          if(!feedback.length)feedback.push(hasTargets?'This repetition met the selected prototype criteria.':'Movement measured. Add optional targets if you want a criteria score.');
          reps.push({start:pending[0].t,end:s.t,peakLift:peak,maxAdditionalBend:Math.max(0,...pending.map(p=>p.bend-baseBend)),hold,lower,checks,score:hasTargets?Object.values(checks).filter(Boolean).length:null,scoreOutOf:Object.keys(checks).length,feedback});
        }else incomplete++;
        pending=null;
      }
      lastRest=s;
    }else if(!pending && s.lift>=sensitivity.onset && lastRest){pending=[lastRest,s];lastRest=null;}
    else if(pending){pending.push(s);if(s.t-pending[0].t>30){incomplete++;pending=null;lastRest=null;}}
  }
  if(pending)incomplete++;
  return {ruleVersion:RULE_VERSION,config,baseline:{hipAngle:baseHip,kneeBend:baseBend,method:config.smallMovement?"still-start-noise-calibration":"automatic-lowest-observed",referenceFrames:reference.length},coverage:trace.length?trace.filter(s=>s.valid).length/trace.length:0,reps,incomplete,trace,metrics:summarise(trace,reps,config,{hipAngle:baseHip,kneeBend:baseBend})};
}

export function clinicalQAB(components){
  const keys=['straightLegRaise','quadricepsContraction','extensionLag'];
  for(const key of keys)if(components[key]!=null && ![0,1,2].includes(components[key]))throw Error('QAB components must be 0, 1, 2 or not assessed.');
  const complete=keys.every(key=>components[key]!=null);
  return {name:'Quadriceps Activation Battery',source:'https://doi.org/10.1016/j.apmr.2017.07.013',method:'Clinician-entered component scores using published protocol; not inferred from video',components,total:complete?keys.reduce((sum,key)=>sum+components[key],0):null,outOf:6,complete,automatedValidation:false};
}

export function slrAssessment(report,reviewScore=null){
  if(reviewScore!=null && ![0,1,2].includes(reviewScore))throw Error('SLR review score must be 0, 1 or 2.');
  let estimate=null,reason;
  if(report.coverage<0.8)reason='Insufficient full tracking for an automatic estimate (prototype coverage gate: 80%).';
  else if(!report.baseline || !report.reps.length)reason='No complete tracked lift. This cannot distinguish inability from a missed or incomplete recording, so it is not scored as zero.';
  else{
    // Exploratory adaptation only. The paper gives no camera angle tolerance.
    // Classify a completed lift as maintained only when its observed maximum additional
    // bend stays within the entered engineering tolerance. Do not average ordinal grades.
    const maintained=report.reps.filter(r=>r.maxAdditionalBend<=report.config.bendTolerance);
    const trial=maintained.length?maintained[0]:report.reps[0];
    estimate=maintained.length?2:1;
    reason=`Based on a complete detected lift at ${trial.start.toFixed(1)} s and the entered ${report.config.bendTolerance}° bend tolerance. This tolerance, inferred baseline and trial selection are engineering choices, not the published clinical protocol. Heel clearance, the 2-foot target and full available extension require review.`;
  }
  return {name:'SLR component of QAB',source:'https://doi.org/10.1016/j.apmr.2017.07.013',videoEstimate:estimate,outOf:2,videoEstimateValidated:false,clinicalScore:reviewScore,clinicalScoreOrigin:reviewScore==null?'not assessed':'clinician entered using published criteria',reason};
}
