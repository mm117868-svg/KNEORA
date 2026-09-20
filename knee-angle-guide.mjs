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
  host.innerHTML=`<div class="knee-guide-copy"><span class="eyebrow">Understanding knee bend</span><h2>What do the degrees mean?</h2><p><b>0° means the knee is straight.</b> A larger number means the knee is more bent. The app estimates this from a side-on camera picture.</p><div class="knee-guide-reading" aria-live="polite"><span>Knee bend</span><strong data-knee-reading>60°</strong><small data-knee-meaning>More bend</small></div><input data-knee-slider type="range" min="0" max="120" value="60" step="1" aria-label="Explore knee bend from 0 to 120 degrees"><div class="knee-guide-buttons">${buttons}</div><p class="knee-guide-note">This picture explains the number. Your camera reading is an estimate, not a clinical measurement or a target you must reach.</p></div><div class="knee-guide-picture" aria-hidden="true"><svg viewBox="0 0 500 430">
    <path class="guide-straight" d="M250 220 L250 392"/><text class="guide-direction" x="270" y="397">0° STRAIGHT</text>
    <path class="guide-femur" d="M220 26 L280 26 L276 126 C275 154 286 177 298 197 C306 211 300 228 286 236 C273 243 260 237 250 229 C240 237 227 243 214 236 C200 228 194 211 202 197 C214 177 225 154 224 126Z"/>
    <path class="guide-cartilage" d="M205 210 C218 220 235 222 250 214 C265 222 282 220 295 210"/>
    <g class="guide-lower-leg" data-knee-lower>
      <path class="guide-leg-outline" d="M207 222 C218 210 235 211 250 220 C265 211 282 210 293 222 C299 233 291 244 279 247 L270 381 L230 381 L221 247 C209 244 201 233 207 222Z"/>
      <path class="guide-tibia" d="M222 236 C229 244 240 246 250 240 C260 246 271 244 278 236 M232 252 L239 372 M268 252 L261 372"/>
      <path class="guide-fibula" d="M282 252 C289 282 283 337 274 372"/>
    </g>
    <path class="guide-ligament guide-acl" d="M235 191 L266 244"/><path class="guide-ligament guide-pcl" d="M267 191 L238 244"/>
    <path class="guide-patella" d="M203 202 C191 205 185 219 189 231 C193 242 204 245 212 237 C220 227 218 210 211 204 C209 202 206 201 203 202Z"/>
    <circle class="guide-joint" cx="250" cy="220" r="5"/>
    <path class="guide-arc" data-knee-arc d=""/><text class="guide-arc-label" data-knee-svg-label x="185" y="330">60°</text>
    <g class="guide-anatomy-labels"><text x="338" y="86">THIGH BONE</text><path d="M328 82 L278 108"/><text x="46" y="216">KNEECAP</text><path d="M116 212 L188 220"/></g>
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
