export const KNEE_EXAMPLES=Object.freeze([
  {deg:0,label:'Straight'},
  {deg:30,label:'Slight bend'},
  {deg:60,label:'More bend'},
  {deg:90,label:'Right angle'},
  {deg:120,label:'Deep bend'}
]);

export function kneeGuideGeometry(deg,{kneeX=250,kneeY=128,length=105}={}){
  const value=Math.max(0,Math.min(120,Number(deg)||0)),r=value*Math.PI/180;
  const ankle=[kneeX-length*Math.sin(r),kneeY+length*Math.cos(r)];
  return {deg:value,knee:[kneeX,kneeY],ankle};
}

export function mountKneeAngleGuide(host){
  if(!host)return()=>{};
  const buttons=KNEE_EXAMPLES.map(x=>`<button type="button" data-knee-deg="${x.deg}"><b>${x.deg}°</b><span>${x.label}</span></button>`).join('');
  host.innerHTML=`<div class="knee-guide-copy"><span class="eyebrow">Understanding knee bend</span><h2>What do the degrees mean?</h2><p><b>0° means the knee is straight.</b> A larger number means the knee is more bent. The app estimates this from a side-on camera picture.</p><div class="knee-guide-reading" aria-live="polite"><span>Knee bend</span><strong data-knee-reading>60°</strong><small data-knee-meaning>More bend</small></div><input data-knee-slider type="range" min="0" max="120" value="60" step="1" aria-label="Explore knee bend from 0 to 120 degrees"><div class="knee-guide-buttons">${buttons}</div><p class="knee-guide-note">This picture explains the number. Your camera reading is an estimate, not a clinical measurement or a target you must reach.</p></div><div class="knee-guide-picture" aria-hidden="true"><svg viewBox="0 0 500 270"><path class="guide-thigh" d="M250 22 L250 128"/><path class="guide-straight" d="M250 128 L250 242"/><path class="guide-shin" data-knee-shin d="M250 128 L159 181"/><circle class="guide-joint" cx="250" cy="128" r="10"/><path class="guide-arc" data-knee-arc d=""/><text class="guide-arc-label" data-knee-svg-label x="210" y="180">60°</text><text class="guide-direction" x="264" y="36">THIGH</text><text class="guide-direction" x="264" y="238">0° STRAIGHT</text></svg></div>`;
  const slider=host.querySelector('[data-knee-slider]'),reading=host.querySelector('[data-knee-reading]'),meaning=host.querySelector('[data-knee-meaning]'),shin=host.querySelector('[data-knee-shin]'),arc=host.querySelector('[data-knee-arc]'),svgLabel=host.querySelector('[data-knee-svg-label]');
  const show=value=>{
    const g=kneeGuideGeometry(value),rad=g.deg*Math.PI/180,endX=250-54*Math.sin(rad),endY=128+54*Math.cos(rad),large=g.deg>180?1:0;
    shin.setAttribute('d',`M250 128 L${g.ankle[0].toFixed(1)} ${g.ankle[1].toFixed(1)}`);
    arc.setAttribute('d',g.deg===0?'':`M250 182 A54 54 0 ${large} 1 ${endX.toFixed(1)} ${endY.toFixed(1)}`);
    const middle=rad/2;svgLabel.setAttribute('x',(250-78*Math.sin(middle)).toFixed(1));svgLabel.setAttribute('y',(128+78*Math.cos(middle)).toFixed(1));svgLabel.textContent=`${g.deg}°`;
    const nearest=KNEE_EXAMPLES.reduce((a,b)=>Math.abs(b.deg-g.deg)<Math.abs(a.deg-g.deg)?b:a);
    reading.textContent=`${g.deg}°`;meaning.textContent=nearest.label;
    host.querySelectorAll('[data-knee-deg]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.kneeDeg===g.deg)));
  };
  slider.addEventListener('input',()=>show(+slider.value));
  host.querySelectorAll('[data-knee-deg]').forEach(button=>button.addEventListener('click',()=>{slider.value=button.dataset.kneeDeg;show(+slider.value);}));
  show(+slider.value);
  return show;
}
