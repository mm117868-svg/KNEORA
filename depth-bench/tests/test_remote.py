import unittest,time
from depth_bench import remote
class RemoteTest(unittest.TestCase):
 def setUp(self):
  remote.SESSION={'desktop':'computer','phone':'mobile','expires':time.monotonic()+10,'heartbeat':0,'queue':[{'action':'start'}]}
 def tearDown(self):remote.SESSION=None
 def test_role_separation_and_expiry(self):
  with self.assertRaises(ValueError):remote.access('mobile','desktop')
  remote.SESSION['expires']=0
  with self.assertRaises(ValueError):remote.access('computer','desktop')
 def test_deliver_once_and_strip_patient_data(self):
  b={'token':'computer','state':{'phase':'ready','title':'Heel slides','voice':True,'patient':'private','exercises':[{'id':'1:0','title':'Heel slides'}]}}
  self.assertEqual(len(remote.desktop(b)['commands']),1)
  self.assertEqual(remote.desktop(b)['commands'],[])
  self.assertNotIn('patient',remote.SESSION['state'])
 def test_disconnect_revokes_phone(self):
  remote.desktop({'token':'computer','close':True})
  with self.assertRaises(ValueError):remote.access('mobile','phone')
