/* Patient views use recorded whole-session measurements only. No form score or per-repetition angle. */
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
export function recordedCount(record) {
  if (record.hold) return number(record.hold.cycles_completed);
  const source = record.count_source || 'monitoring';
  return number((source === 'patient_voice' ? record.patient_count : source === 'knee_tracker' ? record.tracking : source === 'monitoring' ? record.monitoring : null)?.repetitions);
}
export function patientRecords(records, patient, operationDate) {
  return records.filter(r => r && r.patient_id === patient && (r.operation_date || '') === (operationDate || '') && Number.isFinite(Date.parse(r.started_at)))
    .sort((a,b) => Date.parse(a.started_at) - Date.parse(b.started_at));
}
export function comparableRecords(records, record, metric = 'bend') {
  return records.filter(r => r.exercise === record.exercise && r.patient_id === record.patient_id && (r.operation_date || '') === (record.operation_date || '') &&
    (r.measurement?.side || '') === (record.measurement?.side || '') &&
    (metric !== 'reps' || ((r.count_source || 'monitoring') === (record.count_source || 'monitoring') && !!r.hold === !!record.hold)));
}
const bend = r => number(r.measurement?.p95_flexion_deg);
const date = r => new Date(r.started_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const name = r => ({heel_slide:'Heel slides',straight_leg_raise:'Straight leg raise',seated_extension:'Seated knee extension',standing_flexion:'Standing knee bend',quad_set:'Quad sets',mini_squat:'Mini squat',sit_to_stand:'Sit to stand',squat:'Squat',single_leg_stance:'Single-leg balance'}[r.exercise] || String(r.exercise || 'Exercise').replace(/_/g,' '));
const sourceLabel = r => ({patient_voice:'Your spoken count',knee_tracker:'Camera knee tracker',monitoring:'Camera movement counter',timer:'Timed holds'}[r.count_source || 'monitoring'] || 'Count unavailable');
const duration = r => {const s=number(r.duration_s);return s === null ? 'Not recorded' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;};
const display = n => n === null ? 'Not recorded' : Math.round(n).toLocaleString('en-GB');
function tile(label,value,note='') { return `<div class="patient-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`; }
function trend(records,metric) {
  const points=records.slice(-12).map((r,i)=>({r,i,v:metric==='reps'?recordedCount(r):bend(r)}));
  const valid=points.filter(p=>p.v!==null), unit=metric==='reps'?'':'°';
  if (!valid.length) return '<div class="patient-empty">No measurements recorded for this view yet.</div>';
  const lo=Math.max(0,Math.min(...valid.map(p=>p.v))-5), hi=Math.max(lo+10,...valid.map(p=>p.v))+5;
  const x=i=>24+(points.length===1?260:i/(points.length-1)*520), y=v=>126-(v-lo)/(hi-lo)*100;
  // Missing measurements break the line rather than being treated as zero or interpolated.
  let paths='',segment=[];
  for (const p of points) { if(p.v===null){if(segment.length)paths+=`<polyline points="${segment.join(' ')}"/>`;segment=[];}else segment.push(`${x(p.i)},${y(p.v)}`); }
  if(segment.length)paths+=`<polyline points="${segment.join(' ')}"/>`;
  return `<svg class="patient-trend" viewBox="0 0 568 160" role="img" aria-label="${escapeHtml(metric==='reps'?'Recorded repetitions':'Typical best bend')} over ${points.length} sessions"><path d="M24 130H544" stroke="var(--line)"/><g fill="none" stroke="var(--ink)" stroke-width="2.5">${paths}</g>${valid.map(p=>`<circle cx="${x(p.i)}" cy="${y(p.v)}" r="4" fill="var(--brand)"><title>${escapeHtml(date(p.r))}: ${p.v}${unit}</title></circle>`).join('')}<text x="24" y="153">${escapeHtml(date(points[0].r))}</text><text x="544" y="153" text-anchor="end">${escapeHtml(date(points.at(-1).r))}</text></svg><details class="patient-chart-data"><summary>View chart values</summary><ul>${points.map(p=>`<li>${escapeHtml(date(p.r))}: ${p.v===null?'not recorded':escapeHtml(p.v+unit)}</li>`).join('')}</ul></details>`;
}
export function sessionSummary(record, records) {
  const count=recordedCount(record), target=number(record.prescribed_reps), value=bend(record);
  const before=comparableRecords(records,record).filter(r=>Date.parse(r.started_at)<Date.parse(record.started_at));
  const previous=before.at(-1), prev=previous?bend(previous):null;
  const delta=value!==null && prev!==null ? Math.round((value-prev)*10)/10 : null;
  const comparison=delta===null?'A comparison will appear after another measured session of this exercise.':`${delta>0?'+':''}${delta}° compared with your previous ${name(record).toLowerCase()} session.`;
  const completion=count!==null && target>0?`${Math.min(100,Math.round(count/target*100))}% of the planned count recorded`:'No completion percentage available';
  const history=[...before,record];
  return `<div class="patient-session"><div class="eyebrow">Exercise saved · ${escapeHtml(date(record))}</div><h2>${escapeHtml(name(record))}</h2><p class="patient-lead">Here is what you recorded.</p><div class="patient-metrics">${tile(record.hold?'Holds':'Repetitions',`${display(count)}${target>0?' / '+target:''}`,sourceLabel(record))}${tile('Typical best bend',value===null?'Not recorded':`${display(value)}°`,value===null?'No usable knee angle recorded':'Whole-session measurement')}${tile('Time',duration(record),'Minutes : seconds')}${tile('Form score','Planned','To be introduced in due course')}</div><div class="patient-completion"><span>${escapeHtml(completion)}</span>${count!==null&&target>0?`<progress max="${target}" value="${Math.min(count,target)}" aria-label="Recorded count towards the planned count"></progress>`:''}<small>Completing the count does not assess movement quality.</small></div><div class="patient-trend-panel"><h3>Your bend over time</h3><p>${escapeHtml(comparison)}</p>${trend(history,'bend')}<small>Same exercise and recorded leg. Typical best bend is the 95th percentile of the session's knee angles. It is not a movement-quality score.</small></div></div>`;
}
export function renderPatientProgress(element, records, onReview) {
  const previousExercise=element.querySelector('[data-progress-exercise]')?.value;
  const previousMetric=element.querySelector('[aria-pressed="true"]')?.dataset.metric || 'bend';
  const last=records.at(-1), week=records.filter(r=>Date.now()-Date.parse(r.started_at)>=0&&Date.now()-Date.parse(r.started_at)<7*864e5);
  element.innerHTML=`<div class="patient-section-heading"><div><div class="eyebrow">Your recovery</div><h2>Progress at a glance</h2></div><span>Saved on this device</span></div><div class="patient-overview">${tile('Exercise sessions',records.length,'For these patient details')}${tile('Last 7 days',week.length,'Recorded sessions')}${tile('Latest exercise',last?name(last):'Ready when you are',last?date(last):'Choose an active exercise below')}${tile('Form score','Planned','To be introduced in due course')}</div>`;
  if(!last){element.insertAdjacentHTML('beforeend','<div class="patient-empty">Your session results and progress chart will appear here after your first exercise. Choose an exercise below to get started.</div>');return;}
  const exercises=[...new Set(records.map(r=>r.exercise))];
  element.insertAdjacentHTML('beforeend',`<div class="patient-progress-body"><div class="patient-trend-panel"><div class="patient-trend-controls"><label>Exercise<select data-progress-exercise>${exercises.map(id=>`<option value="${escapeHtml(id)}">${escapeHtml(name({exercise:id}))}</option>`).join('')}</select></label><div class="patient-tabs" aria-label="Progress measurement"><button type="button" data-metric="bend">Bend</button><button type="button" data-metric="reps">Repetitions</button></div></div><div data-progress-chart></div></div><div class="patient-recent"><h3>Recent exercises</h3>${records.slice(-4).reverse().map(r=>`<button type="button" class="patient-history-row" data-review="${records.indexOf(r)}"><span><b>${escapeHtml(name(r))}</b><small>${escapeHtml(date(r))} · ${display(recordedCount(r))} ${r.hold?'holds':'reps'}</small></span><span>Review →</span></button>`).join('')}</div></div>`);
  const select=element.querySelector('[data-progress-exercise]');select.value=exercises.includes(previousExercise)?previousExercise:last.exercise;
  let metric=previousMetric;
  function update(){const chosen=records.filter(r=>r.exercise===select.value),latest=chosen.at(-1),same=comparableRecords(chosen,latest,metric);const val=metric==='bend'?bend(latest):recordedCount(latest);element.querySelector('[data-progress-chart]').innerHTML=`<div class="patient-chart-headline"><strong>${display(val)}${metric==='bend'&&val!==null?'°':''}</strong><span>${metric==='bend'?'Typical best bend in the latest session':escapeHtml(sourceLabel(latest))}</span></div>${trend(same,metric)}<small>${metric==='bend'?'Whole-session bend, not movement quality. Same exercise and recorded leg.':'Recorded counts from the same exercise, leg and counting method.'}</small>`;element.querySelectorAll('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.metric===metric)));}
  select.onchange=update;
  element.querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>{metric=b.dataset.metric;update();});
  element.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>onReview(records[+b.dataset.review],records));update();
}
