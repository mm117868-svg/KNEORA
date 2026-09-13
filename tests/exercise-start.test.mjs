import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {AppVoice, completionNotice} from '../app-voice.mjs';
import {finishRecording} from '../video-analysis/live.mjs';
import {inspectExerciseLeg} from '../pose-gate.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('const HAND_HOLD_START_S'), html.indexOf('function cameraFailed(e)')) +
  html.slice(html.indexOf('let previewId = 0'), html.indexOf('function startSession()'));
const pose = (raised = true) => Array.from({length: 33}, (_, i) => ({x: .5, y: i === 0 ? .5 : i === 15 && raised ? .2 : .75, visibility: 1}));
function previewHarness() {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {hidden: true, style: {}, innerHTML: '', textContent: '', classList: {add(){}, remove(){}}, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }});
    return elements.get(id);
  };
  let now = 0, starts = 0, spoken = 0, stopped = 0, detects = 0, landmarks = pose();
  const context = vm.createContext({$, stream: {}, running: false, current:{kind:'reps'}, inspectExerciseLeg, performance: {now: () => now},
    appVoice: {play(){spoken++; return true;}, stop(){stopped++;}}, refreshHint(){},
    video: {readyState: 4, currentTime: 0, videoWidth: 1280}, canvas: {width: 1280, height: 720}, ctx: {drawImage(){}},
    requestAnimationFrame(){return 1;}, cancelAnimationFrame(){}, pickSide(){return null;}, drawSkeleton(){},
    landmarker: {detectForVideo(){detects++; return {landmarks: landmarks ? [landmarks] : []};}},
    startSession(){starts++; context.running = true;}});
  vm.runInContext(source, context);
  return {$, context, get starts(){return starts;}, get spoken(){return spoken;}, get stopped(){return stopped;}, get detects(){return detects;},
    frame(t, {fresh = true, sample = landmarks} = {}) { now = t; landmarks = sample; if (fresh) context.video.currentTime += .04; context.previewStep(); },
    run(from, to, options) {for (let t = from; t <= to; t += 40) this.frame(t, options);},
    get counting(){return vm.runInContext('countdownStart !== null', context);}};
}
test('a continuous raised hand starts one five-second countdown, then recording', () => {
  const h = previewHarness();
  h.run(0, 2000); assert.equal(h.counting, false); assert.equal(h.starts, 0);
  h.run(2040, 2240); assert.equal(h.counting, true); assert.equal(h.spoken, 1);
  const begin = vm.runInContext('countdownStart', h.context);
  h.run(2280, begin + 4960, {sample: pose(false)}); assert.equal(h.starts, 0);
  h.frame(begin + 5000, {sample: pose(false)}); assert.equal(h.starts, 1); assert.equal(h.spoken, 1);
});
test('lowered hands, missing landmarks and low confidence cannot start', () => {
  for (const sample of [pose(false), null, pose().map(p => ({...p, visibility: .2}))]) {
    const h = previewHarness(); h.run(0, 8000, {sample}); assert.equal(h.starts, 0); assert.equal(h.counting, false);
  }
});
test('a brief raise interrupted by lost landmarks needs a fresh full hold', () => {
  const h = previewHarness(); h.run(0, 1400); h.run(1440, 1680, {sample: null});
  h.run(1720, 3000, {sample: pose()}); assert.equal(h.counting, false);
  h.run(3040, 4000); assert.equal(h.counting, true);
});
test('repeated camera frames cannot complete a raised-hand hold', () => {
  const h = previewHarness(); h.run(0, 1400); const detects = h.detects;
  h.run(1440, 8000, {fresh: false}); assert.equal(h.detects, detects); assert.equal(h.counting, false); assert.equal(h.starts, 0);
  h.run(8040, 9400); assert.equal(h.counting, false);
});
test('a camera stall cancels countdown and stops its audio', () => {
  const h = previewHarness(); h.run(0, 2400); assert.equal(h.counting, true);
  h.run(2440, 8400, {fresh: false}); assert.equal(h.counting, false); assert.equal(h.starts, 0); assert.ok(h.stopped > 0);
});
test('tapping the countdown cancels it and resets the hand hold', () => {
  const h = previewHarness(); h.run(0, 2400); h.$('countdown').listeners.pointerdown();
  assert.equal(h.counting, false); assert.equal(h.stopped, 1);
  h.run(2440, 3600); assert.equal(h.counting, false); assert.equal(h.starts, 0);
});
test('camera tracking must be ready and no manual or speech-start control remains', () => {
  const h = previewHarness(); h.context.landmarker = null; h.run(0, 10000); assert.equal(h.starts, 0); assert.equal(h.counting, false);
  assert.doesNotMatch(html, /briefStart|id="handstart"|SpeechRecognition|speechSynthesis|voicecount\.js|id="voice"|id="speak"/);
  assert.equal((html.match(/beginCountdown\(\)/g) || []).length, 2); // Declaration and raised-hand call only.
});
test('unseen wrists do not arm hands-free finish as if the hand was lowered', () => {
  const h = previewHarness(); const sample = pose(false); sample[15].visibility = 0;
  assert.equal(h.context.handPosition(sample), null);
  assert.equal(h.context.handPosition(pose(false)), 'lowered');
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
  const context = vm.createContext({$, running: true, rafId: 0, t0: 0, openGen: 1, recorder, chunks: [],
    performance: {now: () => 10000}, cancelAnimationFrame(){}, finishRecording, console,
    stopCamera(){events.push('camera stopped');}, current: {kind: 'reps', count: 10},
    monitor: {summary: () => ({repetitions: count})}, legGate: {finish: () => ({repetitions: count})}, trackWanted: () => false,
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
