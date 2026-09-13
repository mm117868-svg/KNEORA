"""Small independent-frame SLR classifier. Private recordings remain outside git."""
import os,json,time,argparse
parser=argparse.ArgumentParser();parser.add_argument("--exercise",choices=["straight_leg_raise","seated_extension","heel_slide"],default="straight_leg_raise");exercise=parser.parse_args().exercise
from pathlib import Path
import cv2,numpy as np,torch
ROOT=Path(os.environ.get('KNEE_TRACKER_HOME',str(Path(__file__).resolve().parents[3]/'knee-dis-evaluation')))
OUT=ROOT/'position-recogniser';OUT=OUT/exercise if exercise!='straight_leg_raise' else OUT;OUT.mkdir(parents=True,exist_ok=True)
torch.set_num_threads(4);torch.manual_seed(42);rng=np.random.default_rng(42)
manifest=json.loads((ROOT/'manifest.json').read_text())
# Sparse labels inspected from the supplied contact sheet, not from an existing counter.
# Class 0 rest, 1 intermediate position, 2 clearly elevated. Direction needs a sequence.
labels=[(0,0),(.8,1),(1.5,2),(2.3,1),(3.1,0),(3.9,2),(4.6,1),(5.4,0),(6.2,2),(6.9,1),(7.7,0),(8.5,1),(9.3,2),(10,0),(10.8,1),(11.6,2),(12.3,1),(13.1,0),(13.9,2),(14.7,1),(15.5,0),(16.2,2),(17,1),(17.7,0)]
if exercise=='seated_extension':
 labels=[(0,0),(.5,1),(1,2),(1.5,2),(2.5,0),(3,1),(3.5,2),(4,2),(4.5,1),(5,0),(5.5,0),(6,2),(6.5,2),(7,1),(7.5,0),(8,0),(8.5,1),(9,2),(9.5,1),(10,0),(10.5,0),(11,1),(11.5,2),(12,2),(12.7,0)]
train_id='01.39.45' if exercise=='seated_extension' else '01.39.33'
comparison_id='02.04.36' if exercise=='seated_extension' else '02.04.17'
if exercise=='heel_slide':
 labels=[(0,0),(1.1,1),(2.19,2),(3.29,2),(4.38,1),(5.48,0),(6.57,2),(7.67,2),(8.76,0),(9.86,2),(10.95,2),(12.05,0),(13.14,1),(14.24,2),(15.33,0)]
 train_id=comparison_id='11.49.20'
# A fixed lower-limb view is a deliberate limitation of this first model.
# No pose trajectories, optical flow, video timestamps or previous predictions enter its input.
def gray(path):
 im=cv2.imread(str(ROOT/path));h,w=im.shape[:2];top=round(h*.12);height=round(h*.90)-top
 ys=np.minimum(h-1,np.floor(top+(np.arange(128)+.5)*height/128).astype(int));xs=np.minimum(w-1,np.floor((np.arange(128)+.5)*w/128).astype(int))
 im=im[ys[:,None],xs[None,:]].astype(np.float32)/255
 g=im[:,:,2]*.299+im[:,:,1]*.587+im[:,:,0]*.114
 return g.reshape(32,4,32,4).mean(axis=(1,3))

def feature(im,rest):
 d=im-rest;d-=np.median(d);d[:,:10]=0
 return np.clip(d,-.5,.5).reshape(-1)
train=next(c for c in manifest if c['id']==train_id);rest=gray(train['frames'][0]['image']);X=[];Y=[];annotated=[]
for t,y in labels:
 f=min(train['frames'],key=lambda f:abs(f['t']-t));im=gray(f['image']);annotated.append({'t':f['t'],'class':y,'image':f['image']})
 for j in range(96):
  gain=rng.uniform(.8,1.2);offset=rng.uniform(-.08,.08)
  # Paired lighting augmentation preserves the meaning of the resting reference.
  matrix=cv2.getRotationMatrix2D((15.5,15.5),rng.uniform(-12,12),rng.uniform(.8,1.2));matrix[:,2]+=rng.uniform(-4,4,2)
  a=cv2.warpAffine(im,matrix,(32,32));b=cv2.warpAffine(rest,matrix,(32,32))
  X.append(feature(np.clip(a*gain+offset,0,1),np.clip(b*gain+offset,0,1)));Y.append(y)
X=torch.tensor(np.array(X));Y=torch.tensor(Y)
model=torch.nn.Sequential(torch.nn.Linear(1024,24),torch.nn.ReLU(),torch.nn.Linear(24,3))
optim=torch.optim.AdamW(model.parameters(),lr=.006,weight_decay=.05)
start=time.perf_counter()
for epoch in range(220):
 optim.zero_grad();loss=torch.nn.functional.cross_entropy(model(X),Y);loss.backward();optim.step()
model.eval()
weights={'version':exercise+'-position-v1','exercise':exercise,'classes':['rest','intermediate','bent' if exercise=='heel_slide' else 'raised'],'input':{'width':32,'height':32,'crop':[0,.12,1,.78],'excluded_left_columns':10,'features':'signed grayscale difference from starting image, median brightness corrected, clipped to [-0.5,0.5]'},'hidden':24,'w1':model[0].weight.detach().numpy().tolist(),'b1':model[0].bias.detach().numpy().tolist(),'w2':model[2].weight.detach().numpy().tolist(),'b2':model[2].bias.detach().numpy().tolist(),'training_clip':train_id,'training_label_count':len(labels),'augmentation':'paired rotation +/-12 degrees, scale 0.8-1.2, translation +/-4 pixels, brightness','limitations':['One person and room, one training recording.','Requires a side-on lower-limb view similar to the supplied examples.','Has no learned selected-leg identity or out-of-distribution detector.','Not validated for tiny movements, other homes, occlusion or clinical use.']}
(OUT/'model.json').write_text(json.dumps(weights))
(OUT/'labels.json').write_text(json.dumps(annotated,indent=2))
report={'training_seconds':time.perf_counter()-start,'training_clip':train['id'],'validation_clip':comparison_id,'split':'whole recording, same person and room; development comparison after inspecting initial failure, not untouched validation','labels':annotated,'clips':[]}
if exercise=='heel_slide':
 report['split']='Training labels only at or before 15.33 seconds. Later frames are a within-recording comparison, not independent validation.'
 weights['training_end_s']=15.33
 weights['counting']={'acceptIntermediate':True,'meaning':'Movement away from rest and return; no minimum therapeutic range implied.'}
 (OUT/'model.json').write_text(json.dumps(weights))
with torch.no_grad():
 for cid in dict.fromkeys([train_id,comparison_id]):
  clip=next(c for c in manifest if c['id']==cid);ref=gray(clip['frames'][0]['image']);rows=[]
  for f in clip['frames']:
   t0=time.perf_counter();v=torch.tensor(feature(gray(f['image']),ref))[None];prob=torch.softmax(model(v),dim=1)[0].numpy();ms=(time.perf_counter()-t0)*1000
   rows.append({'t':f['t'],'probabilities':prob.tolist(),'class':int(prob.argmax()),'confidence':float(prob.max()),'processing_ms_including_image_read':ms})
  report['clips'].append({'id':cid,'role':'training recording' if cid==train['id'] else 'different recording from same person and room','rows':rows})
(OUT/'predictions.json').write_text(json.dumps(report))
print(json.dumps({'trained':True,'labels':len(labels),'seconds':report['training_seconds'],'output':str(OUT)}))
