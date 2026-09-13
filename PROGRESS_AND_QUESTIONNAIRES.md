# Progress to date and patient-reported measures

Local entry points: `/?view=progress-to-date` and `/?view=patient-measures`.

The main exercise workflow is unchanged: stop recording, analyse the exercise, then save the compact report with that session. Progress to date reads those reports for the selected patient ID and operation date. The camera does not load on either new page.

## Exercise progress

- Straight leg raise: additional knee bend during completed lifts, approximate peak hip flexion, completed lift excursion, mean hold and lowering times.
- Seated knee extension: least observed knee bend, largest completed straightening excursion, cycle and return timing. Timing is not a validated measure of return control. Passive extension is needed to assess clinical extension lag separately.
- Heel slides: maximum observed bend, knee bend at the actual completed return endpoint, completed excursion and the standard deviation of peak bend across at least two complete repetitions.
- Other available measurements: repetition count, cadence, timing, whole-video knee statistics, tracking coverage, sampled/rejected frames, reported pain/difficulty, live counts and older live p95 bend. Only manually entered complete clinical QAB totals enter the clinical QAB trend.

The daily representative value is from the latest measurable session in the selected series on that calendar date. Every saved session remains expandable. Missing days and missing measurements stay missing. The card for a best observed value uses all measurable sessions in the selected date range. Holding longer, lifting higher or moving faster is not automatically treated as better. Timing/range targets use the values already entered in the analysis configuration and are described as closest to target, not as validated scores.

Series separate patient, operation date, exercise, anatomical leg, measurement source and recorded analysis settings. New video angle estimates and legacy live measurements are not joined into one trend. Assistance and camera setup are not automatically verified, so even within-series comparisons remain approximate. The user can inspect any date range up to 366 days at a time and export all recorded sessions.

`metricSchemaVersion: 2` adds `reps[].returnKneeBend` to newly analysed reports. Older reports retain missing endpoints. Existing videos can be reanalysed if available; no endpoint is fabricated from an old minimum value.

## Patient-reported measures

The page records a dated result from an official questionnaire completed separately. It does not reproduce the questionnaire text or estimate questionnaire answers from video.

- KOOS JR: enter an official 0 to 100 interval score, or a complete seven-item raw total from 0 to 28. Raw totals use the exact non-linear HSS lookup table. Completion must be confirmed. Missing items are not imputed by this app.
- Oxford Knee Score: enter an official score using the current 0 to 48 convention. The app does not silently reinterpret legacy 12 to 60 scores. Oxford requires a copyright licence for use of its questionnaire and a digital version needs the appropriate permission. An authorised full questionnaire implementation is not included.
- Preserve the recall periods: the past week for KOOS JR, and the past four weeks for Oxford. Dated logging is available, but this is not a recommendation to administer either questionnaire daily.
- Each result records patient, operation, assessed knee, assessment date, scoring method, raw total when supplied, and optional note. Editing retains previous versions. Distinct instruments and knees have separate trends. The highest recorded score is descriptive, not a recovery deadline or an MCID judgement.
- Storage key: `kr_patient_reported_measures_v1`. Save failures are visible; malformed existing data is not overwritten. Data stays in this browser. CSV exports and a readable progress summary support keeping a separate copy.

## Evidence

See `recovery-references.mjs` for the source-linked catalogue and `video-analysis/POSTOPERATIVE_EVIDENCE.md` for the exercise analysis evidence notes. Numeric cohort means and interquartile ranges are shown in separate contexts. No expected daily angle, patient percentile or universal postoperative deadline is interpolated.

Key primary sources:
- Kittelson et al., 2020, 327 patients / 1,173 observations: https://doi.org/10.1186/s12891-020-03493-x
- Mehta et al., 2018, 559 patients: https://mds.marshall.edu/physical_therapy_faculty/41/
- Paravlic et al., 2022, 17 studies / 832 patients overall: https://doi.org/10.3389/fmed.2022.865412
- Mizner et al., 2011, 100 patients: https://pmc.ncbi.nlm.nih.gov/articles/PMC3008304/
- KOOS JR validation: https://pmc.ncbi.nlm.nih.gov/articles/PMC4868168/
- HSS scoring: https://www.hss.edu/files/KOOS-JR-Scoring-Instructions-2017.pdf
- HSS questionnaire: https://www.hss.edu/files/hss-koos-jr.pdf
- Oxford description: https://innovation.ox.ac.uk/licence-details/oxford-knee-score-oks
- Oxford permissions: https://process.innovation.ox.ac.uk/clinical/

## Verification

Run `node --test tests/progress.test.mjs video-analysis/analysis.test.mjs video-analysis/exercises.test.mjs video-analysis/camera-access.test.mjs`.

`tests/progress-fixture.html` provides synthetic software UI examples and an isolated in-memory questionnaire store. It neither reads nor writes patient localStorage. `tests/progress-mobile.html` displays the actual empty/local pages in 390 pixel iframe viewports. These checks verify interface behaviour and calculations, not camera accuracy, clinical validity, genuine patient recovery or operation on a physical phone.

## Simple end-of-exercise summary

The end screen now starts with repetitions, whole-session time (including pauses), pace in repetitions per minute, seconds per repetition, and a few plain-language movement results specific to the exercise. The video analysis adds the measured lift/hold/return timings. SLR shows extra knee bend, approximate hip bend and lift excursion; seated extension shows least bend and straightening excursion; heel slides show maximum bend, the return position and observed range.

The day after surgery comes from the recorded session date. A previous-session comparison is shown only for compatible measurements. No new daily target, movement-quality grade or clinical diagnosis is generated. A live spoken count never inherits the background camera counter's tempo, and failed video tracking does not imply zero performed repetitions.

After the first completed video analysis, the analyser closes back to the simple summary. **More detail** reveals the existing charts, full saved analysis and the button to reopen the video report. Reanalysis while deliberately viewing the full report stays open. Existing pain and effort questions remain available below the summary.

Software checks: `node --test tests/exercise-summary.test.mjs`. `tests/exercise-summary-fixture.html` and `tests/exercise-summary-mobile.html` are explicitly labelled synthetic UI previews that do not read or write patient records.

## Recovery timeline

`?view=recovery-timeline` presents seven selectable stages on a connected chronological diagram. Each stage describes a broad rehabilitation focus, illustrative activities, useful measures and linked evidence. Patients can also expand the complete timeline. The page states prominently that these are reference points, not mandatory deadlines, and does not select or grade a stage using the patient's measurements. An entered operation date supplies calendar context only.

Kittelson's active-flexion interquartile bands remain distinct from Kornuijt's 137-patient eight-week observations. Early 70 to 90 degree observations are not a day-14 requirement. Physiotherapist-guided activities link to NICE, AAOS and the clinical guideline as applicable. More detail is available in `recovery-timeline.mjs`.

The expandable measurement explanation distinguishes current recording estimates, separately entered symptoms and clinical results, and domains requiring additional assessment. It does not claim automatic strength, physiological activation, swelling, gait, clinical extension lag or full QAB measurement. No new patient records or clinical scoring rules are introduced.

`tests/recovery-timeline-mobile.html` displays the actual panel in a 390-pixel iframe for responsive interface checks. This is browser layout verification, not physical-device or clinical validation.

## Calendar follow-ups

Questionnaires are reached from the footer's **Questionnaires & follow-ups** link and from calendar reminders. They no longer occupy a primary navigation tab. The recovery summary shows questionnaire outcomes only when results have been recorded.

Patients enter the questionnaire, knee and postoperative day from their agreed clinical schedule. The app does not invent a default follow-up interval. Surgery is day 0; calendar dates are calculated with date-only arithmetic. Reminders are stored under `kr_questionnaire_followups_v1`, separately for each patient and operation date. Changing patient details selects a separate record, as with exercise history.

The home calendar marks questionnaire dates with a blue dot. Exercise history shows a labelled event and its date, postoperative day and status. Opening the event selects its questionnaire and knee. Only an explicitly linked, completed official questionnaire result changes a reminder to **Result saved**; opening the app or completing exercises does not. Removing a reminder retains saved results. These are in-app reminders, not system notifications.

Validation: `node --test tests/questionnaire-schedule.test.mjs tests/progress.test.mjs tests/recovery-measurements.test.mjs`. The reminder checks cover DST and leap dates, invalid input, patient isolation, explicit result linking, preserved records and storage failures. Browser interaction was checked in an isolated synthetic context at 1280 px and 390 px, including creation, reload, event navigation, completion status and horizontal overflow.
