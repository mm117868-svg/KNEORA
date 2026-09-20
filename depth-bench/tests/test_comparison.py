import unittest
from copy import deepcopy
from math import sqrt
from depth_bench.comparison import height_estimate, compare

INTR={'fx':600.,'fy':600.,'ppx':640.,'ppy':360.}
HEIGHT=180.
# An ideal planar 90-degree knee at z=2m. Synthetic, not camera evidence.
POINTS=[[640.,360.-.245*1.8/2*600],[640.,360.],[640.+.246*1.8/2*600,360.]]

def record():
    return {'points_px':deepcopy(POINTS),'visibility':[1,1,1],'intrinsics':INTR,
            'surface_points_3d':[[0,-.441,2],[0,0,2],[.4428,0,2]],
            'depth_valid':[True,True,True],'colour_ts':1000,'depth_ts':1000,
            'angle_3d':90.,'reason':''}

class ComparisonTest(unittest.TestCase):
    def test_known_planar_geometry(self):
        r=height_estimate(POINTS,[1,1,1],INTR,HEIGHT,80)
        self.assertTrue(r['available']);self.assertAlmostEqual(r['knee_distance_m'],2)
        self.assertAlmostEqual(r['angle_deg'],90)
        self.assertEqual(r['weight_usage'],'context_only')

    def test_weight_does_not_invent_joint_locations(self):
        a=height_estimate(POINTS,[1,1,1],INTR,HEIGHT,50)
        b=height_estimate(POINTS,[1,1,1],INTR,HEIGHT,120)
        self.assertEqual(a['points_3d'],b['points_3d'])

    def test_depth_and_height_remain_independent(self):
        a=record();a['surface_points_3d'][1][2]=2.4
        result=compare(a,HEIGHT,80)
        self.assertAlmostEqual(result['depth']['knee_distance_m'],2.4)
        self.assertAlmostEqual(result['estimate']['knee_distance_m'],2)
        self.assertAlmostEqual(result['difference']['distance_cm'],-40)

    def test_missing_or_out_of_sync_depth_cannot_be_replaced_by_estimate(self):
        for update in ({'depth_valid':[True,False,True]}, {'depth_ts':1100}):
            a=record();a.update(update);result=compare(a,HEIGHT)
            self.assertFalse(result['depth']['available']);self.assertIsNone(result['difference'])
            self.assertTrue(result['estimate']['available'])

    def test_bad_inputs_and_foreshortening_are_refused(self):
        for height in (None,0,90,300,float('nan')):
            self.assertFalse(height_estimate(POINTS,[1,1,1],INTR,height)['available'])
        self.assertFalse(height_estimate(POINTS,[1,.2,1],INTR,HEIGHT)['available'])
        p=deepcopy(POINTS);p[0][1]=340
        self.assertFalse(height_estimate(p,[1,1,1],INTR,HEIGHT)['available'])
        self.assertFalse(compare(None,HEIGHT)['depth']['available'])

    def test_range_is_euclidean_not_just_axial_depth(self):
        a=record();a['surface_points_3d'][1]=[.5,0,2]
        self.assertAlmostEqual(compare(a,HEIGHT)['depth']['knee_distance_m'],sqrt(4.25))
