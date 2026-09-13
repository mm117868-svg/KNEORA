"""Replace narration while copying the previously checked animation stream."""
import os,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
ff=os.environ.get('GUIDES_FFMPEG','ffmpeg')
source=Path(os.environ.get('GUIDES_AUDIO_OUTPUT',str(root/'source')))
only=set(filter(None,os.environ.get('GUIDES_ONLY','').split(',')))
for ex in json.loads((root/'exercises.json').read_text()):
 if only and ex['id'] not in only:continue
 video=root/'videos'/f'{ex["id"]}.mp4';temp=video.with_name(video.stem+'.narration.tmp.mp4')
 subprocess.run([ff,'-v','error','-y','-i',str(video),'-i',str(source/f'{ex["id"]}-voice.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','128k','-t',str(ex['duration']),'-movflags','+faststart','-map_metadata','-1',str(temp)],check=True)
 temp.replace(video);print(ex['id'],flush=True)
