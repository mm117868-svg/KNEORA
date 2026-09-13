import test from 'node:test';
import assert from 'node:assert/strict';
import {SkeletonAverage} from '../live-overlay.mjs';
const point=(x,y=.5)=>({x,y,visibility:1,presence:1});
const pose=(x=.5)=>{const p=Array(33);p[23]=point(.3);p[25]=point(x);p[27]=point(.7);return p;};
test('six-frame display average removes alternating jitter without changing the input',()=>{
 const filter=new SkeletonAverage(),samples=[];
 for(let i=0;i<30;i++){const raw=pose(.5+(i%2?.015:-.015));Object.freeze(raw[25]);Object.freeze(raw);const out=filter.update(raw,i*40);assert.equal(raw[25].x,.5+(i%2?.015:-.015));if(i>=6)samples.push(out[25].x);}
 assert.ok(Math.max(...samples)-Math.min(...samples)<.001);
});
test('moving display catches up fully within six fresh frames',()=>{
 const filter=new SkeletonAverage();for(let i=0;i<6;i++)filter.update(pose(),i*40);
 const first=filter.update(pose(.56),240);assert.ok(first[25].x>.5&&first[25].x<.56);
 let last;for(let i=1;i<6;i++)last=filter.update(pose(.56),240+i*40);assert.ok(Math.abs(last[25].x-.56)<1e-9);
});
test('missing or uncertain joints disappear independently and cannot retain old locations',()=>{
 const filter=new SkeletonAverage();filter.update(pose(),0);const raw=pose();raw[23]=undefined;raw[25].visibility=.1;
 const out=filter.update(raw,40);assert.equal(out[23],undefined);assert.equal(out[25],undefined);assert.equal(out[27].x,.7);
 assert.equal(filter.update(pose(.55),80)[25].x,.55);
 assert.equal(filter.update(null,120),null);assert.equal(filter.update(pose(.58),160)[25].x,.58);
});
test('a long gap, backwards clock or large jump starts a fresh display average',()=>{
 for(const time of [600,-10]){const f=new SkeletonAverage();f.update(pose(),0);assert.equal(f.update(pose(.56),time)[25].x,.56);}
 const f=new SkeletonAverage();f.update(pose(.3),0);assert.equal(f.update(pose(.7),40)[25].x,.7);f.reset();assert.equal(f.update(pose(.5),80)[25].x,.5);
});
