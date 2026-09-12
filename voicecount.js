/* Knee Recovery: the patient-count layer. A third layer, kept apart from the other two as in
   CONTRIBUTING.md.

   The patient says the number of each repetition out loud. A small keyword spotter on this device
   (TensorFlow.js speech-commands, vocabulary "zero" to "nine" plus a few commands) hears it.
   Every clear utterance advances the count; a number that is heard clearly sets the count to that
   number, so one misheard word does not lose the rest of the set.

   This layer receives audio only. It never sees frames, landmarks, joints or angles, and nothing in
   it looks at the video. The count it produces is the patient's own count, not a measurement of the
   movement: no part of the picture is compared with anything, and no repetition is segmented from
   any signal. Its result meets the other two layers only in the session record, side by side.

   The sound never leaves the device. The model files are served from this site and the spotting runs
   in the page, unlike the browser's own speech recognition, which sends sound away to be recognised. */

export const VOICE_VERSION = "voicecount-0.1.0";

/* served from beside this file, so the page works offline and the sound has nowhere to go */
const asset = f => new URL(f, import.meta.url).href;
const MODEL_URL = asset("vendor/speech/model/model.json");
const META_URL = asset("vendor/speech/model/metadata.json");
const TF_URL = asset("vendor/speech/tf.min.js");
const SC_URL = asset("vendor/speech/speech-commands.min.js");

const DIGITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const MIN_GAP_S = 0.8;      // two counting events cannot be closer together than this
const P_NUMBER = 0.70;      // a number is taken as heard at this confidence
const P_SPEECH = 0.85;      // any other word counts as a spoken repetition only when this sure
const RESYNC_AHEAD = 3;     // a number this far above the running count still sets it

let loading = null;

/* load the library and the model once. Both are files on this site; nothing is fetched from elsewhere. */
function script(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = () => ok(); s.onerror = () => fail(new Error("could not load " + src));
    document.head.appendChild(s);
  });
}

export function voiceAvailable() {
  return !!(window.AudioContext || window.webkitAudioContext) && !!navigator.mediaDevices?.getUserMedia;
}

export async function loadVoice() {
  if (!loading) {
    loading = (async () => {
      if (!window.tf) await script(TF_URL);
      if (!window.speechCommands) await script(SC_URL);
      const r = window.speechCommands.create("BROWSER_FFT", undefined, MODEL_URL, META_URL);
      await r.ensureModelLoaded();
      return r;
    })().catch(e => { loading = null; throw e; });
  }
  return loading;
}

export class VoiceCount {
  /* Hears the patient counting. clock() gives the session time in seconds, or null when the session is
     not running yet, in which case words are heard but nothing is counted. */
  constructor(clock, onCount) {
    this.clock = clock; this.onCount = onCount || (() => { });
    this.recognizer = null; this.listening = false; this.failed = "";
    this.reset();
  }

  reset() { this.count = 0; this.rows = []; this.numbers = 0; this.resyncs = 0; this.lastAt = -99; this.lastNumber = null; }

  async start() {
    if (this.listening) return true;
    try {
      this.recognizer = await loadVoice();
      this.words = this.recognizer.wordLabels();
      await this.recognizer.listen(r => this.heard(r), {
        probabilityThreshold: Math.min(P_NUMBER, P_SPEECH),
        overlapFactor: 0.5,
        includeSpectrogram: false,
        invokeCallbackOnNoiseAndUnknown: true
      });
      this.listening = true; this.failed = "";
      return true;
    } catch (e) {
      this.failed = /permission|not-allowed|NotAllowed/i.test(e.message || "") ? "counting out loud needs microphone permission for this page" : "counting out loud could not start (" + (e.message || e) + ")";
      this.listening = false;
      return false;
    }
  }

  stop() {
    this.listening = false;
    if (this.recognizer) { try { this.recognizer.stopListening(); } catch (e) { } }
  }

  /* one result from the spotter. scores are per word, in the order of wordLabels(). */
  heard(result) {
    const scores = result.scores;
    let best = 0;
    for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
    const label = this.words[best], p = scores[best];
    if (label === "_background_noise_") return;

    const digit = Object.prototype.hasOwnProperty.call(DIGITS, label) ? DIGITS[label] : null;
    const isNumber = digit !== null && p >= P_NUMBER;
    const isSpeech = digit === null && p >= P_SPEECH;
    if (!isNumber && !isSpeech) return;

    const t = this.clock();
    if (t === null) return;                       // heard before the session was running: not counted
    if (t - this.lastAt < MIN_GAP_S) return;      // one word, one repetition

    let kind = "speech";
    if (isNumber) {
      this.numbers++; this.lastNumber = digit;
      if (digit > this.count && digit <= this.count + RESYNC_AHEAD) {
        if (digit > this.count + 1) this.resyncs++;
        this.count = digit; kind = "number";
      } else if (digit === this.count) {
        return;                                   // the same number heard twice in a row
      } else {
        this.count++; kind = "number_out_of_order";
      }
    } else {
      this.count++;                               // a word that is not a number, "ten" among them
    }
    this.lastAt = t;
    this.rows.push([+t.toFixed(2), label, +p.toFixed(3), this.count, kind]);
    this.onCount(this.count, label, kind);
  }

  summary() {
    return {
      repetitions: this.count,
      source: "patient_voice",
      words_heard: this.rows.length,
      numbers_heard: this.numbers,
      resyncs: this.resyncs,
      last_number: this.lastNumber,
      available: !!this.recognizer,
      error: this.failed || null,
      trace_file: this.rows.length ? "voice.csv" : null
    };
  }

  csv() { return "t,word,probability,count,kind\n" + this.rows.map(r => r.join(",")).join("\n") + "\n"; }
}
