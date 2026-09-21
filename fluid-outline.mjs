/* Display only. The outline of the operated leg: how it moves between pose results, and how it is drawn.

   Pose results arrive somewhere between three and thirty times a second, at uneven intervals, and each one
   describes a picture that is already a little old. The screen refreshes sixty times a second and the video
   under the outline never stops moving. An outline that is only redrawn when a result arrives moves in steps
   and trails the leg.

   Between results FluidOutline does this, in plain arithmetic:
     it estimates how fast each joint is travelling from the last results and carries the newest result forward
       along that line, for a bounded time and distance, so the outline keeps moving while the next result is
       awaited and sits on the leg, not behind it;
     a joint that is slowing is expected to stop, so it is carried only as far as the stop and does not run on
       past the end of the movement; a joint that is barely moving is not carried at all, so the jitter of a
       still leg is never turned into motion;
     it glides the drawn point towards that carried point at the screen's own rate, so the correction made when
       a new result lands is spread over a few refreshes and never shows as a jump.
   The outline fades in when the leg is found and fades out when it is lost, and it is drawn fainter when the
   pose model is less sure of the joints. A joint that reappears somewhere else is drawn there, not dragged
   across the picture.

   An outline is only kept while the leg cannot have moved far from it. A result more than 0.45 seconds old is
   dropped if the leg was moving when it was last seen. If the leg was still, as it is while a patient settles
   into position, the result is kept until the next one is well overdue, so a device that manages one result
   every second or two still shows a steady outline on a still leg and nothing misleading on a moving one.

   Nothing here feeds the angle, the statistics, the record or a count: those keep the per-frame values.
   Points are [x, y] in pixels; times are in seconds, on whatever clock the caller keeps (the pages use the video's
   own, see PictureClock below). tests/fluid-outline.test.mjs holds it to account against a
   leg whose true position is known: closer to the leg than stepped drawing, far smoother, a bounded run-on at
   the turn of a movement, and steadier than its own input when the leg is still. */

export const FLUID = Object.freeze({
  followS: 0.05,        // time constant of the glide towards the carried point
  maxLeadS: 0.12,       // a result is carried forward for at most this long (plus the glide's own delay)
  maxLeadFraction: 0.1, // and never further than this fraction of the picture height
  velocityBlend: 0.7,   // how much of the newest speed estimate is taken
  accelBlend: 0.5, brake: true,   // a slowing joint is expected to stop, not to carry on
  stillBelow: 0.03, movingAbove: 0.08,   // picture heights a second: below the first a joint counts as still, above the second as moving
  staleS: 0.45,         // a result this old is no longer drawn, unless the leg cannot have moved far from it (below)
  driftFraction: 0.04,  // an older result is kept while the leg, at the speed it was last seen moving, cannot be further than this from it
  overdue: 1.6, maxStaleS: 3,   // and only until the next result is this many times overdue, or this old
  jumpFraction: 0.2,    // a joint that moves this fraction of the picture height between results has been reacquired
  fadeInS: 0.18, fadeOutS: 0.25,
  confidenceBlend: 0.2, // the pose model's confidence is itself smoothed before it sets the opacity
  faintBelow: 0.2, solidAbove: 0.75, faintest: 0.4,
});

const usable = points => Array.isArray(points) && points.length > 0 && points.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
const copy = points => points.map(p => [p[0], p[1]]);

export class FluidOutline {
  /* sourceLag: if the joints handed to target() have already been smoothed, how far behind the leg that smoothing
     leaves them, in seconds, given the joint's speed in picture heights a second. The outline is carried that much
     further so it sits on the leg and not on the smoothed joints' trail. Leave it out for joints that are not smoothed. */
  constructor(frameH = 720, settings = FLUID, sourceLag = null) { this.s = settings; this.sourceLag = typeof sourceLag === 'function' ? sourceLag : null; this.resize(frameH); this.reset(); }
  resize(frameH) { this.h = frameH > 0 ? frameH : 720; }   // the picture height the distances above are fractions of

  reset() { this.forget(); this.hide(NaN); this.ghost = null; this.every = null; this.seenAt = null; }
  /* Two things are kept apart. The track is what the results say: where the joints were, how fast they were going.
     The drawing is what is on screen. A result that has grown too old is no longer drawn, but it is still known, so
     the next result can be joined to it. */
  forget() { this.p = null; this.v = null; this.u = null; this.a = null; this.dt = null; this.t = null; this.linked = false; this.confidence = null; }
  hide(t) {
    if (this.shown && this.alpha > 0 && Number.isFinite(t)) this.ghost = { points: copy(this.shown), from: t, alpha: this.alpha };   // it fades out where it was
    this.shown = null; this.shownAt = null; this.bornAt = null; this.alpha = 0;
  }

  /* How long the results have been taking to arrive, found or not: what "overdue" is measured against. */
  arrived(t) {
    if (!Number.isFinite(t)) return;
    if (this.seenAt !== null && t > this.seenAt) { const gap = t - this.seenAt; this.every = this.every === null ? gap : this.every + 0.3 * (gap - this.every); }
    this.seenAt = t;
  }
  patience() { return this.every === null ? this.s.staleS : Math.max(this.s.staleS, Math.min(this.s.maxStaleS, this.s.overdue * this.every)); }

  /* How old the newest result may be and still be drawn. */
  allowedAge() {
    if (!this.linked) return this.s.staleS;   // one result alone says nothing about whether the leg is moving
    const speed = Math.max(...this.v.map(v => Math.hypot(v[0], v[1])));
    return speed > 0 ? Math.max(this.s.staleS, Math.min(this.patience(), this.s.driftFraction * this.h / speed)) : this.patience();
  }

  /* A new pose result: the joints, the time of the picture it describes, and how sure the model was (0 to 1). */
  target(points, t, confidence = 1) {
    if (!usable(points) || !Number.isFinite(t)) { this.lose(t); return; }
    this.arrived(t);
    const c = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 1;
    const near = this.p && this.p.length === points.length && points.every((p, i) => Math.hypot(p[0] - this.p[i][0], p[1] - this.p[i][1]) <= this.s.jumpFraction * this.h);
    if (near && t <= this.t) { this.p = copy(points); return; }   // the same instant again: the newer joints, the same speed
    if (!(near && t - this.t <= this.patience())) {               // found for the first time, or found again somewhere else or after too long
      this.hide(t); this.forget();
      this.p = copy(points); this.v = points.map(() => [0, 0]); this.a = points.map(() => [0, 0]); this.t = t; this.confidence = c; this.bornAt = t;
      return;
    }
    const dt = t - this.t, b = this.s.velocityBlend, g = this.s.accelBlend;
    const u = points.map((p, i) => [(p[0] - this.p[i][0]) / dt, (p[1] - this.p[i][1]) / dt]);   // speed over the last interval alone
    if (this.u) { const span = (dt + this.dt) / 2; this.a = u.map((q, i) => [g * (q[0] - this.u[i][0]) / span + (1 - g) * this.a[i][0], g * (q[1] - this.u[i][1]) / span + (1 - g) * this.a[i][1]]); }
    this.v = u.map((q, i) => [b * q[0] + (1 - b) * this.v[i][0], b * q[1] + (1 - b) * this.v[i][1]]);
    this.u = u; this.dt = dt; this.p = copy(points); this.t = t; this.linked = true; this.confidence += this.s.confidenceBlend * (c - this.confidence);
    if (this.bornAt === null) this.bornAt = t;   // it had grown too old to draw, and now fades in again
  }

  /* The leg was looked for and not found: what is on screen fades out where it is. */
  lose(t) { this.arrived(t); this.hide(t); this.forget(); }

  /* What to draw at time t: [{points, alpha, fading}, ...], the live outline and, briefly, one that is fading out. */
  at(t) {
    const out = [];
    if (!Number.isFinite(t)) return out;
    const limit = this.p ? this.allowedAge() : 0, tooOld = this.p && t - this.t > limit;
    if (tooOld) this.hide(this.t + limit);
    if (this.ghost) {
      const a = this.ghost.alpha * (1 - (t - this.ghost.from) / this.s.fadeOutS);
      if (a > 0.01) out.push({ points: copy(this.ghost.points), alpha: a, fading: true }); else this.ghost = null;
    }
    if (!this.p || tooOld) return out;
    /* The glide below trails whatever it follows, so the point it follows is carried that much further ahead: on a
       steadily moving leg the two cancel and the outline sits on the leg, not behind it. How far a glide trails
       depends on how often it is stepped: refresh / (e^(refresh / followS) - 1), which tends to followS itself as
       the refreshes get closer together. */
    const refresh = this.shownAt === null ? 0 : t - this.shownAt, trail = refresh > 0 ? refresh / Math.expm1(refresh / this.s.followS) : this.s.followS;
    const lead = Math.max(0, Math.min(this.s.maxLeadS, t - this.t)) + trail, reach = this.s.maxLeadFraction * this.h;
    const carried = this.p.map((p, i) => {
      const vx = this.v[i][0], vy = this.v[i][1], vmag = Math.hypot(vx, vy);
      if (!(vmag > 0)) return [p[0], p[1]];
      // a joint that is barely moving is not carried at all, so jitter in a still leg is never turned into motion
      const k = Math.max(0, Math.min(1, (vmag / this.h - this.s.stillBelow) / (this.s.movingAbove - this.s.stillBelow))), gain = k * k * (3 - 2 * k);
      /* A joint that is slowing is coming to a stop, and a line carried on at full speed would run past where it
         stops and have to come back. Only the slowing along the line of travel is used, and only as far as the
         stop: the way back is left for the next result to show. */
      const ahead = lead + (this.sourceLag ? Math.max(0, Math.min(this.s.maxLeadS, this.sourceLag(vmag / this.h) || 0)) : 0);
      let travel = vmag * ahead;
      if (this.s.brake) {
        const slowing = -(this.a[i][0] * vx + this.a[i][1] * vy) / vmag;   // how hard it is braking, along its own direction
        if (slowing > 0) travel = slowing * ahead >= vmag ? vmag * vmag / (2 * slowing) : vmag * ahead - slowing * ahead * ahead / 2;
      }
      const d = Math.min(reach, travel * gain);
      return [p[0] + vx / vmag * d, p[1] + vy / vmag * d];
    });
    if (!this.shown) this.shown = carried;
    else if (t > this.shownAt) { const a = 1 - Math.exp(-(t - this.shownAt) / this.s.followS); this.shown = this.shown.map((p, i) => [p[0] + a * (carried[i][0] - p[0]), p[1] + a * (carried[i][1] - p[1])]); }
    this.shownAt = t; if (this.bornAt === null) this.bornAt = t;
    const sure = Math.max(this.s.faintest, Math.min(1, (this.confidence - this.s.faintBelow) / (this.s.solidAbove - this.s.faintBelow)));
    this.alpha = Math.max(0, Math.min(1, (t - this.bornAt) / this.s.fadeInS)) * sure;
    out.push({ points: copy(this.shown), alpha: this.alpha, fading: false });
    return out;
  }
}

/* ---------------- the clock ----------------
   The outline has to sit on the leg in the picture that is on screen, and that picture has a clock of its own: a
   camera in poor light may deliver fifteen pictures a second, and any camera can stall. Carried forward by the
   wall clock, the outline would run ahead of a picture that has not moved. So its clock is the video's: results
   are timed by the picture they were made from (video.currentTime when the model was given it), and the moment
   of drawing is the time of the picture now showing, run on smoothly for at most one picture's worth so that the
   outline still moves between pictures. If the video stops, the outline stops with it. */
export class PictureClock {
  constructor() { this.reset(); }
  reset() { this.media = null; this.seenAt = null; this.every = 1 / 30; }
  /* mediaS: video.currentTime. nowS: performance.now() / 1000. Returns seconds on the video's own clock. */
  read(mediaS, nowS) {
    if (!Number.isFinite(mediaS) || !Number.isFinite(nowS)) return NaN;
    if (mediaS !== this.media) {
      if (this.media !== null && mediaS > this.media && mediaS - this.media < 0.5) this.every += 0.2 * (mediaS - this.media - this.every);   // how long a picture usually lasts
      this.media = mediaS; this.seenAt = nowS;
    }
    return this.media + Math.max(0, Math.min(this.every, nowS - this.seenAt));
  }
}

/* ---------------- drawing ----------------
   One leg: a rounded thigh and shin with a dark edge so they read on any background, ringed joints with the knee
   picked out, and, when the angle is shown, a goniometer-style arc. The arc runs from the line the shin would
   follow if the knee were straight to the shin itself, which is the bend the app reports. A translucent wedge
   either side of the shin shows the 95% interval of the displayed reading (see confidence.mjs): narrow when the
   reading is steady, wider when the readings disagree or the knee is moving. Steadiness, not accuracy. */
const TAU = Math.PI * 2;

export function drawOutline(ctx, points, { alpha = 1, colour = '#ff3b3b', light = '#ffb0a8', scale = 1, angle = null, halfWidth = null, label = true } = {}) {
  if (!usable(points) || points.length !== 3 || !(alpha > 0)) return;
  const [hip, knee, ankle] = points, w = Math.max(3, 5 * scale);
  const thigh = Math.hypot(hip[0] - knee[0], hip[1] - knee[1]), shin = Math.hypot(ankle[0] - knee[0], ankle[1] - knee[1]);
  if (thigh < 1 || shin < 1) return;
  ctx.save?.();
  ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const limb = () => { ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.lineTo(ankle[0], ankle[1]); ctx.stroke(); };

  const shinDir = Math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]), straightDir = Math.atan2(knee[1] - hip[1], knee[0] - hip[0]);
  if (Number.isFinite(angle)) {
    // the 95% interval of the displayed reading, as a wedge either side of the shin
    if (Number.isFinite(halfWidth) && halfWidth >= 0.5) {
      const hw = Math.min(halfWidth, 25) * Math.PI / 180;
      ctx.fillStyle = 'rgba(255,59,59,.24)'; ctx.beginPath(); ctx.moveTo(knee[0], knee[1]); ctx.arc(knee[0], knee[1], shin, shinDir - hw, shinDir + hw); ctx.closePath?.(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,176,168,.7)'; ctx.lineWidth = Math.max(1, scale); ctx.stroke();   // a fine edge, so a narrow band can still be seen
    }
    // where the shin would lie with the knee straight, and the arc from there to the shin
    const r = Math.max(18 * scale, Math.min(thigh, shin) * 0.3);
    let sweep = shinDir - straightDir; while (sweep > Math.PI) sweep -= TAU; while (sweep < -Math.PI) sweep += TAU;
    // each is drawn twice, dark then white, so it reads on a pale wall as well as on dark clothing
    for (const [style, extra] of [['rgba(5,10,20,.45)', Math.max(1.5, 2 * scale)], ['rgba(255,255,255,.95)', 0]]) {
      ctx.strokeStyle = style;
      ctx.setLineDash?.([6 * scale, 6 * scale]); ctx.lineWidth = Math.max(1.5, 2 * scale) + extra;
      ctx.beginPath(); ctx.moveTo(knee[0], knee[1]); ctx.lineTo(knee[0] + Math.cos(straightDir) * r * 1.5, knee[1] + Math.sin(straightDir) * r * 1.5); ctx.stroke(); ctx.setLineDash?.([]);
      ctx.lineWidth = Math.max(2, 2.5 * scale) + extra;
      ctx.beginPath(); ctx.arc(knee[0], knee[1], r, straightDir, straightDir + sweep, sweep < 0); ctx.stroke();
    }
    if (label && ctx.fillText) {
      const text = `${Math.round(angle)}°` + (Number.isFinite(halfWidth) && halfWidth >= 0.5 ? ` ±${Math.round(halfWidth)}` : '');
      ctx.font = `700 ${Math.round(20 * scale)}px Archivo, Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      /* The reading sits just outside the arc, on the line that halves the bend, far enough out to clear the shin
         and the dashed line. When the bend is too small for that, it moves to the far side of the dashed line. */
      const halfW = (ctx.measureText?.(text)?.width ?? text.length * 11 * scale) / 2 + 4 * scale, halfH = 13 * scale, turn = sweep < 0 ? -1 : 1, between = Math.abs(sweep) >= 0.4;
      const toward = between ? straightDir + sweep / 2 : straightDir - turn * 0.6;
      const clear = r + 6 * scale + Math.abs(Math.cos(toward)) * halfW + Math.abs(Math.sin(toward)) * halfH;
      const out = between ? Math.max(clear, (Math.hypot(halfW, halfH) + 4 * scale) / Math.sin(Math.min(Math.PI / 2, Math.abs(sweep) / 2))) : clear, lx = knee[0] + Math.cos(toward) * out, ly = knee[1] + Math.sin(toward) * out;
      ctx.lineWidth = Math.max(3, 4 * scale); ctx.strokeStyle = 'rgba(5,10,20,.75)'; ctx.strokeText?.(text, lx, ly); ctx.fillStyle = '#fff'; ctx.fillText(text, lx, ly);
    }
  }

  // thigh and shin: a dark edge, then the colour running lighter towards the ankle
  ctx.strokeStyle = 'rgba(5,10,20,.55)'; ctx.lineWidth = w + Math.max(3, 4 * scale); limb();
  const run = ctx.createLinearGradient?.(hip[0], hip[1], ankle[0], ankle[1]);
  if (run) { run.addColorStop(0, colour); run.addColorStop(1, light); }
  ctx.strokeStyle = run || colour; ctx.lineWidth = w; limb();

  // joints: a soft halo at the knee, then white-ringed discs
  const halo = ctx.createRadialGradient?.(knee[0], knee[1], 0, knee[0], knee[1], w * 4.2);
  if (halo) { halo.addColorStop(0, 'rgba(255,255,255,.35)'); halo.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(knee[0], knee[1], w * 4.2, 0, TAU); ctx.fill(); }
  for (const [p, radius, fill] of [[hip, w * 1.25, colour], [ankle, w * 1.25, light], [knee, w * 1.7, '#fff']]) {
    ctx.beginPath(); ctx.arc(p[0], p[1], radius, 0, TAU); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = Math.max(2, 2.5 * scale); ctx.strokeStyle = fill === '#fff' ? colour : '#fff'; ctx.stroke();
  }
  ctx.restore?.();
}

/* A neutral path for exercises such as squats that need both legs and the trunk visible. It marks the selected
   landmarks without implying that every segment is itself an angle measurement. */
export function drawLandmarkPath(ctx,points,{alpha=1,colour='#ff3b3b',light='#ffb0a8',scale=1}={}){
  if(!usable(points)||!(alpha>0))return;
  const w=Math.max(3,5*scale),path=()=>{ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const point of points.slice(1))ctx.lineTo(point[0],point[1]);ctx.stroke();};
  ctx.save?.();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';
  if(points.length>1){ctx.strokeStyle='rgba(5,10,20,.55)';ctx.lineWidth=w+Math.max(3,4*scale);path();const run=ctx.createLinearGradient?.(points[0][0],points[0][1],points.at(-1)[0],points.at(-1)[1]);if(run){run.addColorStop(0,colour);run.addColorStop(1,light);}ctx.strokeStyle=run||colour;ctx.lineWidth=w;path();}
  for(const [i,point] of points.entries()){ctx.beginPath();ctx.arc(point[0],point[1],w*(i>0&&i<points.length-1?1.45:1.2),0,TAU);ctx.fillStyle=i>0&&i<points.length-1?'#fff':colour;ctx.fill();ctx.lineWidth=Math.max(2,2.5*scale);ctx.strokeStyle=i>0&&i<points.length-1?colour:'#fff';ctx.stroke();}ctx.restore?.();
}

/* Straight leg raise only. Draw the operated-side shoulder-to-hip trunk reference and label the live hip raise.
   The thigh is already part of drawOutline, so it is used for the arc but not painted twice. */
export function drawHipOutline(ctx, points, {alpha=1,colour='#ff3b3b',scale=1,angle=null}={}) {
  if(!usable(points)||points.length!==3||!(alpha>0))return;
  const [shoulder,hip,knee]=points,w=Math.max(3,5*scale),trunk=Math.hypot(hip[0]-shoulder[0],hip[1]-shoulder[1]),thigh=Math.hypot(knee[0]-hip[0],knee[1]-hip[1]);
  if(trunk<1||thigh<1)return;
  ctx.save?.();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';
  const segment=()=>{ctx.beginPath();ctx.moveTo(shoulder[0],shoulder[1]);ctx.lineTo(hip[0],hip[1]);ctx.stroke();};
  ctx.strokeStyle='rgba(5,10,20,.55)';ctx.lineWidth=w+Math.max(3,4*scale);segment();ctx.strokeStyle=colour;ctx.lineWidth=w;segment();
  for(const [p,r] of [[shoulder,w*1.25],[hip,w*1.45]]){ctx.beginPath();ctx.arc(p[0],p[1],r,0,TAU);ctx.fillStyle=colour;ctx.fill();ctx.lineWidth=Math.max(2,2.5*scale);ctx.strokeStyle='#fff';ctx.stroke();}
  if(Number.isFinite(angle)){
    const reference=Math.atan2(hip[1]-shoulder[1],hip[0]-shoulder[0]),thighDir=Math.atan2(knee[1]-hip[1],knee[0]-hip[0]);
    let sweep=thighDir-reference;while(sweep>Math.PI)sweep-=TAU;while(sweep<-Math.PI)sweep+=TAU;
    const r=Math.max(22*scale,Math.min(trunk,thigh)*.28);
    for(const [style,extra] of [['rgba(5,10,20,.45)',Math.max(1.5,2*scale)],['rgba(255,255,255,.95)',0]]){
      ctx.strokeStyle=style;ctx.setLineDash?.([6*scale,6*scale]);ctx.lineWidth=Math.max(1.5,2*scale)+extra;ctx.beginPath();ctx.moveTo(hip[0],hip[1]);ctx.lineTo(hip[0]+Math.cos(reference)*r*1.5,hip[1]+Math.sin(reference)*r*1.5);ctx.stroke();ctx.setLineDash?.([]);
      ctx.lineWidth=Math.max(2,2.5*scale)+extra;ctx.beginPath();ctx.arc(hip[0],hip[1],r,reference,reference+sweep,sweep<0);ctx.stroke();
    }
    const toward=reference+sweep/2,out=r+30*scale,lx=hip[0]+Math.cos(toward)*out,ly=hip[1]+Math.sin(toward)*out,text=`HIP ${Math.round(angle)}°`;
    ctx.font=`700 ${Math.round(18*scale)}px Archivo, Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=Math.max(3,4*scale);ctx.strokeStyle='rgba(5,10,20,.75)';ctx.strokeText?.(text,lx,ly);ctx.fillStyle='#fff';ctx.fillText?.(text,lx,ly);
  }
  ctx.restore?.();
}

/* Straight leg raise foot direction. Zero degrees is the heel-to-toe line pointing to the top of a level image. */
export function drawToeOutline(ctx,points,{alpha=1,colour='#ff3b3b',scale=1,angle=null}={}){
  if(!usable(points)||points.length!==2||!(alpha>0))return;const [heel,toe]=points,length=Math.hypot(toe[0]-heel[0],toe[1]-heel[1]),w=Math.max(3,5*scale);if(length<1)return;
  ctx.save?.();ctx.globalAlpha=alpha;ctx.lineCap='round';
  const segment=()=>{ctx.beginPath();ctx.moveTo(heel[0],heel[1]);ctx.lineTo(toe[0],toe[1]);ctx.stroke();};ctx.strokeStyle='rgba(5,10,20,.55)';ctx.lineWidth=w+Math.max(3,4*scale);segment();ctx.strokeStyle=colour;ctx.lineWidth=w;segment();
  for(const p of [heel,toe]){ctx.beginPath();ctx.arc(p[0],p[1],w*1.25,0,TAU);ctx.fillStyle=colour;ctx.fill();ctx.lineWidth=Math.max(2,2.5*scale);ctx.strokeStyle='#fff';ctx.stroke();}
  if(Number.isFinite(angle)){
    const up=-Math.PI/2,foot=Math.atan2(toe[1]-heel[1],toe[0]-heel[0]);let sweep=foot-up;while(sweep>Math.PI)sweep-=TAU;while(sweep<-Math.PI)sweep+=TAU;const r=Math.max(20*scale,Math.min(50*scale,length*.45));
    ctx.setLineDash?.([6*scale,6*scale]);ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=Math.max(2,2.5*scale);ctx.beginPath();ctx.moveTo(heel[0],heel[1]);ctx.lineTo(heel[0],heel[1]-r*1.5);ctx.stroke();ctx.setLineDash?.([]);ctx.beginPath();ctx.arc(heel[0],heel[1],r,up,up+sweep,sweep<0);ctx.stroke();
    const toward=up+sweep/2,out=r+25*scale,lx=heel[0]+Math.cos(toward)*out,ly=heel[1]+Math.sin(toward)*out,text=`TOE ${Math.round(angle)}°`;ctx.font=`700 ${Math.round(16*scale)}px Archivo, Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=Math.max(3,4*scale);ctx.strokeStyle='rgba(5,10,20,.75)';ctx.strokeText?.(text,lx,ly);ctx.fillStyle='#fff';ctx.fillText?.(text,lx,ly);
  }
  ctx.restore?.();
}
