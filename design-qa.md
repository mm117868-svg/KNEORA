# Design QA

## Source reference

- User screenshot: `/var/folders/np/lnr7x4kn1gzds1mxgfznnmfm0000gn/T/TemporaryItems/NSIRD_screencaptureui_UxXXO4/Screenshot 2026-09-21 at 00.19.49.png`
- Requested change: replace the Exercise metrics tab with exercise-specific physiotherapy feedback covering what went well and what can be improved.

## Implementation review

- The active navigation item is now labelled `Physiotherapy feedback`.
- The page leads with the latest feedback for each exercise rather than population recovery ranges.
- Feedback is divided into `What went well` and `What to improve` for rapid scanning.
- Missing measurements are not interpreted as poor performance.
- A prominent notice distinguishes automated camera feedback from a personal physiotherapist review.
- Existing measurements, evidence context and exports remain available in a collapsed detailed section.
- The visual language retains the Cambridge Kinematics typography, warm neutral palette, borders and orange accent.

## Responsive and functional checks

- Desktop layout checked in the local app.
- A populated synthetic-data fixture was checked at desktop and 390-pixel content widths.
- Feedback columns collapse into a single column at narrow widths.
- No browser warnings or errors were present.
- Targeted automated tests passed for the feedback page, report logic, progress data and exercise summary.
- Source formatting check passed.

Feedback page result: passed

## Operation date display update

- Source screenshot: `/var/folders/np/lnr7x4kn1gzds1mxgfznnmfm0000gn/T/codex-clipboard-4cad72c7-d5a4-46ad-8850-4b5e0d09a244.png`
- The operation-date field preserves the existing dimensions, border, focus treatment and calendar control.
- Its prompt and accessible label now specify `DD/MM/YYYY`.
- A selected date is shown with the complete year, for example `17/09/2026`.
- The hidden native date remains ISO formatted, so recovery-day calculations are unchanged.
- The updated field was visually checked in the Patient details layout and produced no browser warnings or errors.

## Live exercise camera update

- Source screenshot: `/var/folders/np/lnr7x4kn1gzds1mxgfznnmfm0000gn/T/TemporaryItems/NSIRD_screencaptureui_nMMO1d/Screenshot 2026-09-21 at 00.34.56.png`
- The persistent tracking warning strip and large camera-positioning panel have been removed from the patient view.
- Measurement safety remains active silently. Frames that fail the existing visibility and stability checks are not used as measurements, but the warning UI does not interrupt or stop the recording.
- The dedicated MediaPipe hand-pose model now reads Intel colour frames directly and the two-second open-palm hold is timed from those frame arrivals.
- Mini squat and squat overlays use MediaPipe Pose shoulders, hips, knees, ankles, heels and forefeet. Face and hand pose landmarks are not drawn.
- The local mini-squat camera layout was visually checked after the mandatory, skippable demonstration. The camera area remains dominant, instructions remain readable and no removed warning panel leaves unused space.
- The Intel browser integration check passed for open-palm start, live depth distance, hidden warning UI, mobile width and camera release.
- The complete automated suite passed: 334 tests.
- Source formatting check passed.

final result: passed
