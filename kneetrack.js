/* Knee Recovery: the knee tracker, a second way of counting from the picture alone.

   A grid of points is laid inside the box the patient or physiotherapist drew round the knee and
   followed from frame to frame by pyramidal Lucas-Kanade optical flow (jsfeat, MIT). The median of the
   points that survive is the knee's step between two frames; adding those steps up along the direction
   the knee actually travels gives a path: the knee going back and forth. A repetition is one full swing
   of that path, taken at the same point of the swing every time.

   What this layer may see, as in CONTRIBUTING.md: pixels and the clock. No key points, no body model,
   no learned model of any kind. The path is compared with nothing but itself: each frame is matched to
   the frame before it, never to a stored reference movement, and no similarity matrix is built.

   Why it is steadier than frame differencing: the count comes from where the knee is in its swing
   rather than from how fast the changed pixels are moving, so a pause, a slow repetition or a passing
   shadow does not add or drop a count. */

export const TRACK_VERSION = "kneetrack-0.2.0";

const PW = 160;            // the picture is counted at this width, as in the pixel-motion counter
const GRID = 7;            // points across the box
const WIN = 15;            // optical flow window, in pixels of the small picture
const PYR = 3;             // pyramid levels
const RESEED_S = 1.5;      // points are laid again this often, and whenever too few survive
const MIN_KEEP = 0.5;      // reseed when fewer than half the points survived
const MIN_AMP = 1.2;       // a swing smaller than this, in small-picture pixels, is not a repetition
const MIN_PERIOD_S = 0.6;  // two repetitions cannot be closer than this

let loading = null;
export function loadTracker() {
  if (!loading) {
    loading = new Promise((ok, fail) => {
      if (window.jsfeat) return ok(window.jsfeat);
      const s = document.createElement("script");
      s.src = new URL("vendor/track/jsfeat-min.js", import.meta.url).href; s.async = true;
      s.onload = () => window.jsfeat ? ok(window.jsfeat) : fail(new Error("jsfeat did not load"));
      s.onerror = () => fail(new Error("could not load the knee tracker"));
      document.head.appendChild(s);
    }).catch(e => { loading = null; throw e; });
  }
  return loading;
}

/* One repetition is one full swing of the path. The swing's size is learned as it goes: the count fires
   when the path comes back through the low third having passed through the high third, which is the same
   moment in every repetition whatever the speed. Nothing is compared with a stored movement. */
export class SwingCounter {
  constructor(fps, minAmplitude=MIN_AMP, {orientFromStart=false}={}) { this.orientFromStart=orientFromStart; this.minAmplitude=minAmplitude; this.aS = 1 - Math.exp(-1 / (0.15 * fps)); this.aE = 1 - Math.exp(-1 / (6 * fps)); this.reset(); }
  reset() { this.origin=null; this.direction=0; this.p = 0; this.s = 0; this.hi = 0; this.lo = 0; this.high = false; this.reps = 0; this.times = []; this.amps = []; this.ready = false; }
  update(p, t) {
    if (this.orientFromStart) {
      this.origin ??= p;
      const excursion = p-this.origin;
      if (!this.direction && Math.abs(excursion)>=this.minAmplitude) this.direction=Math.sign(excursion);
      p=this.direction ? excursion*this.direction : 0;
    }
    this.s += this.aS * (p - this.s);                       // the path, smoothed
    if (!this.ready) { this.hi = this.lo = this.s; this.ready = true; }
    this.hi = this.s > this.hi ? this.s : this.hi + this.aE * (this.s - this.hi);   // the envelope of the swing
    this.lo = this.s < this.lo ? this.s : this.lo + this.aE * (this.s - this.lo);
    const amp = this.hi - this.lo; let rep = 0;
    if (amp >= this.minAmplitude) {
      const up = this.lo + 0.7 * amp, down = this.lo + 0.3 * amp;
      if (this.s >= up) this.high = true;
      else if (this.s <= down && this.high) {
        if (!this.times.length || t - this.times[this.times.length - 1] >= MIN_PERIOD_S) {
          this.reps++; this.times.push(t); this.amps.push(+amp.toFixed(2)); rep = 1;
        }
        this.high = false;
      }
    }
    return [this.s, amp, rep];
  }
  tempo(k = 4) { if (this.times.length < 2) return null; const ts = this.times.slice(-(k + 1)); return (ts[ts.length - 1] - ts[0]) / (ts.length - 1); }
}

export class KneeTracker {
  constructor(fw, fh, fps, {smallMovement=false}={}) {
    this.pw=smallMovement?640:PW; this.smallMovement=smallMovement;
    this.fw = fw; this.fh = fh; this.fps = fps; this.scale = this.pw / fw; this.ph = Math.round(fh * this.scale);
    this.counter = new SwingCounter(fps,smallMovement ? .35 : MIN_AMP,{orientFromStart:smallMovement}); this.rows = []; this.hist = []; this.path = 0; this.drift = 0;
    this.aD = 1 - Math.exp(-1 / (8 * fps));    // the slow wander of the whole leg is taken out of the path
    this.n = 0; this.kept = 0; this.sinceSeed = 0; this.ready = false; this.tracking = false;
    this.work = document.createElement("canvas"); this.work.width = this.pw; this.work.height = this.ph;
    this.wctx = this.work.getContext("2d", { willReadFrequently: true });
  }

  /* jsfeat is loaded before the session starts; nothing here fetches anything */
  attach(jsfeat) {
    this.jsfeat = jsfeat;
    const max = GRID * GRID;
    this.prevPyr = new jsfeat.pyramid_t(PYR); this.currPyr = new jsfeat.pyramid_t(PYR);
    this.prevPyr.allocate(this.pw, this.ph, jsfeat.U8_t | jsfeat.C1_t);
    this.currPyr.allocate(this.pw, this.ph, jsfeat.U8_t | jsfeat.C1_t);
    this.prevXY = new Float32Array(max * 2); this.currXY = new Float32Array(max * 2);
    this.status = new Uint8Array(max); this.ready = true;
  }

  reset() { this.counter.reset(); this.rows = []; this.hist = []; this.path = 0; this.drift = 0; this.n = 0; this.sinceSeed = 0; }

  seed(box) {
    const [bx, by, bw, bh] = box.map(v => v * this.scale);
    let k = 0;
    for (let i = 1; i <= GRID; i++) for (let j = 1; j <= GRID; j++) {
      const x = bx + bw * i / (GRID + 1), y = by + bh * j / (GRID + 1);
      if (x < 2 || y < 2 || x > this.pw - 3 || y > this.ph - 3) continue;
      this.prevXY[k * 2] = x; this.prevXY[k * 2 + 1] = y; k++;
    }
    this.n = k; this.sinceSeed = 0;
  }

  /* one frame. box is the counting box in full-picture pixels, the same box the pixel counter uses. */
  update(source, frame, t, box) {
    if (!this.ready) return 0;
    const J = this.jsfeat;
    this.wctx.drawImage(source, 0, 0, this.pw, this.ph);
    const img = this.wctx.getImageData(0, 0, this.pw, this.ph);
    J.imgproc.grayscale(img.data, this.pw, this.ph, this.currPyr.data[0]);
    this.currPyr.build(this.currPyr.data[0], true);

    let step = [0, 0], kept = 0;
    if (this.n > 0) {
      J.optical_flow_lk.track(this.prevPyr, this.currPyr, this.prevXY, this.currXY, this.n, WIN, 30, this.status, 0.01, 0.0001);
      const dx = [], dy = [];
      for (let i = 0; i < this.n; i++) {
        if (!this.status[i]) continue;
        const x = this.currXY[i * 2], y = this.currXY[i * 2 + 1];
        if (x < 0 || y < 0 || x >= this.pw || y >= this.ph) continue;
        const a = x - this.prevXY[i * 2], b = y - this.prevXY[i * 2 + 1];
        if (Math.abs(a) > 24 || Math.abs(b) > 24) continue;           // a point that jumped has lost the knee
        dx.push(a); dy.push(b); kept++;
      }
      if (kept >= 4) {
        // In small-movement mode the wide box may contain mostly stationary
        // background. Use a coherent moving group, rather than its static median.
        if(this.smallMovement){
          const groups=Array.from({length:8},()=>[]);
          for(let i=0;i<dx.length;i++)if(Math.hypot(dx[i],dy[i])>=.04){const bin=Math.floor((Math.atan2(dy[i],dx[i])+Math.PI)/(2*Math.PI)*8)%8;groups[bin].push([dx[i],dy[i]]);}
          const group=groups.sort((a,b)=>b.length-a.length)[0];
          if(group.length>=4)step=[median(group.map(p=>p[0])),median(group.map(p=>p[1]))];
        }else step = [median(dx), median(dy)];
      }
    }
    this.kept = kept; this.tracking = kept >= 4;

    // the points are laid again often, so the path is a sum of short steps and cannot wander off with them
    this.sinceSeed += 1 / this.fps;
    if (this.n === 0 || kept < MIN_KEEP * this.n || this.sinceSeed >= RESEED_S) this.seed(box);
    else { const tmp = this.prevXY; this.prevXY = this.currXY; this.currXY = tmp; }
    const p = this.prevPyr; this.prevPyr = this.currPyr; this.currPyr = p;

    const d = this.axis(step[0], step[1]);
    this.path += d;
    this.drift += this.aD * (this.path - this.drift);                 // slow wander of the leg, taken out
    const [s, amp, rep] = this.counter.update(this.path - this.drift, t);
    this.signal = s; this.amp = amp;
    this.rows.push([frame, t, +step[0].toFixed(3), +step[1].toFixed(3), kept, +s.toFixed(3), +amp.toFixed(3), rep]);
    return rep;
  }

  /* the direction the knee actually travels, from the steps so far: the long axis of their spread */
  axis(dx, dy) {
    this.hist.push([dx, dy]); if (this.hist.length > 150) this.hist.shift();
    if (this.hist.length < 10) return dy;
    let xx = 0, xy = 0, yy = 0;
    for (const [a, b] of this.hist) { xx += a * a; xy += a * b; yy += b * b; }
    const th = 0.5 * Math.atan2(2 * xy, xx - yy); let v = [Math.cos(th), Math.sin(th)];
    if (Math.abs(v[0]) >= Math.abs(v[1])) { if (v[0] < 0) v = [-v[0], -v[1]]; } else if (v[1] < 0) v = [-v[0], -v[1]];
    return dx * v[0] + dy * v[1];
  }

  summary(duration) {
    const tempo = this.counter.tempo(Math.max(4, this.counter.times.length));
    const tracked = this.rows.filter(r => r[4] >= 4).length;
    const amps = this.counter.amps;
    return {
      repetitions: this.counter.reps, source: "knee_tracker", version: TRACK_VERSION, small_movement: this.smallMovement, working_width: this.pw, minimum_swing_px: this.counter.minAmplitude,
      tempo_s_per_rep: tempo ? +tempo.toFixed(2) : null,
      tracked_fraction: +(tracked / Math.max(1, this.rows.length)).toFixed(3),
      tracked_time_s: +(tracked / Math.max(1, this.rows.length) * duration).toFixed(1),
      mean_swing_px: amps.length ? +(amps.reduce((a, b) => a + b, 0) / amps.length).toFixed(2) : 0,
      points: GRID * GRID, trace_file: "track.csv"
    };
  }

  csv() {
    return "frame,t,dx,dy,points_kept,path,swing,rep\n" +
      this.rows.map(r => `${r[0]},${r[1].toFixed(3)},${r[2]},${r[3]},${r[4]},${r[5]},${r[6]},${r[7]}`).join("\n") + "\n";
  }
}

function median(a) { const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
