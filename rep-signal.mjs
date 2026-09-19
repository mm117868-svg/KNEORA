/* The one number the repetition counter watches for each exercise, read from a whole-body pose result.

   Which number depends on the exercise (exercise-profiles.mjs). Knee exercises: the knee bend. Straight leg raise:
   the knee stays straight, so the counter watches how far the whole leg is raised, hip to ankle, which needs no
   shoulder in the picture and has the longest lever and so the least jitter. Returns NaN whenever the pose model is unsure of any joint it needs: the counter treats that as the leg
   being out of sight and never counts on a guess. */
import {kneeFlexionDeg} from './kneerec.js?v=fluid-1';
import {exerciseProfile} from './exercise-profiles.mjs?v=1';
export const REP_SIGNAL = Object.freeze({visibility: .5});
const IDS = {left: [23, 25, 27], right: [24, 26, 28]};
export class RepSignal {
  constructor(exercise, side) { this.profile = exerciseProfile(exercise); this.side = side; }
  read(body, width, height) {
    const ids = IDS[this.side]; if (!Array.isArray(body) || !ids || !(width > 0 && height > 0)) return NaN;
    const pts = ids.map(i => body[i]); if (!pts.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 0) >= REP_SIGNAL.visibility && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) return NaN;
    const [hip, knee, ankle] = pts.map(p => [p.x * width, p.y * height]);
    if (this.profile.signal !== 'lift') return kneeFlexionDeg(hip, knee, ankle);
    // how far the leg is raised above level, whichever way the patient faces: 0 lying flat, rising as the heel lifts
    return Math.atan2(hip[1] - ankle[1], Math.abs(ankle[0] - hip[0])) * 180 / Math.PI;
  }
}
