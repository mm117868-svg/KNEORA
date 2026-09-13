import {EXERCISES} from './exercises.mjs';

// MediaRecorder emits its last data chunk before stop. Assemble only afterwards.
export async function finishRecording(recorder, chunks) {
  if (!recorder) return null;
  if (recorder.state !== 'inactive') {
    await new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);recorder.removeEventListener('stop',stop);recorder.removeEventListener('error',error);};
      const stop=()=>{cleanup();resolve();};
      const error=()=>{cleanup();reject(Error('The recording could not be finalised.'));};
      const timer=setTimeout(()=>{cleanup();reject(Error('The recording took too long to stop.'));},10000);
      recorder.addEventListener('stop',stop,{once:true});recorder.addEventListener('error',error,{once:true});
      try {recorder.stop();} catch(e) {cleanup();reject(e);}
    });
  }
  return chunks.length ? new Blob(chunks,{type:recorder.mimeType||chunks[0].type}) : null;
}

export function savedAnalysisSummary(report) {
  const section=document.createElement('section');section.className='analysis-card';
  const heading=document.createElement('h3');heading.textContent='Recorded exercise analysis';section.append(heading);
  const angle=n=>Number.isFinite(n)?n.toFixed(1)+'°':'not measured';
  const p=document.createElement('p');p.textContent=`${report.exerciseName}. ${report.reps.length} complete cycles. Knee bend: ${angle(report.metrics.kneeBend?.minimum)} to ${angle(report.metrics.kneeBend?.maximum)}. Peak hip estimate: ${angle(report.metrics.hipFlexion?.maximum)}. Leg: ${report.config.side}.`;
  section.append(p);
  const note=document.createElement('p');note.textContent='2D prototype measurements. The recording is not stored in your progress history.';section.append(note);
  const button=document.createElement('button');button.type='button';button.textContent='Download saved analysis';
  button.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=report.exercise+'-analysis.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  section.append(button);return section;
}

export function mountExerciseAnalysis(host,{blob,metadata,onReport,returnToSummary=false}) {
  if (!EXERCISES[metadata.exercise]) return ()=>{};
  const card=document.createElement('section');card.className='analysis-card';
  const heading=document.createElement('h3');heading.textContent='Add your movement details';
  const text=document.createElement('p');
  text.textContent=blob?.size ? 'Select Analyse exercise to add your angles and movement timings to this summary.' : 'No usable recording was captured. Allow camera recording in a supported browser, or use the video upload analyser.';
  card.append(heading,text);
  const button=document.createElement('button');button.type='button';button.textContent='Analyse exercise';button.disabled=!blob?.size;card.append(button);
  if(!blob?.size){const a=document.createElement('a');a.href='video-analysis/';a.textContent='Open video analyser';card.append(a);}
  const status=document.createElement('p');status.setAttribute('role','status');card.append(status);host.append(card);
  let dialog=null,iframe=null,disposed=false,hasReport=false,token=crypto.randomUUID();
  function message(event){
    if(disposed||event.origin!==location.origin||event.source!==iframe?.contentWindow)return;
    if(event.data?.type==='exercise-analysis-ready'){
      iframe.contentWindow.postMessage({type:'exercise-analysis-load',token,blob,metadata},location.origin);
    } else if(event.data?.type==='exercise-analysis-complete'&&event.data.token===token) {
      const report=event.data.report;
      if(!report||!EXERCISES[report.exercise])return;
      // Re-selecting a different exercise in the analyser must not overwrite this session.
      if(report.exercise!==metadata.exercise){status.textContent='This report is for a different exercise. Download it in the analyser; this session was not changed.';return;}
      onReport(report);button.textContent='Open full video report';
      heading.hidden=true;text.hidden=true;
      status.textContent='Your summary now includes the video measurements.';
      if(returnToSummary&&!hasReport){
        dialog?.close();
        document.querySelector('#simpleExerciseSummary h2')?.focus();
      }
      hasReport=true;
    }
  }
  window.addEventListener('message',message);
  button.onclick=()=>{
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='exercise-analysis-dialog';dialog.setAttribute('aria-label','Recorded exercise analysis');
      const header=document.createElement('div');header.className='analysis-dialog-header';
      const title=document.createElement('strong');title.textContent=EXERCISES[metadata.exercise].name+' analysis';
      const close=document.createElement('button');close.type='button';close.textContent='Back to exercise summary';close.onclick=()=>dialog.close();header.append(title,close);
      iframe=document.createElement('iframe');iframe.title='Exercise measurements and clinical references';iframe.src='video-analysis/?embedded=1';
      dialog.append(header,iframe);document.body.append(dialog);
    }
    dialog.showModal();
  };
  return ()=>{disposed=true;window.removeEventListener('message',message);if(dialog){dialog.close();dialog.remove();}iframe=null;dialog=null;blob=null;};
}
