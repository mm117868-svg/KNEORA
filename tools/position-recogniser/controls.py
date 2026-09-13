"""Synthetic negative controls, kept distinct from recorded exercise evidence."""
import os,json
from pathlib import Path
import cv2,numpy as np
ROOT=Path(os.environ.get('KNEE_TRACKER_HOME',str(Path(__file__).resolve().parents[3]/'knee-dis-evaluation')));out=ROOT/'position-recogniser';m=json.loads((out/'model.json').read_text());w1=np.array(m['w1']);b1=np.array(m['b1']);w2=np.array(m['w2']);b2=np.array(m['b2'])
im=cv2.imread(str(ROOT/'cache/01.39.33/00000.png'));im=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY);h,w=im.shape;rest=cv2.resize(im[round(h*.12):round(h*.9)],(32,32),interpolation=cv2.INTER_AREA)/255
runs=[]
for name in ['stationary','brightness_change','camera_shift','unrelated_upper_motion','leg_occlusion']:
 rows=[]
 for i in range(181):
  t=i/15;phase=np.sin(np.pi*max(0,min(1,(t-3)/6)))**2 if 3<t<9 else 0;x=rest.copy()
  if name=='brightness_change':x=np.clip(x*(1+.35*phase)+.1*phase,0,1)
  elif name=='camera_shift':x=cv2.warpAffine(x,np.float32([[1,0,phase*1.5],[0,1,0]]),(32,32),borderMode=cv2.BORDER_REFLECT)
  elif name=='unrelated_upper_motion' and phase>0:
   y=round(3+phase*8);x[y:y+5,2:9]=.9
  elif name=='leg_occlusion' and phase>0:x[18:30,15:32]=.9
  d=x-rest;d=np.clip(d-np.median(d),-.5,.5);d[:,:10]=0;d=d.ravel();logits=w2@np.maximum(0,w1@d+b1)+b2;p=np.exp(logits-max(logits));p/=sum(p)
  rows.append({'t':t,'probabilities':p.tolist()})
 runs.append({'id':name,'role':'synthetic negative control','rows':rows})
(out/'controls.json').write_text(json.dumps({'clips':runs}))
