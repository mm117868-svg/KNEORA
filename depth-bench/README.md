# Depth bench

One RealSense D415 on a tripod and a MacBook, measuring the knee twice at the
same instant: once from the colour image the way the product does today, once
from depth in metres. The pair is the instrument. Neither half on its own tells
you when it is wrong.

This is a bench instrument, not the product. It exists to say how wrong the
webcam is, under which conditions, and by how much.

## Install, in order of least effort

The camera has no official macOS support, so one of these three has to work.
Try them in this order and stop at the first that opens the camera.

```bash
cd ~/"AI TeleRehab/depth-bench"
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt        # mediapipe and numpy, always needed
```

1. Prebuilt Apple Silicon wheel:
   `.venv/bin/pip install realsense-applesilicon`
2. Prebuilt macOS packages from cansik:
   `.venv/bin/pip install pyrealsense2-macosx`
3. Build librealsense from source, following the LightBuzz macOS guide, then
   point the virtual environment at the built `pyrealsense2`.

Check it opened:

```bash
.venv/bin/python -c "import pyrealsense2 as rs; print(rs.context().query_devices())"
```

Plug the camera into a MacBook port directly. RealSense is unreliable through
hubs and docks, and a bad hub looks exactly like a broken camera.

## Run a capture

```bash
.venv/bin/python -m depth_bench.capture \
  --patient P001 --op-date 2026-08-20 --side left --motion bend
```

It calibrates the limb lengths from three seconds of still frames, waits for
Enter, captures a 1.4 second hold to match the app's own burst, and writes two
files into `captures/`:

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

Fifteen checks on constructed geometry. The one that matters is
`test_the_projected_angle_drifts_off_axis_and_the_measured_one_does_not`: at 45
degrees off axis a real 60 degree bend projects as 50.8, and the depth reading
stays at 60. If that check ever stops passing, the camera is not earning its
place.

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
