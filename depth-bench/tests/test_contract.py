"""The bench's side of the contract with the app, and its place in the repository.

The app's side is tests/depth-bench-contract.test.mjs at the repository root.
Both read the same fixture, so neither half can change the file format alone.
"""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))

import contract_fixture                      # noqa: E402
from depth_bench import capture, export      # noqa: E402
from depth_bench.geometry import knee_angle_3d, knee_angle_2d, summarise  # noqa: E402


def same(a, b, tolerance=1e-9):
    """Equal in shape and text, and equal to a nanometre in the numbers.

    Sines and cosines can differ in the last binary place between one machine's
    maths library and another's, and the fixture is written on one and checked on
    several.
    """
    if isinstance(a, bool) or isinstance(b, bool):
        return a is b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) <= tolerance
    if isinstance(a, dict) and isinstance(b, dict):
        return list(a) == list(b) and all(same(a[k], b[k], tolerance) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(same(x, y, tolerance) for x, y in zip(a, b))
    return a == b


class Contract(unittest.TestCase):
    def test_the_exporter_still_writes_the_checked_in_fixture(self):
        with open(contract_fixture.PATH, encoding="utf-8") as handle:
            on_disk = json.load(handle)
        self.assertTrue(same(on_disk, json.loads(json.dumps(contract_fixture.build()))),
                        "The export format changed. If that was intended, run "
                        "python3 depth-bench/tests/contract_fixture.py --write, then make test.")

    def test_the_comparison_notices_a_real_change(self):
        with open(contract_fixture.PATH, encoding="utf-8") as handle:
            on_disk = json.load(handle)
        for change in (lambda d: d.update(units="mm"), lambda d: d["frames"].pop(),
                       lambda d: d["frames"][0]["knee"].__setitem__(2, 2.501),
                       lambda d: d["frames"][0].update(valid=False), lambda d: d.pop("side")):
            altered = json.loads(json.dumps(on_disk))
            change(altered)
            self.assertFalse(same(on_disk, altered))

    def test_the_fixture_is_a_hold_the_app_should_accept(self):
        frames = contract_fixture.frames()
        verdict = export.will_import(frames)
        self.assertTrue(verdict["accepted"], verdict["problems"])
        self.assertEqual(verdict["usable"], 11)
        self.assertLess(verdict["spread"], 8.0)

    def test_the_fixture_shows_what_the_camera_is_for(self):
        # Off axis the projected angle is wrong by several degrees and the measured one is not.
        summary = summarise(contract_fixture.frames())
        self.assertAlmostEqual(summary["depth_3d"]["mean"], contract_fixture.TRUE_BEND, places=6)
        self.assertEqual(summary["depth_3d"]["accepted"], 11)
        self.assertGreater(abs(summary["mediapipe_2d"]["mean"] - contract_fixture.TRUE_BEND), 5.0)

    def test_the_refused_frame_carries_no_coordinates(self):
        payload = contract_fixture.build()
        refused = [f for f in payload["frames"] if not f["valid"]]
        self.assertEqual(len(refused), 1)
        self.assertEqual(refused[0]["knee"], [0, 0, 0])
        for frame in payload["frames"]:
            if frame["valid"]:
                self.assertIsNotNone(knee_angle_3d(frame["hip"], frame["knee"], frame["ankle"]))

    def test_the_seven_context_fields_travel_with_the_file(self):
        payload = contract_fixture.build()
        for field in export.CONTEXT_FIELDS:
            self.assertEqual(payload[field], contract_fixture.CONTEXT[field])
        self.assertEqual(payload["schema"], "knee-depth-endpoint-v1")
        self.assertEqual(payload["source"]["coordinates"], "depth-derived-joint-centres")


class PlaceInTheRepository(unittest.TestCase):
    def test_the_bench_uses_the_pose_model_the_app_serves(self):
        self.assertTrue(os.path.isfile(capture.DEFAULT_MODEL), capture.DEFAULT_MODEL)
        self.assertEqual(os.path.relpath(capture.DEFAULT_MODEL, capture.REPO_DIR),
                         os.path.join("models", "pose_landmarker_full.task"))
        self.assertTrue(os.path.isfile(os.path.join(capture.REPO_DIR, "index.html")),
                        "REPO_DIR should be the folder that holds the patient app")

    def test_captures_stay_inside_the_bench_folder_and_out_of_git(self):
        args = capture.build_parser().parse_args(["--patient", "P001", "--op-date", "2026-08-20", "--side", "left"])
        self.assertEqual(args.out, os.path.join(capture.BENCH_DIR, "captures"))
        self.assertEqual(args.model, capture.DEFAULT_MODEL)
        with open(os.path.join(capture.REPO_DIR, ".gitignore"), encoding="utf-8") as handle:
            self.assertIn("depth-bench/captures/", handle.read().split())

    def test_the_two_dimensional_angle_is_the_apps_sum(self):
        # Pixels in, flexion out, 0 is straight: the same convention as kneeFlexionDeg in kneerec.js.
        self.assertAlmostEqual(knee_angle_2d([440, 400], [640, 200], [840, 400]), 90.0, places=6)
        self.assertAlmostEqual(knee_angle_2d([100, 100], [200, 100], [300, 100]), 0.0, places=6)


if __name__ == "__main__":
    unittest.main()
