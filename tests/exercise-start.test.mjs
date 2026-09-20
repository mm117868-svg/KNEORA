import {TrackingQuality} from '../tracking-quality.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JointFilter} from '../kneerec.js';
import {AppVoice, completionNotice} from '../app-voice.mjs';
import {finishRecording} from '../video-analysis/live.mjs';
import {inspectExerciseLeg} from '../pose-gate.js';
import {raisedHandState,raisedWrist,RAISED_HAND,WaveDetector} from '../raised-hand.mjs';
import {highFiveState,HIGH_FIVE_SETTINGS} from '../high-five.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('const HAND_HOLD_START_S'), html.indexOf('function cameraFailed(e)')) +
  html.slice(html.indexOf('let previewId = 0'), html.indexOf('function startSession()'));
/* A whole-body pose result. The left wrist is either well above the left shoulder or down by the hip; `seen` is how
   visible the model says the wrist is. */
const pose = (raised=true,seen=.95) => { const lm=Array.from({length:33},()=>({x:.5,y:.5,visibility:.9}));
  lm[11]={x:.6,y:.3,visibility:.95}; lm[12]={x:.62,y:.3,visibility:.4}; lm[23]={x:.6,y:.6,visibility:.95}; lm[24]={x:.62,y:.6,visibility:.4};
  lm[15]={x:.7,y:raised?.02:.62,visibility:seen}; lm[13]={x:.66,y:raised?.16:.46,visibility:.9}; lm[0]={x:.6,y:.2,visibility:.9}; lm[16]={x:.64,y:.62,visibility:.3}; return lm; };
const palm = (category='Open_Palm',score=.9) => ({gestures:[[{categoryName:category,score}]],landmarks:[Array.from({length:21},()=>({x:.5,y:.5}))]});
const noPalm = {gestures:[],landmarks:[]};
function previewHarness() {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {hidden: true, style: {}, innerHTML: '', textContent: '', classList: {add(){}, remove(){}}, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }});
    return elements.get(id);
  };
  let now = 0, starts = 0, spoken = 0, stopped = 0, detects = 0, handDetects = 0, landmarks = pose(), handResult = palm();
  const context = vm.createContext({trackingQuality:new TrackingQuality(),setExerciseSidebar(){},$, stream: {}, running: false, current:{kind:'reps'}, JointFilter, outline:{target(){},lose(){},at(){return [];}}, aimOutline(){}, paintOverlay(){}, showSlr(){}, inspectExerciseLeg, raisedHandState, RAISED_HAND, WaveDetector, highFiveState, HIGH_FIVE_SETTINGS, drawRaisedHand(){}, performance: {now: () => now},
    appVoice: {play(){spoken++; return true;}, stop(){stopped++;}}, refreshHint(){},
    video: {readyState: 4, currentTime: 0, videoWidth: 1280}, canvas: {width: 1280, height: 720}, ctx: {drawImage(){}},
    requestAnimationFrame(){return 1;}, cancelAnimationFrame(){}, pickSide(){return null;},
    landmarker: {detectForVideo(){detects++;return {landmarks:landmarks?[landmarks]:[]};}},
    handRecognizer: {recognizeForVideo(){handDetects++;return handResult;}},
    startSession(){starts++; context.running = true;}});
  vm.runInContext(source, context);
  return {$, context, get starts(){return starts;}, get spoken(){return spoken;}, get stopped(){return stopped;}, get detects(){return detects;}, get handDetects(){return handDetects;},
    frame(t, {fresh = true, sample = landmarks, gesture = handResult} = {}) { now = t; landmarks = sample; handResult = gesture; if (fresh) context.video.currentTime += .04; context.previewStep(); },
    run(from, to, options) {for (let t = from; t <= to; t += 40) this.frame(t, options);},
    get counting(){return vm.runInContext('countdownStart !== null', context);}};
}
test('an open palm held for two seconds starts the five-second countdown',()=>{
 const h=previewHarness();h.run(0,1960);assert.equal(h.counting,false);h.run(2000,2280);assert.equal(h.counting,true);assert.equal(h.spoken,1);
 const begin=vm.runInContext('countdownStart',h.context);h.run(2320,begin+4960,{gesture:noPalm});assert.equal(h.starts,0);h.frame(begin+5000,{gesture:noPalm});assert.equal(h.starts,1);
});
test('a raised arm or wave without an Open_Palm classification does not start recording',()=>{
 const h=previewHarness();h.run(0,6000,{sample:pose(true),gesture:palm('Closed_Fist')});assert.equal(h.counting,false);
});
test('open-palm start works with no body pose or face in view', () => {
 const h=previewHarness();h.context.landmarker=null;h.run(0,2200,{sample:null});assert.equal(h.counting,true);
});
test('no hand, an unrecognised gesture and a low-confidence palm cannot start',()=>{
 for(const gesture of [noPalm,palm('None'),palm('Open_Palm',.49),null]){const h=previewHarness();h.run(0,8000,{gesture});assert.equal(h.starts,0);assert.equal(h.counting,false);}
});
test('a lost hand interrupts the hold and needs another full two seconds',()=>{
 const h=previewHarness();h.run(0,1400);h.run(1440,1680,{gesture:noPalm});h.run(1720,3000,{gesture:palm()});assert.equal(h.counting,false);h.run(3040,4200,{gesture:palm()});assert.equal(h.counting,true);
});
test('repeated camera frames cannot complete an open-palm hold',()=>{
 const h=previewHarness();h.run(0,1400);const detects=h.handDetects;h.run(1440,8000,{fresh:false});assert.equal(h.handDetects,detects);assert.equal(h.counting,false);h.run(8040,9400);assert.equal(h.counting,false);
});
test('a camera stall cancels the countdown and stops audio',()=>{
 const h=previewHarness();h.run(0,2400);assert.equal(h.counting,true);h.run(2440,8400,{fresh:false});assert.equal(h.counting,false);assert.equal(h.starts,0);assert.ok(h.stopped>0);
});
test('tapping the countdown cancels it and resets the hold',()=>{
 const h=previewHarness();h.run(0,2400);h.$('countdown').listeners.pointerdown();assert.equal(h.counting,false);assert.equal(h.stopped,1);h.run(2440,3600);assert.equal(h.counting,false);
});
test('with no hand model the Start button and space bar still work',()=>{
 const missing=previewHarness();missing.context.handRecognizer=null;missing.run(0,8000);assert.equal(missing.counting,false);
 vm.runInContext('beginCountdown()',missing.context);assert.equal(missing.counting,true);
 assert.match(html,/<button type="button" class="start-now" id="startNow">/);assert.match(html,/\$\("startNow"\)\.onclick = \(\) => beginCountdown\(\);/);assert.match(html,/e\.code === "Space"/);
 assert.match(html,/loadHighFive|highFiveState|gesture_recognizer/);assert.doesNotMatch(html,/SpeechRecognition|speechSynthesis/);
});
test('what counts as a raised hand: above its own shoulder by half the trunk, sitting or lying, either hand',()=>{
 assert.equal(raisedWrist(pose(true),1280,720),15);assert.equal(raisedWrist(pose(false),1280,720),null);
 const level=pose(true);level[15].y=.2;assert.equal(raisedWrist(level,1280,720),null,'a hand just above the shoulder is not raised');
 const face=pose(true);face[15].y=.19;face[13].y=.4;assert.equal(raisedWrist(face,1280,720),null,'a hand at the face with the elbow down is not a signal');
 const right=pose(false);right[12].visibility=.95;right[24].visibility=.95;right[16]={x:.5,y:.02,visibility:.9};right[14]={x:.55,y:.15,visibility:.9};assert.equal(raisedWrist(right,1280,720),16);
 // lying on the back: trunk along the picture, arm pointing at the ceiling; then the arm resting beside the body
 const lying=pose(false);lying[11]={x:.3,y:.7,visibility:.9};lying[12]={x:.31,y:.68,visibility:.4};lying[23]={x:.55,y:.72,visibility:.9};lying[15]={x:.3,y:.3,visibility:.9};lying[13]={x:.3,y:.5,visibility:.9};lying[0]={x:.2,y:.68,visibility:.9};assert.equal(raisedWrist(lying,1280,720),15);
 lying[15]={x:.5,y:.74,visibility:.9};lying[13]={x:.4,y:.73,visibility:.9};assert.equal(raisedWrist(lying,1280,720),null);
 assert.equal(raisedHandState(null,1280,720),'absent');assert.equal(raisedHandState(undefined,1280,720),'unknown');assert.equal(raisedHandState(pose(false),1280,720),'other');assert.equal(raisedHandState(pose(true),1280,720),'open');
});
test('holding the starting palm cannot finish until it has been released, then held again',()=>{
 const h=previewHarness();for(let t=0;t<6000;t+=120)assert.equal(h.context.finishHand('open',t),0);
 h.context.finishHand('absent',6000);h.context.finishHand('unknown',6200);h.context.finishHand('absent',6400);h.context.finishHand('absent',6600);h.context.finishHand('absent',6800);h.context.finishHand('absent',7000);
 assert.equal(h.context.finishHand('open',7100),0);assert.equal(h.context.finishHand('open',10100),0,'a long missing interval must not complete a hold');
 for(let t=10220;t<=13220;t+=120)h.context.finishHand('open',t);
 assert.equal(h.context.finishHand('open',13340),1);
});

test('a gap between release observations cannot arm the finish gesture',()=>{
 const h=previewHarness();h.context.finishHand('absent',0);h.context.finishHand('absent',2000);
 assert.equal(vm.runInContext('handArmed',h.context),false);
 h.context.finishHand('absent',2250);h.context.finishHand('absent',2500);
 assert.equal(vm.runInContext('handArmed',h.context),true);
});

function audioHarness({voice = 'marin', duration = 5, status = 200} = {}) {
  let plays = 0, stops = 0;
  class Context {
    state = 'suspended'; destination = {};
    async resume(){this.state = 'running';}
    async decodeAudioData(){return {duration};}
    createBufferSource(){return {connect(){}, disconnect(){}, start(){plays++;}, stop(){stops++;}};}
  }
  const player = new AppVoice({AudioContextClass: Context, fetcher: async url => String(url).endsWith('manifest.json') ?
    {ok: status === 200, status, json: async () => ({voice, prompts: {countdown: {file: 'countdown.wav', duration_s: 5}}})} :
    {ok: true, arrayBuffer: async () => new ArrayBuffer(1)}});
  return {player, get plays(){return plays;}, get stops(){return stops;}};
}
test('prepared Marin audio plays once and cancellation stops playback', async () => {
  const h = audioHarness(); assert.equal(await h.player.prepare(), true); assert.equal(h.player.play(), true); assert.equal(h.plays, 1);
  h.player.stop(); assert.equal(h.stops, 1); h.player.stop(); assert.equal(h.stops, 1);
});
test('missing audio, a different voice and incorrect duration do not play substitute speech', async () => {
  for (const options of [{status: 404}, {voice: 'other'}, {duration: 8}]) {
    const h = audioHarness(options); assert.equal(await h.player.prepare(), false); assert.equal(h.player.play(), false); assert.equal(h.plays, 0);
  }
});
test('blocked playback returns false so the screen can identify a visual-only countdown', async () => {
  const h = audioHarness(); await h.player.prepare(); h.player.context.state = 'suspended';
  assert.equal(h.player.play(), false); assert.equal(h.plays, 0);
});

test('completion wording matches the approved audio script and distinguishes an early finish', () => {
  const profile = JSON.parse(readFileSync(new URL('../voice-profile.json', import.meta.url), 'utf8'));
  for (const [count, key] of [[10, 'repetitions_complete'], [12, 'repetitions_complete'], [9, 'session_ended'], [null, 'session_ended']]) {
    const notice = completionNotice(count, 10); assert.equal(notice.key, key); assert.equal(notice.text, profile.prompts[key]);
  }
});

function finishHarness(count = 10) {
  const events = [];
  class Recorder extends EventTarget {state = 'recording'; stop() {this.state = 'inactive'; events.push('stop requested');}}
  const recorder = new Recorder();
  const elements = new Map();
  const $ = id => {if (!elements.has(id)) elements.set(id, {textContent: '', classList: {remove(){}}}); return elements.get(id);};
  const context = vm.createContext({trackingQuality:new TrackingQuality(),setExerciseSidebar(){},$, sessionPausedAt:null,hold:null, running: true, rafId: 0, t0: 0, openGen: 1, recorder, chunks: [],
    performance: {now: () => 10000}, cancelAnimationFrame(){}, finishRecording, console,
    stopCamera(){events.push('camera stopped');}, current: {kind: 'reps', count: 10},
    monitor: {summary: () => ({repetitions: count})}, positionCounter: {summary: () => ({repetitions: count})}, repCounter: {summary: () => ({repetitions: count,events:[]})}, legGate: {finish: () => ({repetitions: count})}, trackWanted: () => false,
    completionNotice, appVoice: {play(key){events.push(key); return true;}}});
  // Exercise the actual finish sequence through the confirmation, without saving any patient record.
  const start = html.indexOf('async function finish(abandon');
  vm.runInContext(html.slice(start, html.indexOf('  mon.early_stop', start)) + '\nreturn confirmation;\n}', context);
  return {context, recorder, events};
}
test('completion speech waits for the recorder stop event and camera shutdown', async () => {
  const h = finishHarness(); const finishing = h.context.finish();
  assert.deepEqual(h.events, ['stop requested']);
  h.recorder.dispatchEvent(new Event('stop')); await finishing;
  assert.deepEqual(h.events, ['stop requested', 'camera stopped', 'repetitions_complete']);
});
test('early finish speaks the session-ended message after stopping', async () => {
  const h = finishHarness(4); const finishing = h.context.finish();
  h.recorder.dispatchEvent(new Event('stop')); await finishing;
  assert.deepEqual(h.events, ['stop requested', 'camera stopped', 'session_ended']);
});
test('abandoned sessions do not announce completed repetitions', async () => {
  const h = finishHarness(); const finishing = h.context.finish(true);
  h.recorder.dispatchEvent(new Event('stop')); await finishing;
  assert.deepEqual(h.events, ['stop requested', 'camera stopped']);
});

for (const exercise of ['straight_leg_raise', 'seated_extension', 'heel_slide']) {
  test(`${exercise}: finishing starts automatic analysis, asks the patient nothing, then saves and displays the report`, async () => {
    const h = finishHarness(), records = [], updates = [];
    let analysis, answer;
    const elements = new Map();
    const $ = id => {
      if (!elements.has(id)) elements.set(id, {value: '', checked: false, innerHTML: '', classList: {add(){}, remove(){}}});
      return elements.get(id);
    };
    $('patient').value = 'SOFTWARE-TEST'; $('side').value = 'left'; $('opdate').value = '2026-09-01';
    Object.assign(h.context, {$, current: {id: exercise, kind: 'reps', count: 10, aim: {}},
      chunks: [new Blob(['software fixture'], {type: 'video/webm'})], startedAt: new Date('2026-09-13T10:00:00Z'),
      frameNo: 250, SOFTWARE: 'test', phase: 1, trace: {rows: []}, LIB: {1: []}, isExerciseAvailable: () => true, renderPhysioReport: () => 'Physio report', closeExercise(){}, openExercise(){},
      daysPostOp: () => 12, localIso: date => date.toISOString(), summarise: () => ({}), tracePreview: () => [],
      storeRecord: record => records.push(record), updateRecord: (slot, record) => updates.push({slot, record}),
      refreshExerciseCompletion(){assert.equal(records.length,1);h.events.push('completion updated');},
      loadRecords: () => records, patientRecords: records => records, esc: value => value,
      renderBasicExerciseSummary: record => record.exercise_analysis ? 'Analysed summary' : 'Live summary',
      renderDetailedExerciseSummary: record => record.exercise_analysis ? 'Full measured report' : 'Waiting for analysis',
      renderHome(){}, disposeAnalysis(){}, mountExerciseContext(){ h.context.openGen++; },   // the page was left here: the test stops before the downloads
      smallMovement: () => false,
      mountExerciseAnalysis(host, options){analysis = options; h.events.push('analysis mounted'); return () => {};},
      ask(){h.events.push('patient question'); return new Promise(resolve => {answer = resolve;});}
    });
    const start = html.indexOf('async function finish(abandon');
    vm.runInContext(html.slice(start, html.indexOf('\nfunction ask(', start)), h.context);
    const finishing = h.context.finish();
    assert.equal(analysis, undefined, 'analysis must wait for the final recording data');
    h.recorder.dispatchEvent(new Event('stop'));
    // finishRecording and finish each resume after the recorder stop event.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(analysis.autoStart, true, 'the main exercise page must enable automatic analysis');
    assert.equal(analysis.metadata.exercise, exercise);
    assert.equal(analysis.metadata.side, 'left');
    assert.ok(analysis.blob.size > 0);
    assert.deepEqual(h.events, ['stop requested', 'camera stopped', 'repetitions_complete', 'completion updated', 'analysis mounted'], 'no pain or effort question is asked');
    assert.equal($('simpleExerciseSummary').innerHTML, 'Live summary');
    const report = {exercise, reps: [{duration: 5}], metrics: {maximumObservedBend: 90}};
    analysis.onReport(report);
    assert.equal(updates.length, 1); assert.equal(updates[0].slot, 0);
    assert.equal(records[0].exercise_analysis, report);
    assert.equal($('simpleExerciseSummary').innerHTML, 'Analysed summary');
    assert.equal($('fullExerciseSummary').innerHTML, 'Full measured report');
    await finishing; assert.equal(records[0].patient.pain_0_10, null); assert.equal(records[0].patient.difficulty_1_5, null);
  });
}
