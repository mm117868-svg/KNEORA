import test from 'node:test';
import assert from 'node:assert/strict';
import {EndpointCountdown} from '../endpoint-countdown.mjs';
function setup(t){let now=0;const starts=[],ticks=[],spoken=[];t.mock.timers.enable({apis:['setTimeout']});const clock=new EndpointCountdown({voice:{play:key=>spoken.push(key),stop:()=>{}},now:()=>now,onStart:trigger=>starts.push(trigger),onTick:n=>ticks.push(n)});return {clock,starts,ticks,spoken,step(ms){for(let i=0;i<ms;i+=100){now+=100;t.mock.timers.tick(100);}}};}
test('Marin countdown finishes before a hand-triggered measurement begins',t=>{
 const h=setup(t);assert.equal(h.clock.start('open_palm'),true);assert.equal(h.clock.start(),false);h.step(4900);assert.deepEqual(h.starts,[]);assert.deepEqual(h.spoken,['countdown']);h.step(100);assert.deepEqual(h.starts,['open_palm']);assert.deepEqual([...new Set(h.ticks)],[5,4,3,2,1]);
});
test('cancelling or leaving during countdown cannot start an abandoned capture',t=>{
 const h=setup(t);h.clock.start();h.step(3000);h.clock.cancel();h.step(3000);assert.deepEqual(h.starts,[]);h.clock.start('button');h.step(5000);assert.deepEqual(h.starts,['button']);
});
