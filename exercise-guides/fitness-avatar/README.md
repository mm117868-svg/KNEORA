# Fitness avatar, style 2

The user selected the adult fitness avatar from the three-character comparison. This local version interprets that direction with natural adult proportions, grey hair, a teal T-shirt, charcoal sports shorts and trainers. It is a new editable character, not an exact reconstruction of the reference face or clothing.

## Delivered assets

- `fitness-avatar-editable.blend`: packed Blender source, with editable meshes, materials, body shape keys and a game-engine armature.
- `fitness-avatar.glb`: the base skinned character for browser rendering.
- `../models/*.glb`: nine animated versions, each containing a 57-second movement demonstration and relevant furniture. Import into Blender with File > Import > glTF 2.0.
- `../fitness-avatar.js`: deterministic exercise motions applied to the skeleton.
- `references/`: the image reference used to define the selected direction.

The films use the Blender-built character rendered in Three.js, with narration and captions. They do not use patient recordings or generated video footage. The quad-set movement is necessarily subtle; its spoken and written cues explain the muscle contraction.

## Reproduction

Built with Blender 4.5.13 LTS and [MPFB 2](https://github.com/makehumancommunity/mpfb2), source commit `437dd513888a92399d1d3200d2e80859fae55abc`. `source/build-fitness-avatar.py` records the build. It expects a tools directory containing MPFB source and the named assets; set `FITNESS_TOOLS_DIR` and `FITNESS_OUTPUT_DIR` to override their locations. Blender's executable and source assets are installed locally under `character-tools` beside the repository. The packed `.blend` can be edited without that build directory or MPFB.

The selected assets are from the [MakeHuman CC0 asset packs](https://static.makehumancommunity.org/assets/assetpacks.html): the middle-aged male skin, high-poly eyes, eyebrow001, eyelashes01, teeth_base, short04 hair, shoes06, and Toigo's basic tucked T-shirt. Sports shorts were constructed from the weighted body surface. See `source/asset-provenance.json` for exact paths and attribution. The assets are CC0; MPFB's software licence is GPL and the bundled Three.js loader/exporter code is MIT.

## Fal status

Fal rejected the original image-to-3D request before submission because the connected account balance was exhausted. No paid generation job was created. The user explicitly requested this Blender route while that credit issue is unresolved. These deliverables work locally without Fal. `source/generation-plan.json` preserves the attempted generation parameters for future reference.

## Content status

The nine guides are drafts for clinical review. Animation quality does not establish tracking accuracy or suitability for an individual patient. The patient's prescribed plan determines range, hold times, repetitions and progression. See the parent guide README for the NHS movement sources and review notes.
