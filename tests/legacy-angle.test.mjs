/* Why Vivek's original page is archived and not run, kept as arithmetic.

   MediaPipe gives landmarks as fractions of the picture: x across the width, y down the height. An angle
   worked out on those fractions is only right on a square picture. The original page did exactly that; the
   app scales to pixels first. Both facts are pinned here so the app cannot slide back to the old sum. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pickSide, kneeFlexionDeg} from '../kneerec.js';

const legacy = fs.readFileSync(new URL('../legacy/vivek-tkr-rehab/tkr-rehab.html.txt', import.meta.url), 'utf8');
const found = legacy.match(/function angle\(a,b,c\)\{[\s\S]*?\n\}/);
assert.ok(found, 'angle() not found in the archived page');
const legacyAngle = eval(`(${found[0]})`);

/* A right-angled knee, the thigh and the shin each at 45 degrees to the picture's edges: the tent a heel
   slide makes. Points are in pixels; landmarks() turns them into what MediaPipe would report. */
const tent = (w, h) => { const cx = w / 2, d = Math.min(w, h) / 4; return { hip: [cx - d, 2 * d], knee: [cx, d], ankle: [cx + d, 2 * d] }; };
function landmarks(points, w, h) {
  const all = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
  for (const [name, index] of [['hip', 23], ['knee', 25], ['ankle', 27]]) all[index] = { x: points[name][0] / w, y: points[name][1] / h, visibility: .99 };
  return all;
}

for (const [label, w, h, wrong] of [['landscape', 1280, 720, 121.3], ['portrait', 720, 1280, 58.7]]) {
  test(`a true 90 degree bend reads 90 in the app on a ${label} picture`, () => {
    const leg = pickSide(landmarks(tent(w, h), w, h), w, h, 'left', .2);
    assert.ok(Math.abs(kneeFlexionDeg(leg.hip, leg.knee, leg.ankle) - 90) < 1e-6);
  });
  test(`the archived page reads the same knee as about ${wrong} degrees on a ${label} picture`, () => {
    const lm = landmarks(tent(w, h), w, h);
    const bend = 180 - legacyAngle(lm[23], lm[25], lm[27]);
    assert.ok(Math.abs(bend - wrong) < .1, `archived page read ${bend.toFixed(1)}`);
  });
}

test('on a square picture the two agree, which is why the fault is easy to miss', () => {
  const lm = landmarks(tent(720, 720), 720, 720);
  assert.ok(Math.abs(180 - legacyAngle(lm[23], lm[25], lm[27]) - 90) < 1e-6);
});

test('the archived page is kept as text, so GitHub Pages cannot serve it as a page', () => {
  const files = fs.readdirSync(new URL('../legacy/vivek-tkr-rehab/', import.meta.url));
  assert.deepEqual(files.filter(f => /\.html?$/i.test(f)), []);
});
