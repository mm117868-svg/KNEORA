# Intel depth and height-based comparison

Open `Open Intel comparison.command`, enter adult height in centimetres, optional weight in kilograms, and the operated side. Start opens the RealSense colour and depth streams on this computer. Stop or closing the page releases them; a disconnected client expires after ten seconds. Do not open the same camera in another app simultaneously.

The normal static/GitHub Pages app cannot access RealSense depth through getUserMedia. The comparison requires the local SDK service and the dependencies in `depth-bench/README.md`. Start the launcher from Terminal for macOS camera permission. No physical-camera success has been established by the software tests.

## The two methods

1. Intel depth: depth is aligned to the colour image. The existing patch-quality checks reject missing or inconsistent depth near the detected knee. The distance is the Euclidean norm of the knee surface coordinate, rather than axial Z alone. It measures the visible surface around a model-selected landmark, not an internal joint centre.
2. Height-based estimate: expected thigh and shank lengths are 0.245 and 0.246 times entered height. These are explicit population-proportion engineering priors, not patient-specific dimensions. Calibrated image rays and a least-squares equal-depth-plane fit estimate a common scale. Both thigh and shank must give broadly consistent scale. The 25% consistency threshold is an engineering gate, not a confidence interval. This method uses no measured depth to set its scale. Height scales the coordinates and distance, not the planar bend angle; that angle remains an image-plane baseline. Weight is retained as context only; there is no supported weight-to-joint-location correction here.

Both methods share RGB landmark detection and are therefore not independent validation references. The height model assumes the leg is parallel to the image plane. Out-of-plane movement, unusual proportions, clothing and landmark errors can bias it. It cannot recover hidden internal joint centres. There is no automatic correction of measurements, averaging between methods, diagnosis or treatment recommendation.

The display reports estimate minus depth and retains the most recent 1,800 frame records. Downloaded JSON includes both coordinate sets, height/weight, source labels, device and capture times, with no colour images. No result is automatically written into the patient's clinical measurement history.

## Evidence and parameter provenance

- Winter, *Biomechanics and Motor Control of Human Movement*, anthropometry: the conventional thigh/shank stature proportions are used here only as initial engineering priors. They are reproduced in the University of Tennessee [anthropometry worksheet](https://rrg.utk.edu/resources/BME473/assignments/BME473_homework_4.pdf). The worksheet is a parameter cross-check, not validation of this estimator.
- Hara et al., 2016, [Predicting the location of the hip joint centres, impact of age group and sex](https://pmc.ncbi.nlm.nih.gov/articles/PMC5121588/): CT data from 157 individuals support the use of anatomical dimensions such as leg length for a specific hip-centre regression. Those equations are not implemented here and do not validate this height-only model or knee-centre estimates.
- [RealSense projection documentation](https://dev.realsenseai.com/docs/projection-in-realsense-sdk-2-0/): explains calibrated pixels, depth and 3D coordinates. This comparison uses SDK deprojection for the surface points and unit-depth image rays, including the aligned colour intrinsics.

## Verification still required

Test with the actual camera, including full field of view, profile support, dropped frames, actual latency, and permission/device errors. Use a known-distance target and a separately measured joint/limb reference before judging which method is more accurate. Synthetic agreement is software evidence only.

## Height-informed 3D research fit (2026-09-21)

An opt-in third method uses participant-weighted mean radiographic bone lengths
from Simon et al. (2023), Tables 3 and 4, DOI 10.1038/s41598-023-34670-2,
PMID 37231033. Source tables retrieved from Europe PMC fullTextXML for
PMC10213042; numeric data and attribution are in
`evidence/stature-bone-lengths-2023.json` (CC BY 4.0).

Reference bins within 3 cm of entered height are pooled, weighted by published n.
At least 20 observations are required. Combined or explicitly selected study groups
are available; sex is never inferred. These grouped means do not provide individual
prediction intervals. No inverse stature regression is used.

The paper's maximum femoral length and tibial radiographic length are not the
camera's joint-centre distances. The experimental solver nevertheless uses them
as imperfect soft segment proxies, explicitly disclosed in the interface. It fits
three depths along the original surface-point viewing rays. The objective penalises
departure from measured axial depth (15 mm scale) and reference lengths (10% scale).
Coordinate search limits changes to 30 mm per axial depth; a boundary solution is
withheld. These are engineering choices, not calibrated uncertainties. Missing,
low-visibility, out-of-frame or unsynchronised depth is never filled from height.

Raw depth and the existing independent planar estimate are unchanged. The new fit
is DEPENDENT on Intel depth, and agreement is not validation. No changes are made
to clinical results or exercise-session angles. Exports include the fit, original
readings, reference provenance and parameter values. No repeated-frame personal
calibration is implemented. Test against an independent reference before selecting
this approach for patient measurements; synthetic tests establish implementation
behaviour only, not improved accuracy.
