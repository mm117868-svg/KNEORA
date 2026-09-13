# Small movement mode

Select **Small movements (early rehabilitation)** under **Settings > Count repetitions by**. Existing saved preferences are preserved. New settings start with this option. Recorded analysis automatically receives the session's selected mode, and the standalone analyser has an equivalent checkbox.

The optical tracker uses a 640-pixel working image instead of 160 pixels and a 0.35-pixel swing threshold instead of 1.2 pixels. It follows coherent moving image points within the leg box, with the first outward direction setting the swing polarity. Optical events remain candidates: the selected hip, knee and ankle must confirm a complete movement out and back. Pose alone cannot increment the live count.

Hold the starting position briefly. The live gate uses 1.2 seconds of still samples to estimate landmark jitter. Minimum excursion is the largest of 1.2% of visible leg length, six times observed jitter, and two source-image pixels. This replaces the normal 10% excursion requirement for this mode. Return and onset thresholds adapt separately. A short pose gap discards an unfinished cycle.

Recorded analysis estimates angle noise from the first 1.2 seconds. A complete small attempt must exceed the larger of 1.5 degrees or six times estimated resting noise, then return towards its starting position. Gaps and unclear starting positions remain unmeasured. These are prototype detection parameters, not clinical range targets or validated accuracy limits. Small-movement attempts do not receive an automated clinical SLR grade.

Constructed two-degree sequences for straight leg raise and seated extension pass the live confirmation checks. Constructed two-degree sequences for all three supported exercises pass video segmentation with quiet baselines, while noisy baselines are withheld. This is algorithm verification, not evidence that two degrees can be measured reliably with a real camera at 3 to 5 metres. Cropping, occlusion, lighting, image resolution and landmark jitter can still prevent counting. Very small movements below the available signal cannot be recovered just by lowering a threshold.

`node tests/browser-small-optical.cjs` runs the actual optical-flow library on generated textures. A three-pixel movement out and back counts in either initial direction; a stationary texture remains at zero. The normal tracker does not detect that same small motion. These generated images contain no patient data and are not equivalent to camera validation.
