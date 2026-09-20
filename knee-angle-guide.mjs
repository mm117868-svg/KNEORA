export const KNEE_EXAMPLES=Object.freeze([
  {deg:0,label:'Straight'},
  {deg:30,label:'Slight bend'},
  {deg:60,label:'More bend'},
  {deg:90,label:'Right angle'},
  {deg:120,label:'Deep bend'}
]);

export function kneeGuideGeometry(deg,{kneeX=250,kneeY=220,length=150}={}){
  const value=Math.max(0,Math.min(120,Number(deg)||0)),r=value*Math.PI/180;
  const ankle=[kneeX-length*Math.sin(r),kneeY+length*Math.cos(r)];
  return {deg:value,knee:[kneeX,kneeY],ankle};
}

export function mountKneeAngleGuide(host){
  if(!host)return()=>{};
  const buttons=KNEE_EXAMPLES.map(x=>`<button type="button" data-knee-deg="${x.deg}"><b>${x.deg}°</b><span>${x.label}</span></button>`).join('');
  host.innerHTML=`<div class="knee-guide-copy"><span class="eyebrow">Understanding knee bend</span><h2>What do the degrees mean?</h2><p><b>0° means the knee is straight.</b> A larger number means the knee is more bent. The app estimates this from a side-on camera picture.</p><div class="knee-guide-reading" aria-live="polite"><span>Knee bend</span><strong data-knee-reading>60°</strong><small data-knee-meaning>More bend</small></div><input data-knee-slider type="range" min="0" max="120" value="60" step="1" aria-label="Explore knee bend from 0 to 120 degrees"><div class="knee-guide-buttons">${buttons}</div><p class="knee-guide-note">This simplified side view explains the number. Your camera reading is an estimate, not a clinical measurement or a target you must reach.</p></div><div class="knee-guide-picture" aria-hidden="true"><svg viewBox="0 0 500 430">
    <path class="guide-straight" d="M250 220 L250 392"/><text class="guide-direction" x="270" y="397">0° STRAIGHT</text>
    <text class="guide-direction" x="36" y="26">LATERAL VIEW · FROM THE SIDE</text>
    <text class="guide-direction" x="36" y="65">BACK</text><text class="guide-direction" x="397" y="65">FRONT</text>
    <path class="guide-femur" d="M232 48 L274 48 L273 151 C273 174 289 191 289 212 C289 235 272 248 252 246 C228 245 215 229 219 208 C221 191 234 178 234 152Z"/>
    <path class="guide-cartilage" d="M222 218 C224 240 253 250 275 234"/>
    <g class="guide-lower-leg" data-knee-lower>
      <path class="guide-leg-outline guide-tibia-side" d="M222 248 Q248 255 279 244 L282 260 Q280 275 268 286 L267 381 L239 381 L237 283 Q224 271 222 248Z"/>
      <path class="guide-tibia" d="M273 273 Q257 283 255 307 L254 371"/>
      <path class="guide-fibula" d="M223 275 Q216 266 218 261 Q221 257 225 263 L230 374"/>
    </g>
    <circle class="guide-joint" cx="250" cy="220" r="5"/>
    <path class="guide-arc" data-knee-arc d=""/><text class="guide-arc-label" data-knee-svg-label x="185" y="330">60°</text>
    <g class="guide-anatomy-labels"><text x="338" y="86">THIGH BONE</text><path d="M328 82 L278 108"/></g>
  </svg></div>`;
  const slider=host.querySelector('[data-knee-slider]'),reading=host.querySelector('[data-knee-reading]'),meaning=host.querySelector('[data-knee-meaning]'),lower=host.querySelector('[data-knee-lower]'),arc=host.querySelector('[data-knee-arc]'),svgLabel=host.querySelector('[data-knee-svg-label]');
  const show=value=>{
    const g=kneeGuideGeometry(value),rad=g.deg*Math.PI/180,endX=250-78*Math.sin(rad),endY=220+78*Math.cos(rad);
    lower.setAttribute('transform',`rotate(${g.deg} 250 220)`);
    arc.setAttribute('d',g.deg===0?'':`M250 298 A78 78 0 0 1 ${endX.toFixed(1)} ${endY.toFixed(1)}`);
    const middle=rad/2,labelX=g.deg===0?282:250-112*Math.sin(middle),labelY=g.deg===0?360:220+112*Math.cos(middle);
    svgLabel.setAttribute('x',labelX.toFixed(1));svgLabel.setAttribute('y',labelY.toFixed(1));svgLabel.textContent=`${g.deg}°`;
    const nearest=KNEE_EXAMPLES.reduce((a,b)=>Math.abs(b.deg-g.deg)<Math.abs(a.deg-g.deg)?b:a);
    reading.textContent=`${g.deg}°`;meaning.textContent=nearest.label;
    host.querySelectorAll('[data-knee-deg]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.kneeDeg===g.deg)));
  };
  slider.addEventListener('input',()=>show(+slider.value));
  host.querySelectorAll('[data-knee-deg]').forEach(button=>button.addEventListener('click',()=>{slider.value=button.dataset.kneeDeg;show(+slider.value);}));
  show(+slider.value);
  return show;
}
