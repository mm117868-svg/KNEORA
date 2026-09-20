# Depth bench

One RealSense D415 on a tripod and a MacBook, measuring the knee twice at the
same instant: once from the colour image the way the product does today, once
from depth in metres. The pair is the instrument. Neither half on its own tells
you when it is wrong.

This is a bench instrument, not the product. It exists to say how wrong the
webcam is, under which conditions, and by how much.

## Install, in order of least effort

The official `pyrealsense2` package on PyPI has Linux and Windows builds only
(checked at 2.58.4, 30 August 2026), so on a Mac one of these two has to work.
Stop at the first that opens the camera.

```bash
cd depth-bench                                   # inside your clone of this repository
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt        # mediapipe and numpy, always needed
```

1. Prebuilt macOS packages from cansik, which install the `pyrealsense2` module
   this code imports. Apple Silicon, macOS 15 or later:
   `.venv/bin/pip install pyrealsense2-macosx`
2. Build librealsense from source, following the LightBuzz macOS guide, then
   point the virtual environment at the built `pyrealsense2`.

`realsense-applesilicon` is not an option here: it installs a different module
(`realsense.wrapper`) with its own interface, and `capture.py` would not find
`pyrealsense2`.

Check it opened:

```bash
.venv/bin/python -c "import pyrealsense2 as rs; print(rs.context().query_devices())"
```

If the list comes back empty with the camera plugged in, run the same line with
`sudo`. Since librealsense 2.50 some versions of macOS only show the device to
a process running as root, and cansik's notes say the same. The two open crash
reports on M series Macs (librealsense issues 14302 and 14648) are both in the
motion sensor start-up of the D455 and D435i. The D415 has no motion sensor, so
it may not be affected, but that is untested here.

Plug the camera into a MacBook port directly, with a USB 3 cable. RealSense is
unreliable through hubs and docks, a charging cable will drop it to USB 2 and a
low frame rate, and both look exactly like a broken camera.

On a Linux machine none of this applies: `pip install pyrealsense2`.

## Run a capture

```bash
.venv/bin/python -m depth_bench.capture \
  --patient P001 --op-date 2026-08-20 --side left --motion bend
```

The pose model is `../models/pose_landmarker_full.task`, the file the patient
app serves, so both halves of the repository find joints with the same model.
Pass `--model` to try another.

It calibrates the limb lengths from three seconds of still frames, waits for
Enter, captures a 1.4 second hold to match the app's own burst, and writes two
files into `depth-bench/captures/`, which git ignores:

- `..._depth.json`, the `knee-depth-endpoint-v1` file the recovery summary
  already imports, so a reading reaches the app with no change to it
- `..._fused.json`, both angle series with the per frame evidence, sharing one
  capture reference and one timestamp

The seven context fields have to match what is on screen in the app when you
import, or the importer rejects the file. The tool checks them before it writes.

For a jig run, add `--reference 60` and it prints the error against the jig.

## What it will not do yet

- The surface to joint centre correction is off by default (`--limb-radius 0,0,0`).
  The deprojected landmark sits on the front of the limb, not at the joint
  centre. Measure that offset on the jig first, then set it. Guessing it is
  worse than leaving it out, because at least the omission is a known bias.
- No video is recorded. Joint coordinates only.
- No continuous exercise capture. One hold at a time, which is what the app's
  recovery summary takes.

## Before the camera arrives

The maths runs without hardware:

```bash
python3 -m unittest discover -s tests -v
```

Or `make test-depth` from the repository root. The checks run on constructed
geometry. The one that matters is
`test_the_projected_angle_drifts_off_axis_and_the_measured_one_does_not`: at 45
degrees off axis a real 60 degree bend projects as 50.8, and the depth reading
stays at 60. If that check ever stops passing, the camera is not earning its
place.

## How it is tied to the app

`tests/fixtures/knee-depth-endpoint-v1.sample.json` is one constructed hold,
written by `depth_bench/export.py`: a real 60 degree bend seen from 45 degrees
off square, eleven good frames and one the bench refuses. Two tests read it.

- `tests/test_contract.py` checks the exporter still writes exactly that file.
- `../tests/depth-bench-contract.test.mjs` checks the app's importer still
  accepts it, reads 60 degrees from it, refuses it for the wrong patient, knee
  or day, and that the acceptance rules repeated in `export.py` are still the
  importer's own.

So a change to the file format, or to the rules, on one side only fails
`make test`. After an intended change, write the fixture again with
`python3 depth-bench/tests/contract_fixture.py --write`.

## Bench protocol, short card

Rigid jig at 0, 30, 60, 90 and 120 degrees, read with a goniometer, five repeats
each. Distances 1.5, 2.5 and 3.5 m. Camera axis at 0, 15, 30 and 45 degrees off
square. Daylight, one warm lamp, dim room. Bare leg, light shorts, dark
trousers, leg part covered by a blanket. Then three volunteers, bending and
straightening, three times each, repeated on another day.

Report agreement as Bland and Altman limits of agreement, not correlation.
Correlation will look excellent and will mean nothing.

Targets set in advance: depth within 5 degrees of the goniometer across the
range, within hold standard deviation under 2 degrees, and the depth reading
moving less than 3 degrees between square on and 45 degrees off axis. If the
last one fails, the case for depth in this product is weak.

## Two things to hold to

Measuring depth with a sensor built to measure it is not inferring depth from
how short a limb looks. Using the measured segment lengths as a quality gate is
a validity check and is what this code does. Using them to correct the two
dimensional angle is a different technique, and it is deliberately not
implemented here.

The 8 degree spread limit in the app's importer is stricter than anything the
live camera path applies, and real depth jitter across a hold may exceed it.
The tool tells you the spread it achieved, so set that rule from measurement
rather than from the placeholder it currently is.

## Live depth versus height comparison

After installing the dependencies above, double-click `../Open Intel comparison.command`. This opens a local page with automatic image correction, the complete RGB field, knee surface distance, a separate height-based planar estimate, differences and JSON export. See `../CAMERA_COMPARISON.md`. The ordinary static server does not provide this depth connection. Close other apps using the RealSense before starting.

This mode is experimental and has software tests only until the actual camera is checked. Height supplies body-proportion priors; weight is context, not a joint-position correction.
