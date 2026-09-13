"""Generate the app's Marin countdown and completion prompts without saving an API key."""
import argparse
import array
import datetime
import getpass
import hashlib
import json
import os
from pathlib import Path
import ssl
import sys
import urllib.error
import urllib.request
import wave

ROOT = Path(__file__).resolve().parent.parent
RATE = 24000
WORDS = ("Five.", "Four.", "Three.", "Two.", "One.")


def request_payload(profile, text, speed=1.0, countdown=False):
    return {
        "model": profile["model"], "voice": profile["voice"], "input": text,
        "instructions": profile["instructions"] + ("\nThis is one number in a countdown. Say only the single supplied number, clearly and naturally, in under one second." if countdown else ""),
        "response_format": "pcm", "speed": speed,
    }


def trim_clip(data):
    if len(data) < 2400 or len(data) % 2:
        raise RuntimeError("The speech response was not valid PCM audio.")
    clip = array.array("h", data)
    if sys.byteorder != "little":
        clip.byteswap()
    active = [i for i, value in enumerate(clip) if abs(value) > 16]
    if not active:
        raise RuntimeError("A generated number was silent.")
    return clip[max(0, active[0] - round(.025 * RATE)):min(len(clip), active[-1] + round(.07 * RATE))]


def assemble(clips):
    if len(clips) != 5:
        raise RuntimeError("The countdown needs five number clips.")
    result = array.array("h", [0]) * (5 * RATE)
    for index, clip in enumerate(clips):
        if not clip or not any(clip) or len(clip) > round(.9 * RATE):
            raise RuntimeError("A number is silent or too long for its one-second slot. No final audio was replaced.")
        position = index * RATE + round(.04 * RATE)
        result[position:position + len(clip)] = clip
    return result


def generate(payload, api_key, cache):
    encoded = json.dumps(payload, sort_keys=True).encode()
    cached = cache / (hashlib.sha256(encoded).hexdigest() + ".pcm")
    if cached.exists():
        return trim_clip(cached.read_bytes())
    request = urllib.request.Request("https://api.openai.com/v1/audio/speech", data=encoded,
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"})
    context = ssl.create_default_context()
    try:
        import certifi
        context = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    try:
        with urllib.request.urlopen(request, context=context, timeout=60) as response:
            if "json" in response.headers.get("Content-Type", ""):
                raise RuntimeError("The speech service returned an error instead of audio.")
            data = response.read()
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            raise RuntimeError("OpenAI API access was refused. Check the key and model permissions.") from None
        if error.code == 429:
            raise RuntimeError("OpenAI API quota or rate limit reached. Completed clips are cached for a later run.") from None
        raise RuntimeError(f"OpenAI speech request failed (HTTP {error.code}).") from None
    clip = trim_clip(data)
    cached.write_bytes(data)
    return clip


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--prompt-key", action="store_true")
    args = parser.parse_args()
    profile = json.loads((ROOT / "voice-profile.json").read_text())
    if profile["voice"] != "marin":
        raise RuntimeError("The approved app voice is Marin.")
    if args.dry_run:
        print(json.dumps({"voice": profile["voice"], "model": profile["model"], "words": WORDS,
            "countdown_duration_s": 5, "completion_prompts": profile["prompts"], "network_requests": 0, "status": "Ready to generate; audio not created"}, indent=2))
        return
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key and args.prompt_key:
        print("Generate the countdown and two completion messages using OpenAI. API charges apply. Your key stays in this process and is not saved.")
        api_key = getpass.getpass("OpenAI API key (hidden): ").strip()
    if not api_key:
        raise RuntimeError("No OpenAI API key is configured. Double-click Generate Marin app audio.command.")
    cache = ROOT / "tools" / ".countdown-cache"
    cache.mkdir(parents=True, exist_ok=True)
    clips = []
    for word in WORDS:
        for speed in (1.0, 1.12):
            clip = generate(request_payload(profile, word, speed, countdown=True), api_key, cache)
            if len(clip) <= round(.9 * RATE):
                break
        else:
            raise RuntimeError(f"{word} did not fit its countdown slot. No final audio was replaced.")
        clips.append(clip)
        print(f"{word} ready", flush=True)
    recordings = {"countdown": assemble(clips)}
    for name, text in profile["prompts"].items():
        recordings[name] = generate(request_payload(profile, text), api_key, cache)
        print(f"{name} ready", flush=True)
    output = ROOT / "audio" / "marin"
    output.mkdir(parents=True, exist_ok=True)
    prompts = {}
    for name, samples in recordings.items():
        duration = len(samples) / RATE
        if sys.byteorder != "little":
            samples.byteswap()
        # Content-addressed audio lets the manifest switch atomically without replacing a file in use.
        filename = name + "-" + hashlib.sha256(samples.tobytes()).hexdigest()[:12] + ".wav"
        with wave.open(str(output / filename), "wb") as audio:
            audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(RATE)
            audio.writeframes(samples.tobytes())
        with wave.open(str(output / filename), "rb") as audio:
            if audio.getnframes() != len(samples) or (name == "countdown" and duration != 5):
                raise RuntimeError("Audio duration check failed.")
        prompts[name] = {"file": filename, "duration_s": duration}
        if name == "countdown":
            prompts[name].update({"words": list(WORDS), "cue_starts_s": [0, 1, 2, 3, 4], "speech_offset_s": .04})
        else:
            prompts[name]["text"] = profile["prompts"][name]
    manifest = {
        "voice": profile["voice"], "model": profile["model"], "instructions": profile["instructions"],
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "prompts": prompts,
    }
    staged = output / ".manifest-staged.json"
    staged.write_text(json.dumps(manifest, indent=2) + "\n")
    staged.replace(output / "manifest.json")
    print("Marin app audio generated. Listen to the recordings, then reload the app.")
    print(output)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError) as error:
        raise SystemExit(str(error)) from None
