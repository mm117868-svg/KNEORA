/* The physio report at the end of a session: what went well, and what to work on next time.

   Every line comes from something the session measured (the count, the holds, the range, the pace, how well the
   camera saw the leg) set against the patient's own plan (prescribed repetitions, the hold they chose, the angle
   this stage aims for) or their own earlier sessions. Nothing here is a clinical judgement, and no line is written
   unless its measurement exists. Camera angles are estimates, so targets are given a margin before anything is
   called short. At most four lines a side: a report someone reads, not a printout. */
export const REPORT = Object.freeze({
  angleMarginDeg: 5,        // a camera estimate within this of the aim counts as reaching it
  quickS: 2,                // out and back in less than this, with no hold, reads as rushed
  fadeShare: 0.25,          // last third of the repetitions this much smaller than the first third: tiring
  steadyCv: 0.15,           // spread of the excursions below this: consistent
  seenShare: 0.7,           // leg measured in fewer frames than this: the camera set-up needs attention
  mostShare: 0.6,           // this share of the prescribed repetitions: most of them
  betterDeg: 3,             // a change against an earlier best smaller than this is not reported
  lines: 4});

const finite = v => typeof v === 'number' && Number.isFinite(v);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const deg = v => `${Math.round(v)}°`, secs = v => `${v < 10 ? Math.round(v * 2) / 2 : Math.round(v)} s`;

function countOf(record) { return record.hold ? record.hold.cycles_completed : record.angle_count?.repetitions ?? null; }

/* record: a finished session. history: the patient's other sessions (any exercise; rejected ones are ignored). */
export function physioReport(record, history = [], settings = REPORT) {
  const well = [], improve = [], s = settings, m = record.measurement || {}, aim = record.app?.aim || null, isHold = !!record.hold;
  const accepted = (record.angle_count?.events || []).filter(e => e.status === 'accepted'), lost = (record.angle_count?.events || []).filter(e => e.reason === 'leg_not_seen').length;
  const done = countOf(record), want = record.prescribed_reps, unit = isHold ? 'holds' : 'repetitions';

  // how much was done
  if (finite(done) && finite(want) && want > 0) {
    if (done >= want) well.push(`You completed all ${want} ${unit}${done > want ? ` and ${done - want} more` : ''}.`);
    else if (done >= s.mostShare * want) { well.push(`You got through most of the set: ${done} of ${want} ${unit}.`); improve.push(`Build up to the full ${want}. Add one or two each session, resting between them if you need to.`); }
    else if (done > 0) improve.push(`${done} of ${want} ${unit} counted. Work towards ${want}, in two shorter sets if that is easier. Stop if pain turns sharp.`);
  }

  // how well the camera saw the leg: said first among the improvements when it is the likely reason for a low count
  const seen = finite(m.frames_total) && m.frames_total > 0 ? m.frames_with_angle / m.frames_total : null;
  if (!isHold && ((seen !== null && seen < s.seenShare) || lost >= 2 || done === 0))
    improve.unshift(`The camera lost sight of your leg at times${done === 0 ? ', so nothing could be counted' : ', so some movements may not have counted'}. Set it side-on with the whole leg in view, hip to ankle, in good light.`);

  // the holds
  const holdWant = record.app?.hold_target_s, holds = accepted.map(e => e.hold_s).filter(finite);
  if (finite(holdWant) && holdWant > 0 && holds.length >= 2) {
    const typical = median(holds), made = holds.filter(h => h >= holdWant - 0.5).length;
    if (made >= 0.8 * holds.length) well.push(`You held ${made === holds.length ? 'every' : 'nearly every'} repetition for your ${holdWant} seconds.`);
    else improve.push(`Your holds were about ${secs(typical)}. Aim for ${holdWant} s each time: count it out loud, then lower slowly.`);
  }

  // the pace, when no hold was asked for
  const away = accepted.map(e => e.away_s).filter(finite);
  if (!(holdWant > 0) && away.length >= 3) {
    const typical = median(away);
    if (typical < s.quickS) improve.push(`The movements were quick, about ${secs(typical)} each. Slow them down: a steady movement out and a slow return work the muscle harder.`);
    else well.push(`Good steady pace, about ${secs(typical)} for each movement.`);
  }

  // consistency and tiring
  const sizes = accepted.map(e => e.excursion_deg).filter(finite);
  if (sizes.length >= 6) {
    const third = Math.floor(sizes.length / 3), first = mean(sizes.slice(0, third)), last = mean(sizes.slice(-third));
    const spread = Math.sqrt(mean(sizes.map(v => (v - mean(sizes)) ** 2))) / mean(sizes);
    if (last < (1 - s.fadeShare) * first) improve.push(`Your movement got smaller towards the end (about ${deg(first)} at the start, ${deg(last)} by the finish), which is what tiring looks like. A short rest halfway keeps every repetition a full one.`);
    else if (spread < s.steadyCv) well.push(`Every repetition was a similar size. Consistent movement from first to last.`);
  }

  // the range, against the aim for this stage
  if (aim && finite(aim.deg) && !isHold) {
    if (aim.kind === 'bend' && finite(m.p95_flexion_deg)) {
      if (m.p95_flexion_deg >= aim.deg - s.angleMarginDeg) well.push(`You reached this stage's bend of ${deg(aim.deg)} (your bend measured about ${deg(m.p95_flexion_deg)}).`);
      else improve.push(`Your bend measured about ${deg(m.p95_flexion_deg)}; this stage works towards ${deg(aim.deg)}. Ease a little further each session and pause at the deepest point. Stretch, not sharp pain.`);
    }
    if (aim.kind === 'straight' && finite(m.p05_extension_deg)) {
      if (m.p05_extension_deg <= aim.deg + s.angleMarginDeg) { const left = Math.max(0, m.p05_extension_deg);
        well.push(left <= s.angleMarginDeg ? 'You got the knee fully straight.' : `You got the knee close to straight, with about ${deg(left)} of bend remaining.`); }
      else improve.push(`The knee stayed about ${deg(m.p05_extension_deg)} short of straight. Tighten the thigh and push the back of the knee down at the end of each movement.`);
    }
    if (record.exercise === 'straight_leg_raise' && finite(m.p95_flexion_deg) && finite(m.p05_extension_deg) && m.p05_extension_deg <= aim.deg + s.angleMarginDeg && m.p95_flexion_deg > aim.deg + 3 * s.angleMarginDeg)
      improve.push(`The knee bent to about ${deg(m.p95_flexion_deg)} at times during the session. Lock it straight first, then lift, and keep it locked on the way down.`);
  }

  // against their own earlier sessions of this exercise
  const before = history.filter(r => r && r !== record && r.exercise === record.exercise && !r.rejected && r.started_at !== record.started_at && r.measurement);
  if (before.length && aim && !isHold) {
    if (aim.kind === 'bend' && finite(m.p95_flexion_deg)) { const best = Math.max(...before.map(r => r.measurement.p95_flexion_deg).filter(finite)); if (finite(best) && m.p95_flexion_deg >= best + s.betterDeg) well.unshift(`Your best bend yet on this exercise: about ${deg(m.p95_flexion_deg - best)} more than before.`); }
    if (aim.kind === 'straight' && finite(m.p05_extension_deg)) { const best = Math.min(...before.map(r => r.measurement.p05_extension_deg).filter(finite)); if (finite(best) && m.p05_extension_deg <= best - s.betterDeg) well.unshift(`Your straightest knee yet on this exercise: about ${deg(best - m.p05_extension_deg)} straighter than before.`); }
  }

  if (!well.length) well.push('You did your exercise today and it is logged. Regular sessions matter more than any single number.');
  if (!improve.length) improve.push('Nothing to change. Do the same again next time.');
  return {well: well.slice(0, s.lines), improve: improve.slice(0, s.lines)};
}

const esc = v => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export function renderPhysioReport(record, history = []) {
  const r = physioReport(record, history), list = items => items.map(i => `<li>${esc(i)}</li>`).join('');
  return `<section class="physio-report" aria-label="Physio report"><div class="eyebrow">Physio report</div>
    <div class="pr-cols"><div class="pr-col well"><h3>Done well</h3><ul>${list(r.well)}</ul></div><div class="pr-col improve"><h3>To work on next time</h3><ul>${list(r.improve)}</ul></div></div>
    <p class="pr-note">Written from what the camera measured in this session, set against your own plan. Camera angles are estimates. This is not advice from your physiotherapist, and it never replaces it.</p></section>`;
}
