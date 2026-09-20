export const METRIC_ANGLE_DIAGRAMS=Object.freeze({
  knee:`<svg class="metric-angle-diagram" viewBox="0 0 260 150" role="img" aria-label="Standing person showing knee bend as the angle between the thigh and shin">
    <circle class="human-head" cx="73" cy="22" r="12"/><path class="human-body" d="M62 39 Q72 32 83 38 L91 76 Q84 86 74 86 Q63 85 57 77Z"/><path class="human-limb" d="M83 45 L102 66 L94 84"/><path class="human-support" d="M74 82 L72 122 L65 142 M80 82 L82 122 L88 142"/>
    <path class="reference" d="M119 96 L119 143"/><path class="measurement" d="M77 82 L119 96 L88 136"/><circle class="joint" cx="119" cy="96" r="5"/><path class="angle" d="M119 126 A30 30 0 0 1 99 118"/><text x="129" y="127">60°</text><text class="caption" x="155" y="37">KNEE BEND</text>
  </svg>`,
  hip:`<svg class="metric-angle-diagram" viewBox="0 0 260 150" role="img" aria-label="Person lying down showing hip raise as the angle between the body and the lifted thigh">
    <circle class="human-head" cx="34" cy="104" r="12"/><path class="human-body" d="M48 94 Q73 87 111 94 L132 102 L123 117 L72 119 Q53 118 45 112Z"/><path class="human-limb" d="M72 100 L93 80 L111 104"/><path class="human-support" d="M124 109 L169 125 L204 126"/>
    <path class="reference" d="M116 105 L236 105"/><path class="measurement" d="M116 105 L181 66 L224 43"/><circle class="joint" cx="116" cy="105" r="5"/><path class="angle" d="M149 105 A33 33 0 0 0 145 88"/><text x="153" y="87">27°</text><text class="caption" x="167" y="128">HIP RAISE</text>
  </svg>`,
  toe:`<svg class="metric-angle-diagram" viewBox="0 0 260 150" role="img" aria-label="Person lying down showing toe direction as the heel-to-toe angle from vertical-up in the camera picture">
    <circle class="human-head" cx="31" cy="112" r="11"/><path class="human-body" d="M43 102 Q68 94 105 101 L120 109 L112 122 L64 124 Q47 123 40 117Z"/><path class="human-support" d="M111 115 L157 128 L197 129"/><path class="human-limb" d="M112 108 L163 80 L199 58"/>
    <path class="reference" d="M205 118 L205 19"/><path class="measurement foot" d="M198 61 L215 25"/><circle class="joint" cx="198" cy="61" r="5"/><path class="angle" d="M205 48 A22 22 0 0 1 211 51"/><text x="219" y="52">18°</text><text class="caption" x="150" y="143">TOE DIRECTION</text>
  </svg>`
});

export function mountMetricAngleDiagrams(root=document){
  root.querySelectorAll('[data-angle-explainer]').forEach(card=>{
    const diagram=METRIC_ANGLE_DIAGRAMS[card.dataset.angleExplainer];
    if(diagram&&!card.querySelector('.metric-angle-diagram'))card.querySelector('h3')?.insertAdjacentHTML('afterend',diagram);
  });
}
