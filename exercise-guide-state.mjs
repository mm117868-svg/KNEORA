export const exerciseGuideKey = exercise => `kr_guide_seen_${exercise.id}`;

export async function confirmFirstExerciseGuide(exercise, showGuide, storage = globalThis.localStorage) {
  if (exercise.guide === false) return true;
  const key = exerciseGuideKey(exercise);
  let seen = false;
  try { seen = storage?.getItem(key) === '1'; } catch { }
  if (seen) return true;
  if (!await showGuide(exercise)) return false;
  try { storage?.setItem(key, '1'); } catch { }
  return true;
}
