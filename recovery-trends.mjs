import {measurementSeriesKey} from './recovery-measurements.mjs?v=endpoint-2';
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

export function movementChart(points, motion, elapsed) {
  const label = motion === 'bend' ? 'Knee bend (degrees)' : 'Bend remaining (degrees)';
  const minDay = Math.min(0, ...points.map(p => p.day)), maxDay = Math.max(14, elapsed || 0, ...points.map(p => p.day));
  const high = Math.max(motion === 'bend' ? 120 : 20, Math.ceil(Math.max(0, ...points.map(p => p.value)) / 20) * 20);
  const x = day => 58 + (day - minDay) / (maxDay - minDay) * 416, y = value => 204 - value / high * 152;
  const ticks = [...new Set(Array.from({length:5}, (_, i) => Math.round(minDay + (maxDay - minDay) * i / 4)))];
  return `<svg class="rs-movement-chart" viewBox="0 0 500 266" role="img" aria-label="${label} by days after surgery. ${points.length} measured dates.">
    <text x="58" y="20" class="chart-axis-title">${label}</text>
    ${[0, .25, .5, .75, 1].map(r => `<line x1="58" x2="474" y1="${y(high*r)}" y2="${y(high*r)}" stroke="var(--line)"/><text x="48" y="${y(high*r)+4}" text-anchor="end">${Math.round(high*r)}</text>`).join('')}
    <path d="M58 44V204H474" fill="none" stroke="var(--muted)"/>
    ${ticks.map(day => `<text x="${x(day)}" y="226" text-anchor="middle">${day}</text>`).join('')}
    ${points.map(p => `<circle cx="${x(p.day)}" cy="${y(p.value)}" r="5" fill="var(--brand)"><title>Day ${p.day} · ${esc(shortDate(p.date))}: ${Math.round(p.value*10)/10}°${motion==='straighten'?' bend remaining':''}</title></circle>`).join('')}
    ${points.length?'':'<text x="266" y="122" text-anchor="middle">No measurements yet</text>'}
    <text x="266" y="255" text-anchor="middle" class="chart-axis-title">Days after surgery · surgery = day 0</text>
  </svg>`;
}
