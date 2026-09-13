# Fitness-avatar refinement preview

Seated knee-extension preview, September 2026. This is a local comparison, not a replacement for the published guides.

The character is rebuilt from the existing MPFB/MakeHuman source assets with adjusted age, body proportions and mouth target, increased skin and clothing subdivision, neutral footwear and revised materials. The existing game-engine bone hierarchy is retained. This is not a new anatomical rig, photorealistic reconstruction or independently assessed clinical demonstration.

The scene uses a simpler rounded upholstered chair with timber legs, softer lighting and a revised camera. `render-v2.html` maps the 70-second Marin schedule back to the original 57-second animation schedule. The video copies the published seated-extension audio stream without new speech generation.

`build.py` uses the same asset provenance as `../source/asset-provenance.json`. Set FITNESS_TOOLS_DIR to the existing character-tools directory and FITNESS_OUTPUT_DIR to this directory, then run Blender in background mode with `--python build.py`. `fitness-avatar-editable.blend` contains the editable character; the browser scene and animation are defined in `avatar.js`. Detailed hair, face expression and trainer geometry remain opportunities for a further modelling pass.

Preview: `index.html`. Renderer: `../../render-v2.html`. Video renderer: `../../source/render-v2.cjs`, with GUIDES_ONLY=seated_extension and the local service URL and FFmpeg paths set. Keep this candidate separate until its appearance and motion have been reviewed.
