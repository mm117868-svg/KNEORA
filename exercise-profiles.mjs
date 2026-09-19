/* Each exercise is its own movement, so each has its own profile: what the counter watches, which way a repetition
   goes, where it starts, where the hold belongs, and what is worth logging. One place, so the counter, the hold
   timer, the cards and the daily log all agree.

   signal     what the counter watches: 'knee' is the knee bend; 'lift' is how far the leg is raised above level
              (hip to ankle), used where the knee is meant to stay straight.
   direction  which way a repetition leaves the resting value: 'up' (the number rises), 'down' (it falls). A movement
              the other way is not a repetition of this exercise and is never counted.
   restBand   where the watched number sits in the starting position. The counter only learns its resting value inside
              this band, so it cannot mistake the far end of a movement (a knee held straight) for the start. */
export const EXERCISE_PROFILES = Object.freeze({
  heel_slide:         {signal: 'knee', direction: 'up',   restBand: [0, 55],   start: 'Start with the leg out straight.',            holdAt: 'at your deepest bend',      tracks: 'Counts each slide · logs your furthest bend'},
  seated_extension:   {signal: 'knee', direction: 'down', restBand: [45, 130], start: 'Start sitting with the knee bent.',            holdAt: 'with the knee at its straightest', tracks: 'Counts each straighten · logs your straightest knee'},
  straight_leg_raise: {signal: 'lift', direction: 'up',   restBand: [-25, 25], start: 'Start with the leg resting out straight.',     holdAt: 'at the top of the lift',    tracks: 'Counts each lift · logs how straight the knee stayed and how high you lifted'},
  standing_flexion:   {signal: 'knee', direction: 'up',   restBand: [0, 35],   start: 'Start standing tall.',                         holdAt: 'at your deepest bend',      tracks: 'Counts each bend · logs your furthest bend'},
  mini_squat:         {signal: 'knee', direction: 'up',   restBand: [0, 30],   start: 'Start standing tall.',                         holdAt: 'at the bottom',             tracks: 'Counts each squat · logs your deepest bend'},
  squat:              {signal: 'knee', direction: 'up',   restBand: [0, 30],   start: 'Start standing tall.',                         holdAt: 'at the bottom',             tracks: 'Counts each squat · logs your deepest bend'},
  sit_to_stand:       {signal: 'knee', direction: 'down', restBand: [60, 130], start: 'Start sitting.',                               holdAt: 'standing tall',             tracks: 'Counts each stand · logs how straight you stood'},
});
const FALLBACK = Object.freeze({signal: 'knee', direction: 'either', restBand: null, start: '', holdAt: 'at the far end', tracks: 'Counts each movement out and back'});
export const exerciseProfile = id => EXERCISE_PROFILES[id] || FALLBACK;
