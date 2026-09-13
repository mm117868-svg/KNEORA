import test from 'node:test';
import assert from 'node:assert/strict';
import {completedExercisesForDay} from '../patient-progress.js';

const options={patientId:'TEST',operationDate:'2026-09-01',day:'2026-09-13'};
const record=(overrides={})=>({patient_id:'TEST',operation_date:'2026-09-01',exercise:'heel_slide',started_at:'2026-09-13T10:00:00+01:00',prescribed_reps:12,count_source:'position_recognition',position_recognition:{repetitions:12,count_status:'experimental'},...overrides});
const storage=(entries={})=>({getItem:key=>entries[key]??null});
const key=(patient='TEST',operation='2026-09-01')=>'kr_daily_checks:'+JSON.stringify([patient,operation]);
const completed=(records,extra={})=>completedExercisesForDay(records,{...options,storage:storage(),...extra});

test('only a completed set earns the tick, with the recording date preserved',()=>{
  assert.deepEqual([...completed([record()])],['heel_slide']);
  for(const change of [{position_recognition:{repetitions:11}},{position_recognition:{repetitions:12,count_status:'unavailable'}},{prescribed_reps:0},{started_at:'2026-09-12T10:00:00+01:00'}]) {
    assert.equal(completed([record(change)]).size,0);
  }
  assert.equal(completed([record({started_at:'2026-09-13T00:05:00+12:00'})]).has('heel_slide'),true);
});
test('ticks are scoped to the patient, operation, exercise and day',()=>{
  const records=[record(),record({patient_id:'OTHER',exercise:'straight_leg_raise'}),record({operation_date:'2026-08-01',exercise:'seated_extension'})];
  assert.deepEqual([...completed(records)],['heel_slide']);
  assert.equal(completed(records,{day:'2026-09-14'}).size,0);
});
test('saved daily checklist ticks are shared, and unticking removes manual completion',()=>{
  const checks=storage({[key()]:JSON.stringify({'2026-09-13':{straight_leg_raise:true,seated_extension:false},'2026-09-12':{heel_slide:true}}),[key('OTHER')]:JSON.stringify({'2026-09-13':{seated_extension:true}})});
  assert.deepEqual([...completed([],{storage:checks})],['straight_leg_raise']);
  assert.equal(completed([],{storage:checks,day:'2026-09-14'}).size,0);
  assert.equal(completed([],{storage:checks,operationDate:'2026-08-01'}).size,0);
});
test('a later incomplete attempt or manual untick cannot undo a completed recorded set',()=>{
  const checks=storage({[key()]:JSON.stringify({'2026-09-13':{heel_slide:false}})});
  assert.deepEqual([...completed([record(),record({position_recognition:{repetitions:2}})],{storage:checks})],['heel_slide']);
});
test('unreadable checklist storage does not hide a completed recorded set',()=>{
  for(const store of [storage({[key()]:'invalid json'}),storage({[key()]:'[]'}),{getItem(){throw Error('Storage blocked');}}]) {
    assert.deepEqual([...completed([record()],{storage:store})],['heel_slide']);
  }
});
