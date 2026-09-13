const root=new URL('./',import.meta.url);
let dialog=null,finish=null,previousFocus=null;
function initialise(){
 if(dialog)return;
 const style=document.createElement('style');style.textContent=`
 .exercise-guide-dialog{width:min(760px,calc(100vw - 28px));max-height:calc(100dvh - 28px);box-sizing:border-box;border:1px solid #deded2;border-radius:22px;padding:24px;background:#faf9f3;color:#243d32;font-family:inherit;overflow:auto;box-shadow:0 22px 90px #172b3040}
 .exercise-guide-dialog::backdrop{background:#1b292bd9}
 .exercise-guide-dialog *{box-sizing:border-box}.exercise-guide-dialog h2{font-size:clamp(23px,4vw,32px);line-height:1.2;margin:6px 40px 10px 0;color:#243d32}.exercise-guide-dialog p{color:#5c6a60;line-height:1.5;margin:8px 0 14px}.exercise-guide-dialog .guide-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#486f5d;font-weight:700}
 .exercise-guide-dialog video{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#edf1eb;border-radius:12px}
 .exercise-guide-dialog .guide-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}.exercise-guide-dialog button{font:inherit;cursor:pointer;min-height:48px;padding:12px 17px;border-radius:10px;border:1px solid #9cad9f;background:transparent;color:#294835;font-weight:600}.exercise-guide-dialog .guide-primary{background:#274d3b;color:white;border-color:#274d3b}.exercise-guide-dialog .guide-close{position:absolute;right:16px;top:12px;border:0;font-size:26px;min-height:44px;padding:6px 12px}.exercise-guide-dialog .guide-note{font-size:13px;margin:12px 0 0}.exercise-guide-dialog button:focus-visible,.exercise-guide-dialog video:focus-visible{outline:3px solid #b57231;outline-offset:3px}
 @media(max-width:480px){.exercise-guide-dialog{padding:19px 14px}.exercise-guide-dialog .guide-actions button{flex:1 1 100%}}`;
 document.head.append(style);dialog=document.createElement('dialog');dialog.className='exercise-guide-dialog';dialog.setAttribute('aria-labelledby','exerciseGuideTitle');dialog.setAttribute('aria-describedby','exerciseGuideDescription');dialog.innerHTML=`<button type="button" class="guide-close" aria-label="Back to exercises">×</button><div class="guide-kicker">One-minute guide · Optional</div><h2 id="exerciseGuideTitle"></h2><p id="exerciseGuideDescription">Watch a demonstration if you would like a reminder, or go straight to your exercise.</p><video controls playsinline preload="none" aria-label="Exercise demonstration"><track kind="captions" srclang="en" label="English"></video><p class="guide-error" hidden>The video could not load. You can still start the exercise and read the written instructions.</p><div class="guide-actions"><button type="button" class="guide-watch guide-primary">Watch how to do it</button><button type="button" class="guide-skip">Skip and start</button></div><p class="guide-note">Follow your own prescribed range, hold time and repetitions.</p>`;
 document.body.append(dialog);
 const video=dialog.querySelector('video'),watch=dialog.querySelector('.guide-watch');
 watch.onclick=()=>{if(video.ended)video.currentTime=0;video.play().catch(()=>{dialog.querySelector('.guide-error').hidden=false});};
 video.addEventListener('play',()=>{watch.textContent='Restart video';watch.onclick=()=>{video.currentTime=0;video.play().catch(()=>{})};});
 video.addEventListener('ended',()=>{watch.textContent='Watch again';dialog.querySelector('.guide-skip').textContent='Start exercise';});
 video.addEventListener('error',()=>{dialog.querySelector('.guide-error').hidden=false});
 dialog.querySelector('.guide-skip').onclick=()=>finish?.(true);
 dialog.querySelector('.guide-close').onclick=()=>finish?.(false);
 dialog.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();finish?.(false)});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation()});
}
export function showExerciseGuide(exercise){
 initialise();if(finish)finish(false);const video=dialog.querySelector('video');previousFocus=document.activeElement;
 dialog.querySelector('h2').textContent=exercise.title;dialog.querySelector('.guide-watch').textContent='Watch how to do it';dialog.querySelector('.guide-skip').textContent='Skip and start';dialog.querySelector('.guide-error').hidden=true;
 video.poster=new URL('videos/'+exercise.id+'.jpg',root);video.src=new URL('videos/'+exercise.id+'.mp4',root);video.querySelector('track').src=new URL('videos/'+exercise.id+'.vtt',root);video.load();
 dialog.showModal();dialog.querySelector('.guide-watch').focus();
 return new Promise(resolve=>{finish=proceed=>{video.pause();video.removeAttribute('src');video.querySelector('track').removeAttribute('src');video.load();finish=null;dialog.close();previousFocus?.focus();resolve(proceed);};});
}
