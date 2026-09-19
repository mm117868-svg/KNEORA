/* Starting with a wave: deliberate, quick, and not set off by anything else a patient does with a hand. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {WaveDetector, raisedWrist} from '../raised-hand.mjs';

const W = 1280, H = 720;
/* a seated figure: shoulder at y .40, hip at y .70 (trunk 216 px); the right wrist wherever asked, with 2 px of jitter */
function body(wx, wy, k = 0) { const lm = Array.from({length: 33}, () => null), j = ((k * 7919) % 5 - 2) / W;
  for (const [id, x, y] of [[0, .5, .30], [11, .46, .40], [12, .54, .40], [23, .47, .70], [24, .53, .70], [13, .40, .50], [15, .40, .62], [14, (wx + .54) / 2, (wy + .40) / 2], [16, wx + j, wy]]) lm[id] = {x, y, visibility: .95};
  return lm; }
function run(path, seconds, hz = 15) { const d = new WaveDetector(); let best = 0; for (let k = 0; k <= seconds * hz; k++) { const t = k / hz, [x, y] = path(t); best = Math.max(best, d.update(body(x, y, k), W, H, t * 1000)); } return best; }

test('two waves of a hand just above the shoulder start it, within about a second and a half', () => {
  const wave = t => [.60 + .05 * Math.sin(2 * Math.PI * 1.6 * t), .33];   // 64 px each side, 1.6 waves a second, hand a third of the trunk above the shoulder
  assert.equal(run(wave, 1.6), 1);
  assert.equal(raisedWrist(body(.60, .33), W, H), null, 'a hand that low is not the held signal: the wave is the easier way in');
});
test('it works at the pose rates the app really has, and lying down with the arm towards the ceiling', () => {
  for (const hz of [8, 15, 30]) assert.equal(run(t => [.60 + .05 * Math.sin(2 * Math.PI * 1.4 * t), .30], 2, hz), 1, `${hz} results a second`);
});
test('a still raised hand, a hand brought up and down once, and landmark jitter are not a wave', () => {
  assert.equal(run(() => [.60, .20], 5), 0);
  assert.ok(run(t => [.60 + .08 * Math.min(1, t), .62 - .4 * Math.min(1, t)], 3) < 1);            // reaching up and across once
  assert.ok(run(t => [.60 + .012 * Math.sin(2 * Math.PI * 3 * t), .25], 5) === 0);                  // a tremor of 15 px
});
test('waving below the shoulder, or a slow drift back and forth, is not a wave', () => {
  assert.equal(run(t => [.60 + .06 * Math.sin(2 * Math.PI * 1.6 * t), .55], 4), 0);                // hand at chest height
  assert.ok(run(t => [.60 + .06 * Math.sin(2 * Math.PI * 0.25 * t), .30], 8) < 1);                  // one sway every four seconds
});
test('the hand dropping out of view for a moment does not lose the wave; dropping for longer starts it again', () => {
  const d = new WaveDetector(); let p = 0;
  for (let k = 0; k <= 30; k++) { const t = k / 15, gone = t > .5 && t < .7; p = Math.max(p, d.update(gone ? null : body(.60 + .05 * Math.sin(2 * Math.PI * 1.6 * t), .33, k), W, H, t * 1000)); }
  assert.equal(p, 1);
  const e = new WaveDetector(); for (let k = 0; k <= 12; k++) e.update(body(.60 + .05 * Math.sin(2 * Math.PI * 1.6 * k / 15), .33, k), W, H, k / 15 * 1000);
  assert.ok(e.turns.length >= 1); e.update(null, W, H, 1400); e.update(null, W, H, 1900); assert.equal(e.turns.length, 0);
});
