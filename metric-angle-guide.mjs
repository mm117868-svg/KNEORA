export const METRIC_ANGLE_DIAGRAMS=Object.freeze({
  knee:`<svg class="metric-angle-diagram" viewBox="0 0 240 112" role="img" aria-label="Knee bend is the angle between the thigh and shin"><path class="reference" d="M123 57 L123 104"/><path class="limb" d="M62 22 L123 57 L78 96"/><circle class="joint" cx="123" cy="57" r="5"/><path class="angle" d="M123 86 A29 29 0 0 1 101 76"/><text x="132" y="88">60°</text></svg>`,
  hip:`<svg class="metric-angle-diagram" viewBox="0 0 240 112" role="img" aria-label="Hip raise is the angle between the line of the body and the thigh"><path class="reference" d="M24 76 L216 76"/><path class="limb" d="M38 76 L111 76 L187 38"/><circle class="joint" cx="111" cy="76" r="5"/><path class="angle" d="M143 76 A32 32 0 0 0 140 62"/><text x="148" y="61">27°</text></svg>`,
  toe:`<svg class="metric-angle-diagram" viewBox="0 0 240 112" role="img" aria-label="Toe direction is the angle between the heel-to-toe line and vertical-up in the camera picture"><path class="reference" d="M120 97 L120 15"/><path class="limb" d="M120 88 L139 28"/><circle class="joint" cx="120" cy="88" r="5"/><path class="angle" d="M120 58 A30 30 0 0 1 129 59"/><text x="139" y="56">18°</text></svg>`
});

export function mountMetricAngleDiagrams(root=document){
  root.querySelectorAll('[data-angle-explainer]').forEach(card=>{
    const diagram=METRIC_ANGLE_DIAGRAMS[card.dataset.angleExplainer];
    if(diagram&&!card.querySelector('.metric-angle-diagram'))card.querySelector('h3')?.insertAdjacentHTML('afterend',diagram);
  });
}
