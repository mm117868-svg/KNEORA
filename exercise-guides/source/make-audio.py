from pathlib import Path
import json,subprocess,wave,os
root=Path(__file__).resolve().parent.parent
ff=os.environ.get('GUIDES_FFMPEG','ffmpeg')
for ex in json.loads((root/'exercises.json').read_text()):
 out=bytearray(30*24000*2)
 for i,c in enumerate(ex['cues']):
  stem=root/'source'/f'{ex["id"]}-{i}';aiff=stem.with_suffix('.aiff');wav=stem.with_suffix('.wav')
  subprocess.run(['say','-v','Daniel','-r','172','-o',str(aiff),c['text']],check=True)
  subprocess.run([ff,'-v','error','-y','-i',str(aiff),'-ar','24000','-ac','1',str(wav)],check=True)
  with wave.open(str(wav)) as w: pcm=w.readframes(w.getnframes());duration=w.getnframes()/w.getframerate()
  available=c['end']-c['start']-.2
  if duration>available:
   speed=duration/available
   subprocess.run([ff,'-v','error','-y','-i',str(aiff),'-af',f'atempo={speed}', '-ar','24000','-ac','1',str(wav)],check=True)
   with wave.open(str(wav)) as w:pcm=w.readframes(w.getnframes())
  start=int((c['start']+.08)*24000)*2;end=min(len(out),start+len(pcm));out[start:end]=pcm[:end-start]
  aiff.unlink();wav.unlink()
 with wave.open(str(root/'source'/f'{ex["id"]}-voice.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(out)
 print(ex['id'],flush=True)
