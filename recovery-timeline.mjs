import {esc,shortDate,dayLabel} from './progress-shared.mjs';
import {localDate,postOpDay} from './progress-data.mjs';
import {RECOVERY_SOURCES} from './recovery-references.mjs';
export const TIMELINE_SOURCES={...RECOVERY_SOURCES,
 earlyRange:{name:'Kornuijt et al. (2019), prospective study of 137 patients',url:'https://pubmed.ncbi.nlm.nih.gov/30628029/'},
 nhs:{name:'NHS: recovering from knee replacement',url:'https://www.nhs.uk/tests-and-treatments/knee-replacement/recovery/'},
 exerciseGuide:{name:'AAOS: total knee replacement exercise guide',url:'https://www.orthoinfo.org/recovery/total-knee-replacement-exercise-guide/'}
};
export const REHAB_STAGES=[
 {id:'first-day',period:'Day 0 to 1',short:'Start moving',title:'Start moving with support',aim:'Begin supported movement, getting out of bed and walking with appropriate help. Pain should be managed sufficiently to take part.',
  programme:['The clinical team helps with the first transfers and short walks.','Begin the gentle exercises your team has prescribed, when able.'],
  watch:['Help needed to get up','Walking with support','Pain during activity'],
  highlight:'Within 24 hours',kind:'Guideline recommendation',
  evidence:'NICE recommends rehabilitation on the day of surgery where possible, and within 24 hours, unless there is a clinical reason to delay.',sources:['nice'],programmeSources:['nice','exerciseGuide']},
 {id:'early-weeks',period:'First 1 to 2 weeks',short:'Build confidence',title:'Build confidence with everyday movement',aim:'Become more confident getting up and sitting down, taking short walks, bending and straightening the knee, and activating the thigh muscle.',
  programme:['Practise the prescribed knee bends, straightening and thigh exercises.','Continue supported walking and everyday tasks within the plan given to you.'],
  watch:['Knee bend and straightening','Control when lifting the leg','Pain and swelling','Confidence getting up'],
  highlight:'70 to 90°',kind:'Early active knee bend · middle 50%',
  evidence:'The Kittelson reference chart describes this range immediately after surgery. It is early postoperative context, not a requirement to achieve by day 14. The chart was developed from 1,173 observations in 327 patients.',sources:['chart'],programmeSources:['exerciseGuide']},
 {id:'one-month',period:'Around 1 month',short:'Grow your range',title:'Develop movement and exercise control',aim:'Continue improving bending and straightening as everyday activities become more manageable. Follow movement, symptoms and function together.',
  programme:['Continue the bending and straightening exercises in your plan.','Build walking and daily activity gradually, with the support you need.'],
  watch:['Furthest comfortable bend','Straightest knee position','Walking ability','Exercise control'],
  highlight:'95 to 115°',kind:'Active knee bend · middle 50%',
  evidence:'This is the reference-chart range around one month. Strength and walking performance may still be below their preoperative level. A better reported knee score does not necessarily mean physical performance has recovered at the same rate.',sources:['chart','function'],programmeSources:['exerciseGuide']},
 {id:'six-eight-weeks',period:'Around 6 to 8 weeks',short:'Improve control',title:'Work towards steadier, more controlled movement',aim:'Look for continuing movement gains, steadier walking and better control when lifting or straightening the leg.',
  programme:['Continue range and muscle-control work.','Your physiotherapist may progress strengthening and walking as your ability allows.'],
  watch:['Bend and straightening','Return control','Walking steadiness','Strength assessed separately'],
  highlight:'110° at 8 weeks',kind:'Median knee bend · one 137-patient study',
  evidence:'In this separate prospective study, median bend increased from 80° in week one to 110° at eight weeks. Average lack of full straightening reduced from 10.7° to 3.2°. These are study observations, not personal targets.',sources:['earlyRange'],programmeSources:['exerciseGuide']},
 {id:'three-months',period:'Around 3 months',short:'Build function',title:'Turn movement gains into everyday ability',aim:'Follow useful knee movement, walking and stair ability, while continuing to develop strength.',
  programme:['Review how the knee performs in everyday tasks, as well as during exercises.','Progress strengthening and endurance with the clinical team.'],
  watch:['Usable knee range','Walking and stairs','Thigh strength','Patient-reported recovery'],
  highlight:'109 to 122°',kind:'Active knee bend · middle 50%',
  evidence:'This is the reference-chart range around three months. A meta-analysis of 17 studies, involving 832 patients overall, found quadriceps strength remained below preoperative levels in the pooled 1.5 to 3-month period. Different time points included different study subsets.',sources:['chart','strength'],programmeSources:['exerciseGuide','guideline']},
 {id:'three-six-months',period:'3 to 6 months',short:'Build endurance',title:'Keep developing strength and endurance',aim:'Strength, endurance and everyday function become particularly useful to follow alongside knee movement.',
  programme:['Continue the strengthening and activity progression agreed with your physiotherapist.','Review which daily tasks still need work, rather than focusing only on an angle.'],
  watch:['Walking tolerance','Strength and endurance','Daily independence','Remaining movement limits'],
  highlight:'Gains can slow',kind:'Range-of-motion pattern · 559-patient study',
  evidence:'Most range-of-motion improvement occurred in the first 12 weeks, with smaller changes up to approximately 26 weeks. Slower angle gains do not mean every aspect of recovery has stopped. Starting range and age influenced the modelled recovery.',sources:['trajectories'],programmeSources:['exerciseGuide','guideline']},
 {id:'longer-term',period:'6 to 12 months+',short:'Maintain progress',title:'Build lasting confidence and independence',aim:'Look for better everyday function, walking capacity, strength and patient-reported knee health compared with earlier recovery.',
  programme:['Continue appropriate activity and strengthening as part of everyday life.','Use planned follow-ups to review remaining limitations and personal goals.'],
  watch:['Everyday activities','Walking capacity','Strength','KOOS JR or Oxford score'],
  highlight:'Recovery continues',kind:'Longer-term function and patient experience',
  evidence:'A 100-patient longitudinal cohort found improvements in walking tests, strength and reported function between one and 12 months. The NHS advises that full recovery can take several months or longer and varies between people.',sources:['function','nhs'],programmeSources:['exerciseGuide','nhs']}
];
const sourceLink=key=>`<a href="${TIMELINE_SOURCES[key].url}" target="_blank" rel="noopener">${esc(TIMELINE_SOURCES[key].name)}</a>`;
const sourceLinks=keys=>keys.map(sourceLink).join(' · ');
const domainIcons=[
 ['Knee movement','M6 4l5 7-3 9M11 11l8 2M8 20h6'],
 ['Muscle control and strength','M5 16l3-6 4 2 3-6 4 2M4 20h16M14 4l5 2-1 5'],
 ['Pain and swelling','M12 4C9 8 5 11 5 15a7 7 0 0014 0c0-4-4-7-7-11M9 15h6'],
 ['Walking','M13 7l-2 6 4 3 2 5M11 13l-3 8M8 8l-3 4M13 7l4 4h4M13 3h.01'],
 ['Everyday independence','M4 11l8-7 8 7M6 10v10h12V10M10 20v-7h4v7'],
 ['How your knee feels','M5 5h14v12h-6l-5 4v-4H5zM8 9h8M8 13h5']
];
function stageDetail(stage,index) {
 return `<div class="rt-stage-heading"><div><div class="eyebrow">${esc(stage.period)}</div><h2 id="rt-stage-title">${esc(stage.title)}</h2><p>${esc(stage.aim)}</p></div><span class="rt-stage-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span></div>
 <div class="rt-stage-columns"><section class="rt-programme"><h3>What the programme may include</h3><ul>${stage.programme.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><p class="rt-fine">Illustrative activities, adapted by your clinical team. ${sourceLinks(stage.programmeSources)}</p><h3 class="rt-watch-heading">Useful things to follow</h3><ul class="rt-measure-tags">${stage.watch.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></section>
 <section class="rt-evidence"><span class="rt-evidence-label">Research reference</span><strong>${esc(stage.highlight)}</strong><span class="rt-evidence-kind">${esc(stage.kind)}</span><p>${esc(stage.evidence)}</p><p class="rt-fine">${sourceLinks(stage.sources)}</p></section></div>`;
}
export function renderRecoveryTimeline(host,{patientId='',operationDate=''}={}) {
 const today=localDate(),day=postOpDay(today,operationDate);
 const scope=JSON.stringify([patientId,operationDate]);
 let selected=host.dataset.scope===scope?Number(host.dataset.selected||0):0;
 if(!Number.isInteger(selected)||selected<0||selected>=REHAB_STAGES.length)selected=0;
 host.dataset.scope=scope;
 host.innerHTML=`<header class="rt-heading"><div class="eyebrow">A guide to total knee replacement</div><h1>Recovery takes shape<br><em>over time.</em></h1><p>A typical rehabilitation journey, from the first supported steps to longer-term strength and independence.</p>${operationDate?`<p class="rt-patient-day">Your operation: ${esc(shortDate(operationDate))} · ${esc(dayLabel(day))} today. This is a calendar reference, not an assessment of your recovery.</p>`:''}</header>
 <aside class="rt-principle"><span class="rt-principle-icon" aria-hidden="true">↗</span><div><strong>Reference points, not mandatory deadlines.</strong><p>This is an idealised overview, not a personal prescription. Your starting movement, strength, health and clinical plan affect the pace. The phases overlap and you may revisit earlier exercises.</p></div></aside>
 <section class="rt-whole-person" aria-labelledby="rt-components"><h2 id="rt-components">Good recovery has several parts</h2><ul>${domainIcons.map(([label,path])=>`<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg><span>${label}</span></li>`).join('')}</ul><p>An angle or repetition count alone cannot capture the whole picture. Physical performance and the patient’s own assessment can recover at different rates. ${sourceLink('function')}</p></section>
 <section class="rt-journey" aria-labelledby="rt-journey-title"><div class="rt-journey-heading"><div><div class="eyebrow">From the first day onwards</div><h2 id="rt-journey-title">Explore the recovery timeline</h2></div><p>Select a stage to explore its focus.</p></div>
 <ol class="rt-rail" aria-label="Chronological rehabilitation stages">${REHAB_STAGES.map((s,i)=>`<li><button type="button" data-stage="${i}" aria-pressed="false" aria-controls="rt-stage-detail"><span class="rt-node" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="rt-period">${esc(s.period)}</span><span class="rt-short">${esc(s.short)}</span></button></li>`).join('')}</ol>
 <article class="rt-stage-detail" id="rt-stage-detail" aria-labelledby="rt-stage-title" tabindex="-1"></article>
 <div class="rt-stage-controls"><button type="button" data-previous>← Previous stage</button><p role="status" data-stage-status></p><button type="button" data-next>Next stage →</button></div></section>
 <aside class="rt-reading-note"><h3>How to read the numbers</h3><p>The 70 to 90°, 95 to 115° and 109 to 122° bands describe the <strong>middle 50% of active knee-bend observations</strong> at the stated times. They are not minimum requirements. The eight-week figures come from a separate study and should not be joined to these bands as one recovery curve.</p><p>These are clinical study measurements. A camera estimate or assisted heel slide is not interchangeable with a standardised active range examination. ${sourceLink('chart')}</p></aside>
 <details class="rt-collection" id="rt-collection"><summary>Which of these can this app track?</summary><p>Your <a href="?view=recovery-summary">Recovery summary</a> brings together dedicated bending and straightening checks, symptoms and exercise observations. Dedicated checks can use a short MediaPipe sequence, imported depth-camera coordinates or a separately entered clinical reading. The exercise analyser covers straight leg raises, seated knee extensions and heel slides. Video results are estimates from visible movement and depend on usable tracking. Their clinical accuracy has not been established.</p><div class="rt-collection-grid">
 <section><span class="rt-collection-label">From your recordings</span><h3>Movement and exercise activity</h3><ul><li><strong>All three exercises:</strong> repetitions, session duration, seconds per repetition, repetitions per minute, and outward, hold and return timings.</li><li><strong>Straight leg raise:</strong> extra knee bend during the lift, approximate hip flexion and lift range.</li><li><strong>Seated knee extension:</strong> straightest observed position, straightening range and variation in return timing.</li><li><strong>Heel slides:</strong> greatest observed knee bend, straightening on return, movement range and variation between repetitions.</li><li>Saved exercise days and comparable results over time. Only activity recorded in the app is counted.</li></ul><p class="rt-fine">Frame coverage and rejected frames describe recording quality. Timing and consistency describe the movement; they do not prove muscle strength or good technique.</p></section>
 <section><span class="rt-collection-label">Entered separately</span><h3>Your experience and clinical results</h3><ul><li>Operation date, used to show the day after surgery.</li><li>Pain after exercise, from 0 to 10, and exercise effort, from 1 to 5.</li><li>Dated official KOOS JR or Oxford Knee Scores from completed questionnaires. The full questionnaires are administered separately.</li><li>A clinician-completed QAB score can be recorded with an SLR analysis. It is not calculated from the video.</li></ul><p class="rt-fine">The QAB is a three-part clinical assessment. Recording a clinician's result does not validate an automated video score. ${sourceLink('qab')}</p></section>
 <section><span class="rt-collection-label">Separate assessment needed</span><h3>Other parts of recovery</h3><ul><li>Muscle strength and physiological muscle activation.</li><li>Passive knee extension and clinical extension lag.</li><li>Swelling, wound healing and joint stability.</li><li>Walking speed or distance, walking balance, stair ability and chair-rise performance.</li><li>Help needed with everyday tasks and activity outside recorded sessions.</li></ul><p class="rt-fine">These are not automatically measured by the three exercise videos. They need an appropriate clinical assessment, a dedicated test or additional patient reporting.</p></section>
 </div></details>
 <details class="rt-complete"><summary>Read the complete timeline</summary><ol>${REHAB_STAGES.map((s,i)=>`<li><span class="rt-overview-node" aria-hidden="true">${i+1}</span><div><p class="eyebrow">${esc(s.period)}</p><h3>${esc(s.title)}</h3><p>${esc(s.aim)}</p><p><strong>${esc(s.highlight)}.</strong> ${esc(s.evidence)}</p><p class="rt-fine">${sourceLinks(s.sources)}</p></div></li>`).join('')}</ol></details>
 <footer class="rt-footer"><div><h2>Your own progress tells the personal story</h2><p>Use the timeline alongside your saved exercises, symptoms and planned clinical reviews.</p></div><div><a class="pt-link-button" href="?view=recovery-summary">View your recovery summary →</a><a class="pt-link-button" href="?view=patient-measures">Patient-reported measures →</a></div></footer>`;
 const panel=host.querySelector('#rt-stage-detail'),status=host.querySelector('[data-stage-status]'),previous=host.querySelector('[data-previous]'),next=host.querySelector('[data-next]');
 function draw(){
  host.dataset.selected=String(selected);panel.innerHTML=stageDetail(REHAB_STAGES[selected],selected);
  host.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stage)===selected)));
  previous.disabled=selected===0;next.disabled=selected===REHAB_STAGES.length-1;
  status.textContent=`${selected+1} of ${REHAB_STAGES.length} · ${REHAB_STAGES[selected].period}`;
 }
 host.querySelectorAll('[data-stage]').forEach(button=>button.onclick=()=>{selected=Number(button.dataset.stage);draw();});
 previous.onclick=()=>{if(selected>0){selected--;draw();}};next.onclick=()=>{if(selected<REHAB_STAGES.length-1){selected++;draw();}};
 draw();
}
