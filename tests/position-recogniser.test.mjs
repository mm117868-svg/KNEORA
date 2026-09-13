import test from 'node:test';import assert from 'node:assert/strict';import {PositionCycle} from '../tools/position-recogniser/position.mjs';
const p=i=>[0,1,2].map(j=>i===j?.98:.01);
function feed(c,i,from,to){for(let t=from;t<=to+.0001;t+=.05)c.update(p(i),t);}
test('rest, intermediate, raised and return counts once',()=>{const c=new PositionCycle();feed(c,0,0,.5);feed(c,1,.55,1);feed(c,2,1.05,2);feed(c,1,2.05,2.5);feed(c,0,2.55,3);assert.equal(c.reps,1);});
test('raised hold and recording starting raised do not count',()=>{const c=new PositionCycle();feed(c,2,0,3);feed(c,0,3.05,4);assert.equal(c.reps,0);feed(c,2,4.05,8);assert.equal(c.reps,0);});
test('long loss abandons a cycle but fresh rest resumes without recalibration',()=>{const c=new PositionCycle();feed(c,0,0,.5);feed(c,2,.55,1);for(let t=1.05;t<2;t+=.05)c.update([.34,.33,.33],t);feed(c,0,2,2.5);assert.equal(c.reps,0);feed(c,2,2.55,3.5);feed(c,0,3.55,4);assert.equal(c.reps,1);});
test('brief uncertainty and duplicated timestamps cannot add a cycle',()=>{const c=new PositionCycle();feed(c,0,0,.5);feed(c,2,.55,1);c.update([.34,.33,.33],1.05);feed(c,2,1.1,1.5);feed(c,0,1.55,2);for(let i=0;i<100;i++)c.update(p(2),2);assert.equal(c.reps,1);});
test('an unfinished final raise remains unconfirmed',()=>{const c=new PositionCycle();feed(c,0,0,.5);feed(c,2,.55,2);c.finish(2);assert.equal(c.reps,0);assert.equal(c.events.at(-1).status,'unconfirmed');});
