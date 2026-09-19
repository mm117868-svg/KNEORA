# Open-palm gesture model

The app bundles Google's MediaPipe Gesture Recognizer, float16 revision 1.

- Source: https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
- SHA-256: `97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482`
- Documentation: https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js
- Upstream MediaPipe source and distribution licence: Apache 2.0, reproduced in `../video-analysis/vendor/LICENSE`.

The model runs locally using the existing Tasks Vision runtime. Open_Palm held for two seconds starts the five-second Marin countdown. It can be anywhere in the picture, the edges and corners included, and needs no face, torso or body-pose result. What has to be inside the picture is the palm (the wrist and the four knuckles); fingertips cut off by the edge do not matter. The hand must remain visible. Recognition errors or missing frames interrupt the hold. An open palm held for three seconds can finish, after the initial palm has been released. The Finish button remains available.

Until this change the start gesture only worked while the pose model was tracking a body. With the angle display on, the preview looked up the operated leg of a skeleton that did not exist whenever nobody was found, the lookup threw, and the throw skipped the hand check for that frame. `tests/operated-leg-overlay.test.mjs` now holds an open palm in a corner with nobody tracked and expects the countdown to start.

Checks use constructed hand results and the upstream `right_hands.jpg` image positioned in four corners. Those checks do not establish recognition accuracy for a distant hand in a home camera feed: the model looks for palms in a small copy of the whole picture, so a palm two metres or more from the camera can be too small for it to find, wherever it is held.
