import {recordedCount} from './patient-progress.js?v=high-five-small-1';
import {EXERCISE_NAMES,METRICS,finite,postOpDay,measurementSeries} from './progress-data.mjs?v=high-five-small-1';
import {esc,shortDate,dayLabel} from './progress-shared.mjs';
import {MIN_COUNT_COVERAGE,trackingCoverage,videoRepetitionCount,trackingFeedback} from './measurement-quality.mjs?v=high-five-small-1';
const positive=n=>finite(n)!==null&&n>0?n:null;
const nonnegative=n=>finite(n)!==null&&n>=0?n:null;
const round=n=>Math.round(n*10)/10;
const angle=n=>finite(n)===null?'Not measured':`About ${Math.round(n)}°`;
const average=xs=>{const a=xs.filter(n=>finite(n)!==null);return a.length?a.reduce((sum,n)=>sum+n,0)/a.length:null;};
function liveRepetitionTempo(record) {
 if(record.count_source==='pose_gated_optical'){
  const times=[...new Set((record.pose_validation?.events||[]).filter(e=>e.status==='accepted'&&finite(e.confirmedAt)!==null).map(e=>e.confirmedAt))].sort((a,b)=>a-b);
  return average(times.slice(1).map((t,i)=>positive(t-times[i])));
 }
 const counter=record.count_source==='knee_tracker'?record.tracking:(!record.count_source||record.count_source==='monitoring')?record.monitoring:null;
 return positive(counter?.tempo_s_per_rep);
}
export function timeWords(seconds) {
 if(nonnegative(seconds)===null)return 'Not recorded';
 const total=Math.round(seconds),minutes=Math.floor(total/60),rest=total%60;
 return minutes?`${minutes} min${rest?' '+rest+' sec':''}`:`${rest} sec`;
}
const timingWords=s=>finite(s)===null?'not measured':`${round(s)} sec`;
const facts={
 straight_leg_raise:{title:'Straight leg raise',focus:'This exercise works on keeping your knee steady as you lift your leg. Follow the lift height and pace your physiotherapist has given you.',key:'extraBend',direction:'extra knee bend during lifting',source:'https://www.orthoinfo.org/recovery/total-knee-replacement-exercise-guide/'},
 seated_extension:{title:'Seated knee extension',focus:'The useful things to follow are how far you can straighten your knee and how steadily you bend it back. Keep to the range and pace in your exercise plan.',key:'leastBend',direction:'bend at your straightest position',source:'https://doi.org/10.1093/ptj/pzag058'},
 heel_slide:{title:'Heel slides',focus:'The useful things to follow are how far your knee bends and how well you straighten it again. Build range within your exercise plan, alongside how your knee feels.',key:'greatestBend',direction:'bend at your furthest point',source:'https://doi.org/10.1186/s12891-020-03493-x'}
};
const counterLabel=r=>({pose_gated_optical:'Camera count confirmed in the selected leg',patient_voice:'Your spoken count',knee_tracker:'Live knee tracker count',monitoring:'Live camera count',timer:'Completed holds'}[r.count_source||'monitoring']||'Recorded count');
function previousMeasurement(record,history,metric) {
 const current=finite(metric.get(record));if(current===null)return null;
 const earlier=history.filter(r=>Date.parse(r.started_at)<Date.parse(record.started_at)&&measurementSeries(r,metric)===measurementSeries(record,metric)&&finite(metric.get(r))!==null).sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at)).at(-1);
 if(!earlier)return null;
 const delta=round(current-metric.get(earlier));
 return {delta,date:earlier.started_at.slice(0,10),day:postOpDay(earlier.started_at.slice(0,10),earlier.operation_date)};
}
export function basicExerciseSummary(record,history=[]) {
 const info=facts[record.exercise]||{title:EXERCISE_NAMES[record.exercise]||'Exercise',focus:'Follow the exercise plan agreed with your physiotherapist.'};
 const report=record.exercise_analysis?.exercise===record.exercise?record.exercise_analysis:null,metrics=report?.metrics||{},reps=Array.isArray(report?.reps)?report.reps:[];
 const day=postOpDay(String(record.started_at||'').slice(0,10),record.operation_date);
 const coverage=trackingCoverage(report);
 const videoCount=videoRepetitionCount(report),liveCount=recordedCount(record);
 const count=videoCount??liveCount;
 const partial=!!report&&((positive(report.config?.start)??0)>0 || (positive(metrics.analysedDuration)!==null&&positive(record.duration_s)!==null&&metrics.analysedDuration<record.duration_s-1));
 let countNote=count===null?'Tracking was not clear enough to measure repetitions. This does not mean you performed none.':videoCount!==null?`Complete repetitions seen${partial?' in the analysed part':' in the video'}${coverage<MIN_COUNT_COVERAGE?'; more may have been missed':''}${liveCount!==null&&liveCount!==videoCount?`. ${counterLabel(record)}: ${liveCount}.`:'.'}`:`${counterLabel(record)}${report?'; video count unavailable':''}`;
 if(report?.config?.smallMovement||record.pose_validation?.small_movement)countNote+=' Small movements are counted as observed attempts; range is measured separately.';
 // Never attach the background camera counter's tempo to the patient's spoken count.
 const tempo=report?(reps.length?positive(metrics.meanCycleDuration)??average(reps.map(p=>positive(p.cycleDuration))):null):(liveCount>=2?liveRepetitionTempo(record):null);
 const cadence=tempo?60/tempo:null;
 const get=id=>{const metric=METRICS[record.exercise]?.find(m=>m.id===id);return metric?finite(metric.get(record)):null;};
 let movement=[];
 if(record.exercise==='straight_leg_raise'){
  movement=[{label:'Keeping your knee straight',value:report&&get('extraBend')!==null?`Up to about ${Math.round(get('extraBend'))}° extra bend while lifting`:'Not measured yet'},
   {label:'Hip bend at the top',value:angle(get('hip'))},
   {label:'How far you lifted',value:get('lift')!==null?`${angle(get('lift'))} above your lowered position`:'Not measured'}];
 } else if(record.exercise==='seated_extension'){
  const least=report?get('leastBend'):finite(record.measurement?.min_extension_deg);
  movement=[{label:'Your straightest knee',value:least!==null?`${angle(least)} of bend remaining`:'Not measured'},
   {label:'How far you straightened',value:angle(get('straightening'))}];
 } else if(record.exercise==='heel_slide'){
  const peak=report?get('greatestBend'):finite(record.measurement?.peak_flexion_deg),peaks=reps.map(r=>r.maximumKneeBend).filter(n=>finite(n)!==null);
  movement=[{label:'Your furthest knee bend',value:angle(peak)},
   {label:'Your knee on the return',value:get('returnBend')!==null?`${angle(get('returnBend'))} of bend remaining, on average`:'Not measured'},
   {label:'How far your knee moved',value:angle(get('slideRange'))}];
  if(peaks.length>=2)movement.push({label:'Repeating the bend',value:`Your deepest bends ranged from ${Math.round(Math.min(...peaks))}° to ${Math.round(Math.max(...peaks))}°`});
 }
 const outward=report?nonnegative(metrics.meanOutwardDuration):null,hold=report?nonnegative(metrics.meanHold):null,back=report?nonnegative(metrics.meanReturnDuration??metrics.meanLowering):null;
 const verbs=record.exercise==='straight_leg_raise'?['Lift','Lower']:record.exercise==='seated_extension'?['Straighten','Bend back']:['Bend','Straighten back'];
 const stages=report&&reps.length?[[verbs[0],outward],['Hold',hold],[verbs[1],back]].filter(([,v])=>v!==null).map(([label,value])=>`${label}: ${timingWords(value)}`).join(' · '):'';
 const metric=METRICS[record.exercise]?.find(m=>m.id===info.key),previous=report&&metric?previousMeasurement(record,history,metric):null;
 const comparison=previous?`${previous.delta===0?'About the same':`About ${Math.abs(previous.delta)}° ${previous.delta>0?'more':'less'}`} ${info.direction} than your previous measured session (${shortDate(previous.date)}${previous.day!==null?', '+dayLabel(previous.day):''}).`:null;
 const pain=nonnegative(record.patient?.pain_0_10),difficulty=nonnegative(record.patient?.difficulty_1_5);
 let quality=report?'Angles are camera estimates. Keep the same camera position when comparing sessions.':record.recording?.captured?'This summary updates automatically when video analysis finishes. Live angles are estimates.':'Live angles are estimates. Video analysis needs a usable recording.';
 if(report&&(coverage===null||coverage<.8))quality=coverage===null?'Some movements may not have been captured clearly. Read these figures as estimates.':coverage===0?'The video did not capture enough clear movement to measure it. The live count, if available, is shown instead.':`The camera could follow ${Math.round(coverage*100)}% of the analysed movement samples. Some repetitions or angles may have been missed.`;
 if(report&&(coverage===null||coverage<MIN_COUNT_COVERAGE))quality+=' '+trackingFeedback(report);
 if(report&&record.exercise==='seated_extension')quality+=' A hands-on check is needed to measure clinical extension lag.';
 if(partial)quality+=` Angles and video repetitions cover ${timeWords(metrics.analysedDuration)} of the recording; total time is for the whole session.`;
 return {title:info.title,day,date:String(record.started_at||'').slice(0,10),side:report?.config?.side||record.measurement?.side,count,countNote,duration:timeWords(record.duration_s),tempo,cadence,stages,movement,focus:info.focus,source:info.source,comparison,quality,analysed:!!report,
  symptoms:[pain!==null?`Pain afterwards: ${pain}/10`:null,difficulty!==null?`Effort: ${difficulty}/5`:null].filter(Boolean).join(' · ')};
}
export function renderBasicExerciseSummary(record,history=[]) {
 const s=basicExerciseSummary(record,history);
 const card=(label,value,note)=>`<div class="exercise-simple-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`;
 return `<section class="exercise-simple" aria-label="Your exercise summary"><div class="eyebrow">Exercise finished</div><h2 tabindex="-1">${esc(s.title)}</h2><p class="exercise-simple-date">${esc(shortDate(s.date))} · ${esc(dayLabel(s.day))}${s.side?` · ${esc(s.side)} leg`:''}</p>
 <div class="exercise-simple-stats">${card('Repetitions',s.count===null?'Not measured':String(s.count),s.countNote)}${card('Time spent',s.duration,'Whole session, including pauses')}${card('Your pace',s.cadence===null?'Not measured':`${round(s.cadence)} per min`,s.tempo===null?'Available when repeat timing is measured':`About ${round(s.tempo)} sec per repetition${s.analysed?' in the video':' between live counts'}`)}</div>
 <dl class="exercise-simple-movement">${s.movement.map(m=>`<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl>
 ${s.stages?`<p class="exercise-simple-tempo"><strong>Your timing, on average</strong><br>${esc(s.stages)}</p>`:''}
 <div class="exercise-simple-context"><h3>For your recovery${s.day!==null&&s.day>=0?` on day ${s.day}`:''}</h3><p>${esc(s.focus)}</p>${s.comparison?`<p>${esc(s.comparison)}</p>`:''}<p class="exercise-simple-note">Follow your own plan. Recovery has no single daily pass mark.</p><a href="?view=progress-to-date">See your progress and recovery references</a>${s.source?` · <a href="${esc(s.source)}" target="_blank" rel="noopener">Exercise reference</a>`:''}</div>
 ${s.symptoms?`<p class="exercise-simple-symptoms">${esc(s.symptoms)}</p>`:''}<p class="exercise-simple-note">${esc(s.quality)}</p></section>`;
}
