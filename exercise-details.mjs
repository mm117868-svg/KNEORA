import {distribution} from './video-analysis/statistics.mjs';
import {recordedCount} from './patient-progress.js?v=high-five-small-1';
import {trackingCoverage,videoRepetitionCount} from './measurement-quality.mjs?v=high-five-small-1';
import {esc} from './progress-shared.mjs';

const finite=Number.isFinite;
const nonnegative=n=>finite(n)&&n>=0?n:null;
const positive=n=>finite(n)&&n>0?n:null;
const number=(n,unit='')=>finite(n)?`${Math.round(n*10)/10}${unit}`:'Not measured';
const seconds=n=>number(n,' s');
const percent=n=>number(finite(n)?n*100:null,'%');
const sumAll=values=>values.length&&values.every(finite)?values.reduce((sum,n)=>sum+n,0):null;
const phase=(rep,key,config)=>nonnegative(rep.phaseTiming?.[key]??(key==='outward'?rep.outwardDuration:key==='return'?rep.returnDuration??rep.lower:config.targetLift==null?rep.hold:null));
const pairDifference=(a,b)=>finite(a)&&finite(b)?Math.abs(a-b):null;
const vocabulary={
  straight_leg_raise:{outward:'Lifting',returning:'Lowering',motion:'Hip lift above the lowered position',joint:'Hip',extra:true},
  seated_extension:{outward:'Straightening',returning:'Bending back',motion:'Knee straightening from the bent position',joint:'Knee'},
  heel_slide:{outward:'Bending',returning:'Straightening back',motion:'Knee bending from the starting position',joint:'Knee'}
};

export function detailedExerciseSummary(record) {
  const report=record.exercise_analysis?.exercise===record.exercise?record.exercise_analysis:null;
  const metrics=report?.metrics||{},config=report?.config||{},vocab=vocabulary[record.exercise];
  const reps=Array.isArray(report?.reps)?report.reps:[];
  const rows=reps.map((rep,i)=>({number:i+1,start:nonnegative(rep.start),end:nonnegative(rep.end),
    duration:positive(rep.cycleDuration)??(finite(rep.end)&&finite(rep.start)?positive(rep.end-rep.start):null),
    outward:phase(rep,'outward',config),hold:phase(rep,'hold',config),returning:phase(rep,'return',config),
    kneeMin:nonnegative(rep.minimumKneeBend),kneeMax:nonnegative(rep.maximumKneeBend),kneeMean:nonnegative(rep.kneeBend?.mean),kneeMedian:nonnegative(rep.kneeBend?.median),kneeRange:nonnegative(rep.kneeExcursion),
    kneeStart:nonnegative(rep.startKneeBend),kneeReturn:nonnegative(rep.returnKneeBend),
    hipMin:nonnegative(rep.hipFlexion?.minimum),hipMax:nonnegative(rep.peakHipFlexion),hipMean:nonnegative(rep.hipFlexion?.mean),hipMedian:nonnegative(rep.hipFlexion?.median),hipRange:nonnegative(rep.hipExcursion),hipStart:nonnegative(rep.startHipFlexion),hipReturn:nonnegative(rep.returnHipFlexion),
    motion:nonnegative(rep.peakLift),extraBend:nonnegative(rep.maxAdditionalBend),peakTime:nonnegative(rep.peakTime),
    outwardSpeed:nonnegative(rep.outwardSpeed),returnSpeed:nonnegative(rep.returnSpeed)}));
  const distributionRow=(label,key,unit='s')=>({label,unit,stats:distribution(rows.map(row=>row[key]))});
  const timing=vocab?[
    distributionRow('Full repetition','duration'),distributionRow(vocab.outward,'outward'),
    distributionRow('Hold near the furthest position','hold'),distributionRow(vocab.returning,'returning'),
    {label:'Cadence within a repetition',unit:'reps/min',stats:distribution(rows.map(row=>row.duration?60/row.duration:null))}
  ]:[];
  const angles=vocab?[
    distributionRow('Least knee bend per repetition','kneeMin','°'),distributionRow('Greatest knee bend per repetition','kneeMax','°'),
    distributionRow('Knee movement range per repetition','kneeRange','°'),distributionRow('Knee bend at the start','kneeStart','°'),
    distributionRow('Knee bend on return','kneeReturn','°'),
    ...(vocab.extra?[distributionRow('Extra knee bending during the lift','extraBend','°')]:[]),
    distributionRow(vocab.motion,'motion','°'),distributionRow('Peak approximate hip bend per repetition','hipMax','°'),
    distributionRow('Hip movement range per repetition','hipRange','°'),
    distributionRow('Hip bend at the start','hipStart','°'),distributionRow('Hip bend on return','hipReturn','°'),
    {label:'Difference between starting and returning knee bend',unit:'°',stats:distribution(rows.map(row=>pairDifference(row.kneeStart,row.kneeReturn)))}
  ]:[];
  const speed=vocab?[distributionRow(`${vocab.outward}: average angular speed`,'outwardSpeed','°/s'),distributionRow(`${vocab.returning}: average angular speed`,'returnSpeed','°/s')]:[];
  const cycles=rows.map(row=>row.duration),cycleStats=distribution(cycles),cycleTime=sumAll(cycles);
  const observedCount=videoRepetitionCount(report),liveCount=recordedCount(record),count=observedCount??liveCount;
  const extreme=(key,which)=>{
    const available=rows.filter(row=>finite(row[key]));if(!available.length)return null;
    const value=Math[which](...available.map(row=>row[key]));
    return {value,repetitions:available.filter(row=>Math.abs(row[key]-value)<1e-6).map(row=>row.number)};
  };
  const gaps=rows.slice(1).map((row,i)=>finite(row.start)&&finite(rows[i].end)?nonnegative(row.start-rows[i].end):null);
  if(vocab)timing.push({label:'Gap between complete repetitions',unit:'s',stats:distribution(gaps)});
  const total=nonnegative(record.duration_s),analysed=nonnegative(metrics.analysedDuration);
  const cadence=cycleStats?.mean?60/cycleStats.mean:null;
  const timings={cycleTime,holdTime:sumAll(rows.map(row=>row.hold)),outwardTime:sumAll(rows.map(row=>row.outward)),returnTime:sumAll(rows.map(row=>row.returning)),
    otherTime:finite(cycleTime)&&finite(analysed)?nonnegative(analysed-cycleTime):null,gapTime:sumAll(gaps),gaps:distribution(gaps),
    cadence,sessionRate:count!==null&&positive(total)!==null?count*60/total:null,
    fastest:extreme('duration','min'),slowest:extreme('duration','max'),shortestHold:extreme('hold','min'),longestHold:extreme('hold','max'),
    cycleVariation:cycleStats?.mean&&finite(cycleStats.standardDeviation)?100*cycleStats.standardDeviation/cycleStats.mean:null};
  // Older saved reports retain their own available statistics; never recreate
  // full-video averages from per-repetition endpoints or live preview points.
  const videoAngles=report?[
    {label:'Knee bending',stats:metrics.kneeBend},
    {label:'Approximate hip bending',stats:metrics.hipFlexion},
    {label:'Hip included angle',stats:metrics.hipIncludedAngle},
    {label:vocab?.motion||'Observed movement',stats:metrics.motion??metrics.lift}
  ]:[];
  return {report,metrics,config,vocab,rows,timing,angles,speed,timings,videoAngles,liveCount,observedCount,count,total,analysed,
    prescribed:positive(record.prescribed_reps),coverage:trackingCoverage(report),incomplete:nonnegative(report?.incomplete)};
}

function statTable(title,rows,note) {
  return `<div class="exercise-detail-block"><h4>${esc(title)}</h4><p>${esc(note)}</p>${table(title,['Measurement','Minimum','Maximum','Average','Median','Variation (SD)','Measured'],rows.map(row=>[
    row.label,...['minimum','maximum','mean','median','standardDeviation'].map(key=>number(row.stats?.[key],row.unit==='°'?'°':` ${row.unit}`)),row.stats?String(row.stats.count):'0'
  ]))}</div>`;
}
function table(label,headers,rows) {
  return `<div class="exercise-table-scroll" tabindex="0" role="region" aria-label="${esc(label)}, scroll horizontally for all columns"><table><caption>${esc(label)}</caption><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((value,i)=>i===0?`<th scope="row">${esc(value)}</th>`:`<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const facts=rows=>`<dl class="exercise-detail-facts">${rows.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
const extremeWords=value=>!value?'Not measured':`${seconds(value.value)} · ${value.repetitions.length===1?'repetition':'repetitions'} ${value.repetitions.join(', ')}`;

export function renderDetailedExerciseSummary(record) {
  const s=detailedExerciseSummary(record),t=s.timings,m=s.metrics,v=s.vocab;
  const sessionRows=[['Time spent on this exercise',seconds(s.total)],['Prescribed repetitions',number(s.prescribed)],
    ['Live recorded count',number(s.liveCount)],['Complete repetitions seen in the video',number(s.observedCount)],
    ['Repetitions compared with the prescribed count',s.count!==null&&s.prescribed?`${s.count} of ${s.prescribed}`:'Not measured']];
  if(s.report)sessionRows.push(['Video duration',seconds(s.config.duration)],['Part of the video analysed',seconds(s.analysed)],
    ['Analysis starts at',seconds(s.config.start)],['Interrupted or incomplete movements excluded',number(s.incomplete)],
    ['Time in complete repetitions',seconds(t.cycleTime)],['Total measured hold time',seconds(t.holdTime)],
    [`Total ${v?.outward.toLowerCase()||'outward movement'} time`,seconds(t.outwardTime)],[`Total ${v?.returning.toLowerCase()||'return movement'} time`,seconds(t.returnTime)],
    ['Time outside complete repetitions',seconds(t.otherTime)],['Time between complete repetitions',seconds(t.gapTime)],
    ['Cadence during complete repetitions',number(t.cadence,' reps/min')]);
  // A partial video count must not be divided by the whole session duration.
  if(!s.report || (finite(s.analysed)&&finite(s.total)&&Math.abs(s.analysed-s.total)<=1&&(s.config.start??0)===0))sessionRows.push(['Repetitions per minute over the whole session',number(t.sessionRate,' reps/min')]);
  let html=`<section class="exercise-details" aria-label="Full exercise breakdown"><h3>Full exercise breakdown</h3><p>All available measurements for this session. “Not measured” means the recording did not provide that information.</p><h4>Repetitions and time</h4>${facts(sessionRows)}`;
  if(s.config.smallMovement||record.pose_validation?.small_movement)html+='<p>Small movement mode: repetitions are observed movement attempts. The angles are shown separately and do not establish a full-range exercise or clinical test result.</p>';
  const symptoms=[];
  if(finite(record.patient?.pain_0_10)&&record.patient.pain_0_10>=0&&record.patient.pain_0_10<=10)symptoms.push(['Pain after exercise',`${record.patient.pain_0_10}/10`]);
  if(finite(record.patient?.difficulty_1_5)&&record.patient.difficulty_1_5>=1&&record.patient.difficulty_1_5<=5)symptoms.push(['Reported effort',`${record.patient.difficulty_1_5}/5`]);
  if(symptoms.length)html+=`<h4>How the exercise felt</h4>${facts(symptoms)}`;
  if(record.patient?.note)html+=`<p>Your note: ${esc(record.patient.note)}</p>`;
  if(!s.report){
    const live=record.measurement||{};
    html+=`<h4>Live knee measurements</h4>${facts([
      ['Greatest knee bend (maximum flexion)',number(live.peak_flexion_deg,'°')],['Straightest knee (bend remaining)',number(live.min_extension_deg,'°')],
      ['Average knee bend',number(live.mean_flexion_deg,'°')],['Median knee bend',number(live.median_flexion_deg,'°')],
      ['Typical upper bend (95th percentile)',number(live.p95_flexion_deg,'°')],['Typical lower bend (5th percentile)',number(live.p05_extension_deg,'°')],
      ['Frames with a usable knee angle',number(live.frames_with_angle)],['Live frames sampled',number(live.frames_total)]
    ])}<p>These are live camera observations. The automatic video analysis adds individual repetitions, hip angles, hold times and fastest and slowest timings when available.</p>`;
    if(record.hold)html+=`<p>The hold count comes from the exercise timer. A timer does not confirm that a muscle contraction was held.</p>`;
    return html+'</section>';
  }
  html+=`<p>Time outside complete repetitions can include pauses, incomplete movements and tracking gaps. It is not a measurement of rest. Whole-session rate includes this time; cadence describes the completed movement cycles. An opening movement without a visible starting position may be missed.</p>`;
  if(v){
    html+=`<h4>Fastest, slowest and holds</h4>${facts([
      ['Fastest repetition',extremeWords(t.fastest)],['Slowest repetition',extremeWords(t.slowest)],
      ['Shortest hold near the furthest position',extremeWords(t.shortestHold)],['Longest hold near the furthest position',extremeWords(t.longestHold)],
      ['Variation in repetition time (relative to the average)',number(t.cycleVariation,'%')]
    ])}<p>Faster or longer is not automatically better. Use the pace and hold duration in your exercise plan. A zero-second hold means no sustained hold was detected in the sampled frames.</p>`;
    html+=statTable('Tempo and cadence',s.timing,'Average is the mean; median is the middle value. Variation (SD) describes how spread out the repetitions were and needs at least two measurements. Each repetition runs from its detected starting position to its return.');
    html+=`<p>The hold is the continuous time near the observed peak${s.rows.some(row=>finite(row.hold))?`, within about ${number(s.report.reps.find(rep=>rep.phaseTiming)?.phaseTiming?.bandDegrees??s.config.cycleSensitivity?.band??3,'°')}`:''}. It is an estimate from sampled images, not proof that the leg was completely still. Cadence during complete repetitions is 60 divided by the average cycle time; the table describes each repetition’s individual rate.</p>`;
  }
  html+=`<h4>Joint angles throughout the analysed video</h4><p>Knee flexion means knee bend. Maximum observed extension is shown as the least bend remaining, with 0° meaning straight. These are observed exercise angles, not a separate test of maximum capacity. Averages include the visible time spent moving and pausing.</p>${facts([
    ['Maximum knee flexion: greatest bend',number(m.maximumObservedBend??m.kneeBend?.maximum,'°')],
    ['Maximum observed knee extension: bend remaining',number(m.bestObservedStraightening??m.kneeBend?.minimum,'°')],
    ['Knee movement range across the video',number(m.kneeBend?.range,'°')],
    ['Starting reference: knee bend',number(s.report.baseline?.kneeBend,'°')]
  ])}`;
  html+=table('Whole-video angle statistics',['Angle','Minimum','Maximum','Average','Median','Range','Variation (SD)','Typical lower (5%)','Typical upper (95%)','Minimum at','Maximum at','Usable samples'],s.videoAngles.map(({label,stats})=>[
    label,...['minimum','maximum','mean','median','range','standardDeviation','p05','p95'].map(key=>number(stats?.[key],'°')),seconds(stats?.minimumTime),seconds(stats?.peakTime),stats?`${number(stats.frames)} (${percent(stats.coverage)})`:'Not measured'
  ]));
  html+=`<p>Hip bend is estimated relative to the trunk; the hip included angle is its complementary angle. The 5th and 95th percentiles describe the typical lower and upper observations, reducing the influence of isolated extremes. They are not confidence limits.</p>`;
  if(v){
    html+=statTable('Movement across repetitions',s.angles,'These statistics compare completed repetitions. A smaller variation describes more similar repetitions; it does not establish good technique or adequate range.');
    html+=statTable('Movement speed',s.speed,`${v.joint} angular change divided by movement time, in degrees per second. These are average speeds for each phase, not peak instantaneous speed or a measurement of muscle strength.`);
    html+=`<h4>Each repetition</h4><p>Times are measured from the start of the recording. Scroll the tables sideways to see all columns.</p>`;
    if(s.rows.length){
      html+=table('Timing for each repetition',['Rep','Start','End','Total time','Cadence',v.outward,'Hold',v.returning,'Peak at',v.outward+' speed',v.returning+' speed'],s.rows.map(row=>[
        String(row.number),seconds(row.start),seconds(row.end),seconds(row.duration),number(row.duration?60/row.duration:null,' /min'),seconds(row.outward),seconds(row.hold),seconds(row.returning),seconds(row.peakTime),number(row.outwardSpeed,'°/s'),number(row.returnSpeed,'°/s')
      ]));
      html+=table('Knee angles for each repetition',['Rep','Least bend','Greatest bend','Average bend','Median bend','Movement range','Start bend','Return bend',...(v.extra?['Extra bend during lift']:[])],s.rows.map(row=>[
        String(row.number),...['kneeMin','kneeMax','kneeMean','kneeMedian','kneeRange','kneeStart','kneeReturn',...(v.extra?['extraBend']:[])].map(key=>number(row[key],'°'))
      ]));
      html+=table('Hip and movement angles for each repetition',['Rep','Least hip bend','Greatest hip bend','Average hip bend','Median hip bend','Hip range','Start hip bend','Return hip bend',v.motion],s.rows.map(row=>[
        String(row.number),...['hipMin','hipMax','hipMean','hipMedian','hipRange','hipStart','hipReturn','motion'].map(key=>number(row[key],'°'))
      ]));
    }else html+='<p>No complete repetitions were measurable. Any available angles above are still shown; a missed movement is not scored as zero ability.</p>';
  }
  html+=`<h4>How much the camera could measure</h4>${facts([
    ['Samples usable for this exercise',percent(s.coverage)],['Video images sampled',number(m.sampledFrames)],['Images with full knee and hip tracking',number(m.fullyTrackedFrames)],
    ['Partly usable images',number(m.partialFrames)],['Rejected images',number(m.rejectedFrames)],
    ['Average landmark visibility (not accuracy)',percent(m.visibility?.mean)],['Sampling rate',number(finite(m.sampledFrames)&&positive(s.analysed)?m.sampledFrames/s.analysed:null,' images/s')]
  ])}`;
  const rejections=Object.entries(m.rejectionCounts||{}).filter(([,n])=>positive(n)!==null);
  if(rejections.length)html+=`<p>Reasons for missing measurements. One image can have more than one reason.</p>${facts(rejections.map(([reason,n])=>[reason.replaceAll('_',' ').replaceAll(':',': '),String(n)]))}`;
  html+=`<p>Camera estimates cannot measure muscle force, pain, swelling, passive range or clinical extension lag. Pain and effort are included only when you report them. Angle estimates cannot distinguish hyperextension from knee bend. Tracking coverage is not a measure of clinical accuracy.</p></section>`;
  return html;
}
