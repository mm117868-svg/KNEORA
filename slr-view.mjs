/* Straight leg raise: two more things read from the pose result the page already has. Display only.

   Hip raise: the angle at the hip of the operated leg between the trunk (shoulder to hip) and the thigh (hip to
   knee). 0 degrees is the leg in line with the trunk; lifting the leg raises it. Like the knee angle it is a 2D
   angle from a side-on camera and is not a validated clinical measurement.

   Other knee: a straight leg raise is set up with the other knee bent and that foot flat, which steadies the
   pelvis and lower back. While the patient gets into position the page says whether the other knee looks bent.
   It is a setup check shown before recording starts. It never scores or interrupts a repetition. */
import {kneeFlexionDeg} from './kneerec.js?v=fluid-1';
export const SLR_VIEW = Object.freeze({visibility: .5, otherKneeBentFrom: 40});
const IDS = {left: {shoulder: 11, hip: 23, knee: 25, ankle: 27}, right: {shoulder: 12, hip: 24, knee: 26, ankle: 28}};
const point = (body, id, w, h) => { const p = body?.[id]; return p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 0) >= SLR_VIEW.visibility ? [p.x * w, p.y * h] : null; };
const angle = (a, b, c) => { if (!a || !b || !c) return null; const v = kneeFlexionDeg(a, b, c); return Number.isFinite(v) ? v : null; };

export function slrView(body, side, width, height) {
  if (!Array.isArray(body) || !IDS[side] || !(width > 0 && height > 0)) return {hip: null, otherKnee: null, otherBent: null};
  const own = IDS[side], other = IDS[side === 'left' ? 'right' : 'left'], at = id => point(body, id, width, height);
  const otherKnee = angle(at(other.hip), at(other.knee), at(other.ankle));
  return {hip: angle(at(own.shoulder), at(own.hip), at(own.knee)), otherKnee, otherBent: otherKnee === null ? null : otherKnee >= SLR_VIEW.otherKneeBentFrom};
}
