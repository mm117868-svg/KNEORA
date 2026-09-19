# Dedicated patient recovery measurements

The Recovery summary at `?view=recovery-summary` separates a patient's reported comfortable end position from an exercise peak. The summary shows knee bending, knee straightening, movement-control observations, recorded exercise participation, post-exercise symptoms and dated official questionnaire results. Muscle strength remains unmeasured. Exercise participation does not supply a validated strength or adherence score.

## Patient measurement flow

1. Choose the knee, bending or straightening, assistance, position and date.
2. Open the camera. When the patient reports their comfortable limit, they or their helper presses capture. No initial static calibration period is required.
3. A 1.4-second burst processes distinct camera frames. Each frame uses MediaPipe's image coordinates, scaled to the image aspect ratio, to calculate unsigned hip-knee-ankle bend. Zero means straight; hyperextension is not distinguished.
4. Review the mean of usable frames, range and frame count. A patient confirmation is retained with the result before saving.

Alternatively, process 6 to 60 uploaded images of the same end position, import a compatible depth-camera export, or enter an existing clinical angle and instrument. Uploaded images need their actual assessment date. Their unknown capture timestamp means they cannot be paired automatically with another camera hold.

No camera is opened on navigation to the summary. Audio is not requested. Stop or leaving the page closes the stream and model; incomplete captures are discarded. Camera permission errors give browser and macOS recovery instructions. Images and live video are processed on the device and are not persisted in the recovery record.

## Prototype frame checks and uncertainty

The selected hip, knee and ankle must be in frame with visibility at least 0.5, presence at least 0.5 when supplied, and projected thigh/shank segments at least 20 pixels. More than one detected person is rejected. Shoulder tracking is not required for this dedicated knee measurement. The sequence requires at least six usable frames, at least 50% usable frames and a total angle spread no greater than eight degrees. These are engineering checks, not clinically validated thresholds. They do not establish accuracy, maximum possible range, physiological activation, strength or clinical extension lag.

The arithmetic average is calculated within one end-position sequence, not across separate repetitions or different attempts. The frame mean, minimum, maximum, standard deviation, accepted count, total count and per-frame angles/rejection reasons are retained. No precision claim is derived from the standard deviation.

A 95% confidence interval of the average is also kept (`summary.ci95`: `low`, `high`, `half_width`), by Student's t on the sample standard deviation of the accepted pictures (`confidence.mjs`). It is shown with the result to review, in the list of graph values, as a whisker through the point on the graph and in two columns at the end of the CSV download. It answers one question: if the knee was held at one angle and the pictures scatter around it at random, how far could their average be from that angle. It says how steady the pictures were, not how accurate the camera is: a camera set off to one side, or a landmark placed a little off the joint, moves every picture the same way and the interval cannot see it. It never decides whether a result is accepted or warned about, the saved value is still the plain average, and results saved before it was added simply have none. The pictures of a check are taken about half a second apart and each is measured on its own, which is close to the independence the interval assumes; a knee that drifts during the six seconds widens it, as it should. The interval is for the average of one attempt. It is not a limit of agreement with a goniometer, which only a comparison study can give.

## Storage and trends

New localStorage key: `kr_recovery_measurements_v1`. Exercise records are not migrated or reclassified as dedicated checks. Each result records patient, operation, assessment date, knee, motion, assistance, position, source, device/model, method, calibration reference when applicable, optional paired-capture reference, capture timestamp, patient confirmation and note.

Patient, operation and knee scope the summary. History series also separate motion, assistance, position, source, device/model, method, calibration and rule version. The headline uses the latest dedicated result, with its source and setup visible. Change is calculated only within a matching series. A missing result remains unmeasured; zero is preserved. CSV exports retain numerical precision. Clinical values and camera estimates remain identifiable. Data corruption or quota failures show an error rather than claiming a successful save or overwriting malformed data.

## Depth-camera input contract

No physical 3D camera or device bridge is connected yet. The UI supplies an import path for an actual depth-derived joint-coordinate export. This does not make the browser an Orbbec, RealSense or OAK driver.

The JSON schema is `knee-depth-endpoint-v1`. Required context fields are `patient_id`, `operation_date`, `date`, `side`, `motion`, `mode`, and `position`, matching the current form. `source` has:

```json
{
  "kind": "depth_3d",
  "coordinates": "depth-derived-joint-centres",
  "device": "Actual device and software identifier",
  "calibration": "Actual calibration reference"
}
```

`units` is `m` or `mm`. Each element of `frames` has `time_ms`, `valid` (true only when the device pipeline accepts that frame), and three arrays `hip`, `knee`, `ankle`, each containing finite XYZ coordinates in a common calibrated coordinate frame. The importer computes unsigned 3D knee bend from these coordinates, rejects unusable or implausible 0.1 to 0.8 metre segment geometry, and applies the sequence checks above. Device naming and calibration references are declarations by the exporting system, not independent verification.

`captured_at` records the actual timestamp. For paired comparison, `capture_group` must match the MediaPipe capture reference and capture timestamps must be within two seconds. The two results must have matching patient, operation, date, side, motion, assistance and position, and the operator must confirm that they describe the same hold. This is a prototype pairing check, not proof of sensor synchronisation. The device bridge must synchronise the observations and document how joint centres are obtained.

The comparison shows both readings, their absolute difference and their equal-weight arithmetic mean. The mean is labelled experimental and is excluded from headline recovery measurements and trends. Projected 2D bend and unsigned 3D joint-centre bend are not identical constructs outside the intended side-view plane. Agreement alone does not establish clinical accuracy, and shared landmark errors may remain correlated. MediaPipe world landmarks are not accepted as a second depth camera.

The **Download depth capture reference** button exports the current context and reference with an empty frame array and blank device/calibration fields. It is an integration request, not a sample result or a recording.

## Software checks

`node --test tests/recovery-measurements.test.mjs tests/progress.test.mjs tests/exercise-summary.test.mjs`

The new tests cover projected and 3D geometry, failed tracking, zero/blank values, source and patient separation, date checks, sequence averaging, storage failures, depth imports, paired-source constraints, camera retry/cancellation, synthetic capture and separation of participation from strength.

`tests/recovery-summary-fixture.html` uses only synthetic data and an isolated in-memory store. Its fake camera is injected solely in that test page. `tests/recovery-summary-mobile.html` embeds the actual empty/local summary at 390 pixels. The UI was checked for patient-triggered saving, zero-valued clinical entries, required patient confirmation, source comparison and mobile layout. These checks do not establish live patient measurement accuracy or validate a physical depth camera.

## Clinical and technical references

- [Google MediaPipe Pose Landmarker web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js): image/video inference and landmark coordinate definitions.
- [Kittelson et al., 2020](https://doi.org/10.1186/s12891-020-03493-x): clinical active knee-flexion reference chart. It does not validate the new camera measurement.
- [Paravlic et al., 2022](https://doi.org/10.3389/fmed.2022.865412): strength recovery following knee arthroplasty; pooled 17 studies and 832 patients overall.
- [Mizner et al., 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3008304/): physical performance and patient-reported recovery trajectories.
- [Bade et al., 2018](https://doi.org/10.1016/j.apmr.2017.07.013): the three-part clinician-assessed QAB is distinct from an automated SLR observation.
- [APTA guideline, 2020](https://academic.oup.com/ptj/article/100/9/1603/5857258): includes standardised performance outcome assessment. A potential future chair-rise test would require its own implementation and validation; pending squat and chair-rise exercises have not been activated by this change.
