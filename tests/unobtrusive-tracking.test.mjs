import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('strict tracking messages stay off the patient exercise screen',()=>{
 assert.match(source,/id="track" hidden aria-hidden="true"/);
 assert.match(source,/id="rehabCoaching" hidden aria-hidden="true"/);
 assert.match(source,/const coachEnabled=false/);
 assert.doesNotMatch(source,/Preparing Marin exercise guidance/);
});

test('recording remains separate from silent measurement gating',()=>{
 assert.match(source,/const quality=trackingQuality\.update/);
 assert.match(source,/lastAll = quality\.usable \?/);
 assert.match(source,/running = true/);
 const overlay=source.slice(source.indexOf('function paintOverlay'),source.indexOf('const ANGLE_WINDOW_MS'));
 assert.doesNotMatch(overlay,/finish\(/);
});
