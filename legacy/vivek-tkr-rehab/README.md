# Vivek's original TKR rehab page

`tkr-rehab.html.txt` is the single page Vivek Sharma published on 17 June 2026
at [viviscool/knee_recovery](https://github.com/viviscool/knee_recovery). The
patient app at the root of this repository grew out of it: the week by week
phases, the shape of the exercise library, the icons and the safety notice all
started here. Its two commits are part of this repository's history.

It is kept as a text file on purpose, so that GitHub Pages serves it as source
to read and not as a page to use.

## Why it is not run

1. **The knee angle is wrong on any frame that is not square.** The page passes
   MediaPipe's normalised landmarks (0 to 1 across the width, 0 to 1 down the
   height) straight into the angle calculation without scaling them back to
   pixels. On a 16:9 picture a true 90 degree heel slide reads about 121 degrees
   with the phone in landscape and about 59 in portrait. The error is zero only
   when thigh and shin happen to lie along the picture's axes. The app scales to
   pixels first (`pickSide` in `kneerec.js`), and `tests/legacy-angle.test.mjs`
   keeps both facts on record.
2. **It measures whichever leg is easier to see**, not the operated one. The app
   asks for the operated leg and will not start without it.
3. **It counts a repetition only when a fixed target angle is reached**, from
   the landmark trace, and coaches the patient live against that target. The
   app's design rules keep the measurement and the counting apart: counting
   never sees landmarks, nothing scores a repetition, and nothing corrects the
   patient during the exercise. Those parts were left behind deliberately.
4. It loads MediaPipe from a CDN at `@latest`, so its behaviour can change
   without the file changing. The app ships a pinned copy in `vendor/`.
5. Nothing is saved, so nothing reaches the physiotherapist.

## What came across in KNEORA

- **Forward step-up** (weeks 4 to 8) and **Functional bend** (week 8 onwards),
  the two exercises this page had and the app did not. They are in the app's
  library as pending cards, with Vivek's aims (70 and 120 degrees) carried over
  unreviewed and no demonstration video yet.

Everything else this page does, the app already does differently.
