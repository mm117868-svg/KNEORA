/* Starting and finishing by raising a hand, read from the pose result the page already has.

   The app used to run a second set of models (a palm detector, a hand landmark model and a gesture classifier)
   ten times a second just to see an open palm. That cost more than the leg tracking it sat beside. The pose
   model already reports both wrists and shoulders on every result, so a raised hand costs nothing extra: a
   wrist held clearly above its own shoulder, by at least half the length of the trunk. That is true sitting,
   standing or lying down with the arm pointing at the ceiling, and false with the arms resting, folded or on
   the thighs. It needs no open palm, and the hand can be anywhere across the picture.

   This only starts and stops a recording. It takes no part in measuring or counting. */
export const RAISED_HAND = Object.freeze({visibility: .5, aboveShoulder: .5, sampleMs: 100, releaseMs: 500});
const SIDES = [[15, 11, 23, 12], [16, 12, 24, 11]];   // wrist, its shoulder, its hip, the other shoulder
const seen = (p, least) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= least;

/* Which wrist, if any, is raised: the landmark index, or null. body: the 33 pose landmarks, 0 to 1 across the picture. */
export function raisedWrist(body, width, height) {
  if (!Array.isArray(body) || !(width > 0 && height > 0)) return null;
  for (const [wrist, shoulder, hip, other] of SIDES) {
    const w = body[wrist], s = body[shoulder];
    if (!seen(w, RAISED_HAND.visibility) || !seen(s, RAISED_HAND.visibility)) continue;
    const span = (a, b) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
    const trunk = Math.max(seen(body[hip], .3) ? span(s, body[hip]) : 0, seen(body[other], .3) ? 1.2 * span(s, body[other]) : 0);
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
