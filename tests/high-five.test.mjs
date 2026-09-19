/* The open palm that starts and finishes a session is accepted anywhere in the picture.

   Hand results here are constructed, in the shape the MediaPipe gesture recogniser returns. They check the
   rule this app applies to a recognised hand. They say nothing about how well the model finds a small,
   distant hand in a home camera picture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {highFiveState, handInPicture, drawHands, HIGH_FIVE_SETTINGS} from '../high-five.mjs';

/* An upright open hand about 0.12 wide and 0.22 tall: wrist at the bottom, fingertips at the top. cx, cy is the wrist. */
function hand(cx, cy) {
  const pts = Array.from({length: 21}, () => ({x: cx, y: cy}));
  const finger = (base, dx) => [1, 2, 3].forEach((k, j) => { pts[base + k] = {x: cx + dx, y: cy - .08 - .045 * (j + 1)}; });
  pts[0] = {x: cx, y: cy};
  [[5, -.04], [9, -.013], [13, .013], [17, .04]].forEach(([knuckle, dx]) => { pts[knuckle] = {x: cx + dx, y: cy - .08}; finger(knuckle, dx); });
  [1, 2, 3, 4].forEach((i, j) => { pts[i] = {x: cx - .03 - .012 * j, y: cy - .02 - .02 * j}; });
  return pts;
}
const result = (pts, name = 'Open_Palm', score = .9) => ({landmarks: [pts], gestures: [[{categoryName: name, score}]]});

test('an open palm is accepted in the middle, in every corner and along every edge', () => {
  for (const [x, y] of [[.5, .6], [.06, .3], [.94, .3], [.06, .98], [.94, .98], [.5, .3], [.5, .99], [.02, .6], [.98, .6]])
    assert.equal(highFiveState(result(hand(x, y))), 'open', `wrist at ${x}, ${y}`);
});

test('a hand raised to the top of the picture counts even with its fingertips cut off', () => {
  const pts = hand(.5, .12);                                   // knuckles at y .04, fingertips above the picture
  assert.ok(pts.filter(p => p.y < 0).length >= 8, 'the constructed hand really does leave the picture');
  assert.equal(handInPicture(pts), true);
  assert.equal(highFiveState(result(pts)), 'open');
});

test('a hand whose palm is outside the picture does not count', () => {
  for (const pts of [hand(.5, -.05), hand(-.1, .5), hand(1.1, .5), hand(.5, 1.3)]) {
    assert.equal(handInPicture(pts), false);
    assert.equal(highFiveState(result(pts)), 'other');
  }
});

test('what makes a palm deliberate is unchanged: the gesture, its score, and a complete hand', () => {
  assert.equal(highFiveState(result(hand(.5, .6), 'Closed_Fist')), 'other');
  assert.equal(highFiveState(result(hand(.5, .6), 'Open_Palm', HIGH_FIVE_SETTINGS.score - .01)), 'other');
  assert.equal(highFiveState(result(hand(.5, .6).slice(0, 20))), 'other');
  const broken = hand(.5, .6); broken[9] = {x: NaN, y: .5};
  assert.equal(highFiveState(result(broken)), 'other');
  assert.equal(highFiveState({landmarks: [], gestures: []}), 'absent');
  assert.equal(highFiveState(null), 'unknown');
});

test('either of two hands can be the open palm', () => {
  const two = {landmarks: [hand(.2, .6), hand(.8, .15)], gestures: [[{categoryName: 'Closed_Fist', score: .9}], [{categoryName: 'Open_Palm', score: .9}]]};
  assert.equal(highFiveState(two), 'open');
});

test('a hand at the edge is still outlined, clipped by the canvas', () => {
  let strokes = 0; const ctx = {beginPath() {}, moveTo() {}, lineTo() {}, stroke() { strokes++; }};
  drawHands(ctx, result(hand(.5, .12)), 1280, 720);
  assert.equal(strokes, 21);
});
