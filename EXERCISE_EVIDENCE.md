# Physiotherapy priorities for the three available exercises

Focused PubMed review, 13 September 2026. Scope: primary total knee arthroplasty, straight leg raise, seated knee extension and heel slides. Prioritised the current physiotherapy guideline, systematic reviews and studies directly relevant to the exercise or measurement. This is a focused evidence search, not an exhaustive systematic review.

Search concepts included: total knee arthroplasty + physical therapist guideline; straight leg raise + quadriceps activation + extension lag; knee extension + strength + rehabilitation; heel slide + active range; knee flexion + recovery reference chart. PubMed records and accessible primary full texts were checked. A study supporting an outcome does not validate this app's camera measurement of it.

## What to collect and how to interpret it

| Exercise | Main measures for review | Supporting observations | What needs patient or clinician input |
|---|---|---|---|
| Straight leg raise | Extra knee bend during the lift and absolute knee bend; ability to perform the lift with the recorded level of help | Hip lift range, peak hip bend, complete repetitions, lift/hold/lowering times, cadence and repeatability | Assistance and resistance; pain and effort. Clinical QAB needs all three tasks and its published examination. Passive extension and muscle force are separate. |
| Seated knee extension | Least remaining bend per repetition, typical straightest endpoint and knee excursion | Hold and return timing, endpoint variation, repetitions and session time | Assistance, resistance and symptoms. Active minus passive extension is a clinical lag assessment; the passive measurement is not available from this task. |
| Heel slides | Peak bend per slide, typical peak bend, straightening at return and excursion | Peak variability, bend/hold/return timing and repetitions | Assistance and symptoms. Compare reference-chart active flexion only with a suitably standardised active range assessment. |

“Typical” means median across completed repetitions. Variation means population standard deviation and requires at least two measurements. These are descriptive summaries, not validated clinical cutoffs. Isolated maxima remain visible in the detailed report. A zero-extra-bend lift can still have a bent knee throughout, so it must not be described as no clinical lag.

Across all exercises, collect date and postoperative day, operated side, dose performed, exercise time and tracking coverage. Patient entries identify assistance, added resistance, added weight if known, worst pain during exercise, pain afterwards and effort. Assistance is never inferred from video; missing answers remain unknown. Matching assistance and load are now required for the same video trend series. The app does not verify camera placement, band tension or the accuracy of self-report.

## Sources and their limits

1. **Bove et al., 2026 guideline.** [PubMed 42506877](https://pubmed.ncbi.nlm.nih.gov/42506877/), [full text](https://doi.org/10.1093/ptj/pzag058). The guideline included 227 articles and supports range, strengthening and functional rehabilitation. It concerns primary knee replacement and does not validate a webcam exercise grade.
2. **Konnyu et al., 2023, online 2022.** [PubMed 35302953](https://pubmed.ncbi.nlm.nih.gov/35302953/). Rehabilitation review of 53 randomised trials; findings had low strength of evidence. Relevant outcomes include pain, movement, strength and daily activities. Protocol diversity limits universal dose or technique rules.
3. **Bade et al., 2018.** [PubMed 28864244](https://pubmed.ncbi.nlm.nih.gov/28864244/). Planned secondary analysis of 162 trial participants. Early QAB performance was related to subsequent activation and recovery. The full clinician-assessed battery totals 0 to 6, not a video-derived score for one routine exercise. Its early discriminatory value does not create daily deadlines.
4. **Suh et al., 2021.** [PubMed 33779408](https://pubmed.ncbi.nlm.nih.gov/33779408/). Retrospective cohort of 888 operated knees in 865 patients. Day-one SLR was associated with earlier mobility and discharge. This supports recording achievement and assistance, not causation or a required day-one milestone.
5. **Eymir et al., 2021, online 2020.** [PubMed 32778907](https://pubmed.ncbi.nlm.nih.gov/32778907/). Randomised active heel-slide comparison. Outcomes included active range, pain, circumference, proprioception and function. The abstract does not state the sample size, so none is invented here. This was not a validation study of slide cadence or video technique scoring.
6. **Kittelson et al., 2020.** [PubMed 32698900](https://pubmed.ncbi.nlm.nih.gov/32698900/). Reference-chart development used 1,173 observations in 327 patients; validation used 377 observations in 171 patients. Middle-half active-flexion ranges were 70 to 90° early, 95 to 115° around one month and 109 to 122° around three months. No daily interpolation, individual percentile or pass/fail target is applied to exercise video.
7. **Paravlic et al., 2022.** [PubMed 35692543](https://pubmed.ncbi.nlm.nih.gov/35692543/). Meta-analysis of 17 studies and 832 patients overall showed prolonged quadriceps strength loss and recovery. Actual strength needs standardised force or torque measurement. A lift angle, speed or count is not that measurement.

No validated universal cadence, hold time, hip-lift angle or 0 to 100 video exercise-quality score was identified in this focused search for these routine tasks. Timing and repetition consistency are useful descriptive observations; interpretation against a prescribed programme is a clinical/product inference, not a published scoring system. Keep PROMs, walking tests, strength testing, swelling and next-day symptom response as separate assessments.

## App implementation

- The automatic full report highlights three exercise-specific priorities with measured values and linked research.
- Exercise metrics includes an expandable research guide and daily dropdowns for typical endpoints and pain during exercise.
- Extra session details are optional and do not delay recording completion or automatic analysis.
- Raw per-repetition data remain in the saved report; descriptive medians are calculated from these data. Unknown, wrong-exercise and invalid measurements stay unavailable.
- Existing repetition detection, clinical scoring code, recording controls and Marin prompts are unchanged.
- Software tests use synthetic records, separate from patient storage. Software checks do not establish camera accuracy or clinical validity.
