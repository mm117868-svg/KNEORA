import {cycleSensitivity} from './sensitivity.mjs';
import {analyse, summarise, slrAssessment} from './analysis.mjs?v=full-breakdown-1';
import {distribution} from './statistics.mjs';

export const EXERCISES = Object.freeze({
  straight_leg_raise: {name: 'Straight leg raise', motion: 'Hip lift above the observed lowered position', outward: 'Lifting', returning: 'Lowering'},
  seated_extension: {name: 'Seated knee extension', motion: 'Knee straightening from the observed bent position', outward: 'Straightening', returning: 'Bending back'},
  heel_slide: {name: 'Heel slide', motion: 'Knee bending from the observed straightened position', outward: 'Bending', returning: 'Straightening back'}
});
const median = xs => [...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const finite = Number.isFinite;

// Select once for the whole recording. Never splice the two legs into one trace.
export function chooseSide(pairs, requested = 'auto', exercise = 'straight_leg_raise') {
  if (['left','right'].includes(requested)) return requested;
  const count = side => pairs.filter(p => exercise === 'straight_leg_raise' ? p[side].valid : finite(p[side].bend)).length;
  return count('left') >= count('right') ? 'left' : 'right';
}

function enrich(r, exercise) {
  r.exercise = exercise;
  r.exerciseName = EXERCISES[exercise].name;
  r.ruleVersion = 'exercise-prototype-11';
  r.metricSchemaVersion = 3;
  for (const rep of r.reps) {
    const frames = r.trace.filter(s=>s.t>=rep.start && s.t<=rep.end);
    const knees = frames.map(s=>s.bend).filter(finite), hips = frames.map(s=>s.hipFlexion).filter(finite);
    const endpoint = frames.at(-1);
    rep.returnKneeBend = endpoint && Math.abs(endpoint.t-rep.end)<0.001 && finite(endpoint.bend) ? endpoint.bend : null;
    rep.minimumKneeBend = knees.length ? Math.min(...knees) : null;
    rep.maximumKneeBend = knees.length ? Math.max(...knees) : null;
    rep.kneeExcursion = knees.length ? Math.max(...knees)-Math.min(...knees) : null;
    rep.peakHipFlexion = hips.length ? Math.max(...hips) : null;
    rep.hipExcursion = hips.length ? Math.max(...hips)-Math.min(...hips) : null;
    rep.kneeBend = distribution(knees);
    rep.hipFlexion = distribution(hips);
    rep.startKneeBend = finite(frames[0]?.bend) ? frames[0].bend : null;
    rep.startHipFlexion = finite(frames[0]?.hipFlexion) ? frames[0].hipFlexion : null;
    rep.returnHipFlexion = finite(endpoint?.hipFlexion) ? endpoint.hipFlexion : null;
    // Three consecutive phases around the first observed maximum. This hold
    // describes the peak zone, independently of a clinician-entered target.
    const motion=frames.map(s=>s.lift).filter(finite);
    if(motion.length===frames.length && motion.length){
      const peak=Math.max(...motion),peakIndex=motion.indexOf(peak),band=r.config.cycleSensitivity?.band??3;
      let first=peakIndex,last=peakIndex;
      while(first>0 && motion[first-1]>=peak-band)first--;
      while(last<frames.length-1 && motion[last+1]>=peak-band)last++;
      rep.peakTime=frames[peakIndex].t;
      rep.phaseTiming={outward:frames[first].t-rep.start,hold:frames[last].t-frames[first].t,return:rep.end-frames[last].t,bandDegrees:band};
      rep.outwardSpeed=rep.phaseTiming.outward>0?Math.abs(motion[first]-motion[0])/rep.phaseTiming.outward:null;
      rep.returnSpeed=rep.phaseTiming.return>0?Math.abs(motion[last]-motion.at(-1))/rep.phaseTiming.return:null;
    }
    rep.cycleDuration = rep.end-rep.start;
    rep.returnDuration = rep.lower;
    if (!finite(rep.outwardDuration)) {
      const peak = Math.max(...frames.map(s=>s.lift).filter(finite));
      rep.outwardDuration = frames.find(s=>s.lift>=peak-(r.config.cycleSensitivity?.band??3)).t-rep.start;
    }
  }
  r.metrics.meanOutwardDuration = mean(r.reps.map(p=>p.outwardDuration));
  r.metrics.meanReturnDuration = mean(r.reps.map(p=>p.returnDuration));
  r.metrics.observedCadence = r.metrics.meanCycleDuration ? 60/r.metrics.meanCycleDuration : null;
  r.metrics.repetitionTrackingCoverage = r.trace.length ? r.trace.filter(s=>exercise==='straight_leg_raise'?s.valid:finite(s.bend)).length/r.trace.length : 0;
  if(exercise!=='straight_leg_raise'&&r.metrics.repetitionTrackingCoverage>=0.8) r.metrics.warning='Knee tracking covered at least 80% of sampled frames. Any missing hip measurements remain unavailable. Coverage does not establish measurement accuracy.';
  r.metrics.motion = r.metrics.lift;
  r.metrics.bestObservedStraightening = r.metrics.kneeBend?.minimum ?? null;
  r.metrics.maximumObservedBend = r.metrics.kneeBend?.maximum ?? null;
  if (exercise==='straight_leg_raise') { r.slrAssessment = slrAssessment(r); if(r.config.smallMovement){r.slrAssessment.videoEstimate=null;r.slrAssessment.reason='Small movement mode counts observed attempts. It does not establish the clinical SLR test criteria.';} }
  r.limitations = 'Unvalidated 2D camera estimates. Observed range is not a test of maximum capacity. Knee angles cannot distinguish hyperextension from flexion. Hip flexion is a trunk-relative proxy. Pain, swelling, strength, passive range and clinical extension lag cannot be inferred.';
  return r;
}

export function analyseExercise(samples, config) {
  const exercise = config.exercise ?? 'straight_leg_raise';
  if (!EXERCISES[exercise]) throw Error('This exercise is not supported for analysis.');
  if (!finite(config.start) || config.start<0) throw Error('Enter a valid analysis start time.');
  if (exercise==='straight_leg_raise') return enrich(analyse(samples, config),exercise);
  // Knee-only cycles remain measurable when the shoulder is obscured.
  const selected = samples.filter(s=>s.t>=config.start), candidates=[];
  const sensitivity=cycleSensitivity(selected,s=>s.bend,config.smallMovement);config={...config,cycleSensitivity:sensitivity};
  for(let i=1;i<selected.length-1;i++) {
    const w=selected.slice(i-1,i+2);
    if(w.some(s=>!finite(s.bend)) || w[1].t-w[0].t>0.25 || w[2].t-w[1].t>0.25) continue;
    candidates.push(median(w.map(s=>s.bend)));
  }
  const direction=exercise==='heel_slide'?1:-1;
  const endpoint=candidates.length ? (direction===1?Math.min(...candidates):Math.max(...candidates)) : null;
  const reference=candidates.filter(n=>Math.abs(n-endpoint)<=sensitivity.band);
  const base=config.smallMovement&&sensitivity.resolved?sensitivity.baseline:reference.length?median(reference):null;
  const trace=selected.map(s=>({...s,lift:base!==null&&finite(s.bend)?direction*(s.bend-base):null}));
  const baseline=base===null?null:{kneeBend:base,hipAngle:null,method:config.smallMovement?'still-start-noise-calibration':direction===1?'automatic-least-observed-bend':'automatic-most-observed-bend',referenceFrames:reference.length};
  const reps=[]; let rest=null,pending=null,previous=null,incomplete=0;
  for(const s of trace) {
    if(!finite(s.lift) || (previous!==null&&s.t-previous>0.25)) {
      if(pending) incomplete++;
      pending=null;rest=null;
    }
    previous=s.t;
    if(!finite(s.lift)) continue;
    if(s.lift<=sensitivity.return) {
      if(pending) {
        pending.push(s);
        const duration=s.t-pending[0].t, peak=Math.max(...pending.map(p=>p.lift));
        if(duration>=0.8&&duration<=30&&peak>=sensitivity.minimumExcursion) {
          const peakIndex=pending.findIndex(p=>p.lift===peak);
          let plateauEnd=peakIndex,hold=0,run=0;
          while(plateauEnd<pending.length-1&&pending[plateauEnd+1].lift>=peak-sensitivity.band) plateauEnd++;
          for(let i=1;i<pending.length;i++) {
            run=pending[i].lift>=peak-sensitivity.band&&pending[i-1].lift>=peak-sensitivity.band?run+pending[i].t-pending[i-1].t:0;
            hold=Math.max(hold,run);
          }
          reps.push({start:pending[0].t,end:s.t,peakLift:peak,hold,lower:s.t-pending[plateauEnd].t,
            outwardDuration:pending.find(p=>p.lift>=peak-sensitivity.band).t-pending[0].t,
            score:null,scoreOutOf:0,checks:{},maxAdditionalBend:null,
            feedback:['Range and timing measured. Repeat the movement within the range and pace prescribed by your physiotherapist.']});
        } else incomplete++;
        pending=null;
      }
      rest=s;
    } else if(!pending && s.lift>=sensitivity.onset && rest) {pending=[rest,s];rest=null;}
    else if(pending) {
      pending.push(s);
      if(s.t-pending[0].t>30) {incomplete++;pending=null;rest=null;}
    }
  }
  if(pending) incomplete++;
  return enrich({config,baseline,trace,reps,incomplete,coverage:trace.length?trace.filter(s=>s.valid).length/trace.length:0,metrics:summarise(trace,reps,config,baseline)},exercise);
}

// Persist only compact measurements and provenance. Recordings stay in memory.
export function compactReport(report) {
  const {trace,...compact}=report;
  return structuredClone(compact);
}
