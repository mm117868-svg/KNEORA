# Live rehabilitation guidance and voice

The exercise screen has written technique reminders, a live Intel knee-distance tile when using the SDK camera option, and a saved Marin voice on/off setting. The in-exercise mute button changes the same setting. It controls countdowns, completion messages, exercise cues and demonstration audio. Written guidance stays visible.

Core exercise cues are paraphrased from NHS patient leaflets checked on 20 September 2026:

- Straight leg raise: [South Tees](https://www.southtees.nhs.uk/resources/straight-leg-raise/) and [CUH knee exercises](https://www.cuh.nhs.uk/patient-information/knee-exercises/).
- Heel slide: [CUH knee exercises](https://www.cuh.nhs.uk/patient-information/knee-exercises/).
- Seated extension: [CUH early knee exercises](https://www.cuh.nhs.uk/patient-information/early-knee-exercises/).

The leaflets support the intended movement, not camera thresholds or automated technique validation. Existing prescribed repetitions and holds take precedence. Other exercises show their existing written steps; no automated form score, diagnosis or progression is introduced.

Visibility is checked before movement-specific cues. During a straight leg raise, a sustained increase of more than 10 degrees from the visible starting knee angle can trigger a gentle straight-knee reminder. The 10-degree change, 800 ms persistence and 600 ms cue settling are provisional engineering choices, not clinical cut-offs. Losing visibility clears the baseline and correction. The app cannot determine pain, loading or muscle activation.

## Marin recordings

The new scripts are in `voice-profile.json` and `rehab-coach.mjs`. `Generate Marin rehab audio.command` generates only missing/changed clips using the existing OpenAI speech generator and preserves installed recordings. Enter the API key only at the hidden local Terminal prompt. It is not saved in the app.

No speech credential was available during this implementation, so the new rehab clips have not been generated. Existing countdown/completion audio remains available. The app explicitly reports when written cues are being used because the new clips are absent. It never substitutes browser TTS or another voice.

After generating clips, listen to them and reload the app. Spoken cues have a 12-second minimum gap and a 35-second same-cue repeat limit; they do not interrupt countdown or completion audio. Missing clips remain written-only.

## Intel exercise connection

Launch `Open Intel exercises.command`, choose the operated side, then open an exercise. The SDK owns both colour and depth; it sends the complete colour picture into a browser stream for the existing exercise workflow. The patient sees distance to the knee surface in metres during positioning and recording. A loss of valid knee depth clears the number. A connection stall stops the camera and exercise recording. Height-based estimates never silently replace missing depth.

Synthetic tests check flow and controls, not hardware performance. Actual Intel latency, stream quality, camera permission and clinical feedback still require real-camera checks. The latest enumeration detected no RealSense devices.
