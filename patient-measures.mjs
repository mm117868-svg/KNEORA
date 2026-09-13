import {finite,localDate,dayNumber,postOpDay,formatValue} from './progress-data.mjs';
import {esc,tile,dayLabel,shortDate,chart,csvDownload} from './progress-shared.mjs';
import {RECOVERY_SOURCES} from './recovery-references.mjs';
export const PROM_KEY='kr_patient_reported_measures_v1';
// Exact HSS non-linear raw-to-interval lookup, English scoring instructions v1.0 (2022).
export const KOOS_INTERVAL=Object.freeze([100,91.975,84.6,79.914,76.332,73.342,70.704,68.284,65.994,63.776,61.583,59.381,57.14,54.84,52.465,50.012,47.487,44.905,42.281,39.625,36.931,34.174,31.307,28.251,24.875,20.941,15.939,8.291,0]);
export const PROM_NAMES={koos_jr:'KOOS JR',oxford_knee:'Oxford Knee Score'};
export function scoreEntry(instrument,mode,value) {
 if(value===''||value===null||value===undefined||typeof value==='boolean')throw Error('Enter the result from the completed questionnaire.');
 const n=Number(value);if(!Number.isFinite(n))throw Error('Enter a valid number.');
 if(instrument==='koos_jr'&&mode==='raw'){
  if(!Number.isInteger(n)||n<0||n>28)throw Error('The complete seven-item KOOS JR raw total must be a whole number from 0 to 28.');
  return {score:KOOS_INTERVAL[n],raw_total:n,scoring:'HSS KOOS JR v1.0 lookup (2022)'};
 }
 if(!PROM_NAMES[instrument]||mode!=='official')throw Error('Choose a supported score and entry method.');
 const maximum=instrument==='koos_jr'?100:48;
 if(n<0||n>maximum)throw Error(`The official ${PROM_NAMES[instrument]} score must be between 0 and ${maximum}.`);
 return {score:n,raw_total:null,scoring:'Official result transcribed; not independently verified'};
}
export function readProms(storage=localStorage) {
 const raw=storage.getItem(PROM_KEY);if(!raw)return [];
 const records=JSON.parse(raw);if(!Array.isArray(records))throw Error('Saved questionnaire data could not be read. It has not been overwritten.');return records;
}
export function scopedProms(records,patientId,operationDate) {
 return records.filter(r=>r.patient_id===patientId&&(r.operation_date||'')===(operationDate||'')&&dayNumber(r.date)!==null&&PROM_NAMES[r.instrument]&&finite(r.score)!==null&&r.score>=0&&r.score<=(r.instrument==='koos_jr'?100:48))
 .sort((a,b)=>a.date.localeCompare(b.date)||String(a.saved_at).localeCompare(String(b.saved_at)));
}
export function saveProm(input,{patientId,operationDate='',today=localDate(),storage=localStorage,idFactory=()=>crypto.randomUUID()}={}) {
 if(!patientId?.trim())throw Error('Set the patient ID in the exercise page first.');
 if(dayNumber(input.date)===null||input.date>today)throw Error('Choose a valid assessment date no later than today.');
 if(!['left','right'].includes(input.side))throw Error('Select the knee assessed in the questionnaire.');
 if(!input.confirmed)throw Error('Confirm that this result comes from the completed official questionnaire.');
 const result=scoreEntry(input.instrument,input.mode,input.value),records=readProms(storage);
 const index=input.id?records.findIndex(r=>r.id===input.id&&r.patient_id===patientId&&(r.operation_date||'')===(operationDate||'')):-1;
 if(input.id&&index<0)throw Error('The original result was not found for this patient. Reload before trying again.');
 const previous=index>=0?records[index]:null;
 const record={schema_version:1,id:previous?.id||idFactory(),patient_id:patientId,operation_date:operationDate,date:input.date,days_post_op:postOpDay(input.date,operationDate),side:input.side,instrument:input.instrument,mode:input.mode,...result,questionnaire_completed:true,note:String(input.note||'').slice(0,1000),saved_at:new Date().toISOString()};
 if(previous){const {revisions,...snapshot}=previous;record.revisions=[...(revisions||[]),snapshot];records[index]=record;}else records.push(record);
 storage.setItem(PROM_KEY,JSON.stringify(records));return record;
}
export function promOverview(records) {
 const groups=[];
 for(const instrument of Object.keys(PROM_NAMES))for(const side of ['left','right']){
  const rows=records.filter(r=>r.instrument===instrument&&r.side===side);if(rows.length)groups.push({instrument,side,latest:rows.at(-1),first:rows[0],best:rows.reduce((a,b)=>b.score>a.score?b:a)});
 }
 return groups;
}
const link=(key,label)=>`<a href="${RECOVERY_SOURCES[key].url}" target="_blank" rel="noopener">${esc(label||RECOVERY_SOURCES[key].name)}</a>`;
export function renderPatientMeasures(host,options={}) {
 const {patientId,operationDate}=options,storage=options.storage||localStorage;
 let records=[],storageError='';try{records=scopedProms(readProms(storage),patientId,operationDate);}catch(e){storageError=e.message;}
 host.innerHTML=`<div class="pt-heading"><div class="eyebrow">Your recovery · questionnaires</div><h1>Patient-reported measures</h1><p>How your knee feels and functions in everyday life, recorded on each assessment date.</p><p class="pt-context">Patient ${esc(patientId)} · ${operationDate?`Operation ${esc(shortDate(operationDate))}`:'Operation date not set'} · <a href="index.html#patient">Change patient details</a></p></div>
 <div class="pt-notice"><strong>Use planned follow-ups, with the original recall period.</strong><p>These questionnaires describe a period of time, rather than just today’s exercise. KOOS JR asks about the past week; the Oxford Knee Score asks about the past four weeks. Repeating a questionnaire every day creates overlapping recall periods. Follow the schedule agreed with your clinical team.</p></div>
 <div class="pt-two"><section class="pt-panel"><h2>KOOS JR <span class="pt-badge">0 to 100</span></h2><p>Seven questions covering knee symptoms and function. Higher scores indicate better reported knee health. Development/internal validation included 2,291 patients. ${link('koos','Lyman et al.')}</p><p><a href="https://www.hss.edu/files/hss-koos-jr.pdf" target="_blank" rel="noopener">Open the official HSS questionnaire</a> · ${link('hss','Official scoring')}</p></section><section class="pt-panel"><h2>Oxford Knee Score <span class="pt-badge">0 to 48</span></h2><p>Twelve questions about pain and function, relevant to a UK knee replacement pathway. Higher scores indicate better reported status. ${link('oxford','Oxford’s description')}</p><p>${link('oxfordScoring','Official scoring guide')} · <a href="https://process.innovation.ox.ac.uk/clinical/" target="_blank" rel="noopener">Questionnaire access and permission</a></p><p class="pt-muted">Enter a result from your clinic’s authorised questionnaire. A digital Oxford questionnaire requires permission from Oxford University Innovation; this page stores the resulting score.</p></section></div>
 <section class="pt-panel"><h2>Add a dated questionnaire result</h2><p>Complete the official questionnaire separately, then enter its result here. These are questionnaire scores, never estimates from exercise video.</p><form data-prom-form><div class="pt-controls"><label>Assessment date<input name="date" type="date" required max="${localDate()}" value="${localDate()}"></label><label>Knee assessed<select name="side" required><option value="">Select knee</option><option value="left">Left knee</option><option value="right">Right knee</option></select></label><label>Questionnaire<select name="instrument"><option value="koos_jr">KOOS JR</option><option value="oxford_knee">Oxford Knee Score</option></select></label><label>Result type<select name="mode"><option value="official">Official score, 0 to 100</option><option value="raw">Complete raw total, 0 to 28</option></select></label><label><span data-score-label>Official score (0 to 100)</span><input name="value" type="number" min="0" max="100" step="0.001" required inputmode="decimal"></label></div><p data-score-preview class="pt-muted" aria-live="polite">No result entered.</p><label class="pt-check"><input type="checkbox" name="confirmed" required><span data-confirm-label>This result comes from a completed official questionnaire, scored using its official instructions.</span></label><label class="pt-block">Note (optional)<textarea name="note" rows="2" maxlength="1000" placeholder="For example, clinic follow-up or a change in walking aid"></textarea></label><input name="id" type="hidden"><div class="pt-actions"><button class="pt-primary" type="submit">Save questionnaire result</button><button type="button" data-prom-cancel hidden>Cancel edit</button></div><p data-prom-message role="status">${esc(storageError)}</p></form></section>
 <section class="pt-panel"><h2>Questionnaire results over time</h2><p>100 on KOOS JR and 48 on Oxford are the maximum scale scores. They are not mandatory outcomes or deadlines. A change in points alone does not establish a clinically important improvement.</p><div class="pt-controls"><label>Questionnaire trend<select data-prom-instrument><option value="koos_jr">KOOS JR</option><option value="oxford_knee">Oxford Knee Score</option></select></label><label>Knee in trend<select data-prom-side><option value="left">Left knee</option><option value="right">Right knee</option></select></label></div><div data-prom-trend></div><div class="pt-actions"><button type="button" data-prom-export>Download questionnaire history (CSV)</button></div><p class="pt-muted">Saved in this browser on this device. Download a copy to retain or share with your physiotherapist. Changing patient ID or operation date opens a separate record.</p></section>`;
 const form=host.querySelector('[data-prom-form]'),field=n=>form.elements.namedItem(n),preview=host.querySelector('[data-score-preview]'),message=host.querySelector('[data-prom-message]');
 function inputMode(reset=false){
  const koos=field('instrument').value==='koos_jr';
  if(reset){field('mode').innerHTML=koos?'<option value="official">Official score, 0 to 100</option><option value="raw">Complete raw total, 0 to 28</option>':'<option value="official">Current official score, 0 to 48</option>';field('value').value='';field('confirmed').checked=false;}
  const raw=koos&&field('mode').value==='raw',max=raw?28:koos?100:48;
  field('value').max=max;field('value').step=raw?'1':'0.001';
  host.querySelector('[data-score-label]').textContent=raw?'Complete seven-item raw total (0 to 28)':`Official score (0 to ${max})`;
  host.querySelector('[data-confirm-label]').textContent=raw?'All seven official KOOS JR items were answered, coded 0 to 4, and included in this raw total.':'This result comes from a completed official questionnaire, scored using its official instructions.';
  if(field('value').value===''){preview.textContent=koos?'The raw total is converted using the HSS lookup table, not a percentage calculation.':'Use the current 0 to 48 scoring. Do not enter an older 12 to 60 score.';return;}
  try{const s=scoreEntry(field('instrument').value,field('mode').value,field('value').value);preview.textContent=`Result to save: ${s.score} / ${koos?100:48}. Higher indicates better reported status.`;}catch(e){preview.textContent=e.message;}
 }
 field('instrument').onchange=()=>inputMode(true);field('mode').onchange=()=>{field('value').value='';field('confirmed').checked=false;inputMode();};field('value').oninput=()=>inputMode();
 const trendInstrument=host.querySelector('[data-prom-instrument]'),trendSide=host.querySelector('[data-prom-side]');
 if(records.length){trendInstrument.value=records.at(-1).instrument;trendSide.value=records.at(-1).side;}
 function draw(){
  const chosen=records.filter(r=>r.instrument===trendInstrument.value&&r.side===trendSide.value),outOf=trendInstrument.value==='koos_jr'?100:48,last=chosen.at(-1),first=chosen[0],best=chosen.length?chosen.reduce((a,b)=>b.score>a.score?b:a):null;
  const daily=new Map();for(const r of chosen)daily.set(r.date,{date:r.date,value:r.score});
  host.querySelector('[data-prom-trend]').innerHTML=`<div class="pt-tiles">${tile('Latest result',last?`${last.score} / ${outOf}`:'Not recorded',last?shortDate(last.date):'Complete a questionnaire first')}${tile('Highest recorded',best?`${best.score} / ${outOf}`:'Not recorded',best?shortDate(best.date):'Same questionnaire and knee')}${tile('Change from first',chosen.length>1?`${Number((last.score-first.score).toFixed(3))>0?'+':''}${Number((last.score-first.score).toFixed(3))} points`:'Not available',first?`First result: ${shortDate(first.date)}`:'Need at least two results')}</div>${chart([...daily.values()],`/${outOf}`,PROM_NAMES[trendInstrument.value],[0,outOf])}<p class="pt-muted">Each point is the latest entry on that date. All entries appear below. Missing dates are unmeasured, and scores from the two questionnaires are not combined.</p><div class="pt-table-wrap"><table><caption>${esc(PROM_NAMES[trendInstrument.value])} · ${esc(trendSide.value)} knee</caption><thead><tr><th scope="col">Assessment date</th><th scope="col">After surgery</th><th scope="col">Score</th><th scope="col">Source and note</th><th scope="col">Edit</th></tr></thead><tbody>${chosen.slice().reverse().map(r=>`<tr><th scope="row">${esc(shortDate(r.date))}</th><td>${esc(dayLabel(postOpDay(r.date,operationDate)))}</td><td>${r.score} / ${outOf}</td><td>${esc(r.raw_total!==null&&r.raw_total!==undefined?`Raw total ${r.raw_total}, HSS conversion`:'Official result entered')}<small>${esc(r.note)}${r.revisions?.length?` · ${r.revisions.length} saved correction(s)`:''}</small></td><td><button type="button" data-edit-prom="${esc(r.id)}" aria-label="Edit ${esc(PROM_NAMES[r.instrument])} result from ${esc(shortDate(r.date))}">Edit</button></td></tr>`).join('')||'<tr><td colspan="5">No questionnaire results recorded for this selection.</td></tr>'}</tbody></table></div>`;
  host.querySelectorAll('[data-edit-prom]').forEach(b=>b.onclick=()=>{
   const r=records.find(r=>r.id===b.dataset.editProm);field('instrument').value=r.instrument;inputMode(true);field('mode').value=r.mode;field('date').value=r.date;field('side').value=r.side;field('value').value=r.raw_total??r.score;field('note').value=r.note;field('id').value=r.id;field('confirmed').checked=false;host.querySelector('[data-prom-cancel]').hidden=false;message.textContent='Editing a saved result. The previous version will be retained.';inputMode();field('value').focus();
  });
 }
 host.querySelector('[data-prom-cancel]').onclick=()=>{form.reset();field('id').value='';host.querySelector('[data-prom-cancel]').hidden=true;message.textContent='Edit cancelled.';inputMode(true);};
 form.onsubmit=e=>{e.preventDefault();try{
  const data=Object.fromEntries(new FormData(form));data.confirmed=field('confirmed').checked;
  const saved=saveProm(data,{patientId,operationDate,storage});records=scopedProms(readProms(storage),patientId,operationDate);trendInstrument.value=saved.instrument;trendSide.value=saved.side;field('id').value='';field('value').value='';field('note').value='';field('confirmed').checked=false;host.querySelector('[data-prom-cancel]').hidden=true;inputMode();draw();message.textContent=`Saved ${PROM_NAMES[saved.instrument]}: ${saved.score} / ${saved.instrument==='koos_jr'?100:48}, ${shortDate(saved.date)}. Saved on this device.`;options.onChange?.();
 }catch(error){message.textContent=`Could not save: ${error.message}`;}};
 trendInstrument.onchange=draw;trendSide.onchange=draw;
 host.querySelector('[data-prom-export]').onclick=()=>csvDownload('patient-questionnaire-history.csv',[['Patient','Operation date','Assessment date','Day after surgery','Knee','Questionnaire','Score','Maximum','Raw total','Scoring method','Note'],...records.map(r=>[r.patient_id,r.operation_date,r.date,postOpDay(r.date,r.operation_date),r.side,PROM_NAMES[r.instrument],r.score,r.instrument==='koos_jr'?100:48,r.raw_total,r.scoring,r.note])]);
 draw();inputMode();
}
