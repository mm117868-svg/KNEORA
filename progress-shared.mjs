import {dayNumber,formatValue,csvText} from './progress-data.mjs';
export const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const shortDate = date=>date?new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Date not recorded';
export const dayLabel = n=>n===null?'Operation date not set':n<0?`${Math.abs(n)} day${Math.abs(n)===1?'':'s'} before surgery`:`Day ${n}`;
export const tile=(label,value,note)=>`<div class="pt-tile"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`;
export function download(name,content,type='text/plain') {const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function chart(rows,unit,label,domain=null) {
 const points=rows.filter(r=>r.value!==null);if(!points.length)return '<p class="pt-empty">No measured values for this selection yet. Unmeasured days are not treated as zero.</p>';
 const start=dayNumber(rows[0].date),end=dayNumber(rows.at(-1).date),values=points.map(p=>p.value);
 const lo=Math.min(...values),hi=Math.max(...values),padding=Math.max(1,(hi-lo)*.15),bottom=domain?.[0] ?? Math.max(0,lo-padding),top=domain?.[1] ?? hi+padding;
 const x=date=>62+(end===start ? .5 : (dayNumber(date)-start)/(end-start))*672,y=v=>190-(v-bottom)/(top-bottom)*160;
 return `<svg class="pt-chart" viewBox="0 0 780 238" role="img" aria-label="${esc(label)} by calendar date. Exact values are listed in the daily table below."><line x1="62" y1="190" x2="734" y2="190" stroke="var(--line)"/><line x1="62" y1="30" x2="734" y2="30" stroke="var(--line)" stroke-dasharray="4 5"/><text x="52" y="34" text-anchor="end">${esc(formatValue(top,unit))}</text><text x="52" y="194" text-anchor="end">${esc(formatValue(bottom,unit))}</text>${points.map(p=>`<circle cx="${x(p.date)}" cy="${y(p.value)}" r="5" fill="var(--brand)"><title>${esc(shortDate(p.date))}: ${esc(formatValue(p.value,unit))}</title></circle>`).join('')}<text x="62" y="220">${esc(shortDate(rows[0].date))}</text><text x="734" y="220" text-anchor="end">${esc(shortDate(rows.at(-1).date))}</text></svg>`;
}
export const csvDownload=(name,rows)=>download(name,csvText(rows),'text/csv;charset=utf-8');
