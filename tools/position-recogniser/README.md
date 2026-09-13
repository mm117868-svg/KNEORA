# Straight-leg-raise position recognition

A separate local research prototype, 13 September 2026. The existing CoTracker page and published patient app are unchanged.

Open http://127.0.0.1:8789/app/tools/position-recogniser/index.html after starting `start.command`. The helper serves static files only; image classification runs in the browser on the CPU. No camera frames are uploaded, no physical markers are used, and no point trajectories or pose angles enter the recogniser.

See [VALIDATION.md](./VALIDATION.md) for the measured results, including the unconfirmed browser return.

## Model and view requirements

The model is a small neural network with 1,024 inputs, 24 hidden units and three outputs: rest, intermediate position and raised. It uses a brightness-corrected grayscale difference from the starting image. The crop is fixed to the example lower-limb view; its leftmost ten of 32 image columns are excluded to reduce interference from the arm area in this view. This is not automatic anatomical localisation and does not establish working-leg identity. Mirrored views, different framing, both legs moving, other rooms and clothing require further work.

Training uses 24 manually inspected position labels from recording `01.39.33`. Each label is augmented with paired changes in brightness, rotation, scale and translation. Recording `02.04.17` is not used for fitting model weights, but it has been used to inspect development failures and guide augmentation changes. It is a development comparison, not untouched validation. Both clips show the same person in the same room.

An individual image does not establish movement direction. The image classifier supplies a position; the counter observes rest, then raised, then rest. The interface describes intermediate frames according to the preceding stable position. A raised hold does not repeatedly count. A long uncertain interval or missing-frame gap abandons the pending movement. A fresh resting position permits counting to resume without rebuilding the starting image.

This model has not learned a threshold for a two-degree movement. An attempted movement that never reaches its learned raised category can be missed. High classifier scores are not evidence of accuracy on unfamiliar images. The camera option is a research preview and does not save a patient session.

## Local data and reproduction

Set `KNEE_TRACKER_HOME` to the private evaluation directory if needed. It contains `manifest.json`, cached video frames and the existing Python runtime. The scripts default to the adjacent `knee-dis-evaluation` directory.

1. Run `train.py` with the installed `.venv-tapir/bin/python`. This reuses NumPy, OpenCV and PyTorch but does not load TAPIR or CoTracker.
2. Run `node tools/position-recogniser/evaluate.cjs` from the app repository.
3. Run `controls.py` for generated negative image sequences.
4. Run `browser-check.cjs` with Playwright available to replay both original videos through the actual browser classifier.
5. `node --test tests/position-recogniser.test.mjs` checks repetition-state handling separately from image recognition.

Model weights, sparse labels, predictions and synthetic-control outputs are written to `KNEE_TRACKER_HOME/position-recogniser/`, outside git. The recordings are never copied into the app repository or published.

The development page reports model results, not prescribed exercise completion. This work does not establish clinical validity, unsupervised home reliability, Raspberry Pi throughput, or performance at 3 to 5 metres. Broader labelled data and independent participant testing are still required before patient deployment.
