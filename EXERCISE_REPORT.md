# Automatic exercise report

After the recorder stops, the app shows the live summary and automatically analyses the recording for straight leg raises, seated knee extensions and heel slides. The full breakdown appears on the same page without another analysis button. Pain and effort questions stay above the long tables. Saved-session review also includes the full breakdown.

The report covers counts, prescribed count, session/video/analysed time, detected cycle time, time outside cycles, gaps between cycles, total phase times, fastest and slowest cycles (including ties), shortest and longest holds, cadence, angle distributions, repetition consistency, phase angular speeds and separate timing/knee/hip tables for each repetition. It shows camera coverage and missing-frame reasons. No raw trace or video is added to the saved history.

## Definitions

- Knee bend uses 0 degrees for straight. The least observed bend is labelled maximum observed extension, with bend remaining, never clinical extension lag. Hip flexion is the existing trunk-relative 2D proxy.
- Video-wide angle summaries use available sampled observations, including pauses. Per-repetition summaries use the frames between the already-detected start and end of each complete cycle.
- Distribution statistics include arithmetic mean, median (the average of the middle pair for even counts), population standard deviation for two or more observations, and linearly interpolated 5th and 95th percentiles. Percentiles are descriptive, not confidence bounds.
- Cadence during complete repetitions is 60 divided by mean cycle duration. Individual repetition cadence is 60 divided by that repetition's duration. The mean of those individual rates can differ from the aggregate cadence. Whole-session rate includes non-cycle time and is omitted for partial video analysis.
- Metric schema 3 stores `phaseTiming` around the first observed maximum in each cycle, using the existing peak-zone band. Outward movement ends on entering the contiguous peak zone, hold time spans that zone, and returning time runs to cycle end. These three phases sum to cycle duration. This is time near the peak, not proof of stillness.
- Existing `hold` and prototype target checks remain unchanged for compatibility. In older reports, a target-zone hold is not reused as a peak-zone hold when an explicit lift target was configured. Missing new statistics remain unavailable until a recording can be reanalysed.
- Phase angular speed is the absolute net change in the exercise motion angle divided by the phase duration. It is not peak speed, joint power, strength or a smoothness score. A zero-duration phase has no speed estimate.
- Time outside complete cycles includes pauses, incomplete movement and tracking loss. It is not classified as rest. Incomplete movements are excluded by the existing counter; an opening partial movement may be missed.

The change does not alter repetition detection thresholds, selected-leg policy, countdowns, camera permission handling or recording finalisation. Reports retain uncertainty and unavailable values rather than inferring force, pain, swelling, passive motion, clinical extension lag or a validated recovery score.

## Verification

`tests/exercise-details.test.mjs` covers exact totals, ties, zero holds, missing data, partial analysis, old records, frame-to-compact-report persistence, phase partitions, unavailable hip tracking and all three exercise renderings. Existing exercise-analysis, summary, progress and recording lifecycle tests remain applicable.

`tests/exercise-summary-fixture.html` passes clearly labelled synthetic sequences through the real analysis and rendering functions without reading or writing patient records. `tests/exercise-summary-mobile.html` provides a 390-pixel layout preview. These checks verify calculations and software flow, not live-patient or clinical measurement accuracy.
