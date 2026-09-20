"""Experimental height-proportion comparison, kept independent of measured depth.

Default segment proportions are explicit engineering priors (thigh .245 H,
shank .246 H), not patient-specific anatomy. Weight is metadata only.
"""
from math import hypot, sqrt, isfinite
from .geometry import knee_angle_3d

MODEL = 'height-planar-v1'
THIGH_FRACTION, SHANK_FRACTION = .245, .246


def height_estimate(points_px, visibility, intrinsics, height_cm, weight_kg=None, image_rays=None):
    missing = lambda reason: {'available': False, 'reason': reason, 'method': MODEL}
    if not isinstance(height_cm, (int, float)) or not isfinite(height_cm) or not 120 <= height_cm <= 230:
        return missing('Enter adult height between 120 and 230 cm.')
    if weight_kg is not None and (not isinstance(weight_kg, (int, float)) or not isfinite(weight_kg) or not 25 <= weight_kg <= 350):
        return missing('Weight must be between 25 and 350 kg, or blank.')
    if len(points_px or []) != 3 or len(visibility or []) != 3 or any(v is None or not isfinite(v) or v < .5 for v in visibility):
        return missing('Hip, knee and ankle must be visible.')
    if not all(isfinite(intrinsics.get(k, float('nan'))) for k in ('fx', 'fy', 'ppx', 'ppy')) or min(intrinsics['fx'], intrinsics['fy']) <= 0:
        return missing('Camera calibration is unavailable.')
    if any(len(p) != 2 or not all(isfinite(x) for x in p) for p in points_px):
        return missing('Invalid image landmarks.')
    rays = [[(p[0]-intrinsics['ppx'])/intrinsics['fx'], (p[1]-intrinsics['ppy'])/intrinsics['fy'], 1.] for p in points_px]
    if image_rays is not None:
        if len(image_rays)!=3 or any(len(r)!=3 or not all(isfinite(x) for x in r) or r[2]<=0 for r in image_rays):
            return missing('Invalid calibrated rays.')
        rays=[[x/r[2] for x in r] for r in image_rays]
    spans = [hypot(rays[a][0]-rays[b][0], rays[a][1]-rays[b][1]) for a,b in ((0,1),(1,2))]
    if min(spans) < .015:
        return missing('Leg is too foreshortened or too small in the picture.')
    expected = [height_cm/100*THIGH_FRACTION, height_cm/100*SHANK_FRACTION]
    separate = [length/span for length,span in zip(expected,spans)]
    # A disagreement gate checks the planar assumption; this is not an accuracy interval.
    if abs(separate[0]-separate[1]) / max(separate) > .25:
        return missing('Thigh and shank give inconsistent scale. Use a side-on view.')
    z = sum(a*b for a,b in zip(expected,spans))/sum(s*s for s in spans)
    if not .3 <= z <= 6:
        return missing('Estimated distance is outside the comparison range.')
    points = [[value*z for value in ray] for ray in rays]
    return {'available': True, 'method': MODEL, 'points_3d': points,
            'knee_distance_m': sqrt(sum(x*x for x in points[1])), 'knee_depth_m': z,
            'angle_deg': knee_angle_3d(*points), 'height_cm': height_cm, 'weight_kg': weight_kg,
            'weight_usage': 'context_only', 'expected_segments_m': expected,
            'assumption': 'Typical adult proportions; hip, knee and ankle in a plane parallel to the camera.'}


def compare(record, height_cm, weight_kg=None):
    if not record:
        return {'depth': {'available': False, 'reason': 'Leg not detected.'},
                'estimate': {'available': False, 'reason': 'Leg not detected.'}, 'difference': None}
    size=record.get('image_size')
    if size and any(not (0<=p[0]<size[0] and 0<=p[1]<size[1]) for p in record['points_px']):
        return {'depth':{'available':False,'reason':'Leg outside camera frame.'},'estimate':{'available':False,'reason':'Leg outside camera frame.'},'difference':None}
    estimate = height_estimate(record['points_px'],record['visibility'],record['intrinsics'],height_cm,weight_kg,record.get('image_rays'))
    knee = record.get('surface_points_3d', [None]*3)[1]
    valid = (knee is not None and record['depth_valid'][1] and record['visibility'][1] is not None
             and record['visibility'][1] >= .5 and all(isfinite(x) for x in knee)
             and abs(record['colour_ts']-record['depth_ts']) <= 50 and 'knee:other_leg' not in record['reason'])
    depth = {'available': bool(valid), 'reason': '' if valid else 'Knee depth is missing, unstable or not synchronised.'}
    if valid:
        depth.update(knee_distance_m=sqrt(sum(x*x for x in knee)),knee_depth_m=knee[2],
                     angle_deg=knee_angle_3d(*record['surface_points_3d']) if not record['reason'] and all(record['surface_points_3d']) else None,
                     points_3d=[p if v is not None and v>=.5 else None for p,v in zip(record['surface_points_3d'],record['visibility'])], method='realsense_surface')
    difference = None
    if valid and estimate['available']:
        difference={'distance_cm':(estimate['knee_distance_m']-depth['knee_distance_m'])*100,
                    'angle_deg':estimate['angle_deg']-depth['angle_deg'] if depth['angle_deg'] is not None else None,
                    'landmark_separation_cm':[sqrt(sum((x-y)**2 for x,y in zip(a,b)))*100 if b else None for a,b in zip(estimate['points_3d'],depth['points_3d'])]}
    return {'depth':depth,'estimate':estimate,'difference':difference}
