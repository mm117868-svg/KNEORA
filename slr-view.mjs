/* Straight leg raise: two more things read from the pose result the page already has. Display only.

   Hip raise: the angle at the hip of the operated leg between the trunk (shoulder to hip) and the thigh (hip to
   knee). 0 degrees is the leg in line with the trunk; lifting the leg raises it. Like the knee angle it is a 2D
   angle from a side-on camera and is not a validated clinical measurement.

   Other knee: a straight leg raise is set up with the other knee bent and that foot flat, which steadies the
   pelvis and lower back. While the patient gets into position the page says whether the other knee looks bent.
   It is a setup check shown before recording starts. It never scores or interrupts a repetition. */
import {kneeFlexionDeg} from './kneerec.js?v=fluid-1';
export const SLR_VIEW = Object.freeze({visibility: .5, otherKneeBentFrom: 40});
const IDS = {left: {shoulder: 11, hip: 23, knee: 25, ankle: 27, heel:29, toe:31}, right: {shoulder: 12, hip: 24, knee: 26, ankle: 28, heel:30, toe:32}};
const point = (body, id, w, h) => { const p = body?.[id]; return p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 0) >= SLR_VIEW.visibility ? [p.x * w, p.y * h] : null; };
const angle = (a, b, c) => { if (!a || !b || !c) return null; const v = kneeFlexionDeg(a, b, c); return Number.isFinite(v) ? v : null; };

export function slrView(body, side, width, height) {
  if (!Array.isArray(body) || !IDS[side] || !(width > 0 && height > 0)) return {hip: null, toeUp: null, otherKnee: null, otherBent: null};
  const own = IDS[side], other = IDS[side === 'left' ? 'right' : 'left'], at = id => point(body, id, width, height);
  const otherKnee = angle(at(other.hip), at(other.knee), at(other.ankle)),heel=at(own.heel),toe=at(own.toe);
  const dx=heel&&toe?toe[0]-heel[0]:NaN,dy=heel&&toe?toe[1]-heel[1]:NaN,length=Math.hypot(dx,dy);
  const toeUp=length>1?Math.acos(Math.max(-1,Math.min(1,-dy/length)))*180/Math.PI:null;
  return {hip: angle(at(own.shoulder), at(own.hip), at(own.knee)), toeUp, otherKnee, otherBent: otherKnee === null ? null : otherKnee >= SLR_VIEW.otherKneeBentFrom};
}

/* The only extra skeleton segment needed for a straight leg raise: shoulder to hip supplies the trunk reference
   for the live hip-raise angle. Hip and knee come from the filtered operated-leg points already drawn. */
export function slrKeyLandmarks(body, side, width, height, leg) {
  if (!leg || !IDS[side]) return null;
  const shoulder=point(body,IDS[side].shoulder,width,height);
  return shoulder ? [shoulder,leg.hip,leg.knee] : null;
}

export function slrToeLandmarks(body,side,width,height){
  if(!Array.isArray(body)||!IDS[side])return null;const heel=point(body,IDS[side].heel,width,height),toe=point(body,IDS[side].toe,width,height);
  return heel&&toe?[heel,toe]:null;
}
