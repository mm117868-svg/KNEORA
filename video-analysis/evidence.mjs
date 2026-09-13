export const SOURCES = {
  nice: {name:'NICE NG157, postoperative rehabilitation',url:'https://www.nice.org.uk/guidance/ng157/chapter/Recommendations'},
  chart: {name:'Kittelson et al. (2020), knee flexion recovery reference chart',url:'https://doi.org/10.1186/s12891-020-03493-x'},
  qab: {name:'Bade et al. (2018), Quadriceps Activation Battery',url:'https://doi.org/10.1016/j.apmr.2017.07.013'},
  koos: {name:'Lyman et al. (2016), validation of KOOS JR',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC4868168/'},
  guideline: {name:'APTA clinical practice guideline, revision 2026',url:'https://doi.org/10.1093/ptj/pzag058'},
  oxford: {name:'Oxford Knee Score, official description and scoring',url:'https://innovation.ox.ac.uk/licence-details/oxford-knee-score-oks'},
  outcomes: {name:'APTA 2020 guideline, outcomes assessment',url:'https://academic.oup.com/ptj/article/100/9/1603/5857258'}
};
export const MILESTONES = [
  {time:'Day 0 to 1',observation:'Start rehabilitation and mobilisation with the clinical team, when appropriate, within 24 hours.',source:'nice'},
  {time:'Early postoperative period',observation:'Knee flexion was typically 70 to 90° in the reference cohort (middle 50% of observations).',source:'chart'},
  {time:'Around 1 month',observation:'Knee flexion was typically 95 to 115° in the reference cohort (middle 50%).',source:'chart'},
  {time:'Around 3 months',observation:'Knee flexion was typically 109 to 122° in the reference cohort (middle 50%).',source:'chart'}
];
export function recoveryContext(exercise, daysPostOp=null) {
  const day=Number.isInteger(daysPostOp)&&daysPostOp>=0?daysPostOp:null;
  const comparisons={
    straight_leg_raise:'Relevant clinical assessment: the SLR component of the Quadriceps Activation Battery (0 to 2). The complete QAB totals three clinician-assessed tests (0 to 6). A routine lift video does not establish the published setup, available passive extension or the full battery.',
    seated_extension:'Track the least knee bend achieved, straightening excursion and control over each cycle. The QAB extension-lag component needs clinician positioning and support withdrawal; ordinary seated repetitions do not reproduce that test. A clinical lag value also needs passive extension measured separately.',
    heel_slide:'Track the greatest knee bend achieved, straightening at return and the observed movement range. The flexion reference chart gives recovery context. It is not a validated heel-slide technique score, and assisted slides are not equivalent to the study’s active range test.'
  };
  return {reviewedAt:'2026-09-13',daysPostOp:day,comparison:comparisons[exercise],
    milestones:MILESTONES,sources:SOURCES,
    interpretation:'These ranges describe a group of patients, not a deadline or your personal target. Your physiotherapist should interpret progress alongside pain, swelling and function. For repeat measurements, use the same exercise, leg, assistance and camera setup.',
    broaderAssessment:'Recovery also includes pain, swelling, strength, walking and everyday function. KOOS JR is a validated seven-question patient-reported measure (0 to 100); it requires the actual questionnaire responses and official scoring, not video. The Oxford Knee Score is another patient questionnaire (12 questions, 0 to 48). Timed Up and Go and chair-rise tests require separate standardised tasks.'};
}
