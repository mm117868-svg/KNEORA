"""Exports for the depth bench.

Two files come out of every hold, from the same frames of the same capture:

  knee-depth-endpoint-v1  the file the recovery summary already imports, so a
                          reading can be taken with no change to the app
  knee-fused-endpoint-v1  both angle series with the per frame evidence, sharing
                          one capture reference and one timestamp

Everything the importer checks is enforced here, so a file that leaves this
module either imports or says exactly why it will not.
"""
import json
import uuid
from datetime import datetime, timezone

SCHEMA_DEPTH = "knee-depth-endpoint-v1"
SCHEMA_FUSED = "knee-fused-endpoint-v1"
CONTEXT_FIELDS = ("patient_id", "operation_date", "side", "motion", "mode", "position", "date")

# The importer's own acceptance rules, repeated here so the bench can warn
# before the file is carried to the app rather than after.
DEPTH_RULES = {"minimum_frames": 5, "minimum_coverage": 0.5, "maximum_spread": 8.0, "maximum_frames": 600}


def now_rfc3339():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def new_capture_group():
    return str(uuid.uuid4())


def check_context(context):
    missing = [f for f in CONTEXT_FIELDS if not context.get(f)]
    if missing:
        raise ValueError("The export needs " + ", ".join(missing) + " to match the form in the app.")
    if context["side"] not in ("left", "right"):
        raise ValueError("side must be left or right.")
    if context["motion"] not in ("bend", "straighten"):
        raise ValueError("motion must be bend or straighten.")
    if context["mode"] not in ("active", "assisted", "passive"):
        raise ValueError("mode must be active, assisted or passive.")
    if context["position"] not in ("supine", "seated"):
        raise ValueError("position must be supine or seated.")


def will_import(frames):
    """What the app will make of this set of frames, before it is carried over."""
    usable = [f for f in frames if f.get("method") == "depth_3d" and f.get("angle_3d") is not None]
    coverage = (len(usable) / len(frames)) if frames else 0.0
    angles = [f["angle_3d"] for f in usable]
    spread = (max(angles) - min(angles)) if angles else None
    problems = []
    if len(frames) > DEPTH_RULES["maximum_frames"]:
        problems.append("more than 600 frames")
    if len(usable) < DEPTH_RULES["minimum_frames"]:
        problems.append("fewer than 5 usable depth frames")
    if coverage < DEPTH_RULES["minimum_coverage"]:
        problems.append("under 50 per cent of frames usable")
    if spread is not None and spread > DEPTH_RULES["maximum_spread"]:
        problems.append("angle spread %.1f degrees, over the 8 degree limit" % spread)
    return {"accepted": not problems, "problems": problems, "usable": len(usable),
            "coverage": coverage, "spread": spread}


def depth_export(frames, context, device, capture_group, captured_at):
    """The file the app imports today. Coordinates are joint centres in metres."""
    check_context(context)
    out = {
        "schema": SCHEMA_DEPTH,
        "source": {
            "kind": "depth_3d",
            "coordinates": "depth-derived-joint-centres",
            "device": device["model"],
            "calibration": device["calibration"],
        },
        "units": "m",
        "captured_at": captured_at,
        "capture_group": capture_group,
        "frames": [],
    }
    out.update({field: context[field] for field in CONTEXT_FIELDS})
    for frame in frames:
        usable = frame.get("method") == "depth_3d" and frame.get("points_3d")
        hip, knee, ankle = (frame.get("points_3d") or [None, None, None])
        out["frames"].append({
            "time_ms": frame["time_ms"],
            "valid": bool(usable),
            "hip": hip or [0, 0, 0],
            "knee": knee or [0, 0, 0],
            "ankle": ankle or [0, 0, 0],
        })
    return out


def fused_export(frames, context, device, capture_group, captured_at, geometry, summary):
    """Both angle series and the evidence, for the bench rather than the app."""
    check_context(context)
    return {
        "schema": SCHEMA_FUSED,
        "capture_group": capture_group,
        "captured_at": captured_at,
        "units": "m",
        "device": device,
        "context": dict(context),
        "patient_geometry": geometry,
        "summary": summary,
        "frames": [
            {
                "time_ms": f["time_ms"],
                "colour_ts": f.get("colour_ts"),
                "depth_ts": f.get("depth_ts"),
                "hip": (f.get("points_3d") or [None, None, None])[0],
                "knee": (f.get("points_3d") or [None, None, None])[1],
                "ankle": (f.get("points_3d") or [None, None, None])[2],
                "hip_px": (f.get("points_px") or [None, None, None])[0],
                "knee_px": (f.get("points_px") or [None, None, None])[1],
                "ankle_px": (f.get("points_px") or [None, None, None])[2],
                "depth_valid": f.get("depth_valid"),
                "depth_spread_m": f.get("depth_spread_m"),
                "visibility": f.get("visibility"),
                "segments_m": f.get("segments_m"),
                "out_of_plane_deg": f.get("out_of_plane_deg"),
                "angle_3d": f.get("angle_3d"),
                "angle_2d": f.get("angle_2d"),
                "method": f.get("method"),
                "valid": f.get("valid"),
                "reason": f.get("reason"),
            }
            for f in frames
        ],
    }


def write(path, payload):
    text = json.dumps(payload, indent=1)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)
    size = len(text.encode("utf-8"))
    if size > 2 * 1024 * 1024:
        raise ValueError("The export is %.1f MB. The app refuses anything over 2 MB, so shorten the hold." % (size / 1e6))
    return size
