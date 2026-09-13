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
