import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const camera=readFileSync(new URL('../intel-exercise-camera.mjs',import.meta.url),'utf8');
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('Intel colour frames are sent directly to the hand-pose gesture model',()=>{
 assert.match(camera,/onFrame=\(\)=>\{\}/);
 assert.match(camera,/onFrame\(canvas,lastFrameAt\)/);
 assert.match(page,/onFrame:\(frame,now\)=>\{/);
 assert.match(page,/handRecognizer\.recognizeForVideo\(frame,Math\.round\(now\)\)/);
 assert.match(page,/handleIntelPalmFrame\(now\)/);
});

test('Intel open-palm state remains independent of accepted body tracking',()=>{
 const start=page.indexOf('onFrame:(frame,now)=>');
 const callback=page.slice(start,page.indexOf('},onError:',start));
 assert.doesNotMatch(callback,/trackingQuality|landmarker|lastAll/);
 assert.match(page,/value==='intel-realsense-depth'\)return now-lastPalmAt<=HAND_SAMPLE_MAX_GAP_MS\?highFiveState\(lastPalmResult\):null/);
 assert.match(page,/function handleIntelPalmFrame\(now\)/);
});
