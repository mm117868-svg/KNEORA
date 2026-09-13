# Measuring recovery after total knee arthroplasty

Evidence reviewed 13 September 2026. Applies primarily to elective primary TKA for osteoarthritis. This is the rationale for the prototype reports, not an individual rehabilitation prescription. Published measurement protocols and patient populations must match before a clinical comparison is made.

## What matters

Recovery should be described using several domains: knee flexion and extension, quadriceps control and strength, pain and swelling, mobility, and the patient's everyday function. A camera exercise score cannot represent them all. The 2026 APTA guideline synthesised 227 articles and supports individualised progression. It does not provide a universal daily webcam score or validate this software. Its scope excludes revision and partial arthroplasty and non-OA indications. [Bade et al., APTA guideline revision 2026](https://doi.org/10.1093/ptj/pzag058).

| Domain | Collect in this app | Interpretation |
| --- | --- | --- |
| Knee bend | Maximum, minimum, mean, median and observed excursion; per-repetition peaks | Exercise observations, not necessarily maximum active ROM. Record whether movement was assisted. |
| Knee straightening | Least knee bend reached and additional bend during SLR | A visible deficit is not automatically quadriceps extension lag. Passive extension is required to distinguish lag from a passive restriction. |
| Quadriceps control | SLR knee-control observations and clinician QAB components | The published test and camera adaptation remain separate. |
| Exercise performance | Complete cycles, interrupted cycles, outward/return time, hold and cadence | Descriptive engineering metrics. No validated universal tempo or repetition-quality cut-off is claimed. |
| Pain and symptoms | Patient-rated pain after the exercise; discuss swelling and symptom response with the clinical team | Pain is entered, never inferred from face, pose or speed. Swelling is not measured by this camera pipeline. |
| Function | Separate patient questionnaire and standardised functional tests | Walking, transfers and stairs cannot be inferred from these three exercises. |
| Measurement quality | Per-joint coverage, accepted/rejected frames, selected leg, model and rule versions | Visibility is not angle accuracy. Compare repeat recordings with the same view, exercise and assistance. |

## Time after surgery

| Time | Evidence-based context | Product use |
| --- | --- | --- |
| Day 0 to 1 | NICE recommends rehabilitation on the day of surgery if possible and within 24 hours, including mobilisation, home exercises and daily-activity advice. | Record an initial assessment and the individual plan. Do not impose a ROM discharge threshold. [NICE NG157, 1.10](https://www.nice.org.uk/guidance/ng157/chapter/Recommendations). |
| Early postoperative period | Typical active knee-flexion observations were 70 to 90° (interquartile range). | Reference context only. |
| About 1 month | Typical active flexion was 95 to 115° (interquartile range). | Show alongside a comparable active ROM measurement, without a pass/fail grade. |
| About 3 months | Typical active flexion was 109 to 122° (interquartile range). | Discuss trajectory together with symptoms and function. |

The three flexion ranges come from [Kittelson et al. (2020)](https://doi.org/10.1186/s12891-020-03493-x), developed using 1,173 observations in 327 patients over the first 120 days. The abstract reports a temporal test set of 171 patients; the results narrative says 177, an internal reporting discrepancy. All data came from one clinic system. The middle 50% of a cohort is neither a minimum acceptable range nor a definition of successful recovery. We have not reproduced its full centile model, interpolated daily targets, or calibrated camera estimates to its clinical measurements.

For days 7, 14, 21 and 42, this implementation deliberately does not invent exact angle requirements. The clinical team can prescribe targets, with progress reviewed against baseline and repeat measurements. Early loss of straightening, symptoms and functional difficulty need clinical context; these sources do not justify a universal day-specific extension deadline or a video-only intervention decision.

## Clinical measures worth referencing

| Measure | Evidence and purpose | Relationship to the three exercises |
| --- | --- | --- |
| Quadriceps Activation Battery (QAB), 0 to 6 | Three clinician-rated items, each 0 to 2; a secondary analysis of 162 TKA patients assessed early activation around day 4. [Bade et al.](https://doi.org/10.1016/j.apmr.2017.07.013). | SLR relates to one component. The complete battery also requires an isometric quadriceps contraction and a specifically administered extension-lag test. Seated repetitions do not reproduce the latter. |
| KOOS JR, 0 to 100 | Seven patient-reported items covering knee symptoms and function. Development/internal validation used 2,291 patients, with external validation also reported. [Lyman et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC4868168/). | Useful for overall patient-reported recovery at planned follow-up intervals. Cannot be calculated from any exercise video. Use the official questionnaire and raw-to-interval conversion. |
| Oxford Knee Score, 0 to 48 | Twelve patient-reported items on pain and function after knee replacement. [Oxford University Innovation](https://innovation.ox.ac.uk/licence-details/oxford-knee-score-oks) and [official scoring guide](https://innovation.ox.ac.uk/wp-content/uploads/2016/05/OKS-scoring-guide_2016-01-15.pdf). | Relevant to a UK pathway; separate questionnaire, not a per-exercise score. Check the applicable implementation licence before adding the instrument itself. |
| Timed Up and Go (seconds), 30-second chair stand (count) | The 2020 APTA guideline recommended these with KOOS JR at first and final visits in each care setting. That recommendation was best practice with insufficient evidence, rather than a daily recovery target. [2020 guideline](https://academic.oup.com/ptj/article/100/9/1603/5857258). | Require their own standardised tests. Evidence is not identical for each measure: the guideline described TUG validity/reliability, while TKA validity for 30-second sit-to-stand was not established there. The 2026 revision does not establish a new universal outcome battery. |

The QAB paper's high/low grouping was a study-specific median split, not a deadline to reach a score. Its evidence does not validate our camera-derived 0 to 2 adaptation. Missing tests are not zero. No dedicated validated technique score for routine heel slides or seated-extension repetitions was identified in this focused search. This is not a claim that no such instrument could exist.

## Implementation boundaries

The report returns 2D estimated joint metrics, repeat timing, data quality and linked clinical references. QAB entries are identified as clinician-entered; no clinician identity is authenticated by this local prototype. An optional SLR criteria count and exploratory QAB-inspired estimate are labelled unvalidated. The software never converts heel-slide or seated-extension angles to QAB, KOOS JR, Oxford Knee Score or a muscle-strength grade.

A proposed follow-up design is to retain per-session movement metrics and pain, then administer a chosen PROM and functional tests at clinically agreed intervals. This schedule is a product proposal, not a claim that a particular postoperative day or score is universally required. Before clinical use, compare the camera outputs against blinded clinician/goniometer measurements, test repeatability and measurement error, and test the intended home-camera setups and patient population. Small changes and well-tracked frames alone do not establish recovery.
