"""Generate local neural narration, preserving each guide's cue boundaries."""
from pathlib import Path
import os,json,time,hashlib
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

root=Path(__file__).resolve().parent.parent
models=Path(os.environ.get('GUIDES_VOICE_MODELS',str(root.parents[1]/'voice-tools/models')))
voice=os.environ.get('GUIDES_VOICE','bf_emma')
output=Path(os.environ.get('GUIDES_AUDIO_OUTPUT',str(root/'source')))
only=set(filter(None,os.environ.get('GUIDES_ONLY','').split(',')))
model_file=models/'kokoro-v1.0.onnx';voices_file=models/'voices-v1.0.bin'
if not model_file.exists() or not voices_file.exists():
 raise SystemExit('Download the Kokoro model and voice files described in source/voice-model.md, or set GUIDES_VOICE_MODELS.')
output.mkdir(parents=True,exist_ok=True)
engine=Kokoro(str(model_file),str(voices_file))
report={'engine':'kokoro-onnx','model':'Kokoro v1.0, full precision ONNX','voice':voice,'language':'en-gb','date':'2026-09-13','clips':[]}

def trim_padding(audio,rate):
 active=np.flatnonzero(np.abs(audio)>.0001)
 if not len(active):raise RuntimeError('The synthesiser returned silence.')
 pad=int(rate*.10)
 return audio[max(0,int(active[0])-pad):min(len(audio),int(active[-1])+pad+1)]

for ex in json.loads((root/'exercises.json').read_text()):
 if only and ex['id'] not in only:continue
 started=time.time();rate=24000;track=np.zeros(round(ex['duration']*rate),dtype=np.float32);cues=[]
 for i,cue in enumerate(ex['cues']):
  available=cue['end']-cue['start']-.30;speed=.78
  for attempt in range(4):
   samples,sr=engine.create(cue['text'],voice=voice,speed=speed,lang='en-gb')
   assert sr==rate
   samples=trim_padding(samples,rate);duration=len(samples)/rate
   if duration<=available:break
   speed*=duration/available*1.015
  else:raise RuntimeError(f'Cannot fit complete narration: {ex["id"]} cue {i+1}')
  if not np.isfinite(samples).all():raise RuntimeError('Non-finite audio samples')
  pos=round((cue['start']+.12)*rate);track[pos:pos+len(samples)]=samples
  cues.append({'cue':i+1,'text':cue['text'],'start':cue['start']+.12,'speechSeconds':round(duration,3),'modelSpeed':round(speed,3),'availableSeconds':round(available,3)})
 peak=float(np.max(np.abs(track)))
 if peak==0:raise RuntimeError('Empty narration')
 # A single gain adjustment per film retains natural emphasis between phrases.
 track*=min(1.25,.89/peak)
 sf.write(output/f'{ex["id"]}-voice.wav',track,rate,subtype='PCM_16')
 report['clips'].append({'id':ex['id'],'duration':ex['duration'],'peak':round(float(np.max(np.abs(track))),5),'cues':cues})
 print(json.dumps({'id':ex['id'],'voice':voice,'seconds':round(time.time()-started,2),'maxModelSpeed':max(c['modelSpeed'] for c in cues)}),flush=True)
report['modelSha256']=hashlib.sha256(model_file.read_bytes()).hexdigest()
report['voicesSha256']=hashlib.sha256(voices_file.read_bytes()).hexdigest()
(output/'narration-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
