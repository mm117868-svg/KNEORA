import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {SkeletonAverage} from '../live-overlay.mjs';
import {AppVoice, completionNotice} from '../app-voice.mjs';
import {finishRecording} from '../video-analysis/live.mjs';
import {inspectExerciseLeg} from '../pose-gate.js';
import {highFiveState,HIGH_FIVE_SETTINGS} from '../high-five.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('const HAND_HOLD_START_S'), html.indexOf('function cameraFailed(e)')) +
  html.slice(html.indexOf('let previewId = 0'), html.indexOf('function startSession()'));
const pose = (open=true,score=.95) => ({gestures:[[{categoryName:open?'Open_Palm':'Closed_Fist',score}]],landmarks:[Array.from({length:21},(_,i)=>({x:.1+(i%4)*.02,y:.7+Math.floor(i/4)*.02}))]});
function previewHarness() {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {hidden: true, style: {}, innerHTML: '', textContent: '', classList: {add(){}, remove(){}}, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }});
    return elements.get(id);
  };
  let now = 0, starts = 0, spoken = 0, stopped = 0, detects = 0, landmarks = pose();
  const context = vm.createContext({setExerciseSidebar(){},$, stream: {}, running: false, current:{kind:'reps'}, skeletonAverage:new SkeletonAverage(), inspectExerciseLeg, highFiveState, HIGH_FIVE_SETTINGS, drawHands(){}, performance: {now: () => now},
    appVoice: {play(){spoken++; return true;}, stop(){stopped++;}}, refreshHint(){},
    video: {readyState: 4, currentTime: 0, videoWidth: 1280}, canvas: {width: 1280, height: 720}, ctx: {drawImage(){}},
    requestAnimationFrame(){return 1;}, cancelAnimationFrame(){}, pickSide(){return null;}, drawSkeleton(){},
    landmarker: {detectForVideo(){return {landmarks:[]};}},
    handRecognizer:{recognizeForVideo(){detects++;return landmarks;}},
    startSession(){starts++; context.running = true;}});
  vm.runInContext(source, context);
  return {$, context, get starts(){return starts;}, get spoken(){return spoken;}, get stopped(){return stopped;}, get detects(){return detects;},
    frame(t, {fresh = true, sample = landmarks} = {}) { now = t; landmarks = sample; if (fresh) context.video.currentTime += .04; context.previewStep(); },
    run(from, to, options) {for (let t = from; t <= to; t += 40) this.frame(t, options);},
    get counting(){return vm.runInContext('countdownStart !== null', context);}};
}
test('an open palm starts the five-second countdown with no face or body landmarks',()=>{
 const h=previewHarness();h.run(0,1960);assert.equal(h.counting,false);h.run(2000,2280);assert.equal(h.counting,true);assert.equal(h.spoken,1);
 const begin=vm.runInContext('countdownStart',h.context);h.run(2320,begin+4960,{sample:pose(false)});assert.equal(h.starts,0);h.frame(begin+5000,{sample:pose(false)});assert.equal(h.starts,1);
});
test('fists, missing results and weak classifications cannot start',()=>{
 for(const sample of [pose(false),null,pose(true,.2),{gestures:[],landmarks:[]}]){const h=previewHarness();h.run(0,8000,{sample});assert.equal(h.starts,0);assert.equal(h.counting,false);}
});
test('a lost hand interrupts the hold and needs another full two seconds',()=>{
 const h=previewHarness();h.run(0,1400);h.run(1440,1680,{sample:null});h.run(1720,3000,{sample:pose()});assert.equal(h.counting,false);h.run(3040,4000);assert.equal(h.counting,true);
});
test('repeated camera frames cannot complete an open-palm hold',()=>{
 const h=previewHarness();h.run(0,1400);const detects=h.detects;h.run(1440,8000,{fresh:false});assert.equal(h.detects,detects);assert.equal(h.counting,false);h.run(8040,9400);assert.equal(h.counting,false);
});
test('a camera stall cancels the countdown and stops audio',()=>{
 const h=previewHarness();h.run(0,2400);assert.equal(h.counting,true);h.run(2440,8400,{fresh:false});assert.equal(h.counting,false);assert.equal(h.starts,0);assert.ok(h.stopped>0);
});
test('tapping the countdown cancels it and resets the hold',()=>{
 const h=previewHarness();h.run(0,2400);h.$('countdown').listeners.pointerdown();assert.equal(h.counting,false);assert.equal(h.stopped,1);h.run(2440,3600);assert.equal(h.counting,false);
});
test('hand recognition can start without the body model, but not without the hand model',()=>{
 const h=previewHarness();h.context.landmarker=null;h.run(0,2400);assert.equal(h.counting,true);
 const missing=previewHarness();missing.context.handRecognizer=null;missing.run(0,8000);assert.equal(missing.counting,false);
 assert.doesNotMatch(html,/HAND_ABOVE_NOSE|handPosition\(|SpeechRecognition|speechSynthesis/);
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
  const context = vm.createContext({setExerciseSidebar(){},$, running: true, rafId: 0, t0: 0, openGen: 1, recorder, chunks: [],
    performance: {now: () => 10000}, cancelAnimationFrame(){}, finishRecording, console,
    stopCamera(){events.push('camera stopped');}, current: {kind: 'reps', count: 10},
    monitor: {summary: () => ({repetitions: count})}, positionCounter: {summary: () => ({repetitions: count})}, legGate: {finish: () => ({repetitions: count})}, trackWanted: () => false,
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
  test(`${exercise}: finishing starts automatic analysis before patient answers, then saves and displays the report`, async () => {
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
      frameNo: 250, SOFTWARE: 'test', phase: 1, trace: {rows: []},
      daysPostOp: () => 12, localIso: date => date.toISOString(), summarise: () => ({}), tracePreview: () => [],
      storeRecord: record => records.push(record), updateRecord: (slot, record) => updates.push({slot, record}),
      loadRecords: () => records, patientRecords: records => records, esc: value => value,
      renderBasicExerciseSummary: record => record.exercise_analysis ? 'Analysed summary' : 'Live summary',
      renderDetailedExerciseSummary: record => record.exercise_analysis ? 'Full measured report' : 'Waiting for analysis',
      renderHome(){}, disposeAnalysis(){}, smallMovement: () => false,
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
    assert.deepEqual(h.events, ['stop requested', 'camera stopped', 'repetitions_complete', 'analysis mounted', 'patient question']);
    assert.equal($('simpleExerciseSummary').innerHTML, 'Live summary');
    const report = {exercise, reps: [{duration: 5}], metrics: {maximumObservedBend: 90}};
    analysis.onReport(report);
    assert.equal(updates.length, 1); assert.equal(updates[0].slot, 0);
    assert.equal(records[0].exercise_analysis, report);
    assert.equal($('simpleExerciseSummary').innerHTML, 'Analysed summary');
    assert.equal($('fullExerciseSummary').innerHTML, 'Full measured report');
    h.context.openGen++; answer(null); await finishing;
  });
}
