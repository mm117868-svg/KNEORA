export const KNEE_EXAMPLES=Object.freeze([
  {deg:0,label:'Straight'},
  {deg:30,label:'Slight bend'},
  {deg:60,label:'More bend'},
  {deg:90,label:'Right angle'},
  {deg:120,label:'Deep bend'}
]);

export function kneeGuideGeometry(deg,{kneeX=250,kneeY=270,length=112}={}){
  const value=Math.max(0,Math.min(120,Number(deg)||0)),r=value*Math.PI/180;
  const ankle=[kneeX-length*Math.sin(r),kneeY+length*Math.cos(r)];
  return {deg:value,knee:[kneeX,kneeY],ankle};
}

export function mountKneeAngleGuide(host){
  if(!host)return()=>{};
  const buttons=KNEE_EXAMPLES.map(x=>`<button type="button" data-knee-deg="${x.deg}"><b>${x.deg}°</b><span>${x.label}</span></button>`).join('');
  host.innerHTML=`<div class="knee-guide-copy"><span class="eyebrow">Understanding knee bend</span><h2>What do the degrees mean?</h2><p><b>0° means the knee is straight.</b> A larger number means the knee is more bent. The app estimates this from a side-on camera picture.</p><div class="knee-guide-reading" aria-live="polite"><span>Knee bend</span><strong data-knee-reading>60°</strong><small data-knee-meaning>More bend</small></div><input data-knee-slider type="range" min="0" max="120" value="60" step="1" aria-label="Explore knee bend from 0 to 120 degrees"><div class="knee-guide-buttons">${buttons}</div><p class="knee-guide-note">This picture explains the number. Your camera reading is an estimate, not a clinical measurement or a target you must reach.</p></div><div class="knee-guide-picture" aria-hidden="true"><svg viewBox="0 0 500 430">
    <g class="guide-person"><circle cx="275" cy="44" r="25"/><path d="M256 70 C236 91 232 121 234 158 L237 199 C238 220 243 236 250 247 C258 235 264 218 266 198 L273 130 C278 111 290 99 307 91"/><path class="guide-arm" d="M300 91 C324 120 331 150 324 177 L304 214 L286 184"/><path class="guide-other-leg" d="M241 201 C226 249 224 304 230 363 L219 405 M258 210 C270 262 268 316 256 405"/></g>
    <path class="guide-femur" d="M247 202 C243 223 244 243 247 258 C238 260 233 268 236 277 C239 285 247 289 255 285 C263 290 273 286 277 277 C281 268 276 260 267 257 C268 238 264 219 258 202Z"/>
    <path class="guide-straight" d="M250 270 L250 411"/><text class="guide-direction" x="266" y="414">0° STRAIGHT</text>
    <g class="guide-lower-leg" data-knee-lower><path class="guide-leg-outline" d="M237 270 C230 289 235 317 240 343 L237 386 L226 407 L266 407 L260 386 L268 344 C273 315 273 288 264 270Z"/><path class="guide-tibia" d="M244 279 C243 300 248 329 249 351 L246 386 M261 279 C265 302 261 330 257 351 L255 386"/><path class="guide-fibula" d="M267 289 C271 318 267 354 261 384"/><path class="guide-foot" d="M237 385 C234 395 224 402 211 408 C205 412 208 417 217 417 L270 417 C278 417 279 410 272 406 L257 396"/></g>
    <path class="guide-patella" d="M231 263 C223 265 220 274 223 281 C226 287 233 287 237 280 C240 272 237 265 231 263Z"/><circle class="guide-joint" cx="250" cy="270" r="4"/>
    <path class="guide-arc" data-knee-arc d=""/><text class="guide-arc-label" data-knee-svg-label x="210" y="330">60°</text><g class="guide-anatomy-labels"><text x="292" y="229">THIGH BONE</text><path d="M285 226 L264 237"/><text x="301" y="272">KNEECAP</text><path d="M294 269 L238 273"/><text x="304" y="333">SHIN BONE</text></g>
  </svg></div>`;
  const slider=host.querySelector('[data-knee-slider]'),reading=host.querySelector('[data-knee-reading]'),meaning=host.querySelector('[data-knee-meaning]'),lower=host.querySelector('[data-knee-lower]'),arc=host.querySelector('[data-knee-arc]'),svgLabel=host.querySelector('[data-knee-svg-label]');
  const show=value=>{
    const g=kneeGuideGeometry(value),rad=g.deg*Math.PI/180,endX=250-58*Math.sin(rad),endY=270+58*Math.cos(rad);
    lower.setAttribute('transform',`rotate(${g.deg} 250 270)`);
    arc.setAttribute('d',g.deg===0?'':`M250 328 A58 58 0 0 1 ${endX.toFixed(1)} ${endY.toFixed(1)}`);
    const middle=rad/2;svgLabel.setAttribute('x',(250-86*Math.sin(middle)).toFixed(1));svgLabel.setAttribute('y',(270+86*Math.cos(middle)).toFixed(1));svgLabel.textContent=`${g.deg}°`;
    const nearest=KNEE_EXAMPLES.reduce((a,b)=>Math.abs(b.deg-g.deg)<Math.abs(a.deg-g.deg)?b:a);
    reading.textContent=`${g.deg}°`;meaning.textContent=nearest.label;
    host.querySelectorAll('[data-knee-deg]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.kneeDeg===g.deg)));
  };
  slider.addEventListener('input',()=>show(+slider.value));
  host.querySelectorAll('[data-knee-deg]').forEach(button=>button.addEventListener('click',()=>{slider.value=button.dataset.kneeDeg;show(+slider.value);}));
  show(+slider.value);
  return show;
}
