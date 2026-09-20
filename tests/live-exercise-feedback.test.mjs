import test from 'node:test';
import assert from 'node:assert/strict';
import {liveExerciseFeedback} from '../live-exercise-feedback.mjs';

test('straight leg raise gives the toe cue before the knee and lift cues',()=>{
  assert.match(liveExerciseFeedback('straight_leg_raise',{toeUp:40,knee:30,hip:3}).text,/toes are pointing towards the ceiling/i);
  assert.match(liveExerciseFeedback('straight_leg_raise',{toeUp:5,knee:30,hip:3}).text,/knee straight/i);
  assert.match(liveExerciseFeedback('straight_leg_raise',{toeUp:5,knee:5,hip:3}).text,/Lift the whole leg/i);
  assert.equal(liveExerciseFeedback('straight_leg_raise',{toeUp:5,knee:5,hip:25}).ok,true);
});

test('heel slide and seated extension use their own knee-angle cues',()=>{
  assert.equal(liveExerciseFeedback('heel_slide',{knee:88,target:90}).ok,true);
  assert.match(liveExerciseFeedback('heel_slide',{knee:45,target:90}).text,/heel towards you/i);
  assert.equal(liveExerciseFeedback('seated_extension',{knee:8}).ok,true);
  assert.match(liveExerciseFeedback('seated_extension',{knee:30}).text,/straightening/i);
});

test('lost tracking produces a plain positioning cue and unknown readings are not scored',()=>{
  assert.equal(liveExerciseFeedback('heel_slide',{tracking:false}).ok,false);
  assert.equal(liveExerciseFeedback('straight_leg_raise',{tracking:true}),null);
});
