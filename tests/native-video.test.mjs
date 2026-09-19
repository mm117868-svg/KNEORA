/* The recovery check shows the camera's own video and keeps the measured picture clean.

   The heavy pose model can take a tenth of a second or more per picture. When the page painted each camera frame
   itself, the picture only moved as fast as that model ran. Now the browser plays the video, the visible canvas
   carries the outline alone, and each picture to be measured is copied to a canvas that is never shown. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createEndpointCamera} from '../recovery-camera.mjs';

function surface(name, log) {
  const ctx = {drawImage() { log.push(`${name}:drawImage`); }, clearRect() { log.push(`${name}:clearRect`); }, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() { log.push(`${name}:stroke`); }, arc() {}, fill() { log.push(`${name}:fill`); }};
  return {name, width: 0, height: 0, getContext: () => ctx};
}

test('pictures are measured on a hidden canvas; the visible one is cleared and carries only the outline', async t => {
  let callback; const log = [], detected = [];
  const raf = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = fn => { callback = fn; return 1; }; globalThis.cancelAnimationFrame = () => {};
  t.after(() => { globalThis.requestAnimationFrame = raf; globalThis.cancelAnimationFrame = cancel; });
  const visible = surface('visible', log), work = surface('work', log);
  const landmarks = Array.from({length: 33}, () => null);
  for (const [id, x, y] of [[23, .2, .5], [25, .5, .5], [27, .5, .8]]) landmarks[id] = {x, y, visibility: .99, presence: .99};
  const video = {srcObject: null, readyState: 2, currentTime: 0, videoWidth: 1280, videoHeight: 720, play: async () => {}};
  const camera = createEndpointCamera({video, canvas: visible, workCanvas: work, getStream: async () => ({getTracks: () => [{stop() {}}]}),
    modelLoader: async () => ({model: 'TEST pose', landmarker: {setOptions: async () => {}, detect: source => { detected.push(source.name); return {landmarks: [landmarks]}; }, close() {}}}),
    handLoader: async () => { throw Error('no hand model in this test'); }});
  await camera.start('left');
  for (let i = 1; i <= 5; i++) { video.currentTime = i / 10; callback(i * 100); }

  assert.deepEqual([...new Set(detected)], ['work'], 'the model only ever sees the hidden canvas');
  assert.equal(log.filter(entry => entry === 'visible:drawImage').length, 0, 'camera frames are never painted onto the visible canvas');
  assert.equal(log.filter(entry => entry === 'work:drawImage').length, 5);
  assert.equal(log.filter(entry => entry === 'visible:clearRect').length, 5);
  assert.ok(log.includes('visible:stroke') && log.includes('visible:fill'), 'the leg outline is drawn on the visible canvas');
  assert.equal(log.filter(entry => entry.startsWith('work:') && entry !== 'work:drawImage').length, 0, 'nothing is ever drawn on the picture that is measured');
  assert.deepEqual([visible.width, visible.height, work.width, work.height], [1280, 720, 1280, 720]);
  camera.stop();
});

test('the recovery check shows the video element with the canvas laid over it', () => {
  const page = fs.readFileSync(new URL('../recovery-summary.mjs', import.meta.url), 'utf8');
  assert.match(page, /<div class="rs-picture"><video data-endpoint-video muted playsinline aria-label="[^"]+"><\/video><canvas data-endpoint-canvas aria-hidden="true"><\/canvas><\/div>/);
  assert.doesNotMatch(page, /data-endpoint-video[^>]*\shidden/);
  const css = fs.readFileSync(new URL('../recovery-summary.css', import.meta.url), 'utf8');
  assert.match(css, /\.rs-picture canvas\{position:absolute;inset:0;[^}]*object-fit:contain/);
  assert.match(css, /\.rs-picture video\{[^}]*object-fit:contain/);
});

test('changed modules carry new version tags, so a cached copy is not mixed with a new page', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const tag = (text, file) => text.match(new RegExp(file.replace('.', '\\.') + '\\?v=([\\w-]+)'))?.[1];
  assert.equal(tag(index, 'recovery-summary.mjs'), 'log-1');
  assert.equal(tag(index, 'recovery-summary.css'), 'log-1');
  /* A module asked for under two different tags is loaded twice. Every page and module that uses one of these must
     ask for the same copy. */
  const sources = ['index.html', 'recovery-summary.mjs', 'recovery-camera.mjs', 'recovery-trends.mjs', 'recovery-measurements.mjs'].map(name => [name, fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')]);
  for (const [file, expected] of [['fluid-outline.mjs', 'fluid-1'], ['confidence.mjs', '1'], ['recovery-measurements.mjs', 'interval-1'], ['recovery-trends.mjs', 'sessions-1'], ['recovery-camera.mjs', 'fluid-1']]) {
    const found = sources.flatMap(([name, text]) => [...text.matchAll(new RegExp(`["']\\./${file.replace('.', '\\.')}(\\?v=([\\w-]+))?["']`, 'g'))].map(m => `${name}: ${m[2] || 'no tag'}`));
    assert.ok(found.length > 0, `${file} is used`);
    for (const use of found) assert.ok(use.endsWith(`: ${expected}`), `${file} should be loaded as ?v=${expected} everywhere (${use})`);
  }
});
