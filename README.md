# Knee Recovery (test build)

Static copy of the browser version of Knee Recovery (Cambridge Kinematics).
`index.html` is the patient app, `bench.html` the bench page with every
control exposed, `report.html` the physio report built from the records the
browser holds. `kneerec.js` holds two layers: MediaPipe Pose for a
whole-session knee angle, a pixel-motion counter for repetitions, written
side by side and never joined. `voicecount.js` is the patient's own count: the
patient says the number of each repetition and a word spotter on the device
hears it. `kneetrack.js` is a steadier counter from the picture alone, which
follows points on the knee and counts one repetition for each full swing.
The counting method is chosen on the home page; movement in the box is always
counted underneath as a cross-check. Everything runs in the visitor's browser; no
video leaves the device. No passcode gate; noindex.

Serve with GitHub Pages (Settings > Pages > Deploy from branch, root).
Built by `tools/pages.py` in the knee-recovery folder; edit there, not here.

## Recorded exercise analyser

`video-analysis/` contains the standalone recorded straight leg raise analyser, with local MediaPipe assets, per-joint measurements, frame-quality filtering, TXT/CSV/JSON reports and an explicitly unvalidated SLR video estimate. Clinical QAB entries remain separate. Videos stay in the browser. Open `video-analysis/` from the home-page footer or see `video-analysis/README.md` for local setup, methods and limitations.

The recorded analyser is maintained as a separate addition to this static build. Future regeneration with `tools/pages.py` should preserve this directory and its footer link.

Run its tests with `node --test video-analysis/analysis.test.mjs`.
