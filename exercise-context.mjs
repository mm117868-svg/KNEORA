import {esc} from './progress-shared.mjs';
export const ASSISTANCE={unknown:'Not recorded',none:'No help moving the leg',person:'Help from another person',strap:'Help from a strap or the other leg',mixed:'Help changed during the exercise'};
export const RESISTANCE={unknown:'Not recorded',none:'No added resistance',weight:'An added weight',band:'An exercise band',other:'Other or mixed resistance'};
const enumValue=(n,values)=>Object.hasOwn(values,n)?n:'unknown';
export function normaliseExerciseContext(input={}){
 const assistance=enumValue(input.assistance,ASSISTANCE),resistance=enumValue(input.resistance,RESISTANCE);
 const pain=input.pain_during_0_10,weight=input.load_kg;
 return {assistance,resistance,load_kg:resistance==='weight'&&Number.isFinite(weight)&&weight>0?weight:null,
  pain_during_0_10:Number.isInteger(pain)&&pain>=0&&pain<=10?pain:null};
}
export function exerciseContextKey(record){
 const c=normaliseExerciseContext(record.patient?.exercise_context);
 return JSON.stringify([c.assistance,c.resistance,c.load_kg]);
}
export function exerciseContextFacts(record){
 const c=normaliseExerciseContext(record.patient?.exercise_context);
 return [['Help moving the leg',ASSISTANCE[c.assistance]],['Added resistance',RESISTANCE[c.resistance]],
  ...(c.resistance==='weight'?[['Reported added weight',c.load_kg===null?'Not recorded':`${c.load_kg} kg`]]:[]),
  ['Worst pain during exercise',c.pain_during_0_10===null?'Not recorded':`${c.pain_during_0_10}/10`]];
}
export function mountExerciseContext(host,record,onChange){
 const c=normaliseExerciseContext(record.patient?.exercise_context),options=values=>Object.entries(values).map(([key,label])=>`<option value="${key}">${esc(label)}</option>`).join('');
 host.innerHTML=`<details class="exercise-context"><summary>Add how you performed the exercise (optional)</summary><p>These answers help interpret your results. They describe this session and do not change your exercise prescription. Analysis continues automatically.</p><div class="exercise-context-fields"><label>Did anything help move your operated leg?<select data-context="assistance">${options(ASSISTANCE)}</select></label><label>Did you use added resistance?<select data-context="resistance">${options(RESISTANCE)}</select></label><label data-weight hidden>Weight used, if known (kg)<input data-context="load_kg" type="number" min="0.01" step="any" inputmode="decimal"></label><label>Worst pain while doing the exercise<select data-context="pain_during_0_10"><option value="">Not recorded</option>${Array.from({length:11},(_,n)=>`<option value="${n}">${n}${n===0?' · no pain':n===10?' · worst pain':''}</option>`).join('')}</select></label></div><p data-context-status role="status"></p></details>`;
 const field=key=>host.querySelector(`[data-context="${key}"]`);
 for(const [key,value] of Object.entries(c))field(key).value=value??'';
 const weight=host.querySelector('[data-weight]');weight.hidden=c.resistance!=='weight';
 host.querySelectorAll('[data-context]').forEach(input=>input.onchange=()=>{
  if(field('resistance').value==='weight'&&!field('load_kg').checkValidity()){host.querySelector('[data-context-status]').textContent='Enter a positive weight, or leave it blank if unknown.';return;}
  const value=key=>field(key).value===''?null:Number(field(key).value);
  const next=normaliseExerciseContext({assistance:field('assistance').value,resistance:field('resistance').value,load_kg:value('load_kg'),pain_during_0_10:value('pain_during_0_10')});
  weight.hidden=next.resistance!=='weight';if(weight.hidden)field('load_kg').value='';
  record.patient??={};record.patient.exercise_context=next;
  try{onChange();host.querySelector('[data-context-status]').textContent='Saved with this exercise on this device.';}
  catch(e){host.querySelector('[data-context-status]').textContent='These answers could not be saved. '+e.message;}
 });
}
