import test from 'node:test';
import assert from 'node:assert/strict';
import {EndpointPreviewAverage} from '../endpoint-smoothing.mjs';
import {summariseEndpoint} from '../recovery-measurements.mjs';

const points=n=>[{x:n,y:.2},{x:.4,y:.4},{x:.6,y:.6}];
test('preview averaging reduces alternating jitter without changing saved extrema',()=>{
 const filter=new EndpointPreviewAverage(),raw=[],preview=[];
 for(let i=0;i<50;i++){const angle=90+(i%2?2:-2);raw.push({angle});preview.push(filter.update(angle,points(i%2?.22:.18),i*100));}
 const spread=a=>Math.max(...a)-Math.min(...a);
 assert.ok(spread(preview.slice(5).map(p=>p.angle))<spread(raw.map(f=>f.angle))/4);
 assert.ok(Math.abs(preview.at(-1).points[0].x-.2)<.005);
 assert.equal(preview.at(-1).samples,5);
 const saved=summariseEndpoint(raw);assert.equal(saved.mean,90);assert.equal(saved.minimum,88);assert.equal(saved.maximum,92);
});
test('missing frames, stale frames and explicit reset cannot carry old positions forward',()=>{
 const filter=new EndpointPreviewAverage();filter.update(90,points(.2),0);filter.update(92,points(.3),100);
 assert.equal(filter.update(null,null,200),null);assert.equal(filter.update(0,points(.5),300).angle,0);
 assert.equal(filter.update(90,points(.2),900).samples,1);
 assert.equal(filter.update(20,points(.4),800).angle,20);
 filter.reset();assert.equal(filter.update(0,points(.5),1000).samples,1);
 assert.equal(filter.update(0,[],1100),null);
});
