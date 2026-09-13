# Heavy pose model for recovery endpoint checks

Bundled MediaPipe Pose Landmarker Heavy, float16 revision 1, downloaded 13 September 2026.

- Source: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task
- SHA-256: `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b`
- Model documentation: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- JavaScript configuration: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Legacy options and benchmarks: https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/pose.md
- MediaPipe source licence: Apache 2.0, reproduced in `../video-analysis/vendor/LICENSE`.

The dedicated recovery measurement uses Heavy, corresponding to the legacy complexity 2 choice, through the existing Tasks Vision runtime. It uses `runningMode: 'IMAGE'` and `detect()` on each fresh camera picture or uploaded image. No pose from a previous picture is supplied to the next measurement. Live camera capture lasts two seconds; each usable raw knee angle contributes once to the average and the minimum/maximum range. Poor visibility, ambiguous multiple people and excessive variation still prevent a usable result. Images are processed in memory on this device; only measurements are saved when the patient confirms Save.

The overlay and live numerical preview use a separate five-frame moving average, reset on missing or stale data. These smoothed preview values do not enter the endpoint statistics. Temporal smoothing is not supplied to independent IMAGE inference. Continuous exercise tracking keeps its existing VIDEO mode, Full model default and motion filtering.

`model_complexity`, `static_image_mode`, `smooth_landmarks` and `smooth_segmentation` are legacy API names, not options on Tasks Vision PoseLandmarker. Segmentation masks are not used by this app's joint-angle calculation or display; `outputSegmentationMasks` remains false. Mask smoothing cannot reduce landmark jitter. If a silhouette is added later, any mask filtering must remain separate from joint measurements.

Google's published Yoga, Dance and HIIT benchmarks favour Heavy over Full on their reported pose metrics. They do not validate knee-angle accuracy after arthroplasty. Software tests and model loading checks do not replace camera, reference-angle or clinical validation.
