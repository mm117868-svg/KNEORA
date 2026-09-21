/* The knee-bend reading on the patient screen. Display only: the trace, the statistics and the counter
   keep the per-frame angle. The class lives in index.html, so it is lifted out and exercised here. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const block=src.match(/const ANGLE_WINDOW_MS[\s\S]*?\nclass AngleDisplay \{[\s\S]*?\n\}\n/);
assert.ok(block,'AngleDisplay not found in index.html');
const AngleDisplay=eval(block[0]+'; AngleDisplay');
const FPS=30,step=1000/FPS;
let seed=7;const jitter=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648-.5;};
function run(fn,frames,d=new AngleDisplay()){const out=[];for(let i=0;i<frames;i++)out.push(d.update(fn(i/FPS),i*step));return{d,out};}

test('a knee held still reads within a degree and is not repainted every frame',()=>{
 const {out}=run(()=>90+6*jitter(),150);                                  // five seconds, six degrees of jitter
 const steady=out.slice(15);
 assert.ok(Math.max(...steady.map(v=>Math.abs(v-90)))<1.5);
 let changes=0;for(let i=1;i<steady.length;i++)if(steady[i]!==steady[i-1])changes++;
 assert.ok(changes<=15,`repainted ${changes} times in five seconds`);
});

test('one wrong landmark in a window does not move the reading',()=>{
 const d=new AngleDisplay();for(let i=0;i<10;i++)d.update(i===4?175:40,i*step);
 assert.equal(Math.round(d.update(40,400)),40);
});

test('the reading follows a real movement without falling far behind',()=>{
 const truth=t=>60+40*Math.sin(2*Math.PI*t/4);                            // four seconds a repetition
 const {out}=run(truth,120);
 let worst=0;for(let i=15;i<out.length;i++)worst=Math.max(worst,Math.abs(out[i]-truth(i/FPS)));
 assert.ok(worst<12,`fell ${worst.toFixed(1)} degrees behind`);
});

test('the most recent knee angle remains visible when tracking briefly leaves the picture',()=>{
 const d=new AngleDisplay();for(let i=0;i<10;i++)d.update(60,i*step);
 let v=NaN;for(let i=0;i<20;i++)v=d.update(NaN,340+i*step);
 assert.equal(Math.round(v),60);
});

test('reset clears the window and the reading',()=>{
 const d=new AngleDisplay();for(let i=0;i<10;i++)d.update(60,i*step);d.reset();
 assert.ok(Number.isNaN(d.shown));assert.equal(d.win.length,0);
});
