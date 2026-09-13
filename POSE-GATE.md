# Selected-leg confirmation

The patient app retains pixel motion or optical tracking as the source of
repetition candidates. MediaPipe observations approve or reject those candidates.
This is a prototype filter for unrelated movement, not an exercise-form score.

After a brief still starting position, each complete selected-leg movement can
approve at most one optical event. Scratching the head with a stationary selected
leg does not approve an event. Scratching during a genuine leg movement cannot
add a second repetition to that cycle. A pose cycle without an optical event
does not count. The operated side comes from Settings and never silently switches
to the other leg.

The movement checks are specific to the three active exercises:

| Exercise | Evidence used to confirm the optical event |
| --- | --- |
| Straight leg raise | Knee and ankle move coherently relative to the hip, then return. A knee-angle change is not required. |
| Heel slide | Ankle displacement and knee movement relative to the hip, then return. |
| Seated knee extension | Lower-leg displacement with a relatively stable thigh, then return. |

Thresholds are normalised to the visible leg length. The initial settings in
`pose-gate.js` require hip, knee and ankle visibility of at least 0.65, presence
of at least 0.5 when provided, and fresh observations within 450 ms. An incomplete
movement is discarded after a longer pose gap. Existing completed counts are
preserved while the model reacquires the leg. Candidates with insufficient
evidence are recorded as unconfirmed, rather than becoming raw-count fallbacks.

The skeleton uses a separate display threshold of 0.4 and draws each segment
whose endpoints are visible. A visible knee and ankle can therefore be drawn
without a visible hip, face or torso. Confirming an exercise still requires the
selected hip, knee and ankle. The display does not infer missing joints or keep
an old skeleton on screen indefinitely after detection is lost.

## Records and verification

New camera records use `count_source: "pose_gated_optical"`. Their accepted count,
candidate decisions, thresholds and pose coverage are in `pose_validation`.
`monitoring` and `tracking` retain raw optical results. Patient summaries and the
physio report display the accepted count; raw tempo and activity remain labelled
as raw pixel-motion measures. Historical counts retain their original method and
are not mixed with the new method in repetition trends. Spoken patient counts and
timed holds retain their existing methods. The technical bench remains available
for examining the raw algorithms.

Run the deterministic regression checks with:

```sh
node --test tests/pose-gate.test.mjs
```

With Playwright available, run `node tests/browser-pose-gate.cjs` against the
local server at port 8783, or set `TEST_URL` to another serving root. This uses
an isolated browser context, a generated camera stream and injected pose and
optical events. It verifies preview and session overlays, rejection and accepted
counts, saved records, progress, reports and mobile layout. No real camera or
patient record is used by the test. `CHROME_PATH` can select a Chrome executable.

These checks cover unrelated hand movement, the other leg, camera translation,
valid cycles of all three active exercises, duplicate events, missing or stale
observations, incomplete movements, reset, record comparison and partial-skeleton
drawing. They test algorithm behaviour using constructed landmarks. They do not
establish accuracy on home camera recordings, at 3 to 5 metres, in poor lighting,
or with a cropped body. MediaPipe can fail to detect a cropped or obscured limb.
The filter cannot recover a repetition that the optical algorithm never proposes.
Those conditions still require recorded-video and live-camera evaluation.

MediaPipe's landmark coordinates and confidence fields are described in the
[official Pose Landmarker documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker).
The underlying approach is described in
[BlazePose: On-device Real-time Body Pose Tracking (Bazarevsky et al., 2020)](https://arxiv.org/abs/2006.10204).
Neither source validates this exercise-specific filter or its thresholds.
