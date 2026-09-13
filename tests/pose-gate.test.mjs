import test from 'node:test';
import assert from 'node:assert/strict';
import { LegMotionGate } from '../pose-gate.js';
import { recordedCount, comparableRecords } from '../patient-progress.js';

function landmarks({lift=0, side='left', hand=0, translate=0, visibility=1, exercise='straight_leg_raise'}={}) {
  const points=Array.from({length:33},()=>({x:.15,y:.15,visibility:1,presence:1}));
  for(const [leg,ids] of Object.entries({left:[23,25,27],right:[24,26,28]})) {
    const l=leg===side?lift:0, y=leg==='left'?.55:.6;
    let hip=[.3,y], knee=[.5,y], ankle=[.7,y];
    if(exercise==='seated_extension') { knee=[.5,y]; ankle=[.5+.2*Math.sin(l),y+.2*Math.cos(l)]; }
    else if(exercise==='heel_slide') { knee=[.5-.05*l,y-.1*l];ankle=[.7-.2*l,y]; }
    else { knee=[.3+.2*Math.cos(l),y-.2*Math.sin(l)]; ankle=[.3+.4*Math.cos(l),y-.4*Math.sin(l)]; }
    for(const [i,p] of [hip,knee,ankle].entries()) points[ids[i]]={x:p[0]+translate,y:p[1],visibility:leg===side?visibility:1,presence:1};
  }
  points[15]={x:.13+hand,y:.12,visibility:1,presence:1};
  return points;
}
function rest(g,from=0,options={}) {for(let i=0;i<=12;i++)g.observe(landmarks(options),from+i*.05,1000,700);}
function cycle(g,{from=1,side='left',hand=0,exercise='straight_leg_raise',candidate=true,extra=false,lift=.6}={}) {
  for(let i=0;i<=60;i++) {
    const t=from+i*.05, position=lift*Math.sin(Math.PI*i/60);
    g.observe(landmarks({lift:position,side,hand:hand*Math.sin(i),exercise}),t,1000,700);
    if(candidate&&i===25)g.candidate(t);
    if(extra&&(i===28||i===45))g.candidate(t);
  }
  rest(g,from+3.05,{exercise});
}
test('head scratching with stationary selected leg never counts',()=>{
 const g=new LegMotionGate('straight_leg_raise','left');rest(g);
 for(let i=0;i<60;i++){const t=1+i*.05;g.observe(landmarks({hand:.2*Math.sin(i)}),t,1000,700);if(i%10===0)g.candidate(t);}
 assert.equal(g.reps,0);assert.equal(g.summary().rejected,6);
});
for(const exercise of ['straight_leg_raise','seated_extension','heel_slide']) {
 test(`${exercise}: one complete selected-leg movement plus optical event counts`,()=>{
  const g=new LegMotionGate(exercise,'left');rest(g,0,{exercise});cycle(g,{exercise});assert.equal(g.reps,1);assert.equal(g.events[0].status,'accepted');
 });
}
test('pose movement alone cannot increment the counter',()=>{const g=new LegMotionGate('straight_leg_raise','left');rest(g);cycle(g,{candidate:false});assert.equal(g.reps,0);});
test('scratching while exercising counts the leg once',()=>{const g=new LegMotionGate('straight_leg_raise','left');rest(g);cycle(g,{hand:.25,extra:true});assert.equal(g.reps,1);assert.equal(g.summary().rejected,2);});
test('the other leg cannot validate a repetition',()=>{const g=new LegMotionGate('straight_leg_raise','left');rest(g);cycle(g,{side:'right'});assert.equal(g.reps,0);});
test('right leg selection uses right landmarks',()=>{const g=new LegMotionGate('straight_leg_raise','right');rest(g,0,{side:'right'});cycle(g,{side:'right'});assert.equal(g.reps,1);});
test('camera translation does not look like a leg excursion',()=>{const g=new LegMotionGate('straight_leg_raise','left');rest(g);for(let i=0;i<70;i++){let t=1+i*.05;g.observe(landmarks({translate:.05*Math.sin(i/10)}),t,1000,700);if(i===25)g.candidate(t);}assert.equal(g.reps,0);});
test('low visibility, missing landmarks and stale results never confirm candidates',()=>{
 for(const mode of ['low','missing','stale']){const g=new LegMotionGate('straight_leg_raise','left');rest(g);if(mode==='low')g.observe(landmarks({visibility:.2}),1,1000,700);else if(mode==='missing')g.observe(null,1,1000,700);g.candidate(1.5);assert.equal(g.reps,0);assert.equal(g.events[0].status,'unconfirmed');}
});
test('a gap discards the unfinished cycle and preserves completed repetitions',()=>{
 const g=new LegMotionGate('straight_leg_raise','left');rest(g);cycle(g);g.observe(landmarks({lift:.5}),4.75,1000,700);g.candidate(4.75);g.advance(5.4);rest(g,5.5);assert.equal(g.reps,1);assert.equal(g.events.at(-1).status,'unconfirmed');cycle(g,{from:6.3});assert.equal(g.reps,2);
});
test('partial movement and finishing while raised do not count',()=>{
 const g=new LegMotionGate('straight_leg_raise','left');rest(g);cycle(g,{lift:.05});assert.equal(g.reps,0);
 g.observe(landmarks({lift:.5}),4.75,1000,700);g.candidate(4.75);const summary=g.finish(4.8);assert.equal(summary.repetitions,0);assert.equal(summary.pending,0);
});
test('duplicate timestamps cannot manufacture a return dwell',()=>{
 const g=new LegMotionGate('straight_leg_raise','left');for(let i=0;i<20;i++)g.observe(landmarks(),0,1000,700);assert.equal(g.reference,null);
});
test('late unrelated motion cannot reuse an old leg movement',()=>{const g=new LegMotionGate('straight_leg_raise','left');rest(g);cycle(g,{candidate:false});g.candidate(4.7);assert.equal(g.reps,0);});
test('reset and unsupported exercise leave no accepted count',()=>{const g=new LegMotionGate('straight_leg_raise','left');rest(g);cycle(g);g.reset();assert.equal(g.reps,0);assert.equal(g.events.length,0);const u=new LegMotionGate('unknown','left');rest(u);u.candidate(1);assert.equal(u.reps,0);});
test('progress uses the confirmed count and does not rewrite historical raw counts',()=>{
 const base={exercise:'straight_leg_raise',patient_id:'test',operation_date:'2026-01-01',measurement:{side:'left'},monitoring:{repetitions:7}};
 const r={...base,count_source:'pose_gated_optical',pose_validation:{repetitions:3,side:'left',version:'leg-gate-1',raw_source:'monitoring'}};
 assert.equal(recordedCount(r),3);assert.equal(recordedCount(base),7);assert.equal(comparableRecords([base,r],r,'reps').length,1);
});

import { drawSkeleton, pickSide } from '../kneerec.js';
function drawing() {const calls={lines:0,dots:0};return {calls,beginPath(){},moveTo(){},lineTo(){calls.lines++;},stroke(){},arc(){calls.dots++;},fill(){}};}
test('lower-limb skeleton draws without face or torso landmarks',()=>{
 const p=Array(33);p[23]={x:.3,y:.4,visibility:.9};p[25]={x:.5,y:.5,visibility:.9};p[27]={x:.7,y:.7,visibility:.9};
 const ctx=drawing();drawSkeleton(ctx,p,1000,700);assert.equal(ctx.calls.lines,2);assert.equal(ctx.calls.dots,3);
 assert.equal(pickSide(p,1000,700,'left',.5).side,'left');
});
test('knee and ankle alone still draw their segment',()=>{
 const p=Array(33);p[25]={x:.5,y:.5,visibility:.9};p[27]={x:.7,y:.7,visibility:.9};
 const ctx=drawing();drawSkeleton(ctx,p,1000,700);assert.equal(ctx.calls.lines,1);assert.equal(ctx.calls.dots,2);assert.equal(pickSide(p,1000,700,'left',.5),null);
});
test('uncertain, absent and off-screen landmarks are not drawn',()=>{
 const p=Array(33);p[25]={x:.5,y:.5,visibility:.9};p[27]={x:.7,y:.7,visibility:.2};p[23]={x:-.1,y:.4,visibility:1};p[15]={x:NaN,y:.2,visibility:1};
 const ctx=drawing();drawSkeleton(ctx,p,1000,700);assert.equal(ctx.calls.lines,0);assert.equal(ctx.calls.dots,1);
});
