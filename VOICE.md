# App voice

All new spoken prompts and guidance use **Marin**, with the soft, warm British female delivery selected on 13 September 2026. `voice-profile.json` is the shared voice and delivery configuration, copied from the approved exercise-library settings. This applies to countdowns, exercise guidance, spoken feedback and future app audio.

Use generated audio through `app-voice.mjs`. Do not fall back to an operating-system voice or a different AI voice. Keep the written instruction available, and describe the speech as AI-generated. Voice commands and microphone access are not part of the exercise flow.

## Countdown

Selecting an exercise opens the camera and prepares audio playback. It does not start recording. Holding a raised hand for two seconds starts a five-second countdown. Marin says five, four, three, two, one at one-second intervals; recording begins after the full five seconds. The audio stops if the countdown is cancelled or the camera stops supplying frames. Raising a hand for three seconds can finish the exercise once the starting hand has been lowered.

The live gesture uses MediaPipe landmarks. Frozen frames, missing landmarks and interrupted holds do not count as a completed gesture. Camera and model access are required. Historical voice-counted records remain readable, but new sessions use camera-based repetition counting.

## End-of-exercise confirmation

After recorder finalisation and camera shutdown, the app plays the completed-repetitions message if the selected counter reached the prescribed count. An early finish uses the session-ended message instead. Reaching the repetition target alone does not announce that recording has stopped. Both messages also appear on screen, and leaving an abandoned session does not announce completion.

## Generate the audio once

Double-click **Generate Marin app audio.command**. It asks for an OpenAI API key through a hidden local Terminal prompt, generates five short number clips, assembles a five-second WAV and generates the two end-of-session confirmations. The key is not saved, written to a browser file or logged. OpenAI API charges apply. Only the fixed prompt scripts and delivery instructions are sent, with no patient information.

The recording is not yet generated in this checkout because no API key was configured. Until `audio/marin/manifest.json` and its audio file exist, the app clearly identifies the countdown as visual only. Reload the page after successful generation. A browser or device that blocks audio also keeps the visible countdown.

Generated files are served locally with the app; no API key is needed by patients. The generator checks clip lengths, silence and a total duration of five seconds. Listen to the generated recording before release to confirm accent, wording and delivery. These checks do not validate camera tracking with a real patient.

The nine exercise-library videos live in a separate checkout. Their full Marin replacement remains pending as recorded in that library; setting this shared voice does not retroactively replace those recordings.
