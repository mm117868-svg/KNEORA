"""One hold, captured from a RealSense D415 on the MacBook.

Colour and depth come from one device on one clock, depth is aligned to colour,
MediaPipe finds the joints once on the colour frame, and the depth branch reads
the same three pixels. Both angles therefore descend from one detection of one
frame, which is the whole point of the instrument.

Run it with run_bench.command, or from the depth-bench folder:

    .venv/bin/python -m depth_bench.capture --patient P001 --op-date 2026-08-20 \
        --side left --motion bend --date 2026-09-19

The pose model is the one the patient app serves, ../models/pose_landmarker_full.task,
so both halves of the repository find joints with the same file.

Nothing leaves the laptop. No video is written, only joint coordinates.
"""
import argparse
import os
import sys
import time

from . import export
from .geometry import (RULES, deproject, evaluate_frame, knee_angle_3d, patch_depth,
                       segment_lengths, summarise, surface_to_centre)

SIDES = {"left": (23, 25, 27), "right": (24, 26, 28)}
BENCH_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # .../depth-bench
REPO_DIR = os.path.dirname(BENCH_DIR)                                     # the repository root
DEFAULT_MODEL = os.path.join(REPO_DIR, "models", "pose_landmarker_full.task")
DEFAULT_OUT = os.path.join(BENCH_DIR, "captures")


def open_camera(width=1280, height=720, fps=30):
    """Start the streams with depth resampled into the colour camera's frame."""
    import pyrealsense2 as rs
    pipeline = rs.pipeline()
    config = rs.config()
    config.enable_stream(rs.stream.depth, width, height, rs.format.z16, fps)
    config.enable_stream(rs.stream.color, width, height, rs.format.bgr8, fps)
    profile = pipeline.start(config)
    sensor = profile.get_device().first_depth_sensor()
    scale = sensor.get_depth_scale()
    device = profile.get_device()
    info = {
        "model": "%s s/n %s" % (device.get_info(rs.camera_info.name),
                                device.get_info(rs.camera_info.serial_number)),
        "firmware": device.get_info(rs.camera_info.firmware_version),
        "sdk": rs.__version__ if hasattr(rs, "__version__") else "librealsense",
        "depth_to_colour": "aligned to colour, factory calibration",
        "calibration": "factory, read %s" % time.strftime("%Y-%m-%d"),
    }
    return pipeline, rs.align(rs.stream.color), scale, device, info


def landmarker(model_path):
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision
    options = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=model_path),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return vision.PoseLandmarker.create_from_options(options)


def read_frame(pipeline, align, scale, detector, side, timestamp_ms, radii=(0.0, 0.0, 0.0), on_frame=None):
    """One frame pair to one frame record. Returns None when no pose is found."""
    import numpy as np
    import mediapipe as mp
    import pyrealsense2 as rs

    frames = align.process(pipeline.wait_for_frames())
    colour_frame = frames.get_color_frame()
    depth_frame = frames.get_depth_frame()
    if not colour_frame or not depth_frame:
        return None

    colour = np.asanyarray(colour_frame.get_data())
    depth_m = np.asanyarray(depth_frame.get_data()).astype("float32") * scale
    height, width = depth_m.shape

    rgb = colour[:, :, ::-1].copy()
    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = detector.detect_for_video(image, int(timestamp_ms))
    if not result.pose_landmarks:
        if on_frame: on_frame(colour, None)
        return None
    marks = result.pose_landmarks[0]

    intr = colour_frame.profile.as_video_stream_profile().intrinsics
    intrinsics = {"fx": intr.fx, "fy": intr.fy, "ppx": intr.ppx, "ppy": intr.ppy}

    points_px, patches, points_3d, visibility = [], [], [], []
    for index, radius in zip(SIDES[side], radii):
        mark = marks[index]
        u, v = mark.x * width, mark.y * height
        points_px.append([u, v])
        visibility.append(getattr(mark, "visibility", None))
        if 0 <= u < width and 0 <= v < height:
            window, cu, cv = _window(depth_m, u, v)
            patch = patch_depth(window, cu, cv)
        else:
            patch = {"z": None, "spread": None, "valid_fraction": 0.0, "reason": "outside_frame"}
        patches.append(patch)
        if patch["z"] and not patch["reason"]:
            points_3d.append(surface_to_centre(deproject(u, v, patch["z"], intrinsics), radius))
        else:
            points_3d.append(None)

    record = evaluate_frame(points_3d, points_px, patches, visibility, reference=read_frame.reference)
    record.update({
        "points_3d": points_3d, "points_px": points_px,
        "colour_ts": colour_frame.get_timestamp(), "depth_ts": depth_frame.get_timestamp(),
        "intrinsics": intrinsics,
        "surface_points_3d": [rs.rs2_deproject_pixel_to_point(intr, p, patch["z"]) if patch["z"] and not patch["reason"] else None for p, patch in zip(points_px, patches)],
        "image_rays": [rs.rs2_deproject_pixel_to_point(intr, p, 1.0) for p in points_px],
        "image_size": [width, height],
    })
    if on_frame: on_frame(colour, record)
    return record


read_frame.reference = None


def _window(depth_m, u, v, half=RULES.patch_half):
    """The patch around a landmark, in metres, with the landmark's place in it.

    Returned as a small list of lists so the same patch code runs here and in
    the tests, where there is no numpy array and no camera.
    """
    height, width = depth_m.shape
    u, v = int(round(u)), int(round(v))
    y0, y1 = max(0, v - half), min(height, v + half + 1)
    x0, x1 = max(0, u - half), min(width, u + half + 1)
    return depth_m[y0:y1, x0:x1].tolist(), u - x0, v - y0


def calibrate(pipeline, align, scale, detector, side, seconds, radii):
    """Measure this patient's thigh and shank once, from a still frame or two."""
    from statistics import median
    thighs, shanks, start = [], [], time.time()
    while time.time() - start < seconds:
        record = read_frame(pipeline, align, scale, detector, side, (time.time() - start) * 1000, radii)
        if record and record.get("method") == "depth_3d":
            thigh, shank = segment_lengths(*record["points_3d"])
            thighs.append(thigh)
            shanks.append(shank)
    if len(thighs) < 5:
        return None
    return {"thigh_m": median(thighs), "shank_m": median(shanks),
            "frames": len(thighs), "calibrated_at": export.now_rfc3339()}


def run(args):
    context = {"patient_id": args.patient, "operation_date": args.op_date, "date": args.date,
               "side": args.side, "motion": args.motion, "mode": args.mode, "position": args.position}
    export.check_context(context)

    if not os.path.exists(args.model):
        sys.exit("Pose model not found at %s. Pass --model with the path to pose_landmarker_full.task." % args.model)

    radii = tuple(float(x) for x in args.limb_radius.split(","))
    pipeline, align, scale, device, info = open_camera()
    detector = landmarker(args.model)
    print("Camera: %s, firmware %s, depth scale %.6f m per unit" % (info["model"], info["firmware"], scale))

    try:
        print("Hold the leg still. Calibrating limb lengths for %.0f seconds." % args.calibrate)
        geometry = calibrate(pipeline, align, scale, detector, args.side, args.calibrate, radii)
        if not geometry:
            sys.exit("Could not measure the leg. Check the whole leg is in view and lit, then try again.")
        read_frame.reference = (geometry["thigh_m"], geometry["shank_m"])
        print("Thigh %.3f m, shank %.3f m, from %d frames." % (geometry["thigh_m"], geometry["shank_m"], geometry["frames"]))

        input("Move to the end position, hold it, then press Enter to capture %.1f s. " % args.seconds)
        capture_group = export.new_capture_group()
        captured_at = export.now_rfc3339()
        frames, start = [], time.time()
        while time.time() - start < args.seconds:
            elapsed = (time.time() - start)
            record = read_frame(pipeline, align, scale, detector, args.side, elapsed * 1000, radii)
            if record:
                record["time_ms"] = round(elapsed * 1000)
                frames.append(record)
    finally:
        pipeline.stop()

    if not frames:
        sys.exit("No frames were captured.")

    summary = summarise(frames)
    verdict = export.will_import(frames)
    device_block = dict(info, intrinsics=frames[0]["intrinsics"], limb_radius_m=list(radii))

    stem = "%s_%s_%s_%s" % (args.patient, args.date, args.side, args.motion)
    depth_path = os.path.join(args.out, stem + "_depth.json")
    fused_path = os.path.join(args.out, stem + "_fused.json")
    os.makedirs(args.out, exist_ok=True)
    export.write(depth_path, export.depth_export(frames, context, device_block, capture_group, captured_at))
    export.write(fused_path, export.fused_export(frames, context, device_block, capture_group, captured_at,
                                                 geometry, summary))

    print()
    for method, label in (("depth_3d", "Depth, 3D  "), ("mediapipe_2d", "Image plane")):
        block = summary.get(method)
        if block:
            print("%s  %6.1f deg   spread %4.1f   sd %4.2f   frames %d"
                  % (label, block["mean"], block["spread"], block["sd"], block["accepted"]))
        else:
            print("%s  not measured" % label)
    if summary.get("agreement_deg") is not None:
        print("Mean disagreement between the two: %.1f degrees" % summary["agreement_deg"])
    if args.reference is not None:
        block = summary.get("depth_3d")
        if block:
            print("Against the jig at %.1f deg: error %+.1f degrees" % (args.reference, block["mean"] - args.reference))

    print()
    if verdict["accepted"]:
        print("The app will accept this file. Import %s in the recovery summary." % os.path.basename(depth_path))
    else:
        print("The app will refuse this file: " + "; ".join(verdict["problems"]))
        print("The reading is still in the fused export, which is what the bench log uses.")
    print("Written to %s" % args.out)


def build_parser():
    parser = argparse.ArgumentParser(description="Capture one knee end position with a RealSense D415.")
    parser.add_argument("--patient", required=True)
    parser.add_argument("--op-date", required=True, help="operation date, YYYY-MM-DD")
    parser.add_argument("--date", default=time.strftime("%Y-%m-%d"), help="assessment date, YYYY-MM-DD")
    parser.add_argument("--side", required=True, choices=["left", "right"])
    parser.add_argument("--motion", default="bend", choices=["bend", "straighten"])
    parser.add_argument("--mode", default="active", choices=["active", "assisted", "passive"])
    parser.add_argument("--position", default="supine", choices=["supine", "seated"])
    parser.add_argument("--seconds", type=float, default=1.4, help="hold length, matching the app's burst")
    parser.add_argument("--calibrate", type=float, default=3.0, help="seconds of still frames for limb lengths")
    parser.add_argument("--limb-radius", default="0,0,0",
                        help="hip,knee,ankle radius in metres for the surface to centre correction. "
                             "Leave at zero until it has been measured on the jig.")
    parser.add_argument("--reference", type=float, default=None, help="jig angle in degrees, for bench runs")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--out", default=DEFAULT_OUT, help="folder for the two export files")
    return parser


def main(argv=None):
    return run(build_parser().parse_args(argv))


if __name__ == "__main__":
    main()
