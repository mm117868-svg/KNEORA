/* The moving outline in the real page, in a real browser, against a leg whose position is known.

   Run the app (make serve), then: TEST_URL=http://localhost:8000/ node tests/browser-fluid-outline.cjs
   Needs Playwright. CHROME_PATH picks the browser, as in the other browser checks.

   Nothing in the page is changed except its two inputs:
     the camera is a drawn picture of a thigh and shin doing a seated knee extension (1.5 s out, 1 s held, 1.5 s
       back, 1 s rest), with the moment each picture was drawn written into its corner as black and white squares;
     the pose model is a stand-in that reads those squares and reports where the leg is in the picture it was
       given, with a little scatter, after keeping the page busy for 15 ms, as a working model does. It raises the
       figure's hand when asked, so the session can be started.
   Everything between is the app: the preview and session loops, the One Euro filter, fluid-outline.mjs, the canvas.

   At every repaint of the overlay the check reads which picture the video element is showing at that moment and
   compares where the ankle of the outline was drawn with where the ankle is in that picture. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:8000/';
const out = path.join(require('node:os').tmpdir(), 'fluid-outline-browser');
fs.mkdirSync(out, { recursive: true });

/* Shared by the camera, the pose stand-in and the judge. Pixels of a 1280 x 720 picture; time in milliseconds. */
const SHARED = `
  const W = 1280, H = 720, BITS = 16, CELL = 16, TICK = 4;
  const stroke = x => 10 * x ** 3 - 15 * x ** 4 + 6 * x ** 5;
  const legAt = ms => { const u = (ms / 1000) % 5, f = u < 1.5 ? stroke(u / 1.5) : u < 2.5 ? 1 : u < 4 ? 1 - stroke((u - 2.5) / 1.5) : 0, bend = (85 - 75 * f) * Math.PI / 180;
    return { hip: [820, 420], knee: [560, 410], ankle: [560 + 250 * Math.cos(Math.PI - 0.04 - bend), 410 - 250 * Math.sin(Math.PI - 0.04 - bend) + 0], bend: bend * 180 / Math.PI }; };
  const reader = document.createElement('canvas'); reader.width = BITS * CELL; reader.height = CELL; const rctx = reader.getContext('2d', { willReadFrequently: true });
  const pictureTime = video => { if (!video.videoWidth) return null; rctx.drawImage(video, 0, 0, BITS * CELL * video.videoWidth / W, CELL * video.videoHeight / H, 0, 0, BITS * CELL, CELL);
    const d = rctx.getImageData(0, 0, BITS * CELL, CELL).data; let n = 0; for (let b = 0; b < BITS; b++) if (d[((CELL >> 1) * BITS * CELL + b * CELL + (CELL >> 1)) * 4] > 127) n |= 1 << b; return n * TICK; };
`;
const MODELS = `${SHARED}
  let seed = 20260919; const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const scatter = () => 1.2 * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const busy = ms => { const end = performance.now() + ms; while (performance.now() < end); };
  function body(ms) { const leg = legAt(ms), lm = Array.from({ length: 33 }, (_, i) => ({ x: .55 + (i % 7) * .03, y: .1 + (i % 5) * .05, z: 0, visibility: .9, presence: .9 }));
    const put = (i, p, v = .97) => { lm[i] = { x: (p[0] + scatter()) / W, y: (p[1] + scatter()) / H, z: 0, visibility: v, presence: v }; };
    put(11, [850, 170]); put(12, [860, 175], .4); put(15, window.__raise ? [930, 20] : [800, 430]); put(23, leg.hip); put(25, leg.knee); put(27, leg.ankle); put(29, [leg.ankle[0] + 12, leg.ankle[1] + 28]); put(31, [leg.ankle[0] - 50, leg.ankle[1] + 34]);
    put(24, [leg.hip[0] + 12, leg.hip[1] + 8], .35); put(26, [572, 470], .35); put(28, [585, 655], .35); put(30, [600, 690], .3); put(32, [535, 695], .3); return lm; }
  export const FilesetResolver = { forVisionTasks: async () => ({}) };
  export const PoseLandmarker = { createFromOptions: async () => ({ setOptions: async () => {}, close() {},
    detect(source) { busy(15); return { landmarks: [body(performance.now())] }; },
    detectForVideo(video) { const ms = video instanceof HTMLVideoElement ? pictureTime(video) : null; busy(15); window.__results = (window.__results || 0) + 1; return { landmarks: ms === null ? [] : [body(ms)] }; } }) };
`;
const CAMERA_AND_JUDGE = `(() => {${SHARED}
  const cam = document.createElement('canvas'); cam.width = W; cam.height = H; const c = cam.getContext('2d');
  function draw() { const ms = Math.round(performance.now() / TICK) * TICK, leg = legAt(ms);
    const wall = c.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, '#9a9c9b'); wall.addColorStop(.7, '#b9bab8'); wall.addColorStop(1, '#d9d9d6'); c.fillStyle = wall; c.fillRect(0, 0, W, H);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#2f3437'; c.lineWidth = 120; c.beginPath(); c.moveTo(leg.hip[0] + 40, leg.hip[1] - 10); c.lineTo(leg.hip[0] + 60, 170); c.stroke();       // trunk
    c.strokeStyle = '#30343a'; c.lineWidth = 104; c.beginPath(); c.moveTo(...leg.hip); c.lineTo(leg.knee[0] + 90, leg.knee[1] + 3); c.stroke();                                                        // shorts
    c.strokeStyle = '#a9714f'; c.lineWidth = 84; c.beginPath(); c.moveTo(leg.knee[0] + 90, leg.knee[1] + 3); c.lineTo(...leg.knee); c.stroke(); c.lineWidth = 66; c.beginPath(); c.moveTo(...leg.knee); c.lineTo(...leg.ankle); c.stroke();
    for (let b = 0; b < BITS; b++) { c.fillStyle = (ms / TICK) >> b & 1 ? '#fff' : '#000'; c.fillRect(b * CELL, 0, CELL, CELL); }
    requestAnimationFrame(draw); }
  draw();
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => cam.captureStream(30) });

  // the judge: every repaint of the overlay, when it happened, which picture was on screen, and where the ankle was drawn
  const paints = window.__paints = []; let current = null; const P = CanvasRenderingContext2D.prototype, clear = P.clearRect, lineTo = P.lineTo, fillText = P.fillText;
  P.clearRect = function (...a) { if (this.canvas.id === 'canvas') { const video = document.getElementById('video'), shown = pictureTime(video); current = { at: performance.now(), shown, ankle: null, label: null }; paints.push(current); } return clear.apply(this, a); };
  P.lineTo = function (x, y) { if (this.canvas.id === 'canvas' && current && this.lineCap === 'round' && this.lineWidth > 4.5) current.ankle = [x, y]; return lineTo.call(this, x, y); };
  P.fillText = function (text, ...a) { if (this.canvas.id === 'canvas' && current) current.label = text; return fillText.call(this, text, ...a); };
  window.__judge = (from, seconds) => { const rows = paints.filter(p => p.at >= from && p.at < from + seconds * 1000 && p.ankle && p.shown !== null), rms = a => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / (a.length || 1));
    const off = rows.map(p => { const real = legAt(p.shown).ankle; return Math.hypot(p.ankle[0] - real[0], p.ankle[1] - real[1]); });
    /* drawn only when a result arrives, the outline shows the picture the model was given: one result behind */
    const results = []; for (const p of rows) if (!results.length || p.shown !== results.at(-1)) results.push(p.shown);
    const stepped = rows.map(p => { const before = results.filter(r => r < p.shown).at(-1) ?? p.shown, a = legAt(before).ankle, b = legAt(p.shown).ankle; return Math.hypot(a[0] - b[0], a[1] - b[1]); });
    const moving = rows.map((p, i) => i && Math.hypot(...legAt(p.shown).ankle.map((v, k) => v - legAt(rows[i - 1].shown).ankle[k])) > 0.5);
    const still = rows.filter((p, i) => moving[i] && Math.hypot(p.ankle[0] - rows[i - 1].ankle[0], p.ankle[1] - rows[i - 1].ankle[1]) === 0).length;
    const gaps = rows.slice(1).map((p, i) => p.at - rows[i].at).sort((a, b) => a - b), mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
    const wobbleIn = held => { const xs = rows.filter(p => held((p.shown / 1000) % 5)).map(p => p.ankle[0]); return rms(xs.map(x => x - mean(xs))); }, wobble = Math.max(wobbleIn(u => u > 1.9 && u < 2.4), wobbleIn(u => u > 4.4));
    return { repaintsPerSecond: rows.length / seconds, resultsPerSecond: (results.length - 1) / seconds, medianGapMs: gaps[gaps.length >> 1], rmsFromAnklePx: rms(off), worstFromAnklePx: Math.max(...off), oneResultBehindRmsPx: rms(stepped), repaintsThatStoodStillWhileTheLegMoved: still,
      wobbleAtRestPx: wobble, labels: [...new Set(rows.map(p => p.label))].length, tile: document.getElementById('angle').textContent }; };
})();`;

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }), args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/vendor/vision_bundle.mjs', route => route.fulfill({ contentType: 'text/javascript', body: MODELS }));
  await page.addInitScript(({ script, opdate }) => { localStorage.setItem('kr_patient', 'SYNTHETIC OUTLINE CHECK'); localStorage.setItem('kr_opdate', opdate); localStorage.setItem('kr_side', 'left');
    localStorage.setItem('kr_app_video', '0'); localStorage.setItem('kr_app_files', '0'); (0, eval)(script); }, { script: CAMERA_AND_JUDGE, opdate: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10) });
  await page.goto(base);
  await page.locator('#week2 .ex-card:not(:disabled)', { hasText: 'Seated knee extension' }).first().click();
  const start = page.getByRole('button', { name: /start exercise/i }).first(); await start.waitFor({ timeout: 20000 }); await start.click();
  await page.locator('#veil.hide').waitFor({ state: 'attached', timeout: 60000 });

  const judge = async seconds => { const from = await page.evaluate(() => performance.now()); await page.waitForTimeout(seconds * 1000 + 100); return page.evaluate(([from, seconds]) => window.__judge(from, seconds), [from, seconds]); };
  const picture = name => page.evaluate(() => { const v = document.getElementById('video'), c = document.getElementById('canvas'), o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const g = o.getContext('2d'); g.drawImage(v, 0, 0, o.width, o.height); g.drawImage(c, 0, 0); return o.toDataURL('image/jpeg', .92); })
    .then(data => fs.writeFileSync(path.join(out, name), Buffer.from(data.split(',')[1], 'base64')));
  const report = (name, r) => console.log(name.padEnd(12), Object.entries(r).map(([k, v]) => `${k} ${typeof v === 'number' ? +v.toFixed(2) : v}`).join(' | '));
  function hold(name, r, minimumRepaints) {
    assert.ok(r.repaintsPerSecond >= minimumRepaints, `${name}: the overlay is repainted ${r.repaintsPerSecond.toFixed(0)} times a second`);
    assert.ok(r.repaintsPerSecond > 1.3 * r.resultsPerSecond, `${name}: repainted more often than the picture changes (${r.repaintsPerSecond.toFixed(0)} against ${r.resultsPerSecond.toFixed(0)})`);
    assert.ok(r.rmsFromAnklePx < 6 && r.rmsFromAnklePx < 0.8 * r.oneResultBehindRmsPx, `${name}: ${r.rmsFromAnklePx.toFixed(1)} px from the ankle in the picture on screen, against ${r.oneResultBehindRmsPx.toFixed(1)} px one result behind`);
    assert.ok(r.worstFromAnklePx < 45, `${name}: never more than ${r.worstFromAnklePx.toFixed(1)} px off`);
    assert.equal(r.repaintsThatStoodStillWhileTheLegMoved, 0, `${name}: no repaint stands still while the leg moves`);
    assert.ok(r.wobbleAtRestPx < 1.2, `${name}: at rest the outline wobbles ${r.wobbleAtRestPx.toFixed(2)} px, less than the 1.2 px scatter of the results`);
    assert.ok((name !== 'positioning' || r.labels > 5) && /^\d+$/.test(r.tile), `${name}: the reading is written at the knee and in the tile`);
  }

  await page.waitForTimeout(2500);
  const positioning = await judge(10); report('positioning', positioning); await picture('positioning.jpg');
  await page.evaluate(() => { window.__raise = true; }); await page.waitForTimeout(2600); await page.evaluate(() => { window.__raise = false; });   // two seconds of raised hand, then the countdown
  await page.waitForFunction(() => !document.getElementById('finish').disabled, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const session = await judge(10); report('session', session); await picture('session.jpg');
  await page.waitForTimeout(12000);   // four more movements, for the counter
  const counted = await page.evaluate(() => ({ reps: document.getElementById('reps').textContent, track: document.getElementById('track').textContent })); console.log('counter     ', JSON.stringify(counted));
  await browser.close();

  hold('positioning', positioning, 50); hold('session', session, 35);
  assert.ok(+counted.reps >= 3 && +counted.reps <= 5, `the counter saw ${counted.reps} of the four or so movements made while it watched`);
  assert.deepEqual(errors, []);
  console.log(`fluid outline browser check passed; pictures in ${out}`);
})().catch(error => { console.error(error); process.exit(1); });
