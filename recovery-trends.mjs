import {measurementSeriesKey} from './recovery-measurements.mjs?v=interval-1';
import {intervalText} from './confidence.mjs?v=1';
import {postOpDay} from './progress-data.mjs';
import {esc,shortDate} from './progress-shared.mjs';

export function maximumMovementTrend(rows, motion, seriesKey, operationDate) {
  const available = rows.filter(r => r.motion === motion);
  const key = seriesKey || (available.length ? measurementSeriesKey(available.at(-1)) : '');
  const daily = new Map();
  for (const row of available.filter(r => measurementSeriesKey(r) === key)) {
    const day = postOpDay(row.date, operationDate);
    if (day === null || !Number.isFinite(row.value)) continue;
    const previous = daily.get(row.date);
    if (!previous || (motion === 'bend' ? row.value > previous.value : row.value < previous.value)) daily.set(row.date, {...row, day});
  }
  const points = [...daily.values()].sort((a, b) => a.day - b.day);
  const best = points.reduce((a, b) => !a || (motion === 'bend' ? b.value > a.value : b.value < a.value) ? b : a, null);
  return {key, points, best};
}

/* Published figures, drawn faintly behind the patient's own points so a day's measurement can be read
   against what is usual, rather than only against the last one. Display only: nothing here enters the
   record, the session statistics or any score, no repetition is segmented, and the shapes are other
   people's cohorts measured by clinicians, not a target this patient is asked to hit.

   Bending, interquartile range: Kittelson AJ, Elings J, Colborn K, et al. Reference chart for knee flexion
   following total knee arthroplasty. BMC Musculoskelet Disord 2020;21:482. GAMLSS centiles from 327
   patients and 1,173 observations; the three anchors below are read from the published chart and joined
   with straight lines, so only the anchors are published values.

   Straightening, mean bend remaining: Kornuijt A, de Kort GJL, Das D, et al. Recovery of knee range of
   motion after total knee arthroplasty in the first postoperative weeks. Musculoskelet Surg
   2019;103:289-297, 137 patients. Two published points, so a line and not a band, and it stops where the
   paper stops. */
export const PUBLISHED_FLEXION_IQR = [[0, 70, 90], [30, 95, 115], [90, 109, 122]];
export const PUBLISHED_EXTENSION_MEAN = [[1, 10.7], [56, 3.2]];

function atDay(points, day) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (day <= b[0]) { const f = (day - a[0]) / (b[0] - a[0]); return [day, ...a.slice(1).map((v, k) => v + f * (b[k + 1] - v))]; }
  }
  return null;
}
/* only the days the chart actually shows, and never beyond the days the paper covers */
function withinView(points, minDay, maxDay) {
  const lo = Math.max(minDay, points[0][0]), hi = Math.min(maxDay, points.at(-1)[0]);
  if (!(hi > lo)) return [];
  return [atDay(points, lo), ...points.filter(p => p[0] > lo && p[0] < hi), atDay(points, hi)];
}
export function publishedContext(x, y, minDay, maxDay) {
  const round = v => Math.round(v * 10) / 10;
  const iqr = withinView(PUBLISHED_FLEXION_IQR, minDay, maxDay), ext = withinView(PUBLISHED_EXTENSION_MEAN, minDay, maxDay);
  const band = iqr.length ? `<polygon points="${[...iqr.map(p => `${x(p[0])},${y(p[2])}`), ...[...iqr].reverse().map(p => `${x(p[0])},${y(p[1])}`)].join(' ')}" fill="var(--muted)" fill-opacity=".1" stroke="var(--muted)" stroke-opacity=".3"><title>Published middle half of patients: ${round(iqr[0][1])}\u2013${round(iqr[0][2])}\u00b0 on day ${Math.round(iqr[0][0])}, ${round(iqr.at(-1)[1])}\u2013${round(iqr.at(-1)[2])}\u00b0 by day ${Math.round(iqr.at(-1)[0])} (Kittelson 2020). Context, not a target.</title></polygon>` : '';
  const line = ext.length ? `<polyline points="${ext.map(p => `${x(p[0])},${y(p[1])}`).join(' ')}" fill="none" stroke="var(--muted)" stroke-opacity=".75" stroke-width="1.5" stroke-dasharray="6 4"><title>Published mean bend remaining: ${round(ext[0][1])}\u00b0 on day ${Math.round(ext[0][0])} to ${round(ext.at(-1)[1])}\u00b0 at 8 weeks (Kornuijt 2019). Context, not a target.</title></polyline>` : '';
  return band || line ? `<g data-graph-reference="published">${band}${line}</g>` : '';
}

/* sessions: what the exercise sessions say, one value a day ({bend, straighten} of {day, date, value}). Drawn hollow and
   smaller, so a dedicated recovery check is never mistaken for an exercise estimate or the other way round. */
export function combinedMovementChart(trends, elapsed, sessions = {bend: [], straighten: []}) {
  const fromSessions = [...(sessions.bend || []), ...(sessions.straighten || [])];
  const all = [...trends.bend, ...trends.straighten, ...fromSessions];
  const minDay = Math.min(0, ...all.map(p => p.day)), maxDay = Math.max(14, elapsed || 0, ...all.map(p => p.day));
  const high = Math.max(150, Math.ceil(Math.max(0, ...all.map(p => p.value)) / 30) * 30);
  const x = day => 58 + (day - minDay) / (maxDay - minDay) * 416, y = value => 268 - value / high * 216;
  const ticks = [...new Set(Array.from({length:5}, (_, i) => Math.round(minDay + (maxDay - minDay) * i / 4)))];
  /* Gridlines. One upright line per day while the recovery is short enough to read that way; as the weeks
     add up the step widens so the chart never fills with lines. Every seventh day is darker, so a week can
     be counted at a glance. Flat lines every ten degrees, with the labelled thirties left as they were. */
  const dayStep = [1, 2, 7, 14, 28].find(step => (maxDay - minDay) / step <= 28) || 56;
  const dayLines = [];
  for (let day = Math.ceil(minDay / dayStep) * dayStep; day <= maxDay; day += dayStep) dayLines.push(day);
  const minorDegrees = Array.from({length: high / 10 + 1}, (_, i) => i * 10).filter(value => value % 30);
  const interval = p => Number.isFinite(p.summary?.ci95?.low) && Number.isFinite(p.summary?.ci95?.high) ? p.summary.ci95 : null;
  const title = (p, motion) => `${motion === 'bend' ? 'Bending' : 'Straightening'} · Day ${p.day} · ${esc(shortDate(p.date))}: ${Math.round(p.value*10)/10}°${motion === 'straighten' ? ' bend remaining' : ''}${interval(p) ? ` · 95% confidence interval ${intervalText(interval(p))}` : ''}`;
  /* A whisker through each camera or depth result: the 95% confidence interval of that day's average, kept inside
     the axes. It shows how steady the pictures behind the point were, not how accurate the camera is. A clinical
     entry is a single reading and has none. */
  const whisker = (p, colour) => { const ci = interval(p); if (!ci) return ''; const top = y(Math.min(high, Math.max(0, ci.high))), bottom = y(Math.min(high, Math.max(0, ci.low))); return `<path data-graph-interval d="M${x(p.day)} ${top}V${bottom}M${x(p.day)-4} ${top}h8M${x(p.day)-4} ${bottom}h8" fill="none" stroke="${colour}" stroke-width="1.5" stroke-opacity=".8"/>`; };
  return `<svg class="rs-movement-chart" viewBox="0 0 500 330" role="img" aria-label="Knee bending and straightening by days after surgery. ${trends.bend.length} bending and ${trends.straighten.length} straightening measurements. Both use degrees of knee bend; 0 degrees means straight. A faint band and a dashed line show published figures from other patients for context.">
    <text x="58" y="20" class="chart-axis-title">Y · Knee bend (degrees)</text>
    ${publishedContext(x, y, minDay, maxDay)}
    ${minorDegrees.map(value => `<line x1="58" x2="474" y1="${y(value)}" y2="${y(value)}" stroke="var(--line)" stroke-opacity=".38"/>`).join('')}
    ${dayLines.map(day => `<line x1="${x(day)}" x2="${x(day)}" y1="44" y2="268" stroke="var(--line)" stroke-opacity="${day % 7 ? '.38' : '.85'}"/>`).join('')}
    ${Array.from({length:high/30+1},(_,i)=>i*30).map(value => `<line x1="58" x2="474" y1="${y(value)}" y2="${y(value)}" stroke="var(--line)"/><text x="48" y="${y(value)+4}" text-anchor="end">${value}°</text>`).join('')}
    <path d="M58 44V268H474" fill="none" stroke="var(--ink)" stroke-width="1.5"/>
    ${ticks.map(day => `<text x="${x(day)}" y="290" text-anchor="middle">${day}</text>`).join('')}
    <g data-graph-series="straighten">${trends.straighten.map(p => `${whisker(p, '#23734f')}<path d="M${x(p.day)} ${y(p.value)-7}l7 7-7 7-7-7Z" fill="none" stroke="#23734f" stroke-width="2.5"><title>${title(p,'straighten')}</title></path>`).join('')}</g>
    <g data-graph-series="bend">${trends.bend.map(p => `${whisker(p, 'var(--brand)')}<circle cx="${x(p.day)}" cy="${y(p.value)}" r="4.5" fill="var(--brand)"><title>${title(p,'bend')}</title></circle>`).join('')}</g>
    <g data-graph-series="sessions">${(sessions.bend || []).map(p => `<circle cx="${x(p.day)}" cy="${y(p.value)}" r="3.5" fill="var(--bone)" stroke="var(--brand)" stroke-width="1.8"><title>From your heel slides · Day ${p.day} · ${esc(shortDate(p.date))}: about ${Math.round(p.value)}° (exercise estimate)</title></circle>`).join('')}${(sessions.straighten || []).map(p => `<path d="M${x(p.day)} ${y(p.value)-5}l5 5-5 5-5-5Z" fill="var(--bone)" stroke="#23734f" stroke-width="1.6"><title>From your seated knee extensions · Day ${p.day} · ${esc(shortDate(p.date))}: about ${Math.round(p.value)}° bend remaining (exercise estimate)</title></path>`).join('')}</g>
    ${all.length?'':'<text x="266" y="162" text-anchor="middle">No measurements yet</text>'}
    <text x="266" y="319" text-anchor="middle" class="chart-axis-title">X · Days after surgery · surgery = day 0</text>
  </svg>`;
}
