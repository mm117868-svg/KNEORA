import test from 'node:test';
import assert from 'node:assert/strict';
import {StillHold} from '../still-hold.mjs';
const settle=h=>{for(let i=0;i<40;i++)h.update(30,i*.05,[.5,.5]);};
test('settles first, tolerates jitter and saves the time when the knee drops',()=>{const h=new StillHold();h.update(30,0,[.5,.5]);assert.equal(h.read(.1),0);settle(h);assert.ok(h.seconds>1);h.update(30,2,[.5,.55]);assert.equal(h.ended.reason,'movement');assert.ok(h.ended.held_s>1);h.update(30,3,[.5,.5]);assert.equal(h.read(3),0);});
test('missing or stale tracking is unconfirmed, never patient movement',()=>{for(const missing of [true,false]){const h=new StillHold();settle(h);if(missing)h.update(NaN,2);else h.read(3);assert.equal(h.ended.reason,'tracking_lost');}});
