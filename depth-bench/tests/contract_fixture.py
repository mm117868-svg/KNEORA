"""The one file both halves of the repository are tested against.

fixtures/knee-depth-endpoint-v1.sample.json is what depth_bench.export writes for
a constructed hold: a real 60 degree bend, seen from 45 degrees off square at
2.5 m, eleven good frames and one where the knee patch straddles the edge of the
limb. test_contract.py checks that the exporter still produces exactly this
file. tests/depth-bench-contract.test.mjs at the repository root checks that the
app's importer still accepts it and reads 60 degrees from it.

If the export format changes on purpose, write the file again and run both:

    python3 depth-bench/tests/contract_fixture.py --write
    make test
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from depth_bench import export                      # noqa: E402
from depth_bench.geometry import evaluate_frame    # noqa: E402
from test_geometry import leg, project             # noqa: E402

PATH = os.path.join(HERE, "fixtures", "knee-depth-endpoint-v1.sample.json")
CONTEXT = {"patient_id": "BENCH-FIXTURE", "operation_date": "2026-08-20", "date": "2026-09-19",
           "side": "left", "motion": "bend", "mode": "active", "position": "supine"}
DEVICE = {"model": "Intel RealSense D415 s/n FIXTURE", "calibration": "factory, constructed fixture"}
CAPTURE_GROUP = "00000000-0000-4000-8000-000000000001"
CAPTURED_AT = "2026-09-19T10:00:00.000Z"
TRUE_BEND = 60.0
YAW = 45.0
# The hold wanders a degree either side of the true bend and averages to it exactly.
OFFSETS = [-1.0, -0.8, -0.6, -0.4, -0.2, 0.0, 0.2, 0.4, 0.6, 0.8, 1.0]

GOOD_PATCH = {"z": 2.5, "spread": 0.004, "valid_fraction": 1.0, "reason": ""}
EDGE_PATCH = {"z": 2.5, "spread": 0.060, "valid_fraction": 1.0, "reason": "patch_on_a_depth_edge"}


def frames():
    out = []
    for i, offset in enumerate(OFFSETS):
        points = leg(TRUE_BEND + offset, yaw_deg=YAW)
        record = evaluate_frame(list(points), [project(p) for p in points], [GOOD_PATCH] * 3, [0.9, 0.9, 0.9])
        record.update({"time_ms": i * 100, "points_3d": [list(p) for p in points]})
        out.append(record)
    # One frame the bench must refuse: the knee landmark sits on the edge of the limb.
    points = leg(TRUE_BEND, yaw_deg=YAW)
    record = evaluate_frame([points[0], None, points[2]], [project(p) for p in points],
                            [GOOD_PATCH, EDGE_PATCH, GOOD_PATCH], [0.9, 0.9, 0.9])
    record.update({"time_ms": len(OFFSETS) * 100, "points_3d": None})
    out.append(record)
    return out


def build():
    return export.depth_export(frames(), CONTEXT, DEVICE, CAPTURE_GROUP, CAPTURED_AT)


if __name__ == "__main__":
    if "--write" not in sys.argv:
        sys.exit("Pass --write to replace %s" % PATH)
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    size = export.write(PATH, build())
    print("Wrote %s, %d bytes" % (PATH, size))
