# Live tracking area and skeleton

The automatic counting rectangle covers at least 85% of the camera width and height. It includes the selected hip, knee and ankle with extra movement space, and stays within the image. The starting rectangle is also broad. Manual drawing remains available. The optical counter still requires selected-leg confirmation before an event can count.

Small movements mode uses a 14 by 14 grid so enlarging the rectangle does not leave the same few points spread too far apart. A generated three-pixel out-and-back texture movement passes with the wide region in either starting direction; a stationary texture produces no event. This is algorithm verification, not a home-camera accuracy result.

## What is drawn over the picture

Only the operated leg is outlined: its hip, knee and ankle, the three joints the angle comes from. The pose model still returns the whole body, but the other leg, the trunk, the arms and the face are never drawn. The hand is outlined while the open-palm gesture is being looked for. `tests/operated-leg-overlay.test.mjs` runs the real preview loop with a whole-body result and checks where ink lands.

The outline uses the One Euro filter that the angle trace already uses (`JointFilter` in `kneerec.js`): it follows a moving leg closely and holds a still one steady. It replaces the earlier average of six pose frames, which trailed the leg by up to half a second. This affects only the displayed coordinates. The original pose results still feed angle measurements. An outline older than 450 milliseconds is removed, and a missing joint is never reconstructed.

## The picture itself

The picture is the camera's own video element, played by the browser. The canvas lies over it and is transparent apart from the outline. The page used to paint every camera frame onto the canvas itself, so the picture could only move as fast as the page's own processing allowed, and every pose or hand inference showed as a stutter. Now slow processing can delay the outline but cannot slow the picture. With a synthetic camera in a browser with no graphics processor, where inference kept the page busy for well over a second in every second, the browser still presented the video at 20 to 28 frames a second. The recovery check works the same way: each picture to be measured is copied to a canvas that is never shown and never drawn on.

The trade is that the outline can sit slightly behind a fast-moving leg, by the time one inference takes. Nothing is recorded from the canvas: the saved video comes straight from the camera.

Checks cover jitter reduction, catch-up, unchanged input, missing joints, timestamp gaps, region bounds, the real optical-flow library on generated pixels, and browser recording and analysis using a synthetic camera.
