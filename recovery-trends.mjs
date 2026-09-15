import {measurementSeriesKey} from './recovery-measurements.mjs?v=endpoint-3-flexible';
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

export function combinedMovementChart(trends, elapsed) {
  const all = [...trends.bend, ...trends.straighten];
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
  const title = (p, motion) => `${motion === 'bend' ? 'Bending' : 'Straightening'} · Day ${p.day} · ${esc(shortDate(p.date))}: ${Math.round(p.value*10)/10}°${motion === 'straighten' ? ' bend remaining' : ''}`;
  return `<svg class="rs-movement-chart" viewBox="0 0 500 330" role="img" aria-label="Knee bending and straightening by days after surgery. ${trends.bend.length} bending and ${trends.straighten.length} straightening measurements. Both use degrees of knee bend; 0 degrees means straight.">
    <text x="58" y="20" class="chart-axis-title">Y · Knee bend (degrees)</text>
    ${minorDegrees.map(value => `<line x1="58" x2="474" y1="${y(value)}" y2="${y(value)}" stroke="var(--line)" stroke-opacity=".38"/>`).join('')}
    ${dayLines.map(day => `<line x1="${x(day)}" x2="${x(day)}" y1="44" y2="268" stroke="var(--line)" stroke-opacity="${day % 7 ? '.38' : '.85'}"/>`).join('')}
    ${Array.from({length:high/30+1},(_,i)=>i*30).map(value => `<line x1="58" x2="474" y1="${y(value)}" y2="${y(value)}" stroke="var(--line)"/><text x="48" y="${y(value)+4}" text-anchor="end">${value}°</text>`).join('')}
    <path d="M58 44V268H474" fill="none" stroke="var(--ink)" stroke-width="1.5"/>
    ${ticks.map(day => `<text x="${x(day)}" y="290" text-anchor="middle">${day}</text>`).join('')}
    <g data-graph-series="straighten">${trends.straighten.map(p => `<path d="M${x(p.day)} ${y(p.value)-7}l7 7-7 7-7-7Z" fill="none" stroke="#23734f" stroke-width="2.5"><title>${title(p,'straighten')}</title></path>`).join('')}</g>
    <g data-graph-series="bend">${trends.bend.map(p => `<circle cx="${x(p.day)}" cy="${y(p.value)}" r="4.5" fill="var(--brand)"><title>${title(p,'bend')}</title></circle>`).join('')}</g>
    ${all.length?'':'<text x="266" y="162" text-anchor="middle">No measurements yet</text>'}
    <text x="266" y="319" text-anchor="middle" class="chart-axis-title">X · Days after surgery · surgery = day 0</text>
  </svg>`;
}
