import unittest
from copy import deepcopy
import numpy as np
from depth_bench.height_3d import prior,fit,DATA

def sample():
 p=prior(175)['lengths_m']
 return {'surface_points_3d':[[0,-p[0],2],[0,0,2],[p[1],0,2]],'visibility':[1,1,1],'depth_valid':[True]*3,'colour_ts':100,'depth_ts':100,'reason':''}
class Height3DTest(unittest.TestCase):
 def test_prior_weighted_published_bins(self):
  rows=[r for r in DATA['rows'] if r['group']=='male' and 172<=r['height_cm']<=178];p=prior(175,'male')
  self.assertEqual(p['reference_n'],sum(r['n'] for r in rows))
  self.assertAlmostEqual(p['lengths_m'][0],sum(r['n']*r['femur_cm'] for r in rows)/p['reference_n']/100)
 def test_no_extrapolation(self):
  for h in (None,float('nan'),100,230):self.assertFalse(prior(h)['available'])
 def test_geometry_and_input_preservation(self):
  r=sample();before=deepcopy(r);f=fit(r,175)
  self.assertTrue(f['available']);self.assertAlmostEqual(f['angle_deg'],90);self.assertEqual(r,before);self.assertFalse(f['independent_of_depth'])
 def test_adjustments_preserve_rays_and_bound(self):
  r=sample();r['surface_points_3d'][1][2]+=.02;f=fit(r,175);self.assertTrue(f['available'])
  a=np.array(r['surface_points_3d']);b=np.array(f['points_3d']);np.testing.assert_allclose(a/a[:,2,None],b/b[:,2,None]);self.assertLess(np.max(abs(a[:,2]-b[:,2])),.03)
 def test_bad_depth_never_imputed(self):
  for change in ({'depth_valid':[True,False,True]},{'visibility':[1,.2,1]},{'depth_ts':200},{'reason':'occluded'},{'surface_points_3d':[[0,0,2],None,[1,0,2]]}):
   r=sample();r.update(change);self.assertFalse(fit(r,175)['available'])
  self.assertFalse(fit(None,175)['available'])
