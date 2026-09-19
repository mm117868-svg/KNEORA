# Live tracking area and skeleton

The automatic counting rectangle covers at least 85% of the camera width and height. It includes the selected hip, knee and ankle with extra movement space, and stays within the image. The starting rectangle is also broad. Manual drawing remains available. The optical counter still requires selected-leg confirmation before an event can count.

Small movements mode uses a 14 by 14 grid so enlarging the rectangle does not leave the same few points spread too far apart. A generated three-pixel out-and-back texture movement passes with the wide region in either starting direction; a stationary texture produces no event. This is algorithm verification, not a home-camera accuracy result.

## What is drawn over the picture

Only the operated leg is outlined: its hip, knee and ankle, the three joints the angle comes from. The pose model still returns the whole body, but the other leg, the trunk, the arms and the face are never drawn. A raised hand is ringed while it is being held up. It is read from the same pose result (`raised-hand.mjs`): the separate hand models have been removed, because they cost more than the leg tracking they sat beside and the video stuttered for it. The Start button and the space bar start the same countdown with no model at all. `tests/operated-leg-overlay.test.mjs` runs the real preview loop with a whole-body result and checks where ink lands.

The joints that are drawn come from the One Euro filter the angle trace already uses (`JointFilter` in `kneerec.js`): it follows a moving leg closely and holds a still one steady. This affects only the displayed coordinates. The original pose results still feed angle measurements. A missing joint is never reconstructed.

### How the outline moves

Pose results arrive between three and thirty times a second, unevenly, and each describes a picture that is already a little old. The screen refreshes sixty times a second and the video under the outline never stops. Drawn only when a result arrives, the outline moves in steps and trails the leg. `fluid-outline.mjs` repaints it on every refresh instead:

- Each joint is carried forward from the newest result along the line it was travelling, to the moment of drawing, for at most 0.12 seconds and a tenth of the picture height. The time the pose model took is part of what is made up, and so is the small delay of the One Euro filter the joints have been through, which the outline is told (`JointFilter.lagS`).
- A joint that is slowing is expected to stop, so it is carried only as far as the stop and does not run on past the end of a movement. A joint that is barely moving is not carried at all, so the jitter of a still leg is never turned into motion.
- The drawn point glides towards the carried point, so the correction made when a new result lands is spread over a few refreshes and never shows as a jump.
- The outline fades in when the leg is found, fades out where it was when the leg is lost, and is drawn fainter when the pose model is less sure of the joints. A leg that reappears somewhere else is drawn there, not dragged across the picture.
- An outline is only kept while the leg cannot have moved far from it. A result more than 450 milliseconds old is dropped if the leg was moving when last seen. If the leg was still, as it is while a patient settles into position, the result is kept until the next one is well overdue (at most three seconds), so a device that manages one result every second or two shows a steady outline on a still leg and nothing on a moving one.

`tests/fluid-outline.test.mjs` holds this to account against a joint whose true position is known, reported late, noisily and at uneven intervals. For an exercise-like movement of 250 pixels, with results 50 milliseconds old arriving 10 to 30 times a second, the outline stays 3 to 6 pixels from the joint where stepped drawing is 9 to 14 pixels away, the change of speed between refreshes is a quarter or less of what it was, the run-on at the turn of a movement stays under 5% of the stroke, and a still leg is drawn steadier than the results it is drawn from. These are generated movements, not recordings of patients. The preview now runs the pose as often as the device can afford, not on every third frame.

This is appearance only. Nothing here feeds the angle, the statistics, the record or a count, and the app reports no outcome differently because of it.

### The arc and the band at the knee

With the angle shown, a dashed line marks where the shin would lie with the knee straight, an arc runs from there to the shin, and the reading is written beside it. The arc spans exactly the bend the app reports.

A translucent wedge either side of the shin, and the `±` beside the reading, show how steady the displayed reading is: the 95% interval, by Student's t, of the readings of the last third of a second about their own straight-line trend (`trendCI95` in `confidence.mjs`). Taking the trend out first means a knee that is moving smoothly is not mistaken for an unsteady reading: the band is as narrow as the readings are clean and widens only when they disagree. It describes steadiness, not accuracy: a camera set off to one side moves every reading the same way and no interval worked out from the readings can see that. Consecutive video frames also lean on one another, which makes the band narrower than a true 95% interval; `tests/confidence.test.mjs` shows the 95% coverage with independent readings, still or moving, and the shortfall with readings that lean on one another as video frames do. A band narrower than half a degree is not drawn.

The recovery check draws the same outline, arc and band. Its saved result carries a 95% confidence interval of its own, described in `RECOVERY_MEASUREMENTS.md`.

## The picture itself

The picture is the camera's own video element, played by the browser. The canvas lies over it and is transparent apart from the outline. The page used to paint every camera frame onto the canvas itself, so the picture could only move as fast as the page's own processing allowed, and every pose or hand inference showed as a stutter. Now slow processing can delay the outline but cannot slow the picture. With a synthetic camera in a browser with no graphics processor, where inference kept the page busy for well over a second in every second, the browser still presented the video at 20 to 28 frames a second. The recovery check works the same way: each picture to be measured is copied to a canvas that is never shown and never drawn on.

While an inference is running the page cannot repaint, so on a slow device the outline is redrawn in bursts between inferences; each time it is drawn it is drawn where the leg is expected to be at that moment, not where it was. Running the pose model off the page's main thread would remove those gaps and has not been done. Nothing is recorded from the canvas: the saved video comes straight from the camera.

Checks cover jitter reduction, catch-up, unchanged input, missing joints, timestamp gaps, region bounds, the real optical-flow library on generated pixels, and browser recording and analysis using a synthetic camera.
