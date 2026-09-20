import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmFirstExerciseGuide,exerciseGuideKey} from '../exercise-guide-state.mjs';

function memory() {
  const values=new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),values};
}

test('the first opening must pass through the skippable demonstration screen', async () => {
  const storage=memory(),exercise={id:'heel_slide'},shown=[];
  assert.equal(await confirmFirstExerciseGuide(exercise, async ex=>{shown.push(ex.id);return true;}, storage), true);
  assert.deepEqual(shown,['heel_slide']);
  assert.equal(storage.getItem(exerciseGuideKey(exercise)),'1');
});

test('later openings do not force the demonstration again', async () => {
  const storage=memory(),exercise={id:'seated_extension'},shown=[];
  storage.setItem(exerciseGuideKey(exercise),'1');
  assert.equal(await confirmFirstExerciseGuide(exercise, async ex=>{shown.push(ex.id);return true;}, storage), true);
  assert.deepEqual(shown,[]);
});

test('closing the first demonstration returns to the list and does not mark it seen', async () => {
  const storage=memory(),exercise={id:'straight_leg_raise'};
  assert.equal(await confirmFirstExerciseGuide(exercise, async()=>false, storage), false);
  assert.equal(storage.getItem(exerciseGuideKey(exercise)),null);
});

test('a pending exercise with no demonstration asset is not blocked by a missing video', async () => {
  let shown=0;
  assert.equal(await confirmFirstExerciseGuide({id:'forward_step_up',guide:false},async()=>{shown++;return false;},memory()),true);
  assert.equal(shown,0);
});
