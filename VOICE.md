# App voice

All new spoken prompts and guidance use **Marin**, with the soft, warm British female delivery selected on 13 September 2026. `voice-profile.json` is the shared voice and delivery configuration, copied from the approved exercise-library settings. This applies to countdowns, exercise guidance, spoken feedback and future app audio.

Use generated audio through `app-voice.mjs`. Do not fall back to an operating-system voice or a different AI voice. Keep the written instruction available, and describe the speech as AI-generated. Voice commands and microphone access are not part of the exercise flow.

## Countdown

Selecting an exercise opens the camera and prepares audio playback. It does not start recording. Holding an open palm towards the camera anywhere in the picture for two seconds starts a five-second countdown. Marin says five, four, three, two, one at one-second intervals; recording begins after the full five seconds. The audio stops if the countdown is cancelled or the camera stops supplying frames. Showing another open palm for three seconds can finish the exercise after the starting palm has been lowered or closed. The Finish button remains available.

The live gesture uses the separately bundled MediaPipe Gesture Recognizer and its Open_Palm classification. It does not require body, face or shoulder landmarks. Frozen frames, missing landmarks and interrupted holds do not count as a completed gesture. Camera and hand-model access are required for starting. The body-pose model is used separately for exercise tracking. Historical voice-counted records remain readable, but new sessions use camera-based repetition counting.

## End-of-exercise confirmation

After recorder finalisation and camera shutdown, the app plays the completed-repetitions message if the selected counter reached the prescribed count. An early finish uses the session-ended message instead. Reaching the repetition target alone does not announce that recording has stopped. Both messages also appear on screen, and leaving an abandoned session does not announce completion.

## Generate the audio once

Double-click **Generate Marin app audio.command**. It asks for an OpenAI API key through a hidden local Terminal prompt, generates five short number clips, assembles a five-second WAV and generates the two end-of-session confirmations. The key is not saved, written to a browser file or logged. OpenAI API charges apply. Only the fixed prompt scripts and delivery instructions are sent, with no patient information.

The three app prompts are now included in `audio/marin/manifest.json` and the accompanying WAV files. They were generated with the selected Marin voice through OpenAI.fm on 13 September 2026. The countdown was split at the pauses and assembled into five one-second slots. Patients need no API key. Use **Test Marin voice** on the camera setup screen to check playback and unlock browser audio. The visible countdown remains available if a device blocks sound.

Generated files are served locally with the app; no API key is needed by patients. The generator checks clip lengths, silence and a total duration of five seconds. Listen to the generated recording before release to confirm accent, wording and delivery. These checks do not validate camera tracking with a real patient.

The nine exercise-library videos live in a separate checkout. Their full Marin replacement remains pending as recorded in that library; setting this shared voice does not retroactively replace those recordings.
