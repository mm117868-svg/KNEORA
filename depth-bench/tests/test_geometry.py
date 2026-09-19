"""Checks the bench maths without a camera, using constructed geometry.

The point of the third test is the whole premise of the instrument: as the leg
turns out of the image plane, the projected angle drifts and the measured one
does not. If that ever stops being true, the depth camera is not earning its
place and these checks should fail loudly.
"""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from depth_bench.geometry import (
    knee_angle_2d, knee_angle_3d, deproject, patch_depth, surface_to_centre,
    out_of_plane_deg, evaluate_frame, summarise, RULES,
)
from depth_bench import export

INTR = {"fx": 900.0, "fy": 900.0, "ppx": 640.0, "ppy": 360.0}
THIGH, SHANK = 0.42, 0.40


def leg(bend_deg, yaw_deg=0.0, distance=2.5):
    """A leg at a known knee bend, rotated by yaw about the vertical axis.

    Hip above knee, ankle swung forward by the bend. yaw of zero is square to
    the camera, which is the only case the projected angle can get right.
    """
    knee = [0.0, 0.0, distance]
    hip = [0.0, -THIGH, distance]
    theta = math.radians(180.0 - bend_deg)          # interior angle at the knee
    ankle_local = [SHANK * math.sin(theta), -SHANK * math.cos(theta), 0.0]
    c, s = math.cos(math.radians(yaw_deg)), math.sin(math.radians(yaw_deg))
    def rot(p):
        return [p[0] * c, p[1], p[0] * s]
    ankle = [knee[i] + rot(ankle_local)[i] for i in range(3)]
    hip = [knee[0], hip[1], knee[2]]
    return hip, knee, ankle


def project(p):
    return [INTR["fx"] * p[0] / p[2] + INTR["ppx"], INTR["fy"] * p[1] / p[2] + INTR["ppy"]]


class Geometry(unittest.TestCase):
    def test_three_dimensional_angle_matches_the_construction(self):
        for bend in (0, 30, 60, 90, 120):
            hip, knee, ankle = leg(bend)
            self.assertAlmostEqual(knee_angle_3d(hip, knee, ankle), bend, places=6)

    def test_deprojection_round_trips_through_the_camera(self):
        hip, knee, ankle = leg(75.0)
        back = [deproject(*project(p), p[2], INTR) for p in (hip, knee, ankle)]
        self.assertAlmostEqual(knee_angle_3d(*back), 75.0, places=4)

    def test_the_projected_angle_drifts_off_axis_and_the_measured_one_does_not(self):
        # 60 degrees, not 90: a right angle with the thigh vertical is the one
        # case where this rotation leaves the projection untouched, so testing
        # at 90 would prove nothing.
        truth = 60.0
        drifts = []
        for yaw in (0, 15, 30, 45):
            hip, knee, ankle = leg(truth, yaw_deg=yaw)
            measured = knee_angle_3d(hip, knee, ankle)
            projected = knee_angle_2d(*[project(p) for p in (hip, knee, ankle)])
            self.assertAlmostEqual(measured, truth, places=4)
            drifts.append(abs(projected - truth))
        self.assertLess(drifts[0], 0.01)        # square on, the projection is right
        self.assertGreater(drifts[-1], 5.0)     # at 45 degrees off axis it is not
        self.assertEqual(drifts, sorted(drifts))

    def test_out_of_plane_angle_reports_the_lean(self):
        hip, knee, ankle = leg(90.0, yaw_deg=30.0)
        self.assertIsNotNone(out_of_plane_deg(hip, ankle))
        self.assertGreater(out_of_plane_deg(hip, ankle), 5.0)

    def test_surface_correction_moves_away_from_the_camera(self):
        moved = surface_to_centre([0.0, 0.0, 2.5], 0.05)
        self.assertAlmostEqual(moved[2], 2.55, places=6)

    def test_patch_rejects_an_edge_and_accepts_a_surface(self):
        flat = [[2.5] * 11 for _ in range(11)]
        self.assertEqual(patch_depth(flat, 5, 5)["reason"], "")
        edge = [[2.5 if x < 5 else 4.0 for x in range(11)] for _ in range(11)]
        self.assertEqual(patch_depth(edge, 5, 5)["reason"], "patch_on_a_depth_edge")
        empty = [[0.0] * 11 for _ in range(11)]
        self.assertEqual(patch_depth(empty, 5, 5)["valid_fraction"], 0.0)


def frame(bend, yaw=0.0, visibility=(0.9, 0.9, 0.9), spoil=None):
    hip, knee, ankle = leg(bend, yaw_deg=yaw)
    if spoil == "knee_behind":
        knee = [knee[0], knee[1], knee[2] + 0.3]
    points_3d = [hip, knee, ankle]
    points_px = [project(p) for p in points_3d]
    good = {"z": 2.5, "spread": 0.004, "valid_fraction": 1.0, "reason": ""}
    patches = [dict(good) for _ in range(3)]
    if spoil == "no_depth":
        patches[2] = {"z": None, "spread": None, "valid_fraction": 0.1, "reason": "patch_mostly_empty"}
    record = evaluate_frame(points_3d, points_px, patches, visibility,
                            reference=(THIGH, SHANK))
    record["points_3d"] = points_3d
    record["points_px"] = points_px
    record["time_ms"] = 0
    return record


class Gates(unittest.TestCase):
    def test_a_clean_frame_is_measured_in_three_dimensions(self):
        record = frame(90.0)
        self.assertEqual(record["method"], "depth_3d")
        self.assertAlmostEqual(record["angle_3d"], 90.0, places=4)

    def test_a_joint_without_depth_falls_back_to_two_dimensions_and_says_so(self):
        record = frame(90.0, spoil="no_depth")
        self.assertEqual(record["method"], "mediapipe_2d")
        self.assertIsNone(record["angle_3d"])
        self.assertIn("ankle:patch_mostly_empty", record["reason"])

    def test_a_knee_behind_its_neighbours_is_treated_as_the_other_leg(self):
        record = frame(90.0, spoil="knee_behind")
        self.assertIn("knee:other_leg", record["reason"])
        self.assertIsNone(record["angle_3d"])

    def test_a_segment_that_changes_length_is_rejected(self):
        hip, knee, ankle = leg(90.0)
        ankle = [ankle[0] * 1.4, ankle[1] * 1.4, ankle[2]]
        patches = [{"z": 2.5, "spread": 0.004, "valid_fraction": 1.0, "reason": ""} for _ in range(3)]
        record = evaluate_frame([hip, knee, ankle], [project(p) for p in (hip, knee, ankle)],
                                patches, (0.9, 0.9, 0.9), reference=(THIGH, SHANK))
        self.assertIn("shank:length_changed", record["reason"])
        self.assertIsNone(record["angle_3d"])

    def test_low_visibility_alone_still_allows_a_reading_but_is_recorded(self):
        record = frame(90.0, visibility=(0.9, 0.9, 0.2))
        self.assertIn("ankle:low_visibility", record["reason"])

    def test_the_summary_keeps_the_two_methods_apart(self):
        frames = [frame(90.0) for _ in range(6)] + [frame(90.0, spoil="no_depth")]
        summary = summarise(frames)
        self.assertEqual(summary["depth_3d"]["accepted"], 6)
        self.assertEqual(summary["mediapipe_2d"]["accepted"], 1)
        self.assertEqual(summary["sampled"], 7)


class Exports(unittest.TestCase):
    context = {"patient_id": "P001", "operation_date": "2026-08-20", "date": "2026-09-19",
               "side": "left", "motion": "bend", "mode": "active", "position": "supine"}
    device = {"model": "Intel RealSense D415 s/n 000", "calibration": "factory, 2026-09-19"}

    def test_the_export_carries_what_the_importer_demands(self):
        frames = [frame(90.0) for _ in range(6)]
        for i, f in enumerate(frames):
            f["time_ms"] = i * 50
        payload = export.depth_export(frames, self.context, self.device, "group-1", export.now_rfc3339())
        self.assertEqual(payload["schema"], "knee-depth-endpoint-v1")
        self.assertEqual(payload["source"]["coordinates"], "depth-derived-joint-centres")
        self.assertEqual(payload["units"], "m")
        for field in export.CONTEXT_FIELDS:
            self.assertEqual(payload[field], self.context[field])
        first = payload["frames"][0]
        self.assertTrue(first["valid"])
        self.assertEqual(len(first["hip"]), 3)
        thigh = math.dist(first["hip"], first["knee"])
        self.assertTrue(0.1 <= thigh <= 0.8)

    def test_a_missing_context_field_fails_before_the_file_is_written(self):
        broken = dict(self.context, side="")
        with self.assertRaises(ValueError):
            export.depth_export([frame(90.0)], broken, self.device, "g", export.now_rfc3339())

    def test_the_import_check_warns_about_a_short_or_wandering_hold(self):
        self.assertIn("fewer than 5 usable depth frames",
                      export.will_import([frame(90.0) for _ in range(3)])["problems"])
        wandering = [frame(80.0 + i * 3) for i in range(8)]
        problems = export.will_import(wandering)["problems"]
        self.assertTrue(any("8 degree limit" in p for p in problems))
        steady = [frame(90.0) for _ in range(8)]
        self.assertTrue(export.will_import(steady)["accepted"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
