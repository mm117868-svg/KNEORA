# Exercise narration

The user approved **Marin**, with a soft, warm British female delivery, on 13 September 2026. The [approved audio sample](openai-narration/approved-marin-preview.mp3) was generated with GPT-4o mini TTS through [OpenAI.fm](https://www.openai.fm/). The exact [voice direction](openai-narration/voice-direction.txt) and all nine exercise scripts are saved in `openai-narration/`.

## Current render status

The complete Marin video batch has **not** been generated. Eight videos still contain the original macOS Daniel narration. Seated knee extension contains the earlier local Kokoro Emma sample. The public demo's full recording download did not complete, and a direct request returned HTTP 429. No OpenAI API key was configured in the generation environment.

The approved voice sample is separate from the exercise videos. It is a voice audition, not the canonical clinical script. The existing `exercises.json` remains the source of the instructions and cue timings used for the full batch.

## Complete the Marin recordings

Double-click **Generate Marin guides.command** in the exercise-guides folder. The launcher asks for an OpenAI API key using a hidden local prompt. It does not save the key or put it in the browser, project files, command history or generated media. API usage is billed by OpenAI. A configured `OPENAI_API_KEY` environment variable can also be used.

The generator uses `gpt-4o-mini-tts`, voice `marin`, the saved delivery instructions, and PCM audio at 24 kHz. OpenAI documents support for controlling accent, tone, intonation and pace in its [text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech). This is an exportable speech model, not a claim that the videos use ChatGPT's live voice conversation system.

From the repository root:

```sh
"../voice-tools/venv/bin/python" exercise-guides/source/make-openai-audio.py --dry-run
"../voice-tools/venv/bin/python" exercise-guides/source/make-openai-audio.py --prompt-key
```

Use `--only straight_leg_raise` for a single full guide. Without `--only`, all nine are generated. `GUIDES_FFMPEG` overrides FFmpeg discovery.

Each instruction is synthesised separately and placed in its matching cue window. The generator leaves breathing space between cues and refuses to cut off speech or force a substantially faster delivery. Completed speech requests are cached so a failed run can resume. It decodes each staged video and checks that the animation stream is unchanged before replacing the requested videos. Previous videos are retained in an ignored backup folder.

The successful run writes `openai-narration/render-manifest.json` with the model, voice, cue timings and checks. Audio has not yet been generated or assessed through this API route. Remove the library's pending narration notice only after a completed render and listening review.

## Local fallback

`make-audio.py` retains the Kokoro v1.0 / `bf_emma` fallback, through [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx). It runs locally without Fal credit. This fallback is not the selected final voice. Its earlier manifest covers the seated knee extension sample only.
