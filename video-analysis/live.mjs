import {EXERCISES} from './exercises.mjs?v=full-breakdown-1';
import {videoRepetitionCount,trackingFeedback} from '../measurement-quality.mjs?v=high-five-small-1';

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
  const count=videoRepetitionCount(report);
  const p=document.createElement('p');p.textContent=`${report.exerciseName}. ${count===null?'Repetitions not measured. '+trackingFeedback(report):count+' complete cycles observed.'} Knee bend: ${angle(report.metrics.kneeBend?.minimum)} to ${angle(report.metrics.kneeBend?.maximum)}. Peak hip estimate: ${angle(report.metrics.hipFlexion?.maximum)}. Leg: ${report.config.side}.`;
  section.append(p);
  const note=document.createElement('p');note.textContent='2D prototype measurements. The recording is not stored in your progress history.';section.append(note);
  const button=document.createElement('button');button.type='button';button.textContent='Download saved analysis';
  button.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=report.exercise+'-analysis.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  section.append(button);return section;
}

export function mountExerciseAnalysis(host,{blob,metadata,onReport,returnToSummary=false,autoStart=true}) {
  if (!EXERCISES[metadata.exercise]) return ()=>{};
  const card=document.createElement('section');card.className='analysis-card';
  const heading=document.createElement('h3');heading.textContent=blob?.size?(autoStart?'Analysing your exercise':'Your video was captured'):'Recording unavailable';
  const text=document.createElement('p');
  text.textContent=blob?.size ? (autoStart?'Your movement details are being analysed on this device. Keep this page open until analysis finishes.':'Select Analyse exercise to add your angles and movement timings to this summary.') : 'No usable recording was captured. Allow camera recording in a supported browser, or use the video upload analyser.';
  card.append(heading,text);
  const button=document.createElement('button');button.type='button';button.textContent='Analyse exercise';button.disabled=!blob?.size;button.hidden=autoStart;card.append(button);
  if(!blob?.size){const a=document.createElement('a');a.href='video-analysis/';a.textContent='Open video analyser';card.append(a);}
  const status=document.createElement('p');status.setAttribute('role','status');card.append(status);host.append(card);
  let recordingURL=null;
  if(blob?.size){
    recordingURL=URL.createObjectURL(blob);
    const review=document.createElement('details'),label=document.createElement('summary');label.textContent='Replay or download your recording';
    const player=document.createElement('video');player.controls=true;player.preload='metadata';player.src=recordingURL;player.style='display:block;max-width:100%;max-height:360px;margin:12px 0';
    const save=document.createElement('a');save.href=recordingURL;save.download=metadata.exercise+'-recording.'+(blob.type.includes('mp4')?'mp4':'webm');save.textContent='Download this recording';
    const note=document.createElement('p');note.textContent='This video is available until you leave this page. Download it if you want to keep it. It is not uploaded.';
    review.append(label,player,save,note);card.append(review);
  }
  let dialog=null,iframe=null,disposed=false,hasReport=false,failed=false,readyTimer=null,token=crypto.randomUUID();
  function analysisFailed(reason){
    clearTimeout(readyTimer);failed=true;card.setAttribute('aria-busy','false');heading.textContent='Analysis needs another try';
    text.textContent='Your recording has stopped. Your live results are still shown, and you can replay or download the video.';
    status.textContent=reason;button.hidden=false;button.textContent='Retry analysis';
  }
  function message(event){
    if(disposed||event.origin!==location.origin||event.source!==iframe?.contentWindow)return;
    if(event.data?.type==='exercise-analysis-ready'){
      clearTimeout(readyTimer);
      iframe.contentWindow.postMessage({type:'exercise-analysis-load',token,blob,metadata},location.origin);
    } else if(event.data?.type==='exercise-analysis-complete'&&event.data.token===token) {
      const report=event.data.report;
      if(!report||!EXERCISES[report.exercise])return;
      // Re-selecting a different exercise in the analyser must not overwrite this session.
      if(report.exercise!==metadata.exercise){status.textContent='This report is for a different exercise. Download it in the analyser; this session was not changed.';return;}
      onReport(report);failed=false;card.setAttribute('aria-busy','false');heading.textContent='Your exercise summary is ready';button.textContent='Open full video report';button.hidden=autoStart;
      text.textContent='Analysis finished. You can replay or download the recording below.';
      status.textContent='Your summary now includes the video measurements.';
      if(returnToSummary&&!hasReport&&dialog?.open){
        dialog?.close();
        document.querySelector('#simpleExerciseSummary h2')?.focus();
      }
      hasReport=true;
    } else if(event.data?.type==='exercise-analysis-error'&&event.data.token===token&&typeof event.data.text==='string') {
      analysisFailed(event.data.text);
    } else if(event.data?.type==='exercise-analysis-status'&&event.data.token===token&&typeof event.data.text==='string') {
      status.textContent=event.data.text;
    }
  }
  window.addEventListener('message',message);
  function openAnalysis(show=true){
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='exercise-analysis-dialog';dialog.setAttribute('aria-label','Recorded exercise analysis');
      const header=document.createElement('div');header.className='analysis-dialog-header';
      const title=document.createElement('strong');title.textContent=EXERCISES[metadata.exercise].name+' analysis';
      const close=document.createElement('button');close.type='button';close.textContent='Back to exercise summary';close.onclick=()=>dialog.close();header.append(title,close);
      iframe=document.createElement('iframe');iframe.title='Exercise measurements and clinical references';iframe.src='video-analysis/?embedded=1&release=full-breakdown-1';
      iframe.onerror=()=>{if(!disposed)analysisFailed('The analyser could not load. Check your connection and try again.');};
      readyTimer=setTimeout(()=>{if(!disposed)analysisFailed('The analyser did not respond. Check your connection and try again.');},20000);
      dialog.append(header,iframe);document.body.append(dialog);
    }
    if(show)dialog.showModal();
  }
  button.onclick=()=>{
    if(failed){clearTimeout(readyTimer);dialog?.close();dialog?.remove();dialog=null;iframe=null;token=crypto.randomUUID();failed=false;hasReport=false;button.hidden=autoStart;heading.textContent='Analysing your exercise';text.textContent='Your movement details are being analysed on this device. Keep this page open until analysis finishes.';status.textContent='Preparing your recording for analysis…';card.setAttribute('aria-busy','true');openAnalysis(!autoStart);}
    else openAnalysis();
  };
  if(autoStart&&blob?.size){status.textContent='Preparing your recording for analysis…';card.setAttribute('aria-busy','true');openAnalysis(false);}
  return ()=>{disposed=true;clearTimeout(readyTimer);window.removeEventListener('message',message);if(dialog){dialog.close();dialog.remove();}if(recordingURL)URL.revokeObjectURL(recordingURL);iframe=null;dialog=null;blob=null;};
}
