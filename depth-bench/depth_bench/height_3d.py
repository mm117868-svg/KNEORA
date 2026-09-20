"""Experimental depth fit using published height-group means as soft bone-length proxies.
Not an anatomical calibration or an independent comparator to Intel depth.
"""
import json
from pathlib import Path
from math import isfinite
import numpy as np
from .geometry import knee_angle_3d
DATA=json.loads((Path(__file__).resolve().parents[2]/'evidence/stature-bone-lengths-2023.json').read_text())
MODEL='height-depth-research-v1'

def prior(height, group='combined'):
    if group not in ('combined','male','female'):
        return {'available':False,'reason':'Choose a reference group.'}
    if not isinstance(height,(int,float)) or not isfinite(height):
        return {'available':False,'reason':'Enter height to see the research estimate.'}
    rows=[r for r in DATA['rows'] if (group=='combined' or r['group']==group) and abs(r['height_cm']-height)<=3]
    n=sum(r['n'] for r in rows)
    if n<20:return {'available':False,'reason':'Insufficient published data within 3 cm of this height.'}
    return {'available':True,'source':DATA['source'],'group':group,'height_cm':height,'reference_n':n,
            'window_cm':3,'lengths_m':[sum(r[k]*r['n'] for r in rows)/n/100 for k in ('femur_cm','tibia_cm')],
            'method':'Participant-weighted published height-bin means; not inverse regression.',
            'uncertainty':'Individual prediction intervals cannot be recovered from these group means.'}

def fit(record,height,group='combined'):
    p=prior(height,group)
    missing=lambda reason:{'available':False,'method':MODEL,'reason':reason,'prior':p}
    if not p['available']:return missing(p['reason'])
    if not record:return missing('Waiting for visible hip, knee and ankle with valid depth.')
    if record.get('reason') or abs(record['colour_ts']-record['depth_ts'])>50 or len(record.get('depth_valid',[]))!=3 or not all(record.get('depth_valid',[])):
        return missing('All three landmarks need reliable synchronised depth.')
    if len(record.get('visibility',[]))!=3 or any(v is None or not isfinite(v) or v<.5 for v in record['visibility']):
        return missing('Hip, knee and ankle must all be visible.')
    size=record.get('image_size')
    if size and any(not(0<=p[0]<size[0] and 0<=p[1]<size[1]) for p in record.get('points_px',[])):
        return missing('Leg outside camera frame.')
    try: original=np.asarray(record['surface_points_3d'],dtype=float)
    except (ValueError,TypeError):return missing('Invalid depth coordinates.')
    if original.shape!=(3,3) or not np.isfinite(original).all() or np.any(original[:,2]<=0):return missing('Invalid depth coordinates.')
    # Preserve observed image rays. Adjust each axial depth, rather than just rescaling the triangle.
    rays=original/original[:,2,None];z0=original[:,2].copy();target=np.array(p['lengths_m'])
    raw_lengths=np.linalg.norm(np.diff(original,axis=0),axis=1)
    if np.any(abs(raw_lengths-target)>target*.35):return missing('Observed lengths disagree strongly with the height reference; check the view.')
    def cost(z):
        lengths=np.linalg.norm(np.diff(rays*z[:,None],axis=0),axis=1)
        return float(np.sum(((z-z0)/.015)**2)+np.sum(((lengths-target)/(.10*target))**2))
    z=z0.copy()
    for step in (.01,.003,.001,.0003):
        for _ in range(12):
            changed=False
            for i in range(3):
                choices=[z.copy() for _ in range(3)]
                choices[1][i]=max(z0[i]-.03,z[i]-step);choices[2][i]=min(z0[i]+.03,z[i]+step)
                best=min(choices,key=cost)
                changed=changed or not np.array_equal(best,z);z=best
            if not changed:break
    if np.any(abs(z-z0)>=.0299):return missing('Fit reached its adjustment limit; use the original depth reading.')
    points=rays*z[:,None];angle=knee_angle_3d(*points)
    return {'available':True,'method':MODEL,'prior':p,'angle_deg':angle,'points_3d':points.tolist(),
            'knee_distance_m':float(np.linalg.norm(points[1])),
            'angle_difference_deg':angle-knee_angle_3d(*original),
            'distance_difference_cm':float((np.linalg.norm(points[1])-np.linalg.norm(original[1]))*100),
            'maximum_adjustment_cm':float(np.max(np.linalg.norm(points-original,axis=1))*100),
            'settings':{'depth_penalty_m':.015,'length_penalty_fraction':.10,'depth_adjustment_limit_m':.03},
            'assumption':'Radiographic bone lengths used as imperfect proxies for surface-landmark segments. Penalties are engineering settings, not confidence intervals.',
            'independent_of_depth':False}
