import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {StillHold} from '../still-hold.mjs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),source=html.slice(html.indexOf('function tickHold(now)'),html.indexOf('async function finish'));
test('variable hold counts beyond a fixed target, records movement end and never treats lost tracking as completion',()=>{
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='holdtarget'?'-1':'',textContent:'',classList:{toggle(){},remove(){}}});return nodes.get(id);};
 const h={phase:'waiting',still:new StillHold(),attempts:[],cycles:0};const c=vm.createContext({$,t0:0,hold:h,current:{hold:5,rest:3,count:10},navigator:{}});vm.runInContext(source,c);
 for(let i=0;i<=600;i++){h.still.update(30,i*.05,[.5,.5]);c.tickHold(i*50);}assert.equal(h.cycles,0);assert.ok(parseFloat($('holdCount').textContent)>29);
 h.still.update(40,30.05,[.5,.5]);c.tickHold(30050);assert.equal(h.attempts[0].status,'recorded');assert.equal(h.attempts[0].target_s,null);assert.equal(h.cycles,1);
 c.tickHold(34000);for(let i=0;i<40;i++){h.still.update(30,34+i*.05);c.tickHold(34000+i*50);}h.still.update(NaN,36);c.tickHold(36000);assert.equal(h.attempts[1].status,'unconfirmed');assert.equal(h.cycles,1);
});
