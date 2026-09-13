# Live tracking area and skeleton

The automatic counting rectangle covers at least 85% of the camera width and height. It includes the selected hip, knee and ankle with extra movement space, and stays within the image. The starting rectangle is also broad. Manual drawing remains available. The optical counter still requires selected-leg confirmation before an event can count.

Small movements mode uses a 14 by 14 grid so enlarging the rectangle does not leave the same few points spread too far apart. A generated three-pixel out-and-back texture movement passes with the wide region in either starting direction; a stationary texture produces no event. This is algorithm verification, not a home-camera accuracy result.

The exercise skeleton and highlighted leg both use the same average of up to six recent pose frames, with a maximum history age of 500 milliseconds. This affects only the displayed coordinates. The original pose results still feed angle measurements and repetition confirmation. Missing or uncertain joints disappear independently. Long gaps and large reacquisition jumps clear their old positions. Smoothing adds a short visual delay and does not reconstruct an unseen joint.

Checks cover jitter reduction, catch-up, unchanged input, missing joints, timestamp gaps, region bounds, the real optical-flow library on generated pixels, and browser recording and analysis using a synthetic camera.
