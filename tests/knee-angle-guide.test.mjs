import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {KNEE_EXAMPLES,kneeGuideGeometry} from '../knee-angle-guide.mjs';

test('patient examples run from straight to a deep bend',()=>{
  assert.deepEqual(KNEE_EXAMPLES.map(x=>x.deg),[0,30,60,90,120]);
  const straight=kneeGuideGeometry(0),right=kneeGuideGeometry(90);
  assert.ok(Math.abs(straight.ankle[0]-250)<1e-9&&straight.ankle[1]>straight.knee[1]);
  assert.ok(right.ankle[0]<right.knee[0]&&Math.abs(right.ankle[1]-right.knee[1])<1e-9);
});

test('the home page explains that zero is straight and camera readings are estimates',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),guide=fs.readFileSync(new URL('../knee-angle-guide.mjs',import.meta.url),'utf8');
  assert.match(guide,/0° means the knee is straight/);assert.match(html+guide,/camera estimate/i);assert.match(html,/Measurements in everyday language/);
});

test('the interactive guide shows only an enlarged knee and named joint parts',()=>{
  const guide=fs.readFileSync(new URL('../knee-angle-guide.mjs',import.meta.url),'utf8');
  for(const part of ['guide-femur','guide-patella','guide-tibia','guide-fibula','guide-cartilage','guide-acl','guide-pcl'])assert.match(guide,new RegExp(part));
  for(const wholeBodyPart of ['guide-person','guide-arm','guide-foot'])assert.doesNotMatch(guide,new RegExp(wholeBodyPart));
  assert.match(guide,/data-knee-lower/);assert.match(guide,/rotate\(\$\{g\.deg\} 250 220\)/);
});
