# Optional animated exercise guides

Nine original 30-second videos demonstrate the movements in the current Knee Recovery exercise library. Each has a simple 3D character, British English narration, six caption cues and a complete outward-and-return movement. Static exercises show a contraction or balance hold and release.

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

`avatar.js` defines the character and motion mathematically in Three.js 0.180.0. It uses fixed limb lengths, joint rotations and inverse kinematics for selected movements. It is a simplified visual character, not an anatomical or patient-specific biomechanical model. It does not use pose estimation, patient footage or an AI video generator.

The `models/` files are glTF 2.0 binary models with named 30-second animations. They contain the character and relevant furniture, with individual mesh transforms animated at 12 samples per second. In Blender, import a GLB using **File > Import > glTF 2.0**. The character has separate animated mesh parts rather than a skinned armature. A muscle cue used in the quad-set video is a graphic annotation and is not in the GLB.

`videos/` contains H.264 MP4s at 1280 × 720, 24 frames per second, with AAC narration, JPEG posters and WebVTT captions. The MP4s contain no patient recordings. Voice was rendered with the macOS Daniel voice. Narration is timed to the six cues in `exercises.json`.

`exercises.json` is the canonical script and timing source. The individual JSON files in `source/` preserve the initial script drafts.

The [interactive model viewer](model.html) supports playback and scrubbing. The [library](index.html) supports playback, downloads, transcripts and a demonstration of the watch-or-skip interaction.

## App integration

The root `index.html` imports `guide-player.js` and presents the optional guide after the operated leg has been selected and before opening the camera. Existing exercise availability, counting, targets and recording code are preserved.

This branch is a local preview and has not been published. If merging into a generated site, apply the same small integration to the template that generates the root page, and copy this `exercise-guides/` directory as static assets. `source/app-integration.patch` records the root-page change. The underlying source generator is maintained outside this repository.

## Rebuilding

Requirements: Python 3, Node.js with Playwright, Chrome, FFmpeg with libx264, and macOS `say` for regenerating narration. The existing MP4s and GLBs play without any build tools.

Serve the repository root with the included server on port 8783, which supports video seeking. Run the following from that root, setting `GUIDES_FFMPEG` if FFmpeg is not on PATH:

```sh
python3 exercise-guides/source/serve.py
```

In another terminal:

```sh
python3 exercise-guides/source/make-audio.py
export GUIDES_BASE_URL=http://127.0.0.1:8783
node exercise-guides/source/render-videos.cjs
node exercise-guides/source/export-models.cjs
```

`GUIDES_BASE_URL` and `GUIDES_BROWSER` can override the local URL and browser executable. If narration changes, update the matching WebVTT captions before release. The current JSON cues define their start and end times.

Three.js and its bundled exporter utilities are MIT licensed; see [vendor/LICENSE](vendor/LICENSE). The meshes and animation logic were created for this project.

## Verification

Browser checks passed for all nine video durations and caption tracks, desktop and mobile layouts, model playback, watch/skip, cancellation, focus restoration and camera access only after continuing. All MP4s decoded fully to 720 frames with an audio stream; the source narration contains a non-zero signal and no clipped samples. GLB structure and 30-second animation timelines were checked. Start and movement poses were visually inspected. This does not substitute for clinician review or establish tracking accuracy.
