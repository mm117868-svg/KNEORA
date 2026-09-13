# Verification, 13 September 2026

- 11 synthetic unit tests passed with Node's test runner: known geometry, controlled repetition, rest, sustained knee bending, isolated outlier, missing tracking, incomplete lift, inadequate/moving baseline, missing landmarks, multiple cycles and unmet range/hold.
- JavaScript syntax check and git diff whitespace check passed.
- Local browser UI rendered and decoded the existing 10.2-second synthetic-upload.webm fixture from optical-rep-counter/tests. This is a moving graphical object, not a person.
- Bundled MediaPipe model loaded in the Codex browser; analysis processed the entire synthetic recording and refused a score because the resting leg could not be tracked. No false successful score was displayed.
- External model loading stalled in the browser. Assets were bundled locally, and model timeout/cancellation handling was added.

Still open: real human supine video tracking, reference angle comparison, clinician agreement, score validity, repeatability across views/devices, positive-result rendering/export in a real-video run, and clinical feedback review. The tests are engineering checks only. No user's exercise video was supplied or analysed in this session.

## Flexible recording update

Rule version slr-prototype-3 removes the fixed two-second baseline and estimates a lowered-position reference across the selected clip. Targets and confirmation checkbox are no longer mandatory. With blank targets the report provides measurements without a score. With partial targets, the denominator includes only supplied targets plus knee control. 17 unit tests pass, including immediate movement, obscured opening frames, mid-lift starts, reference outlier rejection and optional scoring. Updated controls verified in a separate local browser tab without clearing the user's selected recording. Real-video and clinical accuracy remain unverified.

## Full measurement report update

Rule version slr-prototype-4 reports observed joint statistics even without repetitions or a usable reference. Nineteen unit tests pass, including partial joint observations and reports with no baseline. Source syntax checks pass. Metrics and timing remain estimated; clinical accuracy is not established. The full report adds TXT, CSV and JSON outputs.

## MediaPipe quality gate update

23 unit tests pass, including absent/multiple detections, low landmark presence, partial joint retention and exclusion of rejected measurements from statistics. JavaScript syntax check passed. New filtering has not yet been run against the user's recording; clinical accuracy and the effect on its tracking coverage remain unknown.

## Threshold and SLR output update

27 unit tests pass. Checks cover configurable visibility, recorded settings, withholding automatic SLR estimates for low coverage or absent full repetitions, explicit clinical zero, and separate unvalidated video estimates. Real-video scoring accuracy remains unvalidated.

## Live integration and three-exercise reports, version 9

- 44 Node tests passed across `analysis.test.mjs` and `exercises.test.mjs`. Added known seated-extension/heel-slide trajectories, shoulder occlusion, interrupted cycles, missing timestamps, mid-movement starts, no-motion/no-tracking inputs, fixed anatomical side selection, compact persistence and MediaRecorder final-chunk/error handling. A floating-point comparison in a one-second hold test was corrected to use a numerical tolerance.
- Browser integration used the same `finishRecording` and `mountExerciseAnalysis` modules as the patient app. A generated no-person canvas recording finalised to WebM, decoded successfully despite MediaRecorder duration metadata behaviour, transferred into the embedded analyser and returned a compact report to its parent. All 18 sampled frames were rejected; knee/hip values were null, with zero completed cycles. Day 14 and seated-extension metadata survived the handoff. No frame trace was included in the saved summary.
- The existing 41.4-second `examples/rep-count/seated-extension-rep-count.mp4` was processed through the local bundled MediaPipe model: 414 sampled frames, 220 usable knee and hip measurements (53.1% coverage). It produced a full report and no complete measured cycles because tracking interrupted the movements. The example includes a narrow patient video inside a wider designed layout and is not a clean validation recording. Its visible example counter is not an independently verified clinical ground truth for this pose pipeline.
- The browser showed the exercise-specific measurement tables, postoperative context, absence of QAB panels for seated extension, and parent completion status. A readable-report download was triggered through the UI. Screenshot inspection showed the embedded layout without page-wide overflow. The updated patient home rendered with only the original three exercises active.
- Syntax checks and `git diff --check` passed. No production deployment or GitHub push was performed for this update.

Remaining verification: live webcam use through the complete patient workflow on intended devices, real SLR and heel-slide recordings, positive-cycle agreement with blinded human counts, goniometer/3D reference comparisons, repeatability, clinically meaningful changes, clinical score agreement and review of feedback. Generated fixtures and the existing example establish software behaviour only. No clinical accuracy claim is made.

## Camera permission recovery fix

The retry handler now supplies a fresh camera-attempt identifier. Previously it called `openCamera()` without an identifier, so a granted stream was immediately treated as stale and a repeated denial could leave the spinner active. Permission denials now show Mac/browser guidance and an existing-video alternative; fallback to the default camera occurs only for an unavailable or overconstrained selected device.

Five targeted regression tests passed in `camera-access.test.mjs`, exercising the actual inline camera functions with controlled permission outcomes: deny then grant, repeated denial, a late grant after leaving, missing preferred device, and unavailable media API. The in-app browser reproduced system denial on both initial request and retry; each returned a visible retry button and no spinner. Chrome was opened at the local app and its page was verified. Actual camera permission in Chrome has not been granted or verified by these tests.
# Automatic patient summary, 13 September 2026

- The finished exercise screen starts analysis automatically for straight leg raises, seated knee extensions and heel slides. It shows the short patient summary without the detailed report panel or an analysis button.
- All 138 Node software tests passed, including automatic start, report delivery, missing recordings, retry after failure, rejection of stale messages and cadence from confirmed leg events.
- A browser integration check used a generated two-second canvas recording containing no person. The stopped recording was analysed in the background without a click or modal, returning 18 sampled frames and unavailable knee/hip measurements. No patient record was created.
- The simple summary was inspected at 390 pixels wide. These checks verify software behaviour and layout, not live patient tracking or clinical accuracy.
