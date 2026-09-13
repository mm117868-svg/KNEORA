# Third-party components

This analyser uses Google's MediaPipe Tasks Vision 0.10.22-rc.20250304 and Pose Landmarker Full float16 revision 1. The runtime and model are bundled locally for reproducible local processing.

- Upstream: https://github.com/google-ai-edge/mediapipe
- Package: https://www.npmjs.com/package/@mediapipe/tasks-vision
- Model: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task
- MediaPipe source and distribution licence: Apache License 2.0. See vendor/LICENSE.

Model outputs are estimates. No clinical validation is implied by the upstream software or this integration. Sports2D, KIMORE and UI-PRMD code/data are not included.
