/* Starting and finishing by raising a hand, read from the pose result the page already has.

   The app used to run a second set of models (a palm detector, a hand landmark model and a gesture classifier)
   ten times a second just to see an open palm. That cost more than the leg tracking it sat beside. The pose
   model already reports both wrists and shoulders on every result, so a raised hand costs nothing extra: a
   wrist held well above its own shoulder, by at least four fifths of the length of the trunk, with the elbow up too. That is true sitting,
   standing or lying down with the arm pointing at the ceiling, and false with the arms resting, folded or on
   the thighs. It needs no open palm, and the hand can be anywhere across the picture.

   A wave is the second way in, and the easier one. A hand above the shoulder, moved side to side, is unmistakably
   deliberate: nobody waves while scratching their head. Because the movement itself carries the intent, the hand
   only has to be a little above the shoulder, which suits someone lying down or stiff in the shoulder, and it
   takes about a second instead of a held pose. Either signal works; the patient uses whichever comes naturally.

   This only starts and stops a recording. It takes no part in measuring or counting. */
export const RAISED_HAND = Object.freeze({visibility: .6, aboveShoulder: .8, sampleMs: 100, releaseMs: 500});
const SIDES = [[15, 11, 23, 12, 13], [16, 12, 24, 11, 14]];   // wrist, its shoulder, its hip, the other shoulder, its elbow
const seen = (p, least) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= least;

/* Which wrist, if any, is raised: the landmark index, or null. body: the 33 pose landmarks, 0 to 1 across the picture. */
export function raisedWrist(body, width, height) {
  if (!Array.isArray(body) || !(width > 0 && height > 0)) return null;
  for (const [wrist, shoulder, hip, other, elbow] of SIDES) {
    const w = body[wrist], s = body[shoulder];
    if (!seen(w, RAISED_HAND.visibility) || !seen(s, RAISED_HAND.visibility)) continue;
    const span = (a, b) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
    const trunk = Math.max(seen(body[hip], .3) ? span(s, body[hip]) : 0, seen(body[other], .3) ? 1.2 * span(s, body[other]) : 0);
    // A deliberate signal: the arm properly up. The wrist well above the shoulder (four fifths of the trunk), the elbow
    // above the shoulder too when it can be seen, and the wrist above the nose when that can be seen. Touching the
    // face, scratching the head or resting a hand on the chest is none of these.
    const e = body[elbow], nose = body[0];
    if (seen(e, RAISED_HAND.visibility) && e.y >= s.y) continue;
    if (seen(nose, RAISED_HAND.visibility) && w.y >= nose.y) continue;
    if (trunk > 0 && (s.y - w.y) * height >= RAISED_HAND.aboveShoulder * trunk) return wrist;
  }
  return null;
}
/* 'open' while a hand is raised, 'other' while a body is in view with no hand raised, 'absent' with nobody in view. */
export function raisedHandState(body, width, height) {
  if (body === undefined) return 'unknown';
  if (!Array.isArray(body)) return 'absent';
  return raisedWrist(body, width, height) === null ? 'other' : 'open';
}
export function drawRaisedHand(ctx, body, width, height) {
  const wrist = raisedWrist(body, width, height); if (wrist === null) return;
  const x = body[wrist].x * width, y = body[wrist].y * height, r = Math.max(14, width / 60);
  ctx.save?.(); ctx.lineWidth = Math.max(3, width / 320); ctx.strokeStyle = 'rgba(5,10,20,.55)'; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 2 * Math.PI); ctx.stroke();
  ctx.strokeStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke(); ctx.restore?.();
}

/* A wave: a hand above its shoulder that changes direction, side to side, `reversals` times inside `windowMs`, each swing
   at least `swing` of the trunk length (about 8 cm on an adult, several times the jitter of a wrist landmark). */
export const WAVE = Object.freeze({visibility: .5, aboveShoulder: .15, swing: .18, reversals: 3, windowMs: 2500, graceMs: 400});
export class WaveDetector {
  constructor(settings = WAVE) { this.s = settings; this.reset(); }
  reset() { this.wrist = null; this.extreme = null; this.direction = 0; this.turns = []; this.lastSeen = null; }
  /* body: the 33 pose landmarks (null when nobody is in view). Returns progress, 0 to 1; 1 means a wave was made. */
  update(body, width, height, tMs) {
    const hand = Array.isArray(body) && width > 0 && height > 0 ? this.hand(body, width, height) : null;
    if (!hand) { if (this.lastSeen !== null && tMs - this.lastSeen > this.s.graceMs) this.reset(); return this.progress(tMs); }
    if (this.wrist !== hand.wrist) { this.reset(); this.wrist = hand.wrist; }
    this.lastSeen = tMs;
    if (this.extreme === null) { this.extreme = hand.x; return this.progress(tMs); }
    const moved = hand.x - this.extreme;
    if (this.direction === 0) { if (Math.abs(moved) >= this.s.swing) { this.direction = Math.sign(moved); this.extreme = hand.x; } }
    else if (moved * this.direction > 0) this.extreme = hand.x;                                  // still going the same way: carry the far point
    else if (Math.abs(moved) >= this.s.swing) { this.direction = -this.direction; this.extreme = hand.x; this.turns.push(tMs); }   // came back far enough: one change of direction
    return this.progress(tMs);
  }
  progress(tMs) { this.turns = this.turns.filter(t => tMs - t <= this.s.windowMs); return Math.min(1, this.turns.length / this.s.reversals); }
  /* the wrist that is above its shoulder, with its sideways position in trunk lengths */
  hand(body, width, height) {
    for (const [wrist, shoulder, hip, other] of SIDES) {
      const w = body[wrist], s = body[shoulder];
      if (!seen(w, this.s.visibility) || !seen(s, this.s.visibility)) continue;
      const span = (a, b) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
      const trunk = Math.max(seen(body[hip], .3) ? span(s, body[hip]) : 0, seen(body[other], .3) ? 1.2 * span(s, body[other]) : 0);
      if (trunk > 0 && (s.y - w.y) * height >= this.s.aboveShoulder * trunk) return {wrist, x: w.x * width / trunk};
    }
    return null;
  }
}
