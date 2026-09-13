# Development results, 13 September 2026

The position-recognition approach is implemented as a separate browser experiment. No published patient counter was replaced.

| Check | Result | Interpretation |
|---|---|---|
| Training recording, `01.39.33` | 7 returns in offline processing and actual browser replay | Training fit, not independent validation |
| Different recording, `02.04.17` | 5 offline, 4 in actual browser replay, with 1 unconfirmed | Same person and room; development comparison, not an untouched test set |
| Stationary image | 0 | Synthetic control |
| Brightness change | 0 | Synthetic control |
| Small camera translation | 0 | Synthetic control |
| Moving patch in excluded upper-left area | 0 | Synthetic control; does not establish rejection of all unrelated movement |
| Covering the leg region | 0 | Synthetic control; real occlusion remains unvalidated |
| Counter state tests | 5 passed | Includes holds, duplicate times, incomplete returns and recovery after uncertainty |
| Browser page errors | 0 during both full replays | Functional browser check |

The browser missed the first return in the second recording because model confidence stayed below the 0.75 classification threshold for more than 0.5 seconds during the return. That movement was marked unconfirmed. The threshold was not relaxed to force a matching total.

The two implementations read slightly different rendered video images: the offline path uses previously decoded/resized PNG frames while the browser decodes the original MP4. Input processing is aligned, but exact numerical or classification equivalence is not assumed. The browser's measured result is the relevant handoff result.

Training used 24 manually inspected frames from one recording, with geometric and brightness augmentation. The second recording informed development after the initial model failed; no claim of independent validation is made. Initial background and distraction failures led to excluding the leftmost part of the known view. This is a view-specific prototype, not an anatomical detector.

The browser initially learned a blank starting image because `loadeddata` fired before a drawable frame was presented. It now waits for `requestVideoFrameCallback` before capturing the resting reference. Model inference and the full playback flow were then retested.

The classifier has not been trained on a representative patient dataset. It does not establish working-leg identity, exercise quality, tiny-range sensitivity, new-room accuracy or Raspberry Pi 5 throughput. The live-camera button is a preview only, and creates no patient session record.
