// Separate hand model: no face, shoulder or whole-body landmarks are needed.
export const HIGH_FIVE_SETTINGS = Object.freeze({score:.5, detection:.3, presence:.3, tracking:.3, sampleMs:100, releaseMs:500});
export async function loadHighFive() {
  const {GestureRecognizer,FilesetResolver}=await import('./vendor/vision_bundle.mjs');
  const files=await FilesetResolver.forVisionTasks(new URL('./vendor/wasm',import.meta.url).href);
  const options={baseOptions:{modelAssetPath:new URL('./models/gesture_recognizer.task',import.meta.url).href,delegate:'GPU'},runningMode:'VIDEO',numHands:2,
    minHandDetectionConfidence:HIGH_FIVE_SETTINGS.detection,minHandPresenceConfidence:HIGH_FIVE_SETTINGS.presence,minTrackingConfidence:HIGH_FIVE_SETTINGS.tracking};
  try{return await GestureRecognizer.createFromOptions(files,options);}
  catch{return GestureRecognizer.createFromOptions(files,{...options,baseOptions:{...options.baseOptions,delegate:'CPU'}});}
}
export function highFiveState(result) {
  if(!result||!Array.isArray(result.gestures)||!Array.isArray(result.landmarks))return 'unknown';
  if(!result.landmarks.length)return 'absent';
  for(let i=0;i<result.landmarks.length;i++){
    const hand=result.landmarks[i],gesture=result.gestures[i]?.[0];
    const inFrame=hand?.length===21&&hand.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
    if(inFrame&&gesture?.categoryName==='Open_Palm'&&Number.isFinite(gesture.score)&&gesture.score>=HIGH_FIVE_SETTINGS.score)return 'open';
  }
  return 'other';
}
export function drawHands(ctx,result,width,height) {
  const links=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
  ctx.strokeStyle=highFiveState(result)==='open'?'#ffe14d':'rgba(255,255,255,.85)';ctx.lineWidth=Math.max(2,width/500);
  for(const hand of result?.landmarks||[])for(const [a,b] of links){const p=hand[a],q=hand[b];if(!p||!q||![p,q].every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.x>=0&&v.x<=1&&v.y>=0&&v.y<=1))continue;
    ctx.beginPath();ctx.moveTo(p.x*width,p.y*height);ctx.lineTo(q.x*width,q.y*height);ctx.stroke();}
}
