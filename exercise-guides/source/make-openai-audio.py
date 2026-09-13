"""Render Marin narration, then replace video audio after the whole batch passes."""
import argparse
import array
import getpass
import hashlib
import json
import os
import shutil
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'source' / 'openai-narration'
MODEL = 'gpt-4o-mini-tts'
VOICE = 'marin'
RATE = 24000


def speech_request(text, direction, speed):
    return {'model': MODEL, 'voice': VOICE, 'input': text,
            'instructions': direction, 'response_format': 'pcm', 'speed': speed}


def save_wav(path, samples):
    with wave.open(str(path), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(samples.tobytes())


def synthesise(payload, api_key, cache):
    serialised = json.dumps(payload, sort_keys=True).encode()
    digest = hashlib.sha256(serialised).hexdigest()
    pcm_path = cache / f'{digest}.pcm'
    if pcm_path.exists():
        data = pcm_path.read_bytes()
    else:
        request = urllib.request.Request('https://api.openai.com/v1/audio/speech',
            data=serialised, headers={'Authorization': 'Bearer '+api_key,
                                     'Content-Type': 'application/json'})
        context = ssl.create_default_context()
        try:
            import certifi
            context = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            pass
        try:
            with urllib.request.urlopen(request, context=context, timeout=120) as response:
                if 'json' in response.headers.get('Content-Type', ''):
                    raise RuntimeError('The service returned an error instead of audio.')
                data = response.read()
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                raise RuntimeError('OpenAI API access was refused. Check the key and model permissions.') from None
            if error.code == 429:
                raise RuntimeError('OpenAI API quota or rate limit reached. Completed speech clips are cached for a later run.') from None
            raise RuntimeError(f'OpenAI speech request failed (HTTP {error.code}).') from None
        if len(data) < 2400 or len(data) % 2:
            raise RuntimeError('The speech response did not contain valid PCM audio.')
        pcm_path.write_bytes(data)
    samples = array.array('h', data)
    if sys.byteorder != 'little':
        samples.byteswap()
    active = [i for i, value in enumerate(samples) if abs(value) > 4]
    if not active:
        raise RuntimeError('The speech response was silent.')
    padding = round(.10*RATE)
    return samples[max(0, active[0]-padding):min(len(samples), active[-1]+padding+1)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Validate scripts without contacting OpenAI.')
    parser.add_argument('--prompt-key', action='store_true', help='Ask privately for an API key if none is configured.')
    parser.add_argument('--only', help='Render one named exercise for review.')
    args = parser.parse_args()
    exercises = json.loads((ROOT / 'exercises.json').read_text())
    if args.only:
        exercises = [exercise for exercise in exercises if exercise['id'] == args.only]
    if not exercises:
        raise RuntimeError('Unknown exercise.')
    direction = (SOURCE / 'voice-direction.txt').read_text().strip()
    for exercise in exercises:
        for cue in exercise['cues']:
            assert cue['end'] > cue['start'] and cue['text'].strip()
            assert len(cue['text']) < 4096
    if args.dry_run:
        print(json.dumps({'status': 'ready', 'model': MODEL, 'voice': VOICE,
            'exercises': [ex['id'] for ex in exercises],
            'cues': sum(len(ex['cues']) for ex in exercises), 'networkRequests': 0}, indent=2))
        return
    api_key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not api_key and args.prompt_key:
        print('Enter your OpenAI API key. It stays in this process and is not saved. API usage is billed by OpenAI.')
        api_key = getpass.getpass('OpenAI API key (hidden): ').strip()
    if not api_key:
        raise RuntimeError('No OpenAI API key is configured. Use the Generate Marin guides.command launcher.')
    ffmpeg = os.environ.get('GUIDES_FFMPEG') or shutil.which('ffmpeg')
    if not ffmpeg:
        candidates = list(ROOT.parents[1].glob('optical-rep-counter/local-analysis/media-tools/lib/python*/site-packages/imageio_ffmpeg/binaries/ffmpeg-*'))
        ffmpeg = str(candidates[0]) if candidates else None
    if not ffmpeg:
        raise RuntimeError('FFmpeg is required. Set GUIDES_FFMPEG to its executable path.')
    cache = SOURCE / '.cache'
    cache.mkdir(parents=True, exist_ok=True)
    staged = SOURCE / '.staged'
    staged.mkdir(parents=True, exist_ok=True)
    manifest = {'engine': 'OpenAI Speech API', 'model': MODEL, 'voice': VOICE,
                'direction': direction, 'clips': []}
    for exercise in exercises:
        track = array.array('h', [0]) * round(exercise['duration']*RATE)
        cues = []
        for number, cue in enumerate(exercise['cues'], 1):
            speed = .95
            available = cue['end']-cue['start']-.35
            for attempt in range(3):
                samples = synthesise(speech_request(cue['text'], direction, speed), api_key, cache)
                duration = len(samples)/RATE
                if duration <= available:
                    break
                speed *= duration/available*1.015
                if speed > 1.12:
                    raise RuntimeError(f'{exercise["id"]}, cue {number}: too long for a relaxed delivery. Existing videos remain intact.')
            else:
                raise RuntimeError(f'{exercise["id"]}, cue {number}: speech did not fit its cue.')
            start = cue['start']+.15
            position = round(start*RATE)
            track[position:position+len(samples)] = samples
            cues.append({'cue': number, 'text': cue['text'], 'start': start,
                         'speechSeconds': duration, 'availableSeconds': available, 'modelSpeed': speed})
            print(f'{exercise["id"]}: cue {number}/{len(exercise["cues"])} ready', flush=True)
        peak = max(abs(value) for value in track)
        if peak == 0:
            raise RuntimeError('Empty narration.')
        gain = min(1.0, 29163/peak)
        track = array.array('h', (round(value*gain) for value in track))
        audio_path = staged / f'{exercise["id"]}-voice.wav'
        save_wav(audio_path, track)
        original = ROOT / 'videos' / f'{exercise["id"]}.mp4'
        target = staged / original.name
        subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(original), '-i', str(audio_path),
            '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
            '-t', str(exercise['duration']), '-movflags', '+faststart', str(target)], check=True)
        subprocess.run([ffmpeg, '-v', 'error', '-i', str(target), '-f', 'null', '-'], check=True)
        video_hashes = []
        for file in (original, target):
            video_hashes.append(subprocess.check_output([ffmpeg, '-v', 'error', '-i', str(file),
                '-map', '0:v:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']))
        if video_hashes[0] != video_hashes[1]:
            raise RuntimeError('The animation changed unexpectedly.')
        manifest['clips'].append({'id': exercise['id'], 'duration': exercise['duration'],
                                  'videoStreamUnchanged': True, 'cues': cues})
    # Publish only once every requested recording and video passes the checks above.
    backup = SOURCE / '.previous-videos'
    backup.mkdir(exist_ok=True)
    for exercise in exercises:
        ident = exercise['id']
        original = ROOT / 'videos' / f'{ident}.mp4'
        if not (backup / original.name).exists():
            shutil.copy2(original, backup / original.name)
        (staged / original.name).replace(original)
        (staged / f'{ident}-voice.wav').replace(ROOT / 'source' / f'{ident}-voice.wav')
    (SOURCE / 'render-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f'Complete: {len(exercises)} videos now use Marin. Reload the exercise library.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
        raise SystemExit(str(error)) from None
