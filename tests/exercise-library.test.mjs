/* The exercise library lives in index.html, so it is lifted out and checked here, as the other page tests do.
   These checks cover the two exercises carried over from Vivek's original page and the rule that a pending
   card never links to a demonstration that does not exist. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const library = html.slice(html.indexOf('const LIB = {'), html.indexOf('const PHASES = '));
const demo = html.match(/function exerciseDemoLink\(ex\) \{[\s\S]*?\n\}/);
assert.ok(library.length > 0 && demo, 'library or exerciseDemoLink not found in index.html');
const context = vm.createContext({ esc: s => String(s), encodeURIComponent });
vm.runInContext(`${library}\n${demo[0]}\nthis.out = { LIB, ACTIVE_EXERCISES, ICONS, isExerciseAvailable, exerciseDemoLink };`, context);
const { LIB, ACTIVE_EXERCISES, ICONS, isExerciseAvailable, exerciseDemoLink } = context.out;
const all = Object.entries(LIB).flatMap(([phase, list]) => list.map(ex => ({ ...ex, phase: +phase })));
const hasVideo = id => fs.existsSync(new URL(`../exercise-guides/magnific/${id}.mp4`, import.meta.url));

test("Vivek's two exercises are in the library once each, in his phases, and pending", () => {
  for (const [id, phase] of [['forward_step_up', 3], ['functional_bend', 4]]) {
    const found = all.filter(ex => ex.id === id);
    assert.equal(found.length, 1, id);
    assert.equal(found[0].phase, phase);
    assert.equal(ACTIVE_EXERCISES.has(id), false);
    assert.equal(isExerciseAvailable(found[0]), false);
  }
});

test('every exercise has what a card needs', () => {
  for (const ex of all) {
    assert.ok(ICONS[ex.icon], `${ex.id}: icon ${ex.icon}`);
    assert.ok(ex.title && ex.blurb && ex.steps.length >= 2, ex.id);
    assert.ok(['reps', 'hold'].includes(ex.kind) && ex.count > 0, ex.id);
    assert.ok(['bend', 'straight'].includes(ex.aim.kind) && ex.aim.deg >= 0 && ex.aim.deg <= 150, ex.id);
  }
});

test('every exercise with a video has a Watch demonstration link, including active exercises', () => {
  for (const ex of all) {
    const link = exerciseDemoLink(ex);
    if (ex.guide === false) { assert.equal(link, '', ex.id); assert.equal(hasVideo(ex.id), false, `${ex.id} now has a video: remove guide: false`); }
    else { assert.match(link, new RegExp(`magnific/#${ex.id}"`), ex.id); assert.ok(hasVideo(ex.id), `${ex.id}: no demonstration video`); }
  }
});

test('adding exercises did not move the ones already there', () => {
  // The library was built in another realm by vm, so its arrays are copied before comparing.
  const firstThree = phase => [...LIB[phase]].slice(0, 3).map(ex => ex.id);
  assert.deepEqual(firstThree(3), ['heel_slide', 'standing_flexion', 'mini_squat']);
  assert.deepEqual(firstThree(4), ['sit_to_stand', 'squat', 'single_leg_stance']);
});
