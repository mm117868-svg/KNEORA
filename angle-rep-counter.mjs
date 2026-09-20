import {StillHold} from './still-hold.mjs';
/* Repetitions from a joint angle: leave the resting position, come back, count one.

   This is the enter and exit threshold counter that Google's ML Kit and MediaPipe fitness samples use (smoothing,
   one threshold to enter a position, a lower one to leave it), applied to the angle the app already measures
   instead of to a pose classifier. It costs nothing extra: the pose is already being worked out for the display.
   Matthew's decision of 19 Sep 2026: counting may use the pose landmarks. The earlier pixel-only counters
   (kneerec.js FlowMonitor, the position prototype) are kept in the repository but no longer run live.

   Small movements are the point. In the first weeks a bend may be a few degrees, so nothing here is a fixed
   range: the resting angle is learned from the patient, a movement is an excursion of at least `minDeg` away from
   it (5 degrees, about three times the jitter of the smoothed angle), and once the patient's own range is known
   the entry threshold follows it at 25% of their usual excursion and the movement only ends once the leg is back
   within 15% of its furthest point from rest, so sagging part of the way down during a hold neither ends the hold
   nor counts twice. Either direction counts: a knee extension lowers the bend, a heel slide raises it.

   Fail-safes, so a doubtful movement is left out and never invented:
     the entry threshold is never less than six times the jitter measured while the resting angle was learned, so a
       noisy view needs a bigger movement before anything counts;
     a movement whose return was not seen (the leg out of sight for more than four seconds) is not counted;
     a movement shorter than 0.3 s, or within 0.6 s of the last count, is not counted;
     if the leg settles somewhere new and stays there for twenty seconds (longer than any hold), that is taken as a change of position, not
       a movement: nothing is counted and the resting angle is learned again;
     the caller passes NaN whenever the pose model is unsure of the leg, which is treated as the leg out of sight.

   It counts movements completed. It does not judge their quality, and it never tells the patient off. */
export const ANGLE_COUNTER = Object.freeze({smoothS: 0.15, restLearnS: 1.0, restFollowS: 2.5, minDeg: 5, enterShare: 0.25, exitShare: 0.15, settleS: 0.12, minAwayS: 0.3, minGapS: 0.6, maxLostS: 4, noiseTimes: 6, stuckS: 20});
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

export class AngleRepCounter {
  /* direction: 'up' counts only movements that raise the watched angle, 'down' only ones that lower it, 'either' both. */
  constructor(settings = ANGLE_COUNTER, direction = 'either', restBand = null) { this.s = settings; this.restBand = Array.isArray(restBand) && restBand.length === 2 ? restBand : null;   // where this exercise starts: the resting value is only learned inside it
     this.direction = ['up', 'down'].includes(direction) ? direction : 'either'; this.reset(); }
  reset() { this.stillHold = new StillHold(); this.reps = 0; this.events = []; this.smooth = null; this.lastT = null; this.rest = null; this.learn = []; this.learnFrom = null; this.state = 'learning'; this.since = null; this.awayAt = null; this.peak = 0; this.peaks = []; this.lastRepAt = -Infinity; this.lostAt = null; this.holdSince = null; this.held = 0; this.noise = 0; this.steadyFrom = null; this.steadyLo = 0; this.steadyHi = 0; }
  get ready() { return this.rest !== null; }
  get enter() { return Math.max(this.s.minDeg, this.s.noiseTimes * this.noise, this.peaks.length >= 2 ? this.s.enterShare * median(this.peaks.slice(-6)) : 0); }
  // Hold time includes only confirmed stillness after settling, never travel or unseen frames.
  holdS(t) { return this.state === 'away' ? this.stillHold.read(t) : 0; }
  message() { return !this.ready ? (this.restBand && this.smooth !== null && (this.smooth < this.restBand[0] || this.smooth > this.restBand[1]) ? 'Go to the starting position and stay there for a moment.' : 'Stay in your starting position for a moment.') : this.state === 'away' ? 'Movement seen. Hold, then return slowly.' : 'Counting your movements.'; }

  /* angle in degrees (NaN when the joint was not seen), t in seconds. Returns 1 when a repetition completes. */
  update(angle, t, knee = null) {
    if (!Number.isFinite(t) || (this.lastT !== null && t <= this.lastT)) return 0;
    const gap = this.lastT === null ? 0 : t - this.lastT; this.lastT = t;
    /* The leg out of sight for a moment does not spoil a movement: the counter waits. Out of sight for longer than
       `maxLostS`, a movement in progress is dropped, because its return was not seen. */
    if (Number.isFinite(angle)) { if (this.lostAt !== null && this.state === 'away' && t - this.lostAt > this.s.maxLostS) { this.events.push({t, status: 'unconfirmed', reason: 'leg_not_seen'}); this.state = 'rest'; this.since = null; } this.lostAt = null; }
    else { this.stillHold.update(NaN,t); this.lostAt ??= t; this.smooth = null; if (!this.ready) { this.learn = []; this.learnFrom = null; } return 0; }
    const a = this.smooth === null ? 1 : 1 - Math.exp(-Math.max(gap, 1e-3) / this.s.smoothS); this.smooth = this.smooth === null ? angle : this.smooth + a * (angle - this.smooth);
    if (!this.ready) {                                                   // learn the resting angle: a second of steady readings
      if (this.restBand && (this.smooth < this.restBand[0] || this.smooth > this.restBand[1])) { this.learn = []; this.learnFrom = null; return 0; }   // not in this exercise's starting position: e.g. held straight at the top of a knee extension
      this.learnFrom ??= t; this.learn.push(this.smooth);
      if (Math.max(...this.learn) - Math.min(...this.learn) > this.s.minDeg) { this.learn = [this.smooth]; this.learnFrom = t; }
      if (t - this.learnFrom >= this.s.restLearnS) { this.rest = median(this.learn); const m = this.learn.reduce((a, b) => a + b, 0) / this.learn.length; this.noise = Math.sqrt(this.learn.reduce((a, b) => a + (b - m) ** 2, 0) / this.learn.length); this.state = 'rest'; }
      return 0;
    }
    const off = this.smooth - this.rest, size = this.direction === 'either' ? Math.abs(off) : Math.max(0, this.direction === 'up' ? off : -off);   // the wrong way is not this exercise
    if (this.state === 'rest') {
      if (size >= this.enter) { this.since ??= t; if (t - this.since >= this.s.settleS) { this.stillHold.reset(); this.state = 'away'; this.awayAt = this.since; this.peak = size; this.since = null; this.holdSince = null; this.held = 0; this.steadyFrom = null; } }
      else { this.since = null; if (Math.abs(off) < this.enter) this.rest += (1 - Math.exp(-Math.max(gap, 1e-3) / this.s.restFollowS)) * off; }   // the resting angle follows small drift as the patient settles, never a movement the wrong way
      return 0;
    }
    // settled somewhere new for a long time: a change of position, not a movement
    if (this.steadyFrom === null || this.smooth < this.steadyLo || this.smooth > this.steadyHi) { this.steadyFrom = t; this.steadyLo = this.smooth - this.s.minDeg / 2; this.steadyHi = this.smooth + this.s.minDeg / 2; }
    else if (t - this.steadyFrom >= this.s.stuckS) { this.events.push({t, status: 'unconfirmed', reason: 'position_changed'}); this.rest = null; this.learn = []; this.learnFrom = null; this.state = 'learning'; this.since = null; this.steadyFrom = null; return 0; }
    this.peak = Math.max(this.peak, size);
    this.stillHold.update(angle, t, knee); this.held = Math.max(this.held, this.stillHold.read(t));
    if (size <= Math.max(this.s.exitShare * this.peak, 0.5 * this.s.minDeg)) {
      this.since ??= t; if (t - this.since < this.s.settleS) return 0;
      const held = this.since - this.awayAt, counted = held >= this.s.minAwayS && t - this.lastRepAt >= this.s.minGapS;
      this.state = 'rest'; this.since = null;
      if (!counted) { this.events.push({t, status: 'unconfirmed', reason: 'too_brief'}); return 0; }
      this.reps++; this.lastRepAt = t; this.peaks.push(this.peak); this.events.push({t, status: 'accepted', excursion_deg: +this.peak.toFixed(1), away_s: +held.toFixed(2), hold_s: +this.held.toFixed(2), hold_end_reason: this.stillHold.ended?.reason || null});
      return 1;
    } else this.since = null;
    return 0;
  }
  summary(t) {
    if (this.state === 'away') this.events.push({t, status: 'unconfirmed', reason: 'ended_before_return'});
    return {version: 'angle-hysteresis-1', repetitions: this.ready ? this.reps : null, count_status: this.ready ? 'counted' : 'unavailable', resting_angle_deg: this.ready ? +this.rest.toFixed(1) : null,
      median_excursion_deg: this.peaks.length ? +median(this.peaks).toFixed(1) : null, events: this.events};
  }
}
