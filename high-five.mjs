// A separate hand model recognises an open palm without needing a face, shoulder or whole-body pose.
// It is sampled at 8 Hz only while waiting to start, so it does not compete with exercise measurement.
export const HIGH_FIVE_SETTINGS = Object.freeze({
  score: .5,
  detection: .2,
  presence: .2,
  tracking: .2,
  sampleMs: 125
});

export async function loadHighFive() {
  const {GestureRecognizer, FilesetResolver} = await import('./vendor/vision_bundle.mjs');
  const files = await FilesetResolver.forVisionTasks(new URL('./vendor/wasm', import.meta.url).href);
  const options = {
    baseOptions: {
      modelAssetPath: new URL('./models/gesture_recognizer.task', import.meta.url).href,
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: HIGH_FIVE_SETTINGS.detection,
    minHandPresenceConfidence: HIGH_FIVE_SETTINGS.presence,
    minTrackingConfidence: HIGH_FIVE_SETTINGS.tracking
  };
  try {
    return await GestureRecognizer.createFromOptions(files, options);
  } catch {
    return GestureRecognizer.createFromOptions(files, {
      ...options,
      baseOptions: {...options.baseOptions, delegate: 'CPU'}
    });
  }
}

export function highFiveState(result) {
  if (!result || !Array.isArray(result.gestures) || !Array.isArray(result.landmarks)) return 'unknown';
  if (!result.landmarks.length) return 'absent';
  for (let i = 0; i < result.landmarks.length; i++) {
    const hand = result.landmarks[i];
    const gesture = result.gestures[i]?.[0];
    const inFrame = hand?.length === 21 && hand.every(point =>
      Number.isFinite(point.x) && Number.isFinite(point.y) &&
      point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
    );
    if (!inFrame) continue;
    const labelledOpen=gesture?.categoryName === 'Open_Palm'&&Number.isFinite(gesture.score)&&gesture.score>=HIGH_FIVE_SETTINGS.score;
    const classifierUncertain=!gesture||gesture.categoryName==='None'||gesture.categoryName==='Unknown';
    /* The same MediaPipe hand model also supplies 21 landmarks. On difficult Intel colour frames the gesture
       classifier can return None despite a clear palm, so accept three visibly extended fingers as a fallback. */
    const distance=(a,b)=>Math.hypot(hand[a].x-hand[b].x,hand[a].y-hand[b].y);
    const extended=[[6,8],[10,12],[14,16],[18,20]].filter(([pip,tip])=>distance(0,tip)>distance(0,pip)*1.18).length;
    if(labelledOpen||(classifierUncertain&&extended>=3))return 'open';
  }
  return 'other';
}
