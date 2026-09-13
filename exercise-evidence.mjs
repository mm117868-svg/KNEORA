import {distribution} from './video-analysis/statistics.mjs';
import {esc} from './progress-shared.mjs';

export const EVIDENCE_REVIEW_DATE='2026-09-13';
export const EXERCISE_SOURCES={
 guideline:{name:'Bove et al., 2026 physiotherapy guideline',url:'https://pubmed.ncbi.nlm.nih.gov/42506877/',design:'Guideline drawing on 227 included articles',finding:'Supports active, assisted and passive range exercises, strengthening and functional rehabilitation after primary knee replacement.'},
 review:{name:'Konnyu et al., rehabilitation systematic review',url:'https://pubmed.ncbi.nlm.nih.gov/35302953/',design:'53 randomised trials; low strength of evidence',finding:'Rehabilitation studies use pain, range, strength and daily function outcomes. They do not establish a universal video technique score for these exercises.'},
 qab:{name:'Bade et al., Quadriceps Activation Battery',url:'https://pubmed.ncbi.nlm.nih.gov/28864244/',design:'Secondary analysis of a trial, 162 patients',finding:'The clinician-assessed battery at about day 4 was related to early activation, strength and functional recovery. Three components each score 0 to 2; a routine exercise video is not the complete test.'},
 slr:{name:'Suh et al., early straight leg raise',url:'https://pubmed.ncbi.nlm.nih.gov/33779408/',design:'Retrospective cohort, 888 knees in 865 patients',finding:'A leg raise on postoperative day 1 was associated with earlier mobility and discharge. This association is not a deadline or evidence that forcing an early lift improves recovery.'},
 slides:{name:'Eymir et al., active heel-slide trial',url:'https://pubmed.ncbi.nlm.nih.gov/32778907/',design:'Randomised trial of active heel slides versus continuous passive motion',finding:'Outcomes included active range, pain, knee circumference, proprioception and functional tests. These outcomes support what to follow, not a validated heel-slide technique score.'},
 flexion:{name:'Kittelson et al., flexion reference chart',url:'https://pubmed.ncbi.nlm.nih.gov/32698900/',design:'327 patients for development; 171 for validation',finding:'Typical active bend, middle 50%: 70 to 90° early after surgery, 95 to 115° around one month and 109 to 122° around three months. These are reference ranges, not mandatory deadlines or targets for an assisted slide.'},
 strength:{name:'Paravlic et al., quadriceps strength recovery',url:'https://pubmed.ncbi.nlm.nih.gov/35692543/',design:'Systematic review and meta-analysis, 17 studies and 832 patients',finding:'Quadriceps strength falls early and recovers over months. Strength needs a force or torque assessment; repetition count, hip angle and movement speed cannot substitute for it.'}
};
export const EXERCISE_EVIDENCE={
 straight_leg_raise:{name:'Straight leg raise',aim:'Lift the operated leg while maintaining the knee straightening available to you.',
  priorities:[['Knee control','Additional knee bend during each lift, together with the absolute knee bend. Less extra bend describes better maintenance of the starting position; it does not measure clinical extension lag.'],['Lift and return','Hip lift range, hold and lowering time, completed repetitions and how repeatable the movement is. Higher or faster is not automatically better.'],['Independence','Whether the leg can be lifted without a person, strap or other assistance. Record help explicitly; video alone cannot confirm independence.']],
  sources:['qab','slr','strength'],clinical:'A physiotherapist can assess the complete Quadriceps Activation Battery (0 to 6), passive extension and quadriceps force. No new validated SLR score is inferred from this recording.'},
 seated_extension:{name:'Seated knee extension',aim:'Straighten the operated knee through the range in your plan, then return with control.',
  priorities:[['Active straightening','Bend remaining at the straightest point of each repetition. 0° means straight in this display. Compare typical repetitions as well as the best observed angle.'],['Range and return','Knee excursion from the seated starting position, hold time, return time and repetition consistency. Interpret the angles alongside posture and symptoms.'],['Strength context','Assistance, external resistance, completed repetitions and reported effort. More repetitions at a different load are not a like-for-like strength comparison.']],
  sources:['guideline','qab','strength'],clinical:'Clinical extension lag requires comparison with separately assessed passive extension. Routine seated repetitions do not reproduce the supported extension-lag test in the QAB. Muscle force needs a separate test.'},
 heel_slide:{name:'Heel slides',aim:'Bend the operated knee within your agreed comfortable range and straighten it again.',
  priorities:[['Bending range','Greatest bend in each slide, typical peak bend across repetitions and the highest observed angle. A comfortable increase under comparable conditions can be useful progress.'],['Straightening on return','Bend remaining when the leg returns, and the range travelled during each slide. A deeper bend alone does not describe the whole exercise.'],['Repeatability and symptoms','Variation between peak bends, repetition timing, assistance and pain. A consistent small movement is not proof of adequate range.']],
  sources:['slides','flexion','guideline'],clinical:'A standardised active range examination provides the closest comparison with the flexion chart. Assisted slides, exercise maxima and camera estimates are not interchangeable with that examination.'}
};
const link=id=>`<a href="${EXERCISE_SOURCES[id].url}" target="_blank" rel="noopener">${esc(EXERCISE_SOURCES[id].name)}</a>`;
const validAngle=n=>Number.isFinite(n)&&n>=0&&n<=180?n:null;
const stats=values=>distribution(values.map(validAngle));
const numeric=n=>Number.isFinite(n)?n:null;
export function exercisePerformanceMetrics(record){
 const report=record.exercise_analysis?.exercise===record.exercise?record.exercise_analysis:null;
 const reps=Array.isArray(report?.reps)?report.reps:[];
 return {
  extraBend:stats(reps.map(r=>r.maxAdditionalBend)),straightening:stats(reps.map(r=>r.minimumKneeBend)),
  peakBend:stats(reps.map(r=>r.maximumKneeBend)),returnBend:stats(reps.map(r=>r.returnKneeBend)),
  kneeRange:stats(reps.map(r=>r.kneeExcursion)),hipPeak:stats(reps.map(r=>r.peakHipFlexion)),liftRange:stats(reps.map(r=>r.peakLift))
 };
}
const degrees=n=>numeric(n)===null?'Not measured':`About ${Math.round(n*10)/10}°`;
export function renderExerciseEvidenceSummary(record){
 const info=EXERCISE_EVIDENCE[record.exercise];if(!info)return '';
 const p=exercisePerformanceMetrics(record),a=record.exercise_analysis?.exercise===record.exercise?record.exercise_analysis:null;
 const rows=record.exercise==='straight_leg_raise'?[
  ['Extra knee bend while lifting',p.extraBend?.median,'Typical extra bend across completed lifts. Compare with the largest extra bend in the full report.'],
  ['Knee bend at the straightest part of each lift',p.straightening?.median,'The absolute bend matters too. No additional bend does not necessarily mean a fully straight knee.'],
  ['Hip lift above the lowered position',p.liftRange?.median,'Use the lift range in your plan. This angle does not measure thigh strength.']
 ]:record.exercise==='seated_extension'?[
  ['Bend remaining at the straightest point',p.straightening?.median,'Typical straightest point across completed repetitions. 0° means straight; this is not clinical extension lag.'],
  ['Knee movement range per repetition',p.kneeRange?.median,'Read this alongside the seated starting angle and the straightest angle.'],
  ['Variation in straightening between repetitions',p.straightening?.standardDeviation,'Smaller spread means more similar endpoints, not a validated control score.']
 ]:[
  ['Knee bend at the deepest part of each slide',p.peakBend?.median,'Typical peak bend across completed slides. Consider comfortable range and assistance.'],
  ['Bend remaining after returning',p.returnBend?.median,'Typical return endpoint. Less remaining bend describes a straighter return.'],
  ['Variation in deepest bend between slides',p.peakBend?.standardDeviation,'Smaller spread means more similar peaks. It does not establish a sufficient range.']
 ];
 return `<section class="exercise-evidence" aria-label="Physiotherapy priorities for this exercise"><div class="eyebrow">What matters for this exercise</div><h4>${esc(info.aim)}</h4><p>These are the measurements to discuss with your physiotherapist. “Typical” is the median across completed repetitions; variation is the standard deviation and needs at least two.</p><dl class="exercise-evidence-metrics">${rows.map(([label,value,note])=>`<div><dt>${esc(label)}</dt><dd>${esc(degrees(value))}<p>${esc(note)}</p></dd></div>`).join('')}</dl>${!a?'<p>The figures will fill in after automatic analysis if the recording contains usable movements.</p>':''}<p>${esc(info.clinical)}</p><p class="exercise-simple-note">Camera observations, not a validated exercise grade. Hold time, cadence and speed have no universal pass mark established in the studies reviewed. The intended pace and range come from your physiotherapist.</p><p class="exercise-evidence-links">${info.sources.map(link).join(' · ')}</p></section>`;
}
export function renderExerciseEvidenceGuide(){
 return `<section class="pt-panel" id="exercise-evidence"><div class="eyebrow">Research behind your measurements</div><h2>What physiotherapists look for</h2><p>For the three exercises currently available, follow movement, symptoms and assistance together. A useful direction of progress is not a pass mark for a particular postoperative day.</p><div class="pt-reference-list">${Object.values(EXERCISE_EVIDENCE).map(info=>`<details><summary>${esc(info.name)}</summary><p><strong>${esc(info.aim)}</strong></p>${info.priorities.map(([title,body])=>`<p><strong>${esc(title)}.</strong> ${esc(body)}</p>`).join('')}<p><strong>Separate clinical assessment.</strong> ${esc(info.clinical)}</p>${info.sources.map(id=>`<p>${link(id)}. ${esc(EXERCISE_SOURCES[id].design)}. ${esc(EXERCISE_SOURCES[id].finding)}</p>`).join('')}</details>`).join('')}</div><p><strong>For every exercise:</strong> the report collects repetitions, time, observed angles and phase timing. You can add help used, resistance and pain during the exercise. Pain afterwards and effort are recorded separately. Swelling, next-day response, walking, stairs and measured strength need additional assessment.</p><p>We found no validated universal cadence, hold duration or 0 to 100 video technique score for these three routine exercises. ${link('review')}. Published test scores require their own instructions and assessments.</p><p class="pt-muted">Focused PubMed search reviewed 13 September 2026. Prioritised the current guideline, systematic reviews and directly relevant studies. This is not an exhaustive systematic review or clinical validation of the app.</p></section>`;
}
