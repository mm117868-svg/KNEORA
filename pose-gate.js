/* Optical events are candidates. Pose observations can approve or reject them,
   but cannot create a repetition without an optical event. No clinical form score. */
export const POSE_GATE_VERSION = 'leg-gate-2';
export const GATE_SETTINGS = Object.freeze({ visibility: .2, presence: .2, maxGap: .45,
  settleTime: .6, settleMotion: .025, onset: .035, excursion: .10, returnDistance: .035,
  returnDwell: .18, minDuration: .65, minLegPixels: 24, completionGrace: .12 });
const SIDES = { left: [23, 25, 27], right: [24, 26, 28] };
const SUPPORTED = new Set(['straight_leg_raise', 'seated_extension', 'heel_slide']);
const sub = (a, b) => [a[0]-b[0], a[1]-b[1]];
const length = p => Math.hypot(...p);
const distance = (a, b) => length(sub(a, b));
const unit = (p, scale) => p.map(v => v/scale);

export function inspectExerciseLeg(landmarks, side, width, height) {
  const reasons = [], points = (SIDES[side] || []).map(i => landmarks?.[i]);
  const names = ['hip', 'knee', 'ankle'];
  points.forEach((p, i) => {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) reasons.push(names[i] + ':missing');
    else if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) reasons.push(names[i] + ':outside_frame');
    else if (!Number.isFinite(p.visibility) || p.visibility < GATE_SETTINGS.visibility ||
      (p.presence !== undefined && (!Number.isFinite(p.presence) || p.presence < GATE_SETTINGS.presence))) reasons.push(names[i] + ':low_visibility');
  });
  if (!points.length || !(width > 0 && height > 0)) reasons.push('leg:missing');
  const outside = reasons.find(r => r.endsWith(':outside_frame'))?.split(':')[0];
  let message = outside ? `Your ${side} ${outside} is outside the picture. Keep your hip, knee and foot in view.` :
    reasons.length ? `The camera cannot clearly see your ${side} exercise leg. Keep your hip, knee and foot visible and check the light.` : `Your ${side} exercise leg is in view. Keep your hip, knee and foot visible throughout each movement.`;
  if (!reasons.length) {
    const [hip,knee,ankle] = points.map(p => [p.x*width,p.y*height]);
    const thigh = distance(hip,knee), lower = distance(knee,ankle);
    if (thigh+lower < GATE_SETTINGS.minLegPixels || Math.min(thigh,lower) < 6) {
      reasons.push('leg:too_small'); message = 'Your exercise leg is too small in the picture. Move the camera closer while keeping your hip, knee and foot visible.';
    }
  }
  return {clear:reasons.length===0, reasons, message};
}

export class LegMotionGate {
  constructor(exercise, side, rawSource = 'monitoring') {
    this.exercise = exercise; this.side = side; this.rawSource = rawSource; this.reset();
  }
  reset() {
    this.reps = 0; this.events = []; this.times = []; this.observations = 0; this.trustedObservations = 0;
    this.calibrated = false; this.rejectionCounts = {}; this.view = null;
    this.reference = null; this.settling = []; this.cycle = null; this.completion = null;
    this.lastTrusted = null; this.lastObservation = null; this.previous = null; this.quality = false;
    this.state = SUPPORTED.has(this.exercise) && SIDES[this.side] ? 'waiting_for_leg' : 'unsupported';
  }
  invalidate(reason) {
    if (this.cycle) for (const event of this.cycle.candidates) this.decide(event, 'unconfirmed', reason);
    this.reference = null; this.settling = []; this.cycle = null; this.completion = null;
    this.previous = null; this.quality = false; this.state = reason;
  }
  advance(t) {
    if (this.lastTrusted !== null && t-this.lastTrusted > GATE_SETTINGS.maxGap &&
        (this.reference || this.settling.length || this.cycle)) this.invalidate('pose_gap');
  }
  observe(landmarks, t, width, height) {
    if (this.state === 'unsupported' || !Number.isFinite(t) ||
        (this.lastObservation !== null && t <= this.lastObservation)) return;
    this.advance(t); this.lastObservation = t; this.observations++;
    const points = SIDES[this.side].map(i => landmarks?.[i]);
    this.view = inspectExerciseLeg(landmarks, this.side, width, height);
    for (const reason of this.view.reasons) this.rejectionCounts[reason] = (this.rejectionCounts[reason] || 0)+1;
    if (!this.view.clear) {
      this.quality = false; this.state = 'leg_not_clear'; return;
    }
    const [hip, knee, ankle] = points.map(p => [p.x*width, p.y*height]);
    const thigh = sub(knee, hip), lower = sub(ankle, knee), whole = sub(ankle, hip);
    const scale = length(thigh)+length(lower);
    if (scale < GATE_SETTINGS.minLegPixels || Math.min(length(thigh), length(lower)) < 6) {
      this.quality = false; this.state = 'leg_too_small'; return;
    }
    const p = { t, hip, knee, ankle, thigh, lower, whole, scale };
    if (this.previous && (distance(p.hip, this.previous.hip) > this.previous.scale*.55 ||
        distance(p.whole, this.previous.whole) > this.previous.scale*.55 ||
        scale/this.previous.scale < .65 || scale/this.previous.scale > 1.5)) {
      this.invalidate('landmark_jump'); this.lastTrusted = t; return;
    }
    this.previous = p; this.lastTrusted = t; this.quality = true; this.trustedObservations++;
    if (!this.reference) {
      const first = this.settling[0];
      if (first && Math.max(distance(p.thigh, first.thigh), distance(p.whole, first.whole))/first.scale > GATE_SETTINGS.settleMotion) this.settling = [];
      this.settling.push(p); this.state = 'hold_start_position';
      if (this.settling.length >= 4 && t-this.settling[0].t >= GATE_SETTINGS.settleTime) {
        const average = key => [0, 1].map(i => this.settling.reduce((s, q) => s+q[key][i], 0)/this.settling.length);
        this.reference = { ...p, thigh: average('thigh'), lower: average('lower'), whole: average('whole'),
          scale: this.settling.reduce((s, q) => s+q.scale, 0)/this.settling.length };
        this.settling = []; this.state = 'ready'; this.calibrated = true;
      }
      return;
    }
    const ref = this.reference;
    const dk = unit(sub(thigh, ref.thigh), ref.scale), da = unit(sub(whole, ref.whole), ref.scale);
    const kneeMotion = length(dk), ankleMotion = length(da), lowerMotion = distance(lower, ref.lower)/ref.scale;
    const movement = this.exercise === 'seated_extension' ? lowerMotion : Math.max(ankleMotion, kneeMotion);
    const coherent = kneeMotion > 0 && ankleMotion > 0 && (dk[0]*da[0]+dk[1]*da[1])/(kneeMotion*ankleMotion) >= .5;
    const expected = this.exercise === 'straight_leg_raise' ? ankleMotion >= .10 && kneeMotion >= .04 && coherent :
      this.exercise === 'heel_slide' ? ankleMotion >= .10 && kneeMotion >= .035 : lowerMotion >= .10 && kneeMotion <= .10;
    if (this.exercise === 'seated_extension' && kneeMotion > .18) { this.invalidate('thigh_moved'); return; }
    if (!this.cycle && movement >= GATE_SETTINGS.onset) {
      this.completion = null;
      this.cycle = { start: t, candidates: [], excursion: false, samples: 0, returnedAt: null };
    }
    if (!this.cycle) { this.state = 'ready'; return; }
    const cycle = this.cycle; cycle.samples++; cycle.excursion ||= expected; this.state = 'following_leg';
    if (movement <= GATE_SETTINGS.returnDistance) {
      cycle.returnedAt ??= t; this.state = 'returning';
      if (t-cycle.returnedAt >= GATE_SETTINGS.returnDwell) {
        const valid = cycle.excursion && t-cycle.start >= GATE_SETTINGS.minDuration && cycle.samples >= 5;
        this.completion = valid ? { start: cycle.start, end: t, used: false } : null;
        for (const event of cycle.candidates) {
          if (valid && !this.completion.used) this.accept(event, this.completion);
          else this.decide(event, 'rejected', valid ? 'duplicate_cycle' : 'insufficient_target_movement');
        }
        this.cycle = null; this.state = 'ready';
      }
    } else cycle.returnedAt = null;
  }
  decide(event, status, reason) { event.status = status; event.reason = reason; }
  accept(event, completion) {
    completion.used = true; this.reps++; this.times.push(completion.end);
    this.decide(event, 'accepted', 'target_leg_cycle'); event.confirmedAt = completion.end;
  }
  candidate(t) {
    this.advance(t);
    const event = { id: this.events.length+1, time: t, source: this.rawSource, status: 'pending', reason: null };
    this.events.push(event);
    if (this.state === 'unsupported' || !this.quality || this.lastTrusted === null || t-this.lastTrusted > GATE_SETTINGS.maxGap) {
      this.decide(event, 'unconfirmed', this.state === 'unsupported' ? 'unsupported' : 'leg_not_clear');
    } else if (!this.reference) this.decide(event, 'unconfirmed', 'starting_position_not_set');
    else if (this.cycle) this.cycle.candidates.push(event);
    else if (this.completion && t >= this.completion.end && t-this.completion.end <= GATE_SETTINGS.completionGrace) {
      if (this.completion.used) this.decide(event, 'rejected', 'duplicate_cycle');
      else this.accept(event, this.completion);
    } else this.decide(event, 'rejected', 'target_leg_still');
    return event;
  }
  finish(t) {
    this.advance(t);
    if (this.cycle) for (const event of this.cycle.candidates) this.decide(event, 'unconfirmed', 'incomplete_cycle');
    this.cycle = null; this.completion = null;
    return this.summary();
  }
  summary() {
    return { version: POSE_GATE_VERSION, exercise: this.exercise, side: this.side, raw_source: this.rawSource,
      repetitions: this.reps, candidate_count: this.events.length,
      rejected: this.events.filter(e => e.status === 'rejected').length,
      unconfirmed: this.events.filter(e => e.status === 'unconfirmed').length,
      pending: this.events.filter(e => e.status === 'pending').length,
      pose_observations: this.observations, trusted_pose_observations: this.trustedObservations,
      calibrated: this.calibrated, tracking_coverage: this.observations ? this.trustedObservations/this.observations : 0,
      count_status: this.reps > 0 ? 'observed' : this.calibrated && this.trustedObservations/this.observations >= .8 ? 'observed' : 'unavailable',
      rejection_counts: {...this.rejectionCounts},
      settings: { ...GATE_SETTINGS }, events: this.events.map(e => ({ ...e })) };
  }
  countingBox(width, height) {
    if (!this.reference) return null;
    const { hip, knee, ankle, scale } = this.reference;
    // Include the whole excursion, not just the resting foot. Pose confirmation
    // remains necessary because this rectangle can contain other moving objects.
    const pad = scale*.45, points = [hip, knee, ankle];
    const x = Math.max(0, Math.min(...points.map(p => p[0]))-pad);
    const y = Math.max(0, Math.min(...points.map(p => p[1]))-pad);
    const right = Math.min(width, Math.max(...points.map(p => p[0]))+pad);
    const bottom = Math.min(height, Math.max(...points.map(p => p[1]))+pad);
    return [x, y, right-x, bottom-y].map(Math.round);
  }
  message() {
    if (!this.quality) return (this.view && !this.view.clear ? this.view.message : 'Keep the whole exercise leg in view.')+' Counting is waiting.';
    if (!this.reference) return 'Hold your leg still briefly at the starting position.';
    return this.cycle ? 'Following your exercise leg. Return to the starting position.' : 'Ready. Only movement confirmed in your selected leg is counted.';
  }
}
