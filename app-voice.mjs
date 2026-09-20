export const VOICE_PREFERENCE_KEY='kr_marin_voice_enabled';
let voicePreference=true;
export function voiceEnabled(){try{const saved=globalThis.localStorage?.getItem(VOICE_PREFERENCE_KEY);return saved===null||saved===undefined?voicePreference:saved!=='0';}catch{return voicePreference;}}
export function setVoiceEnabled(enabled){voicePreference=Boolean(enabled);try{globalThis.localStorage?.setItem(VOICE_PREFERENCE_KEY,enabled?'1':'0');}catch{}globalThis.dispatchEvent?.(new Event('kneora-voice-change'));}
// Shared playback for generated Marin prompts. No microphone, browser TTS or API key.
export function completionNotice(count, prescribed) {
  const complete = Number.isFinite(count) && Number.isFinite(prescribed) && prescribed > 0 && count >= prescribed;
  return complete
    ? {key: "repetitions_complete", text: "Your repetitions are now complete. The recording has stopped. You may now move from your exercise position when you are ready."}
    : {key: "session_ended", text: "Your exercise session has ended. The recording has stopped. You may now move from your exercise position when you are ready."};
}
export class AppVoice {
  constructor({onState = () => {}, fetcher = (...args) => fetch(...args), AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext} = {}) {
    this.onState = onState; this.fetcher = fetcher; this.AudioContextClass = AudioContextClass;
    globalThis.addEventListener?.('kneora-voice-change',()=>{if(!voiceEnabled())this.stop();});
    this.context = null; this.source = null; this.buffers = new Map(); this.states = new Map(); this.pending = new Map();
  }
  get state() { return this.states.get("countdown") || "idle"; }
  setState(state, prompt = "countdown") { this.states.set(prompt, state); this.onState(state, prompt); }
  async prepare(prompt = "countdown") {
    // Called directly from selecting an exercise so browser audio is unlocked before the hand gesture.
    try {
      if (!this.AudioContextClass) { this.setState("unavailable", prompt); return false; }
      this.context ||= new this.AudioContextClass();
      const resumed = this.context.resume();
      if (this.buffers.has(prompt)) { await resumed; this.setState(this.context.state === "running" ? "ready" : "blocked", prompt); return this.context.state === "running"; }
      if (this.pending.has(prompt)) { await resumed; return this.pending.get(prompt); }
      this.setState("loading", prompt);
      const loading = this.load(prompt, resumed);
      this.pending.set(prompt, loading);
      try { return await loading; } finally { this.pending.delete(prompt); }
    } catch { this.setState("blocked", prompt); return false; }
  }
  async load(prompt, resumed) {
    try {
      await resumed;
      const manifestURL = new URL("./audio/marin/manifest.json", import.meta.url);
      const response = await this.fetcher(manifestURL, {cache: "no-store"});
      if (!response.ok) { this.setState(response.status === 404 ? "missing" : "unavailable", prompt); return false; }
      const manifest = await response.json();
      const entry = manifest.prompts?.[prompt];
      if (manifest.voice !== "marin" || !entry || !Number.isFinite(entry.duration_s) || entry.duration_s <= 0) throw new Error("Unrecognised voice asset");
      const audio = await this.fetcher(new URL(entry.file, manifestURL));
      if (!audio.ok) throw new Error("Missing audio");
      const buffer = await this.context.decodeAudioData(await audio.arrayBuffer());
      if (Math.abs(buffer.duration - entry.duration_s) > 0.05 || (prompt === "countdown" && Math.abs(buffer.duration - 5) > 0.05)) throw new Error("Incorrect prompt timing");
      this.buffers.set(prompt, buffer);
      this.setState(this.context.state === "running" ? "ready" : "blocked", prompt);
      return this.context.state === "running";
    } catch { this.setState("unavailable", prompt); return false; }
  }
  play(prompt = "countdown") {
    this.stop();
    if(!voiceEnabled()) return false;
    const buffer = this.buffers.get(prompt);
    if (!buffer || this.context?.state !== "running") return false;
    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer; source.connect(this.context.destination);
      source.onended = () => { source.disconnect(); if (this.source === source) this.source = null; };
      source.start(); this.source = source; return true;
    } catch { this.setState("unavailable", prompt); return false; }
  }
  stop() {
    if (!this.source) return;
    const source = this.source; this.source = null;
    try { source.stop(); source.disconnect(); } catch { /* Already ended. */ }
  }
}
