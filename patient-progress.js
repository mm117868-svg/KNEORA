/* Patient overview uses live session measurements; post-recording analysis is stored separately. */
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
export function recordedCount(record) {
  if (record.hold) return number(record.hold.cycles_completed);
  const source = record.count_source || 'monitoring';
  return number((source === 'patient_voice' ? record.patient_count : source === 'knee_tracker' ? record.tracking : source === 'monitoring' ? record.monitoring : source === 'pose_gated_optical' ? record.pose_validation : null)?.repetitions);
}
export function patientRecords(records, patient, operationDate) {
  return records.filter(r => r && r.patient_id === patient && (r.operation_date || '') === (operationDate || '') && Number.isFinite(Date.parse(r.started_at)))
    .sort((a,b) => Date.parse(a.started_at) - Date.parse(b.started_at));
}
export function comparableRecords(records, record, metric = 'bend') {
  return records.filter(r => r.exercise === record.exercise && r.patient_id === record.patient_id && (r.operation_date || '') === (record.operation_date || '') &&
    (r.pose_validation?.side || r.measurement?.side || '') === (record.pose_validation?.side || record.measurement?.side || '') &&
    (metric !== 'reps' || ((r.count_source || 'monitoring') === (record.count_source || 'monitoring') && (r.pose_validation?.version || '') === (record.pose_validation?.version || '') && (r.pose_validation?.raw_source || '') === (record.pose_validation?.raw_source || '') && !!r.hold === !!record.hold)));
}
const bend = r => number(r.measurement?.p95_flexion_deg);
const date = r => new Date(r.started_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const name = r => ({heel_slide:'Heel slides',straight_leg_raise:'Straight leg raise',seated_extension:'Seated knee extension',standing_flexion:'Standing knee bend',quad_set:'Quad sets',mini_squat:'Mini squat',sit_to_stand:'Sit to stand',squat:'Squat',single_leg_stance:'Single-leg balance'}[r.exercise] || String(r.exercise || 'Exercise').replace(/_/g,' '));
const sourceLabel = r => ({pose_gated_optical:'Camera count confirmed in the selected leg',patient_voice:'Your spoken count',knee_tracker:'Camera knee tracker',monitoring:'Camera movement counter',timer:'Timed holds'}[r.count_source || 'monitoring'] || 'Count unavailable');
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
  return `<div class="patient-session"><div class="eyebrow">Exercise saved · ${escapeHtml(date(record))}</div><h2>${escapeHtml(name(record))}</h2><p class="patient-lead">Here is what you recorded.</p><div class="patient-metrics">${tile(record.hold?'Holds':'Repetitions',`${display(count)}${target>0?' / '+target:''}`,sourceLabel(record))}${tile('Typical best bend',value===null?'Not recorded':`${display(value)}°`,value===null?'No usable knee angle recorded':'Whole-session measurement')}${tile('Time',duration(record),'Minutes : seconds')}${tile('Video analysis',record.exercise_analysis?'Report saved':'No report saved','Estimated joint angles and timing')}</div><div class="patient-completion"><span>${escapeHtml(completion)}</span>${count!==null&&target>0?`<progress max="${target}" value="${Math.min(count,target)}" aria-label="Recorded count towards the planned count"></progress>`:''}<small>Completing the count does not assess movement quality.</small></div><div class="patient-trend-panel"><h3>Your bend over time</h3><p>${escapeHtml(comparison)}</p>${trend(history,'bend')}<small>Same exercise and recorded leg. Typical best bend is the 95th percentile of the session's knee angles. It is not a movement-quality score.</small></div></div>`;
}
export function renderPatientProgress(element, records, onReview, options = {}) {
  const scope = JSON.stringify([options.patientId, options.operationDate]);
  const previousMonth = element.dataset.calendarScope === scope ? element.querySelector("[data-recovery-calendar]")?.dataset.month : null;
  element.dataset.calendarScope = scope;
  const previousExercise=element.querySelector('[data-progress-exercise]')?.value;
  const previousMetric=element.querySelector('[data-metric][aria-pressed="true"]')?.dataset.metric || 'bend';
  const last=records.at(-1), week=records.filter(r=>Date.now()-Date.parse(r.started_at)>=0&&Date.now()-Date.parse(r.started_at)<7*864e5);
  element.innerHTML=`<div class="patient-section-heading"><div><div class="eyebrow">Your recovery</div><h2>Progress at a glance</h2></div><span>Saved on this device</span></div><div class="patient-overview">${tile('Exercise sessions',records.length,'For these patient details')}${tile('Last 7 days',week.length,'Recorded sessions')}${tile('Latest exercise',last?name(last):'Ready when you are',last?date(last):'Choose an active exercise below')}${tile('Video reports',records.filter(r=>r.exercise_analysis).length,'Recorded exercise analyses')}</div>`;
  element.insertAdjacentHTML("beforeend", '<section class="recovery-calendar" data-recovery-calendar aria-label="Surgery and exercise calendar"></section>');
  renderCalendar(element.querySelector("[data-recovery-calendar]"), records, options.operationDate || "", onReview, previousMonth, options);
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

const dayKey = value => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year,month,day]=value.split('-').map(Number), result=new Date(year,month-1,day,12);
  return dayKey(result)===value?result:null;
}
export function calendarMonth(year, month, records, operationDate, today = new Date()) {
  const first=new Date(year,month,1,12), offset=(first.getDay()+6)%7;
  const size=Math.ceil((offset+new Date(year,month+1,0).getDate())/7)*7;
  const used=new Map();
  for(const record of records){
    // Preserve the calendar date at recording, including when travelling across time zones.
    const key=String(record.started_at || '').slice(0,10);
    if(parseDay(key))used.set(key,[...(used.get(key)||[]),record]);
  }
  return Array.from({length:size},(_,i)=>{
    const d=new Date(year,month,1-offset+i,12), key=dayKey(d);
    return {key,day:d.getDate(),inMonth:d.getMonth()===month,today:key===dayKey(today),surgery:key===operationDate,records:used.get(key)||[]};
  });
}
function renderCalendar(host, records, operationDate, onReview, initialMonth, options) {
  const today=new Date(), surgery=parseDay(operationDate);
  let month=parseDay(initialMonth) || new Date(today.getFullYear(),today.getMonth(),1,12);
  let selected=surgery ? dayKey(today < surgery ? surgery : today) : '';
  function draw(focusAction) {
    const cells=calendarMonth(month.getFullYear(),month.getMonth(),records,operationDate,today);
    const monthName=month.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
    host.dataset.month=dayKey(month);
    const usedDays=cells.filter(c=>c.inMonth&&c.records.length).length;
    host.innerHTML=`<div class="recovery-calendar-head"><div><div class="eyebrow">Your activity calendar</div><h3 aria-live="polite">${escapeHtml(monthName)}</h3></div><div class="recovery-calendar-nav"><button type="button" data-calendar-action="previous" aria-label="Previous month">‹</button><button type="button" data-calendar-action="today">Today</button><button type="button" data-calendar-action="surgery"${surgery?'':' disabled'}>Surgery date</button><button type="button" data-calendar-action="next" aria-label="Next month">›</button></div></div><p class="recovery-calendar-caption">${surgery?`Surgery: <strong>${escapeHtml(surgery.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}))}</strong>`:'Enter your operation date in Settings to mark your surgery.'} · ${usedDays} day${usedDays===1?'':'s'} with saved sessions this month</p><div class="recovery-calendar-grid" role="group" aria-label="${escapeHtml(monthName)} activity calendar">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div class="recovery-weekday">${d}</div>`).join('')}${cells.map(c=>{const fullDate=parseDay(c.key).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}),n=c.records.length;return `<button type="button" class="recovery-day${c.inMonth?'':' outside'}${n?' used':''}${c.surgery?' surgery':''}${c.today?' today':''}" data-calendar-day="${c.key}" aria-label="${escapeHtml(fullDate)}${c.today?', today':''}${c.surgery?', surgery date':''}, ${n} saved session${n===1?'':'s'}"${c.today?' aria-current="date"':''} aria-pressed="${selected===c.key}"><span class="recovery-day-number">${c.day}</span>${c.surgery?'<span class="recovery-surgery-mark">◆ <span>Surgery</span></span>':''}${n?`<span class="recovery-use-mark">✓ <span>${n} session${n===1?'':'s'}</span></span>`:''}</button>`;}).join('')}</div><div class="recovery-calendar-legend"><span><i class="used"></i>Saved exercise session</span><span><i class="surgery"></i>Surgery date</span><span><i class="today"></i>Today</span></div><small class="recovery-calendar-note">A filled box means an exercise session was saved on that date. Opening the app alone does not fill a box.</small><div class="recovery-calendar-detail" data-calendar-detail aria-live="polite"></div><section class="recovery-daily" data-daily-checklist aria-label="Daily exercise checklist"></section>`;
    host.querySelectorAll('[data-calendar-action]').forEach(b=>b.onclick=()=>{const action=b.dataset.calendarAction;selected=action==='surgery'?operationDate:action==='today'?dayKey(today):'';month=action==='today'?new Date(today.getFullYear(),today.getMonth(),1,12):action==='surgery'?new Date(surgery.getFullYear(),surgery.getMonth(),1,12):new Date(month.getFullYear(),month.getMonth()+(action==='next'?1:-1),1,12);draw(action);});
    host.querySelectorAll('[data-calendar-day]').forEach(b=>b.onclick=()=>{
      selected=b.dataset.calendarDay;
      showChecklist();
      host.querySelectorAll('[data-calendar-day]').forEach(day=>day.setAttribute('aria-pressed',String(day.dataset.calendarDay===selected)));
      const cell=cells.find(c=>c.key===selected),detail=host.querySelector('[data-calendar-detail]');
      detail.innerHTML=`<h4>${escapeHtml(parseDay(selected).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}))}${cell.surgery?' · Surgery date':''}</h4>${cell.records.length?cell.records.map((r,i)=>`<button type="button" class="patient-history-row" data-calendar-review="${i}"><span><b>${escapeHtml(name(r))}</b><small>${display(recordedCount(r))} ${r.hold?'holds':'reps'} · ${duration(r)}</small></span><span>Review →</span></button>`).join(''):'<p>No saved exercise sessions on this date.</p>'}`;
      detail.querySelectorAll('[data-calendar-review]').forEach(row=>row.onclick=()=>onReview(cell.records[+row.dataset.calendarReview],records));
    });
    function showChecklist(){
      renderDailyChecklist(host.querySelector('[data-daily-checklist]'), records, options, selected, key=>{selected=key;const d=parseDay(key);month=new Date(d.getFullYear(),d.getMonth(),1,12);draw();host.querySelector('[data-postop-day]')?.focus();});
    }
    showChecklist();
    if(focusAction)host.querySelector(`[data-calendar-action="${focusAction}"]`)?.focus();
  }
  draw();
}


export function dayAfterSurgery(day, operationDate) {
  const d=parseDay(day), op=parseDay(operationDate);
  return d&&op?Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(op.getFullYear(),op.getMonth(),op.getDate()))/86400000):null;
}
export function savedSetComplete(records, exercise, day) {
  return records.some(r=>r.exercise===exercise&&String(r.started_at).slice(0,10)===day&&number(r.prescribed_reps)>0&&recordedCount(r)!==null&&recordedCount(r)>=r.prescribed_reps);
}
function renderDailyChecklist(element,records,options,selected,onSelect){
  const surgery=parseDay(options.operationDate),today=new Date();
  if(!surgery){element.innerHTML='<h3>Your daily exercises</h3><p>Enter your operation date in Settings to choose a day after surgery.</p>';return;}
  const elapsed=dayAfterSurgery(dayKey(today),options.operationDate), chosen=dayAfterSurgery(selected,options.operationDate);
  let day=chosen===null||chosen<0?Math.max(0,elapsed):chosen;
  const maxDay=Math.max(84,elapsed+14,day), dateFor=d=>dayKey(new Date(surgery.getFullYear(),surgery.getMonth(),surgery.getDate()+d,12));
  const key=dateFor(day),phase=day<7?1:day<28?2:day<56?3:4,exercises=options.exercisesByPhase?.[phase]||[];
  const storageKey='kr_daily_checks:'+JSON.stringify([options.patientId,options.operationDate]);
  let checks={};try{const value=JSON.parse(localStorage.getItem(storageKey)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))checks=value;}catch{}
  element.innerHTML=`<label class="recovery-day-picker">Day after surgery<select data-postop-day>${Array.from({length:maxDay+1},(_,i)=>`<option value="${i}"${i===day?' selected':''}>${i===0?'Day 0 · Surgery day':'Day '+i} · ${escapeHtml(parseDay(dateFor(i)).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}))}</option>`).join('')}</select></label><p class="recovery-check-status">${day>elapsed?'Future date. Exercises can be marked on the day.':'Tick each exercise when you have finished it.'}</p>${exercises.map(ex=>{const recorded=savedSetComplete(records,ex.id,key),manual=checks[key]?.[ex.id]===true;return `<label class="recovery-check-row"><input type="checkbox" data-exercise-check="${escapeHtml(ex.id)}"${recorded||manual?' checked':''}${recorded||!ex.available||day>elapsed?' disabled':''}><span>${escapeHtml(ex.title)}<small data-check-label>${!ex.available?'Pending: to be introduced in due course':recorded?'Recorded set complete':manual?'Marked done':'Not marked done'}</small></span></label>`;}).join('')}<p class="recovery-calendar-note">Ticks marked manually are your own record. They do not add a measured session or fill the activity calendar. Follow the exercises your physiotherapist has given you.</p><div class="recovery-check-status" data-check-message role="status"></div>`;
  element.querySelector('[data-postop-day]').onchange=e=>onSelect(dateFor(+e.target.value));
  element.querySelectorAll('[data-exercise-check]').forEach(input=>input.onchange=()=>{
    const id=input.dataset.exerciseCheck,previous=checks[key]?.[id]===true;
    checks[key]={...(checks[key]||{}),[id]:input.checked};
    try{localStorage.setItem(storageKey,JSON.stringify(checks));input.closest('label').querySelector('[data-check-label]').textContent=input.checked?'Marked done':'Not marked done';element.querySelector('[data-check-message]').textContent='Checklist saved on this device.';}
    catch{checks[key][id]=previous;input.checked=previous;element.querySelector('[data-check-message]').textContent='The checklist could not be saved on this device. Please try again.';}
  });
}

export function visitDates(previous, records, today) {
  return [...new Set([...(Array.isArray(previous)?previous:[]),...records.map(r=>String(r.started_at||'').slice(0,10)),today].filter(d=>typeof d==='string'&&parseDay(d)))].sort();
}
export function renderHomeActivity(element, records, patientId, operationDate) {
  const today=new Date(),key='kr_app_visits:'+JSON.stringify(patientId);
  let previous=[],saved=true;
  try{previous=JSON.parse(localStorage.getItem(key)||'[]');}catch{}
  const visits=visitDates(previous,records,dayKey(today));
  try{localStorage.setItem(key,JSON.stringify(visits));}catch{saved=false;}
  const elapsed=dayAfterSurgery(dayKey(today),operationDate);
  const postop=elapsed===null?'Enter your operation date in Settings to show your surgery day and recovery progress.':elapsed<0?`Surgery in ${-elapsed} day${elapsed===-1?'':'s'}.`:elapsed===0?'Today is your surgery day · Day 0.':`${elapsed} day${elapsed===1?'':'s'} post-operatively`;
  let month=new Date(today.getFullYear(),today.getMonth(),1,12);
  function draw(focus){
    const days=calendarMonth(month.getFullYear(),month.getMonth(),[],operationDate,today);
    element.classList.add('home-activity');
    element.setAttribute('aria-label','App activity calendar');
    element.innerHTML=`<div class="mini-calendar"><div class="mini-calendar-head"><h2 aria-live="polite">${escapeHtml(month.toLocaleDateString('en-GB',{month:'long',year:'numeric'}))}</h2><div><button type="button" data-mini-nav="-1" aria-label="Previous month">‹</button><button type="button" data-mini-nav="1" aria-label="Next month">›</button></div></div><div class="mini-calendar-grid" role="group" aria-label="Days this app was used">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<span class="mini-weekday" aria-label="${d}">${d[0]}</span>`).join('')}${days.map(d=>d.inMonth?`<span class="mini-day${visits.includes(d.key)?' visited':''}${d.today?' today':''}${d.surgery?' surgery':''}" aria-label="${escapeHtml(parseDay(d.key).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}))}${visits.includes(d.key)?', app used':''}${d.today?', today':''}${d.surgery?', surgery date':''}"${d.today?' aria-current="date"':''}>${d.day}</span>`:'<span aria-hidden="true"></span>').join('')}</div><div class="mini-calendar-legend"><span><i></i>App used</span><span>○ Today</span>${parseDay(operationDate)?'<span><i class="surgery-dot"></i>Surgery date</span>':''}</div></div><p class="mini-postop" aria-live="polite">${escapeHtml(postop)}</p><p class="mini-calendar-note">${saved?'Days opened or with a saved session on this device.':'Activity could not be saved on this device.'}</p><a class="mini-tracker-link" href="?view=progress#progress">Open progress tracker →</a>`;
    element.querySelectorAll('[data-mini-nav]').forEach(b=>b.onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+(+b.dataset.miniNav),1,12);draw(b.dataset.miniNav);});
    if(focus)element.querySelector(`[data-mini-nav="${focus}"]`)?.focus();
  }
  draw();
}


export function renderPatientOverview(element, records, options = {}) {
  const today=new Date(),elapsed=dayAfterSurgery(dayKey(today),options.operationDate),op=parseDay(options.operationDate);
  const last=records.at(-1), since=new Date(today.getFullYear(),today.getMonth(),today.getDate()-6);
  const recent=records.filter(r=>new Date(r.started_at)>=since&&new Date(r.started_at)<=today);
  const activeDays=new Set(recent.map(r=>String(r.started_at).slice(0,10))).size;
  const dayText=elapsed===null?'Add your operation date':elapsed<0?`${-elapsed} days until surgery`:elapsed===0?'Surgery day':`Day ${elapsed} after surgery`;
  const latestByExercise=[...new Map(records.map(r=>[r.exercise,r])).values()].sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at)).slice(0,3);
  element.innerHTML=`<div class="eyebrow">Patient summary</div><h1 class="overview-title">Your recovery at a glance</h1><p class="patient-lead">${escapeHtml(today.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}))} · Records saved on this device</p>
  <section class="overview-panel"><h2>Your details</h2><dl class="overview-details"><div><dt>Patient ID or name</dt><dd>${escapeHtml(options.patientId||'Not entered')}</dd></div><div><dt>Operation date</dt><dd>${op?escapeHtml(op.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})):'Not entered'}</dd></div><div><dt>Recovery stage</dt><dd>${escapeHtml(dayText)}</dd></div><div><dt>Operated leg</dt><dd>${options.side==='left'?'Left':options.side==='right'?'Right':'Not selected'}</dd></div></dl><a href="?view=settings#patient">Edit your details and settings →</a></section>
  <section class="overview-panel"><h2>Your recorded activity</h2><div class="patient-metrics">${tile('Saved sessions',records.length,'For this patient and operation')}${tile('Sessions in the last 7 days',recent.length)}${tile('Active days in the last 7 days',activeDays,'Days with a saved exercise session')}${tile('Latest session',last?date(last):'None yet',last?name(last):'Start an exercise to build your record')}</div><p class="small-note">These totals count saved exercise sessions. Opening the app or manually ticking an exercise does not add a recorded session.</p></section>
  <section class="overview-panel"><h2>Your current exercises</h2><p>${escapeHtml(options.phaseLabel||'Enter your operation date to see your current recovery week.')}</p>${options.exercises?.length?`<ul class="overview-exercises">${options.exercises.map(ex=>`<li><strong>${escapeHtml(ex.title)}</strong><span>${ex.count} ${ex.kind==='hold'?'holds':'repetitions'}</span></li>`).join('')}</ul>`:'<p>No active exercises are listed for this recovery stage yet.</p>'}<p class="small-note">Follow the exercises your physiotherapist has given you.</p><a href="./#todayExercises">Go to today’s exercises →</a></section>
  <section class="overview-panel"><h2>Latest results by exercise</h2>${latestByExercise.length?latestByExercise.map(r=>`<div class="overview-result"><div><h3>${escapeHtml(name(r))}</h3><small>${escapeHtml(date(r))} · ${escapeHtml(sourceLabel(r))}</small></div><p><strong>${display(recordedCount(r))}</strong> ${r.hold?'holds':'repetitions'}<br><strong>${bend(r)===null?'Not recorded':display(bend(r))+'°'}</strong> typical best bend</p></div>`).join(''):'<p>Your latest exercise results will appear here after you save a session.</p>'}<p class="small-note">Knee bend is a whole-session measurement. It does not assess movement quality. Performance scoring is not yet available.</p><a href="?view=progress#progress">Open the full progress tracker →</a></section>`;
}
