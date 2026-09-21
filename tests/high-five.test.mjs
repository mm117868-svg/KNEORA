import test from 'node:test';
import assert from 'node:assert/strict';
import {highFiveState,HIGH_FIVE_SETTINGS} from '../high-five.mjs';

const result = (category='Open_Palm', score=.9, points=Array.from({length:21},()=>({x:.5,y:.5}))) => ({
  gestures: [[{categoryName:category,score}]],
  landmarks: [points]
});

test('a confident, fully visible Open_Palm is accepted', () => {
  assert.equal(highFiveState(result()), 'open');
  assert.equal(HIGH_FIVE_SETTINGS.sampleMs, 125);
});

test('other gestures and low-confidence palms are not accepted', () => {
  assert.equal(highFiveState(result('Closed_Fist')), 'other');
  assert.equal(highFiveState(result('Open_Palm', HIGH_FIVE_SETTINGS.score - .01)), 'other');
});

test('a clearly extended palm from the hand-pose landmarks is accepted when the classifier is uncertain',()=>{
 const points=Array.from({length:21},()=>({x:.5,y:.7}));points[0]={x:.5,y:.85};
 for(const [mcp,pip,tip,x] of [[5,6,8,.38],[9,10,12,.46],[13,14,16,.54],[17,18,20,.62]]){points[mcp]={x,y:.65};points[pip]={x,y:.5};points[tip]={x,y:.2};}
 assert.equal(highFiveState(result('None',.9,points)),'open');
});

test('missing results and missing hands are distinguished', () => {
  assert.equal(highFiveState(null), 'unknown');
  assert.equal(highFiveState({gestures:[],landmarks:[]}), 'absent');
});

test('a palm partly outside the camera picture is rejected', () => {
  const points=Array.from({length:21},()=>({x:.5,y:.5}));points[8]={x:1.01,y:.5};
  assert.equal(highFiveState(result('Open_Palm',.9,points)), 'other');
});
