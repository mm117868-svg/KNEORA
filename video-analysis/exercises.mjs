import {analyse, summarise, slrAssessment} from './analysis.mjs';

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
  r.ruleVersion = 'exercise-prototype-9';
  r.metricSchemaVersion = 2;
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
    rep.cycleDuration = rep.end-rep.start;
    rep.returnDuration = rep.lower;
    if (!finite(rep.outwardDuration)) {
      const peak = Math.max(...frames.map(s=>s.lift).filter(finite));
      rep.outwardDuration = frames.find(s=>s.lift>=peak-3).t-rep.start;
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
  if (exercise==='straight_leg_raise') r.slrAssessment = slrAssessment(r);
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
  for(let i=1;i<selected.length-1;i++) {
    const w=selected.slice(i-1,i+2);
    if(w.some(s=>!finite(s.bend)) || w[1].t-w[0].t>0.25 || w[2].t-w[1].t>0.25) continue;
    candidates.push(median(w.map(s=>s.bend)));
  }
  const direction=exercise==='heel_slide'?1:-1;
  const endpoint=candidates.length ? (direction===1?Math.min(...candidates):Math.max(...candidates)) : null;
  const reference=candidates.filter(n=>Math.abs(n-endpoint)<=3);
  const base=reference.length?median(reference):null;
  const trace=selected.map(s=>({...s,lift:base!==null&&finite(s.bend)?direction*(s.bend-base):null}));
  const baseline=base===null?null:{kneeBend:base,hipAngle:null,method:direction===1?'automatic-least-observed-bend':'automatic-most-observed-bend',referenceFrames:reference.length};
  const reps=[]; let rest=null,pending=null,previous=null,incomplete=0;
  for(const s of trace) {
    if(!finite(s.lift) || (previous!==null&&s.t-previous>0.25)) {
      if(pending) incomplete++;
      pending=null;rest=null;
    }
    previous=s.t;
    if(!finite(s.lift)) continue;
    if(s.lift<=3) {
      if(pending) {
        pending.push(s);
        const duration=s.t-pending[0].t, peak=Math.max(...pending.map(p=>p.lift));
        if(duration>=0.8&&duration<=30&&peak>=10) {
          const peakIndex=pending.findIndex(p=>p.lift===peak);
          let plateauEnd=peakIndex,hold=0,run=0;
          while(plateauEnd<pending.length-1&&pending[plateauEnd+1].lift>=peak-3) plateauEnd++;
          for(let i=1;i<pending.length;i++) {
            run=pending[i].lift>=peak-3&&pending[i-1].lift>=peak-3?run+pending[i].t-pending[i-1].t:0;
            hold=Math.max(hold,run);
          }
          reps.push({start:pending[0].t,end:s.t,peakLift:peak,hold,lower:s.t-pending[plateauEnd].t,
            outwardDuration:pending.find(p=>p.lift>=peak-3).t-pending[0].t,
            score:null,scoreOutOf:0,checks:{},maxAdditionalBend:null,
            feedback:['Range and timing measured. Repeat the movement within the range and pace prescribed by your physiotherapist.']});
        } else incomplete++;
        pending=null;
      }
      rest=s;
    } else if(!pending && s.lift>=6 && rest) {pending=[rest,s];rest=null;}
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
