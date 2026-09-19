"""Geometry for the depth bench: one colour frame, one depth frame, two angles.

Nothing in this module touches a camera, so every rule in it can be tested
before the hardware arrives. The 2D angle is deliberately the same calculation
the patient app already makes, so the two halves stay comparable.
"""
from dataclasses import dataclass, asdict
from math import acos, asin, degrees, hypot, sqrt
from statistics import median

# Thresholds. These are engineering settings, not clinical limits, and the
# bench exists to find out whether they are the right ones.
@dataclass(frozen=True)
class Rules:
    patch_half: int = 4              # depth patch is (2*half+1) square, scaled by leg size at capture
    min_patch_valid: float = 0.5     # fraction of patch pixels carrying a depth reading
    max_patch_spread_m: float = 0.015  # median absolute deviation inside the patch
    segment_tolerance: float = 0.10  # thigh and shank may not change by more than this
    min_segment_m: float = 0.10      # the importer's own plausibility gate
    max_segment_m: float = 0.80
    knee_behind_m: float = 0.15      # a knee this far behind hip and ankle is the other leg
    min_visibility: float = 0.5      # MediaPipe landmark visibility, as the recovery capture uses

RULES = Rules()


def knee_angle_3d(hip, knee, ankle):
    """Unsigned knee bend in degrees from three points in metres. 0 is straight.

    Same convention and same arithmetic as kneeAngle3D in the app, so a reading
    taken here and a reading taken there mean the same thing.
    """
    u = [h - k for h, k in zip(hip, knee)]
    v = [a - k for a, k in zip(ankle, knee)]
    a = sqrt(sum(x * x for x in u))
    b = sqrt(sum(x * x for x in v))
    if a < 1e-6 or b < 1e-6:
        return None
    cos = sum(x * y for x, y in zip(u, v)) / (a * b)
    return 180.0 - degrees(acos(max(-1.0, min(1.0, cos))))


def knee_angle_2d(hip_px, knee_px, ankle_px):
    """The projected angle, from pixel coordinates. What the product measures today."""
    ux, uy = hip_px[0] - knee_px[0], hip_px[1] - knee_px[1]
    vx, vy = ankle_px[0] - knee_px[0], ankle_px[1] - knee_px[1]
    a, b = hypot(ux, uy), hypot(vx, vy)
    if a < 1e-6 or b < 1e-6:
        return None
    cos = (ux * vx + uy * vy) / (a * b)
    return 180.0 - degrees(acos(max(-1.0, min(1.0, cos))))


def deproject(u, v, z, intr):
    """Pixel plus depth to a point in metres in the camera frame.

    intr is a dict with fx, fy, ppx, ppy. Distortion is ignored: the RealSense
    colour stream is already rectified, and the residual is far below the
    landmark error.
    """
    return [(u - intr["ppx"]) * z / intr["fx"], (v - intr["ppy"]) * z / intr["fy"], z]


def patch_depth(depth_m, u, v, half=RULES.patch_half):
    """Median depth in a square patch, with its spread and how much of it was valid.

    A single pixel at a landmark sits on the edge of the limb often enough that
    one sample is not a measurement. depth_m is a 2D sequence in metres with
    zero meaning no reading.
    """
    height, width = len(depth_m), len(depth_m[0])
    u, v = int(round(u)), int(round(v))
    values, total = [], 0
    for y in range(max(0, v - half), min(height, v + half + 1)):
        for x in range(max(0, u - half), min(width, u + half + 1)):
            total += 1
            z = depth_m[y][x]
            if z and z > 0:
                values.append(z)
    if not total or not values:
        return {"z": None, "spread": None, "valid_fraction": 0.0, "reason": "no_depth_in_patch"}
    m = median(values)
    # Spread is the inter-decile range rather than the median absolute deviation.
    # A landmark straddling the edge of the limb gives two clusters of depth, and
    # a robust deviation from the median happily ignores the smaller cluster,
    # which is exactly the case this check exists to catch.
    ordered = sorted(values)
    low = ordered[int(0.1 * (len(ordered) - 1))]
    high = ordered[int(round(0.9 * (len(ordered) - 1)))]
    spread = high - low
    fraction = len(values) / total
    reason = ""
    if fraction < RULES.min_patch_valid:
        reason = "patch_mostly_empty"
    elif spread > RULES.max_patch_spread_m:
        reason = "patch_on_a_depth_edge"
    return {"z": m, "spread": spread, "valid_fraction": fraction, "reason": reason}


def surface_to_centre(point, radius_m):
    """Push a surface point away from the camera by the local limb radius.

    The deprojected landmark lies on the face of the limb turned towards the
    camera, not at the joint centre. The correction is along the point's own ray.
    """
    if not radius_m:
        return list(point)
    length = sqrt(sum(x * x for x in point))
    if length < 1e-6:
        return list(point)
    return [x * (1.0 + radius_m / length) for x in point]


def out_of_plane_deg(a, b):
    """How far the segment a to b leans out of the image plane, in degrees.

    Zero means the segment lies in the plane the 2D measurement assumes. This is
    measured, not inferred from how short the segment looks.
    """
    v = [y - x for x, y in zip(a, b)]
    length = sqrt(sum(x * x for x in v))
    if length < 1e-6:
        return None
    return degrees(asin(min(1.0, abs(v[2]) / length)))


def segment_lengths(hip, knee, ankle):
    thigh = sqrt(sum((h - k) ** 2 for h, k in zip(hip, knee)))
    shank = sqrt(sum((a - k) ** 2 for a, k in zip(ankle, knee)))
    return thigh, shank


def evaluate_frame(points_3d, points_px, patches, visibility, reference=None, rules=RULES):
    """Decide what one frame pair is worth.

    points_3d and points_px are hip, knee, ankle. patches are the patch results
    for the same three joints. reference is the patient's calibrated
    (thigh, shank) in metres, or None before calibration.

    Returns the frame record the export and the report are both built from.
    """
    names = ("hip", "knee", "ankle")
    reasons = []

    for name, vis in zip(names, visibility):
        if vis is None or vis < rules.min_visibility:
            reasons.append(name + ":low_visibility")

    depth_valid = []
    for name, patch in zip(names, patches):
        ok = patch["z"] is not None and not patch["reason"]
        depth_valid.append(ok)
        if not ok:
            reasons.append(name + ":" + (patch["reason"] or "no_depth"))

    angle_2d = knee_angle_2d(*points_px)
    angle_3d = None
    thigh = shank = oop = None

    if all(depth_valid) and all(p is not None for p in points_3d):
        hip, knee, ankle = points_3d
        thigh, shank = segment_lengths(hip, knee, ankle)
        for label, length in (("thigh", thigh), ("shank", shank)):
            if not (rules.min_segment_m <= length <= rules.max_segment_m):
                reasons.append(label + ":implausible_length")
        if reference:
            for label, length, ref in (("thigh", thigh, reference[0]), ("shank", shank, reference[1])):
                if ref and abs(length - ref) / ref > rules.segment_tolerance:
                    reasons.append(label + ":length_changed")
        # A knee sitting well behind both neighbours is the other leg.
        if knee[2] - max(hip[2], ankle[2]) > rules.knee_behind_m:
            reasons.append("knee:other_leg")
        if not [r for r in reasons if not r.endswith(":low_visibility")]:
            angle_3d = knee_angle_3d(hip, knee, ankle)
        oop = out_of_plane_deg(hip, ankle)

    method = "depth_3d" if angle_3d is not None else ("mediapipe_2d" if angle_2d is not None else None)
    return {
        "angle_3d": angle_3d,
        "angle_2d": angle_2d,
        "method": method,
        "valid": method is not None,
        "segments_m": [thigh, shank],
        "out_of_plane_deg": oop,
        "depth_valid": depth_valid,
        "depth_spread_m": [p["spread"] for p in patches],
        "visibility": list(visibility),
        "reason": ";".join(reasons)[:150],
    }


def summarise(frames):
    """Per method summary of one hold. Never averages a 3D reading with a 2D one."""
    out = {}
    for method in ("depth_3d", "mediapipe_2d"):
        key = "angle_3d" if method == "depth_3d" else "angle_2d"
        values = [f[key] for f in frames if f.get("method") == method and f.get(key) is not None]
        if not values:
            out[method] = None
            continue
        mean = sum(values) / len(values)
        sd = sqrt(sum((v - mean) ** 2 for v in values) / len(values)) if len(values) > 1 else 0.0
        out[method] = {
            "mean": mean, "minimum": min(values), "maximum": max(values),
            "spread": max(values) - min(values), "sd": sd, "accepted": len(values),
        }
    out["sampled"] = len(frames)
    agreed = [abs(f["angle_3d"] - f["angle_2d"]) for f in frames
              if f.get("angle_3d") is not None and f.get("angle_2d") is not None]
    out["agreement_deg"] = (sum(agreed) / len(agreed)) if agreed else None
    out["rules"] = asdict(RULES)
    return out
