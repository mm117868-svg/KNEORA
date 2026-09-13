import test from 'node:test';
import assert from 'node:assert/strict';
import {FOLLOWUP_KEY,followupDate,readFollowups,scopedFollowups,saveFollowup,removeFollowup,followupEvents,calendarFollowups} from '../questionnaire-schedule.mjs';
import {PROM_KEY,saveProm,readProms} from '../patient-measures.mjs';
import {calendarMonth} from '../patient-progress.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const scope=storage=>({patientId:'TEST',operationDate:'2026-09-01',storage,today:'2026-09-13'});
const input={day:12,instrument:'koos_jr',side:'left'};
test('follow-up days are calendar days across DST, leap days and year boundaries',()=>{
 assert.equal(followupDate('2026-03-28',2),'2026-03-30');
 assert.equal(followupDate('2028-02-28',1),'2028-02-29');
 assert.equal(followupDate('2026-12-31',1),'2027-01-01');
 assert.equal(followupDate('2026-09-01',0),'2026-09-01');
 for(const [op,day] of [['',42],['2026-02-30',3],['2026-09-01',-1],['2026-09-01',1.5]])assert.equal(followupDate(op,day),null);
});
test('no schedule is invented; reminders persist and stay scoped to patient, surgery and knee',()=>{
 const storage=memory(),options=scope(storage);
 assert.deepEqual(readFollowups(storage),[]);
 const left=saveFollowup(input,{...options,idFactory:()=> 'left'});
 saveFollowup({...input,side:'right'},{...options,idFactory:()=> 'right'});
 assert.equal(left.date,'2026-09-13');assert.equal(readFollowups(storage).length,2);
 assert.equal(scopedFollowups(readFollowups(storage),'OTHER',options.operationDate).length,0);
 assert.equal(scopedFollowups(readFollowups(storage),options.patientId,'2026-08-01').length,0);
 assert.throws(()=>saveFollowup(input,options),/already/);
 for(const day of ['',null,true,-1,1.5,3651])assert.throws(()=>saveFollowup({...input,day},options));
 assert.throws(()=>saveFollowup({...input,side:''},options));
});
test('planned events appear without marking an exercise day as used',()=>{
 const storage=memory(),options=scope(storage);
 saveFollowup(input,options);
 const events=calendarFollowups(options).events;
 const cells=calendarMonth(2026,8,[],'2026-09-01',new Date(2026,8,13),events);
 const due=cells.find(c=>c.key==='2026-09-13');assert.equal(due.events.length,1);assert.equal(due.records.length,0);
 assert.equal(events[0].status,'Due today');
 assert.equal(followupEvents(readFollowups(storage),[],{...options,today:'2026-09-14'})[0].status,'Past due · no result saved');
});
test('only a matching, explicitly linked completed questionnaire satisfies a reminder',()=>{
 const storage=memory(),options=scope(storage),event=saveFollowup(input,{...options,idFactory:()=> 'reminder'});
 const answer={date:'2026-09-13',side:'left',instrument:'koos_jr',mode:'official',value:80,confirmed:true};
 saveProm(answer,options);assert.equal(calendarFollowups(options).events[0].status,'Due today');
 assert.throws(()=>saveProm({...answer,side:'right',followup_id:event.id},options),/matching/);
 assert.throws(()=>saveProm({...answer,followup_id:'other'},options),/matching/);
 saveProm({...answer,followup_id:event.id},options);
 assert.equal(calendarFollowups(options).events[0].status,'Result saved');
 removeFollowup(event.id,{...options,patientId:'OTHER'});assert.equal(readFollowups(storage).length,1);
 removeFollowup(event.id,options);assert.equal(readFollowups(storage).length,0);assert.equal(readProms(storage).length,2);
});
test('corrupt or full storage cannot overwrite saved data or report success',()=>{
 for(const raw of ['{broken','{}']){
  const storage={getItem:()=>raw,setItem:()=>assert.fail('must not overwrite')};
  assert.throws(()=>saveFollowup(input,scope(storage)));
  assert.ok(calendarFollowups(scope(storage)).error);
 }
 const storage=memory();storage.setItem(FOLLOWUP_KEY,'[]');storage.setItem(PROM_KEY,'{}');assert.ok(calendarFollowups(scope(storage)).error);
 assert.throws(()=>saveFollowup(input,scope({getItem:()=>null,setItem:()=>{throw Error('Full');}})),/Full/);
});
