import test from 'node:test';import assert from 'node:assert/strict';
import {LivePositionCounter} from '../tools/position-recogniser/live.mjs';
import {recordedCount} from '../patient-progress.js';
const model={exercise:'seated_extension',w1:[Array(1024).fill(0)],b1:[0],w2:[[0],[0],[0]],b2:[10,0,0]};
test('seated model calibrates for three seconds and resets its reference',()=>{const c=new LivePositionCounter(model,'seated_extension');for(let i=0;i<=30;i++)c.update(Array(1024).fill(.4),i/10);assert.equal(c.ready,true);assert.equal(c.summary(3).repetitions,0);c.reset();assert.equal(c.ready,false);});
test('missing or mismatched models and unsupported exercises cannot report zero repetitions',()=>{for(const c of [new LivePositionCounter(null),new LivePositionCounter(model,'heel_slide'),new LivePositionCounter(model,'straight_leg_raise')]){c.update(Array(1024).fill(.4),4);assert.equal(c.summary(4).repetitions,null);}});
test('saved position counts survive reading and unavailable stays unavailable',()=>{assert.equal(recordedCount({count_source:'position_recognition',position_recognition:{repetitions:4,count_status:'experimental'}}),4);assert.equal(recordedCount({count_source:'position_recognition',position_recognition:{repetitions:null,count_status:'unavailable'}}),null);});
