/* The repetition counter, against movements whose true number is known. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {AngleRepCounter} from '../angle-rep-counter.mjs';

function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const stroke = x => 10 * x ** 3 - 15 * x ** 4 + 6 * x ** 5;
/* rest 2 s, then `reps` movements of `size` degrees (out 1.2 s, held 0.6 s, back 1.2 s, rest 1 s), read `hz` times a second with `noise` degrees of scatter */
function run({reps, size, rest = 85, hz = 15, noise = 0.8, seed = 5, lose = null}) {
  const random = seeded(seed), normal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random()), counter = new AngleRepCounter();
  for (let t = 0; t < 2 + reps * 4 + 1; t += 1 / hz) { const u = (t - 2) % 4, f = t < 2 || t >= 2 + reps * 4 ? 0 : u < 1.2 ? stroke(u / 1.2) : u < 1.8 ? 1 : u < 3 ? 1 - stroke((u - 1.8) / 1.2) : 0;
    counter.update(lose && t > lose[0] && t < lose[1] ? NaN : rest + size * f + noise * normal(), t); }
  return counter;
}
test('ten knee extensions and ten heel slides are counted as ten, whichever way the angle goes', () => {
  assert.equal(run({reps: 10, size: -70}).reps, 10); assert.equal(run({reps: 10, size: 45, rest: 20}).reps, 10);
});
test('small movements count: eight movements of 8 degrees, read 15 or 30 times a second', () => {
  for (const hz of [15, 30]) for (const seed of [1, 2, 3, 4]) assert.equal(run({reps: 8, size: 8, hz, seed}).reps, 8, `${hz} Hz, seed ${seed}`);
});
test('a still leg counts nothing, however long, and a 2 degree wobble is not a movement', () => {
  for (const seed of [1, 2, 3]) { assert.equal(run({reps: 0, size: 0, seed}).reps, 0); assert.equal(run({reps: 10, size: 2, seed}).reps, 0); }
});
test('a big movement with a wobble at the top is one repetition, not two', () => {
  const counter = new AngleRepCounter(); let t = 0; const feed = (angle, seconds) => { for (let k = 0; k < seconds * 15; k++) counter.update(angle(k / 15 / seconds), t += 1 / 15); };
  feed(() => 85, 2); for (let i = 0; i < 3; i++) { feed(x => 85 - 70 * stroke(x), 1.2); feed(x => 15 + 12 * Math.sin(x * 6 * Math.PI), 1.5); feed(x => 15 + 70 * stroke(x), 1.2); feed(() => 85, 1); }
  assert.equal(counter.reps, 3);
});
test('the leg out of sight for a second does not spoil a movement; out of sight for three, that movement is not counted', () => {
  assert.equal(run({reps: 5, size: -60, lose: [6.5, 7.5]}).reps, 5);
  const long = run({reps: 5, size: -60, lose: [7.0, 9.9]});   // lost from the middle of the second movement until it is over
  assert.equal(long.reps, 4); assert.ok(long.events.some(e => e.status === 'unconfirmed' && e.reason === 'leg_not_seen'));
});
test('the record says what was counted and how big the movements were', () => {
  const s = run({reps: 6, size: -30}).summary(30);
  assert.equal(s.repetitions, 6); assert.equal(s.version, 'angle-hysteresis-1'); assert.ok(Math.abs(s.median_excursion_deg - 30) < 3); assert.ok(Math.abs(s.resting_angle_deg - 85) < 2);
  assert.equal(new AngleRepCounter().summary(1).repetitions, null);
});

test('fail-safes: a noisy view needs a bigger movement, and settling somewhere new is a change of position, not a repetition', () => {
  assert.equal(run({reps: 8, size: 8, noise: 3, seed: 2}).reps <= 2, true, 'with 3 degrees of jitter an 8 degree movement is not trusted');
  assert.equal(run({reps: 8, size: 40, noise: 3, seed: 2}).reps, 8, 'a clear movement still counts through the same jitter');
  const counter = new AngleRepCounter(); let t = 0; const feed = (angle, seconds) => { for (let k = 0; k < seconds * 15; k++) counter.update(angle, t += 1 / 15); };
  feed(85, 2); feed(40, 21); feed(40, 3);
  assert.equal(counter.reps, 0); assert.ok(counter.events.some(e => e.reason === 'position_changed'));
  for (let i = 0; i < 3; i++) { feed(10, 2); feed(40, 2); }
  assert.equal(counter.reps, 3, 'and counting carries on from the new position');
});

test('each exercise counts only its own direction: a knee extension lowers the bend, and tucking the foot under is not a repetition', () => {
  const feedInto = counter => { let t = 0; return (angle, seconds) => { for (let k = 0; k < seconds * 15; k++) counter.update(angle(k / 15 / seconds), t += 1 / 15); }; };
  const down = new AngleRepCounter(undefined, 'down'), feed = feedInto(down);
  feed(() => 85, 2); for (let i = 0; i < 3; i++) { feed(x => 85 + 25 * stroke(x), 1); feed(x => 110 - 25 * stroke(x), 1); feed(() => 85, 1); }   // bending further: the wrong way
  assert.equal(down.reps, 0);
  for (let i = 0; i < 4; i++) { feed(x => 85 - 60 * stroke(x), 1.2); feed(x => 25 + 60 * stroke(x), 1.2); feed(() => 85, 1); }
  assert.equal(down.reps, 4);
});

test('the resting value is only learned in the starting position, so starting mid-movement cannot turn the count inside out', () => {
  const counter = new AngleRepCounter(undefined, 'down', [45, 130]); let t = 0; const feed = (angle, seconds) => { for (let k = 0; k < seconds * 15; k++) counter.update(angle(k / 15 / seconds), t += 1 / 15); };
  feed(() => 10, 3);                                   // recording starts with the knee already held straight
  assert.equal(counter.ready, false); assert.match(counter.message(), /Go to the starting position/);
  feed(x => 10 + 75 * stroke(x), 1.2); feed(() => 85, 1.5); assert.equal(counter.ready, true);
  for (let i = 0; i < 3; i++) { feed(x => 85 - 75 * stroke(x), 1.2); feed(() => 10, 1); feed(x => 10 + 75 * stroke(x), 1.2); feed(() => 85, 1); }
  assert.equal(counter.reps, 3);
});

test('the hold timer is not picky: it runs for as long as the leg is away from rest, wherever it is', () => {
  const counter = new AngleRepCounter(undefined, 'up'); let t = 0; const feed = (angle, seconds) => { for (let k = 0; k < seconds * 15; k++) counter.update(angle(k / 15 / seconds), t += 1 / 15); };
  feed(() => 0, 2); feed(x => 40 * stroke(x), 1); feed(x => 40 - 15 * x, 2); feed(x => 25 + 10 * Math.sin(x * 9), 2);   // up, sagging, wobbling: still off the bed
  assert.ok(counter.holdS(t) > 4.3, `held ${counter.holdS(t).toFixed(1)} s`);
  feed(x => 30 * (1 - stroke(x)), 1); feed(() => 0, 1); assert.equal(counter.holdS(t), 0); assert.equal(counter.reps, 1); assert.ok(counter.events.at(-1).hold_s > 5);
});
