# Optional animated exercise guides

Nine 57-second videos demonstrate the movements in the current Knee Recovery exercise library. Each has a skinned adult fitness character built in Blender, British English narration, nine caption cues and two demonstrations of the movement. Static exercises show a contraction or balance hold and release.

The patient can select **Watch how to do it** or **Skip and start**. A demonstration never starts the camera or a recording. Continuing enters the existing camera setup. Closing the guide returns to the exercise list. Finishing a video leaves the decision to start with the patient.

## Included exercises

| Exercise | App status | Assets |
| --- | --- | --- |
| Heel slide | Current | [MP4](videos/heel_slide.mp4), [animated GLB](models/heel_slide.glb) |
| Straight leg raise | Current | [MP4](videos/straight_leg_raise.mp4), [animated GLB](models/straight_leg_raise.glb) |
| Seated knee extension | Current | [MP4](videos/seated_extension.mp4), [animated GLB](models/seated_extension.glb) |
| Quad set | Planned | [MP4](videos/quad_set.mp4), [animated GLB](models/quad_set.glb) |
| Standing knee bend | Planned | [MP4](videos/standing_flexion.mp4), [animated GLB](models/standing_flexion.glb) |
| Mini squat | Planned | [MP4](videos/mini_squat.mp4), [animated GLB](models/mini_squat.glb) |
| Sit to stand | Planned | [MP4](videos/sit_to_stand.mp4), [animated GLB](models/sit_to_stand.glb) |
| Squat | Planned | [MP4](videos/squat.mp4), [animated GLB](models/squat.glb) |
| Single-leg balance | Planned | [MP4](videos/single_leg_stance.mp4), [animated GLB](models/single_leg_stance.glb) |

The six planned exercises remain unavailable for recording in the app. Their demonstrations are available here for review. Repeated heel-slide entries in the programme share one demonstration; the film does not set a target bend or postoperative week.

## Content status and sources

**Drafts for clinical review before patient release.** These are general movement illustrations, not individual prescriptions, anatomical measurements or evidence that the tracking algorithm works. A clinician still needs to review the exact visual movements, spoken wording and suitability for the intended patients. Video pacing is illustrative. A patient's own plan determines permitted exercises, range, holds, repetitions, support and progression.

Movement descriptions were checked on 13 September 2026 against the following NHS patient resources. Scripts are original summaries. No source photographs, illustrations, footage or logos were copied. These sources do not imply NHS endorsement of these videos.

- [Cambridge University Hospitals: Knee exercises](https://www.cuh.nhs.uk/patient-information/knee-exercises/). Positioning for heel slides, quadriceps setting, straight leg raises and standing knee flexion, plus alignment and control.
- [United Lincolnshire Hospitals: Total Knee Replacement Exercises](https://www.ulh.nhs.uk/patients/patient-information-library/total-knee-replacement-exercises/). Bed exercises and active seated knee straightening.
- [Royal National Orthopaedic Hospital: Total Knee Replacement Exercise Pack](https://www.rnoh.nhs.uk/patients-and-visitors/patient-information-guides/total-knee-replacement-exercise-pack). Sit to stand, standing knee flexion and squat movement patterns.
- [Worcestershire Acute Hospitals: Lower limb strengthening exercises](https://www.worcsacute.nhs.uk/documents/documents/patient-information-leaflets-a-z/3126-lower-limb-strengthening-exercises). Supported knee bends and mini squats.
- [Leeds Teaching Hospitals: Advanced knee and ankle exercises](https://www.leedsth.nhs.uk/patients/resources/advanced-knee-and-ankle-exercises/). Supported squatting and staged balance work.
- [NHS: Balance exercises](https://www.nhs.uk/live-well/exercise/balance-exercises/). Supported single-leg stance and controlled foot placement.

## Editable model and media

The [style 2 fitness character](fitness-avatar/README.md) was built in Blender 4.5.13 using MPFB and CC0 MakeHuman assets. It has a continuous human mesh, fitted clothing and a 53-bone armature. This is a local interpretation of the chosen character reference, not an exact reconstruction.

`fitness-avatar.js` loads the skinned mesh and applies deterministic exercise movements. `avatar.js` supplies the movement targets and furniture. This does not use pose estimation or patient recordings. The [packed Blender source](fitness-avatar/fitness-avatar-editable.blend) retains the editable body, skeleton and materials.

The `models/` files are glTF 2.0 binary models with named 57-second animations. They contain the skinned character and relevant furniture, with the skeleton and root transforms sampled at 12 frames per second. In Blender, import a GLB using **File > Import > glTF 2.0** to edit a particular exercise animation.

`videos/` contains H.264 MP4s at 1280 × 720, 24 frames per second, with AAC narration, JPEG posters and WebVTT captions. The MP4s contain no patient recordings. Marin, with a soft British female delivery, is the selected replacement voice. The approved sample is saved locally. The full Marin batch has not yet been rendered: eight videos retain the original Daniel narration, and seated knee extension has the earlier Kokoro Emma sample. See [voice model and rebuilding notes](source/voice-model.md). Narration is timed to the nine cues in `exercises.json`.

`exercises.json` is the canonical script and timing source. The individual JSON files in `source/` preserve the initial script drafts.

The [interactive model viewer](model.html) supports playback and scrubbing. The [library](index.html) supports playback, downloads, transcripts and a demonstration of the watch-or-skip interaction.

## App integration

The root `index.html` imports `guide-player.js` and presents the optional guide after the operated leg has been selected and before opening the camera. Existing exercise availability, counting, targets and recording code are preserved.

This branch is a local preview and has not been published. If merging into a generated site, apply the same small integration to the template that generates the root page, and copy this `exercise-guides/` directory as static assets. `source/app-integration.patch` records the root-page change. The underlying source generator is maintained outside this repository.

## Rebuilding

Requirements: Python 3, Node.js with Playwright, Chrome, FFmpeg with libx264, and OpenAI API access for the selected Marin narration. The optional Kokoro fallback uses a local speech model. The existing MP4s and GLBs play without any build tools.

Serve the repository root with the included server on port 8783, which supports video seeking. Run the following from that root, setting `GUIDES_FFMPEG` if FFmpeg is not on PATH:

```sh
python3 exercise-guides/source/serve.py
```

In another terminal:

```sh
"../voice-tools/venv/bin/python" exercise-guides/source/make-openai-audio.py --prompt-key
export GUIDES_BASE_URL=http://127.0.0.1:8783
node exercise-guides/source/render-videos.cjs
node exercise-guides/source/export-models.cjs
```

`GUIDES_BASE_URL` and `GUIDES_BROWSER` can override the local URL and browser executable. If narration changes, update the matching WebVTT captions before release. The current JSON cues define their start and end times.

Three.js and its bundled loader/exporter utilities are MIT licensed; see [vendor/LICENSE](vendor/LICENSE). The human and clothing assets are CC0. See [asset provenance](fitness-avatar/source/asset-provenance.json). The exercise animation logic was created for this project.

## Verification

The following checks describe the original Blender video release. Marin narration remains pending and will be checked separately when rendered.

All nine MP4s decode completely to 1,368 frames at 24 fps, with audio, a 57-second duration and nine matching caption cues. Browser checks passed for desktop and mobile playback, model scrubbing, watch/skip, cancellation, focus restoration and camera access only after continuing. Video seeking and HTTP 206 range responses passed.

All nine GLBs load with a 57-second animation and the skinned armature. Their sampled ankle positions match the live browser animation within 0.005 metres. The Blender source opens successfully with one 53-bone armature, nine meshes, body shape keys and all seven image textures packed. Start, movement and hold positions were visually inspected. The quad-set film includes a graphic contraction cue.

See [verification results](source/verification.json). These technical checks do not substitute for clinical review, patient usability testing or repetition-counting validation.
