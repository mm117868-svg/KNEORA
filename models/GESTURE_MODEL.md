# Open-palm gesture model

The app bundles Google's MediaPipe Gesture Recognizer, float16 revision 1.

- Source: https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
- SHA-256: `97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482`
- Documentation: https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js
- Upstream MediaPipe source and distribution licence: Apache 2.0, reproduced in `../video-analysis/vendor/LICENSE`.

The model runs locally using the existing Tasks Vision runtime. Open_Palm held for two seconds starts the five-second Marin countdown. It can be anywhere in the picture and needs no face, torso or body-pose result. The hand must remain visible. Recognition errors or missing frames interrupt the hold. An open palm held for three seconds can finish, after the initial palm has been released. The Finish button remains available.

Checks use constructed hand results and the upstream `right_hands.jpg` image positioned in four corners. Those checks do not establish recognition accuracy for a distant hand in a home camera feed.
