import test from 'node:test';
import assert from 'node:assert/strict';
import {detailedExerciseSummary,renderDetailedExerciseSummary} from '../exercise-details.mjs';
import {distribution} from '../video-analysis/statistics.mjs';
import {analyseExercise,compactReport} from '../video-analysis/exercises.mjs';
import {renderBasicExerciseSummary} from '../exercise-summary.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function record(){return {exercise:'heel_slide',duration_s:40,prescribed_reps:4,monitoring:{repetitions:4},exercise_analysis:{exercise:'heel_slide',config:{start:0,duration:40},metrics:{analysedDuration:40,repetitionTrackingCoverage:1},reps:[
  {start:1,end:5,cycleDuration:4,phaseTiming:{outward:1,hold:0,return:3},minimumKneeBend:5,maximumKneeBend:85,kneeExcursion:80},
  {start:8,end:16,cycleDuration:8,phaseTiming:{outward:2,hold:2,return:4},minimumKneeBend:3,maximumKneeBend:93,kneeExcursion:90},
  {start:18,end:24,cycleDuration:6,phaseTiming:{outward:1,hold:3,return:2},minimumKneeBend:4,maximumKneeBend:104,kneeExcursion:100},
  {start:27,end:31,cycleDuration:4,phaseTiming:{outward:1,hold:0,return:3},minimumKneeBend:0,maximumKneeBend:100,kneeExcursion:100}
],incomplete:2}};}
test('statistics use a true even median and exclude missing or non-finite values',()=>{
 const d=distribution([null,NaN,Infinity,'10',0,2,8,10]);assert.equal(d.count,4);assert.equal(d.mean,5);assert.equal(d.median,5);assert.equal(d.minimum,0);assert.equal(d.maximum,10);close(d.p05,.3);close(d.p95,9.7);
 assert.equal(distribution([]),null);assert.equal(distribution([0]).standardDeviation,null);
});
test('fastest and slowest, tied repetitions, zero holds and total cycle time are exact',()=>{
 const s=detailedExerciseSummary(record());assert.deepEqual(s.timings.fastest,{value:4,repetitions:[1,4]});assert.deepEqual(s.timings.slowest,{value:8,repetitions:[2]});
 assert.deepEqual(s.timings.shortestHold,{value:0,repetitions:[1,4]});assert.deepEqual(s.timings.longestHold,{value:3,repetitions:[3]});
 assert.equal(s.timings.cycleTime,22);assert.equal(s.timings.otherTime,18);assert.equal(s.timings.gapTime,8);assert.equal(s.timings.holdTime,5);assert.equal(s.timings.outwardTime,5);assert.equal(s.timings.returnTime,12);
 close(s.timings.cadence,60/5.5);assert.equal(s.timings.sessionRate,6);assert.equal(s.timing[0].stats.median,5);assert.equal(s.observedCount,4);
});
test('missing per-repetition timing stays unavailable despite an old aggregate average',()=>{
 const r=record();r.exercise_analysis.reps=[{maximumKneeBend:90}];r.exercise_analysis.metrics.meanCycleDuration=7;
 const s=detailedExerciseSummary(r);assert.equal(s.timings.fastest,null);assert.equal(s.timings.shortestHold,null);assert.equal(s.timings.cycleTime,null);assert.equal(s.timings.cadence,null);
 assert.equal(s.angles[1].stats.mean,90);assert.equal(s.angles[1].stats.standardDeviation,null);
});
test('no tracked repetitions cannot be labelled zero ability or zero timing',()=>{
 const r=record();r.exercise_analysis.reps=[];r.exercise_analysis.metrics.repetitionTrackingCoverage=0;r.monitoring.repetitions=0;
 const s=detailedExerciseSummary(r);assert.equal(s.observedCount,null);assert.equal(s.count,null);assert.equal(s.timings.cycleTime,null);assert.equal(s.timings.holdTime,null);
 assert.match(renderDetailedExerciseSummary(r),/No complete repetitions were measurable/);
});
test('partial-video count never becomes a whole-session rate',()=>{
 const r=record();r.exercise_analysis.config.start=10;r.exercise_analysis.metrics.analysedDuration=30;
 const html=renderDetailedExerciseSummary(r);assert.ok(!html.includes('Repetitions per minute over the whole session'));assert.match(html,/Time outside complete repetitions/);assert.match(html,/not a measurement of rest/);
});
test('wrong-exercise reports do not leak angles or timing into this exercise',()=>{
 const r=record();r.exercise_analysis.exercise='straight_leg_raise';const s=detailedExerciseSummary(r);assert.equal(s.report,null);assert.equal(s.rows.length,0);assert.equal(s.timings.fastest,null);
});
test('legacy target-zone hold is not passed off as a peak-position hold',()=>{
 const r=record();r.exercise_analysis.config.targetLift=50;r.exercise_analysis.reps=[{start:0,end:5,hold:0,lower:2,outwardDuration:2}];
 assert.equal(detailedExerciseSummary(r).rows[0].hold,null);delete r.exercise_analysis.config.targetLift;assert.equal(detailedExerciseSummary(r).rows[0].hold,0);
});
test('unavailable live results, visible zero degrees and spoken counts stay distinct',()=>{
 const r={exercise:'seated_extension',duration_s:0,count_source:'patient_voice',patient_count:{repetitions:3},measurement:{min_extension_deg:0}};
 const s=detailedExerciseSummary(r);assert.equal(s.liveCount,3);assert.equal(s.timings.sessionRate,null);const html=renderDetailedExerciseSummary(r);assert.match(html,/<strong>0°<\/strong>/,'a real zero is a result and is shown large');assert.doesNotMatch(html,/Not measured|Not recorded/,'what was not measured is left out, not listed');assert.ok(!html.includes('Infinity'));
});

function samples(exercise){return Array.from({length:80},(_,i)=>{const t=i/10,v=t<1?0:t<3?(t-1)/2:t<4?1:t<6?(6-t)/2:0;return {t,bend:exercise==='straight_leg_raise'?4+2*v:exercise==='seated_extension'?90-80*v:5+100*v,hipFlexion:exercise==='straight_leg_raise'?30*v:null,hipAngle:exercise==='straight_leg_raise'?180-30*v:null,valid:exercise==='straight_leg_raise',frameStatus:exercise==='straight_leg_raise'?'accepted':'partial'};});}
for(const exercise of ['straight_leg_raise','seated_extension','heel_slide'])test(`${exercise}: frame measurements survive compact persistence and phase times add to the cycle`,()=>{
 const result=analyseExercise(samples(exercise),{exercise,start:0,duration:8,bendTolerance:10,targetLift:null,targetHold:null,targetLower:null}),rep=result.reps[0];
 assert.equal(result.reps.length,1);assert.equal(result.metricSchemaVersion,3);close(rep.phaseTiming.outward+rep.phaseTiming.hold+rep.phaseTiming.return,rep.cycleDuration);
 assert.ok(rep.phaseTiming.hold>=1);assert.ok(rep.outwardSpeed>0);assert.ok(rep.returnSpeed>0);assert.ok(rep.kneeBend.count>0);assert.ok(rep.kneeBend.mean>=rep.minimumKneeBend);
 if(exercise!=='straight_leg_raise'){assert.equal(rep.hipFlexion,null);assert.equal(rep.peakHipFlexion,null);}
 const saved=JSON.parse(JSON.stringify(compactReport(result)));assert.deepEqual(saved.reps,result.reps);assert.ok(!('trace' in saved));
 const r={exercise,exercise_analysis:saved,duration_s:8};const html=renderBasicExerciseSummary(r);
 assert.match(html,/Full exercise breakdown/);assert.match(html,/Fastest repetition/);assert.match(html,/Timing for each repetition/);assert.match(html,/Maximum observed knee extension: bend remaining/);
 assert.match(html,/<details class="exercise-more"><summary>All the numbers, for your physiotherapist<\/summary>/,'the long detail is folded away, the headline cards are not');assert.ok(html.indexOf('exercise-hero')<html.indexOf('<details'));assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
});
test('SLR peak hold stays measured even when the optional target is unreachable',()=>{
 const r=analyseExercise(samples('straight_leg_raise'),{exercise:'straight_leg_raise',start:0,duration:8,bendTolerance:10,targetLift:60});
 assert.equal(r.reps[0].hold,0);assert.ok(r.reps[0].phaseTiming.hold>=1);const s=detailedExerciseSummary({exercise:r.exercise,exercise_analysis:compactReport(r)});assert.ok(s.timings.longestHold.value>=1);
});
test('sample medians and extrema times are saved even without a completed cycle',()=>{
 const r=analyseExercise([{t:0,bend:10,valid:false},{t:.1,bend:20,valid:false}],{exercise:'heel_slide',start:0,duration:.2,bendTolerance:10});
 assert.equal(r.metrics.kneeBend.median,15);assert.equal(r.metrics.kneeBend.minimumTime,0);assert.equal(r.metrics.kneeBend.peakTime,.1);assert.equal(r.reps.length,0);
});
test('record-derived rejection names are escaped and uncertainty is explicit',()=>{
 const r=record();r.exercise_analysis.metrics.rejectionCounts={'<img onerror=alert(1)>':2};const html=renderDetailedExerciseSummary(r);
 assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);assert.match(html,/not a measure of clinical accuracy/);assert.match(html,/not confidence limits/);
});
