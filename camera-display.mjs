// Display-only tone correction. Analysis and recordings retain the original stream.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const DISPLAY_SATURATION = 1.22;
export function colourisePixel(r,g,b,saturation=DISPLAY_SATURATION) {
  const light=.2126*r+.7152*g+.0722*b;
  return [r,g,b].map(channel=>Math.round(clamp(light+(channel-light)*saturation,0,255)));
}
export function exposureTarget(data) {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) histogram[Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])]++;
  const count = data.length / 4;
  if (!count) return { gamma: 1, contrast: 1 };
  const percentile = fraction => {
    let sum = 0;
    for (let i = 0; i < 256; i++) { sum += histogram[i]; if (sum >= count*fraction) return i; }
    return 255;
  };
  const low = percentile(.1), median = percentile(.5), high = percentile(.9);
  // Near-black/white frames contain no recoverable detail: do not amplify noise.
  if (high < 10 || low > 245) return { gamma: 1, contrast: 1 };
  const gamma = clamp(Math.log(.46)/Math.log(clamp(median/255,.02,.98)), .45, 1.65);
  const spread = Math.pow(high/255,gamma)-Math.pow(low/255,gamma);
  return { gamma, contrast: clamp(.65/Math.max(.1,spread), 1, 1.18) };
}
export function toneTable({gamma, contrast}) {
  return Uint8ClampedArray.from({length:256}, (_,i) => {
    const x = Math.pow(i/255,gamma);
    // A gentle S curve retains black/white endpoints, unlike an exposure multiplier.
    return 255*clamp(x+(contrast-1)*(x-.5)*4*x*(1-x),0,1);
  });
}
export function createCameraDisplay() {
  const sample = document.createElement('canvas'); sample.width=96; sample.height=72;
  const sc = sample.getContext('2d',{willReadFrequently:true});
  const picture = document.createElement('canvas');
  const pc = picture.getContext('2d',{willReadFrequently:true});
  let current={gamma:1,contrast:1}, target=current, sampledAt=-Infinity, previous=null,lastVideoTime=null;
  function reset(){current={gamma:1,contrast:1};target=current;sampledAt=-Infinity;previous=null;lastVideoTime=null;}
  function draw(ctx,video,now=performance.now()) {
    if (!video.videoWidth || !video.videoHeight) return;
    ctx.save();
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
    try {
      if(Number.isFinite(video.currentTime)&&video.currentTime===lastVideoTime){ctx.drawImage(picture,0,0,ctx.canvas.width,ctx.canvas.height);return;}
      lastVideoTime=Number.isFinite(video.currentTime)?video.currentTime:null;
      if(now-sampledAt>=300){
        sc.drawImage(video,0,0,sample.width,sample.height);
        target=exposureTarget(sc.getImageData(0,0,sample.width,sample.height).data);sampledAt=now;
      }
      const dt=previous===null?33:clamp(now-previous,0,100);previous=now;
      const weight=1-Math.exp(-dt/650);
      current={gamma:current.gamma+(target.gamma-current.gamma)*weight,contrast:current.contrast+(target.contrast-current.contrast)*weight};
      const scale=Math.min(1,1280/video.videoWidth,1280/video.videoHeight);
      const w=Math.max(1,Math.round(video.videoWidth*scale)),h=Math.max(1,Math.round(video.videoHeight*scale));
      if(picture.width!==w||picture.height!==h){picture.width=w;picture.height=h;}
      // Always use the complete source frame. No source rectangle or digital zoom.
      pc.drawImage(video,0,0,w,h);
      const frame=pc.getImageData(0,0,w,h), lut=toneTable(current), data=frame.data;
      for(let i=0;i<data.length;i+=4){
        const colour=colourisePixel(lut[data[i]],lut[data[i+1]],lut[data[i+2]]);
        data[i]=colour[0];data[i+1]=colour[1];data[i+2]=colour[2];
      }
      pc.putImageData(frame,0,0);
      ctx.drawImage(picture,0,0,ctx.canvas.width,ctx.canvas.height);
    } catch {
      lastVideoTime=null;
      // Camera preview must remain available if pixel access is unavailable.
      ctx.drawImage(video,0,0,ctx.canvas.width,ctx.canvas.height);
    } finally {ctx.restore();}
  }
  return {draw,reset};
}
