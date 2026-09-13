import test from 'node:test';
import assert from 'node:assert/strict';
import {ageYears,loadProfile,saveProfile,PROFILE_KEY} from '../patient-profile.mjs';
const today='2026-09-13';
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
test('age changes on the birthday and handles leap day births',()=>{
 assert.equal(ageYears('1960-09-13',today),66);
 assert.equal(ageYears('1960-09-14',today),65);
 assert.equal(ageYears('2000-02-29','2025-02-28'),24);
 assert.equal(ageYears('2000-02-29','2025-03-01'),25);
 for(const date of ['',null,'2026-09-14','2025-02-29','1960-13-01'])assert.equal(ageYears(date,today),null);
});
test('patient details persist separately by patient ID and can be cleared',()=>{
 const storage=memory();saveProfile('TEST A',{full_name:' Test Person ',birth_date:'1960-09-13'},{today,storage});
 saveProfile('TEST B',{full_name:'Another Person',birth_date:''},{today,storage});
 assert.equal(loadProfile('TEST A',storage).full_name,'Test Person');assert.equal(loadProfile('TEST B',storage).birth_date,'');
 assert.equal(loadProfile('MISSING',storage).full_name,'');
 saveProfile('TEST A',{full_name:'',birth_date:''},{today,storage});assert.equal(loadProfile('TEST A',storage).birth_date,'');
 assert.equal(loadProfile('TEST B',storage).full_name,'Another Person');
});
test('invalid birth date, missing ID, corrupt storage and write failure cannot claim a save',()=>{
 const storage=memory();assert.throws(()=>saveProfile('',{},{today,storage}),/patient ID/);
 assert.throws(()=>saveProfile('TEST',{birth_date:'2030-01-01'},{today,storage}),/date of birth/);
 storage.setItem(PROFILE_KEY,'{broken');assert.throws(()=>saveProfile('TEST',{},{today,storage}));assert.equal(storage.getItem(PROFILE_KEY),'{broken');
 assert.throws(()=>saveProfile('TEST',{},{today,storage:{getItem:()=>null,setItem:()=>{throw Error('Storage full');}}}),/Storage full/);
});
