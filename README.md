# KNEORA

Home knee rehabilitation after total knee replacement, from Cambridge Kinematics.

| Path | What it is | Where it came from |
| --- | --- | --- |
| `/` (`index.html` and the modules beside it) | **The patient app.** Runs in a browser with any camera: a week by week programme, a whole-session knee angle from MediaPipe, repetition counting from pixels alone, a recovery summary, questionnaires and a physio report. | `mm117868-svg/knee-recovery`, with its full history |
| `legacy/vivek-tkr-rehab/` | **Vivek's original page**, the single file the app grew out of. Archived as text, not run. | `viviscool/knee_recovery`, with its history |

This is a development prototype. It has not been clinically validated for
diagnosis or treatment decisions, and nothing here replaces a physiotherapist's
or surgeon's plan.

Live app: <https://mm117868-svg.github.io/KNEORA/>

## Run it

```bash
make help        # the targets
make test        # the app's checks (Node)
make serve       # the app on http://localhost:8000
```

On a Mac, double-clicking `Open the app.command` does the same as `make serve`
and opens the browser. A camera only works on `localhost` or over https, which
is why a local server or the live link is needed and opening `index.html` from
disk is not enough.

- The app: [PATIENT-APP.md](PATIENT-APP.md), then the notes it links to.
- What is drawn over the picture, and why the picture stays smooth:
  [LIVE-DISPLAY.md](LIVE-DISPLAY.md).
- The recorded-exercise analyser: [video-analysis/README.md](video-analysis/README.md).

## Rules the app keeps

These are in the code already (`kneerec.js`, `kneetrack.js`, the exercise library
in `index.html`) and are repeated here because they decided what was combined.

1. Measurement and counting are separate layers on the same frames. Measurement
   goes from landmarks to a knee angle to whole-session statistics and never
   marks where a repetition starts or ends. Counting sees pixels and the clock
   only, never landmarks, joints or angles.
2. Nothing scores a repetition or corrects the patient during an exercise.
3. The app never reads MediaPipe's predicted depth.
4. The patient chooses the operated leg. The app does not guess, and only that
   leg is ever outlined on the picture.
5. MediaPipe, its models and the tracking scripts are pinned copies in this
   repository, so the app's behaviour changes only when this repository does.

## What was combined, and what was left out

The app already had the phases, library shape, icons and safety notice of
Vivek's page. The two exercises it lacked, Forward step-up and Functional bend,
are now in the library as pending cards. His live coaching against a target, his
target-gated counting from the landmark trace and his automatic choice of leg
were left out under rules 1, 2 and 4. His knee angle sum was left out because it
is wrong on any picture that is not square: see
[legacy/vivek-tkr-rehab/README.md](legacy/vivek-tkr-rehab/README.md).

## Known limits

- The knee angle is unsigned. It cannot show hyperextension, and near a straight
  knee any noise reads as bend.
- Counts are experimental movement attempts, not clinical range or form
  assessments. The position models came from a small set of recordings of one
  person.
- An open palm two metres or more from the camera can be too small for the hand
  model to find. The Finish button and the capture button remain.
- Records stay in the browser that made them. There is no account and no sync.

## Ownership

© 2026 Cambridge Kinematics Limited. All rights reserved. Cambridge Kinematics
is a trade mark of Cambridge Kinematics Limited (UK application UK00004438535,
registration pending). Third party components keep their own licences:
`vendor/speech/NOTICE.txt`, `vendor/track/NOTICE.txt`,
`exercise-guides/vendor/LICENSE`, `video-analysis/THIRD_PARTY_NOTICES.md` and
`video-analysis/vendor/LICENSE`.
