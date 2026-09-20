/* The day's log: for each day, each exercise done, and the few figures that matter for that exercise.

   A day can hold several sessions of one exercise (a repeat). The log shows the average of the sessions the patient
   kept, and says how many there were. A session the patient rejected is left out. Each exercise logs its own key
   figure (exercise-evidence.mjs keyOutcome): heel slides the furthest bend, seated knee extension the straightest
   knee, straight leg raise how straight the knee stayed. All are camera estimates from the exercise sessions, which
   is why the recovery graph draws them hollow, apart from the dedicated recovery checks. */
import {keyOutcome, exercisePerformanceMetrics, EXERCISE_EVIDENCE} from './exercise-evidence.mjs?v=cards-1';
import {recordedCount} from './patient-progress.js?v=cards-1';
import {postOpDay, dayNumber} from './progress-data.mjs';
import {esc, shortDate, dayLabel} from './progress-shared.mjs';

const mean = values => { const v = values.filter(n => typeof n === 'number' && Number.isFinite(n)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const title = id => EXERCISE_EVIDENCE[id]?.name || String(id || 'Exercise').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const kept = (records, {patientId, operationDate, side}) => records.filter(r => r && r.rejected !== true && r.patient_id === patientId && (r.operation_date || '') === (operationDate || '') &&
  dayNumber(String(r.started_at || '').slice(0, 10)) !== null && (!side || (r.exercise_analysis?.config?.side || r.measurement?.side) === side));

export function dailyLog(records, scope) {
  const days = new Map();
  for (const r of kept(records, scope)) { const date = r.started_at.slice(0, 10); if (!days.has(date)) days.set(date, new Map()); const day = days.get(date); if (!day.has(r.exercise)) day.set(r.exercise, []); day.get(r.exercise).push(r); }
  return [...days].sort((a, b) => b[0].localeCompare(a[0])).map(([date, exercises]) => ({date, day: postOpDay(date, scope.operationDate), exercises: [...exercises].map(([exercise, sessions]) => {
    const keys = sessions.map(keyOutcome), holds = sessions.flatMap(s => (s.angle_count?.events || []).filter(e => e.status === 'accepted').map(e => e.hold_s));
    return {exercise, name: title(exercise), sessions: sessions.length, repetitions: mean(sessions.map(recordedCount)), prescribed: sessions.at(-1).prescribed_reps ?? null,
      key: {label: keys[0].label, sub: keys[0].sub, value: mean(keys.map(k => k.value))}, hold_s: mean(holds), pain: mean(sessions.map(s => s.patient?.pain_0_10))};
  })}));
}

/* What every usable exercise session says about bending and straightening for the recovery scatter graph.
   These are task observations, not dedicated range-of-motion checks. Heel slides contribute their deepest bend.
   Straightening can come from seated extensions, straight leg raises, or the return phase of heel slides. */
export function exerciseRangeSeries(records, scope) {
  const series = {bend: [], straighten: []}, number = (...values) => values.find(v => typeof v === 'number' && Number.isFinite(v)) ?? null;
  for (const r of kept(records, scope)) {
    const date = r.started_at.slice(0, 10), day = postOpDay(date, scope.operationDate), analysed = r.exercise_analysis?.exercise === r.exercise ? r.exercise_analysis.metrics : null;
    if (day === null) continue;
    if (r.exercise === 'heel_slide') {
      const bend = number(analysed?.maximumObservedBend, r.measurement?.p95_flexion_deg, r.measurement?.peak_flexion_deg);
      const performance = exercisePerformanceMetrics(r), straighten = number(performance.returnBend?.median, analysed?.bestObservedStraightening);
      if (bend !== null) series.bend.push({date, day, value:bend, exercise:r.exercise, label:'Heel slides: furthest bend'});
      if (straighten !== null) series.straighten.push({date, day, value:straighten, exercise:r.exercise, label:performance.returnBend?'Heel slides: straightening on return':'Heel slides: straightest knee observed'});
    }
    if (r.exercise === 'seated_extension') {
      const value = number(analysed?.bestObservedStraightening, r.measurement?.p05_extension_deg, r.measurement?.min_extension_deg);
      if (value !== null) series.straighten.push({date, day, value, exercise:r.exercise, label:'Seated knee extension: straightest knee'});
    }
    if (r.exercise === 'straight_leg_raise') {
      const value = number(analysed?.bestObservedStraightening, r.measurement?.median_flexion_deg);
      if (value !== null) series.straighten.push({date, day, value, exercise:r.exercise, label:'Straight leg raise: straightest knee observed'});
    }
  }
  for (const points of Object.values(series)) points.sort((a,b)=>a.day-b.day||a.date.localeCompare(b.date));
  return series;
}

const round = n => n === null ? null : Math.round(n * 10) / 10;
export function renderDailyLog(log, {limit = 7} = {}) {
  if (!log.length) return '<section class="dl-log"><h2>Daily log</h2><p class="dl-empty">Nothing logged yet. Do an exercise and it appears here: repetitions, time held and the one figure that matters for that exercise.</p></section>';
  return `<section class="dl-log"><h2>Daily log</h2><p class="dl-note">The average of the sessions you kept each day. Camera estimates.</p>${log.slice(0, limit).map(d => `<article class="dl-day"><header><strong>${esc(shortDate(d.date))}</strong><span>${esc(d.day === null ? '' : dayLabel(d.day))}</span></header><div class="dl-cards">${d.exercises.map(e => `<div class="dl-card"><h3>${esc(e.name)}${e.sessions > 1 ? ` <small>average of ${e.sessions}</small>` : ''}</h3><dl>
    <div><dd>${e.repetitions === null ? '–' : esc(String(round(e.repetitions)))}${e.prescribed ? `<small> / ${esc(String(e.prescribed))}</small>` : ''}</dd><dt>repetitions</dt></div>
    <div><dd>${e.key.value === null ? '–' : `${Math.round(e.key.value)}°`}</dd><dt>${esc(e.key.label.toLowerCase())}</dt></div>
    ${e.hold_s === null ? '' : `<div><dd>${esc(String(round(e.hold_s)))} s</dd><dt>typical hold</dt></div>`}${e.pain === null ? '' : `<div><dd>${esc(String(round(e.pain)))}<small> / 10</small></dd><dt>pain after</dt></div>`}</dl></div>`).join('')}</div></article>`).join('')}</section>`;
}
