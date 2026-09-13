export class PositionCycle {
 constructor({acceptIntermediate=false}={}){this.acceptIntermediate=acceptIntermediate;this.reset();}
 reset(){this.reps=0;this.state='find_rest';this.lastT=null;this.since=null;this.lastLabel=null;this.awayAt=null;this.unknownAt=null;this.events=[];}
 update(probabilities,t){
  if(!Number.isFinite(t)||(this.lastT!==null&&t<=this.lastT))return;
  if(this.lastT!==null&&t-this.lastT>.6)this.interrupt(t,'frame_gap');
  this.lastT=t;
  const best=Math.max(...probabilities),label=best>=.75?probabilities.indexOf(best):-1;
  if(label<0){this.unknownAt??=t;if(t-this.unknownAt>.5)this.interrupt(t,'uncertain_position');return;}
  this.unknownAt=null;
  if(label!==this.lastLabel){this.since=t;this.lastLabel=label;}
  const settled=t-this.since>=.12;
  if(this.state==='find_rest'){if(label===0&&settled)this.state='rest';return;}
  if(this.state==='rest'){if((label===2||(this.acceptIntermediate&&label===1))&&settled){this.awayAt=t;this.state='raised';}return;}
  if(label===0&&settled){
   if(t-this.awayAt>=.35){this.reps++;this.events.push({t,status:'accepted'});}
   this.awayAt=null;this.state='rest';
  }
 }
 interrupt(t,reason){if(this.awayAt!==null)this.events.push({t,status:'unconfirmed',reason});this.state='find_rest';this.awayAt=null;this.lastLabel=null;this.since=null;this.unknownAt=null;}
 finish(t){if(this.awayAt!==null)this.events.push({t,status:'unconfirmed',reason:'clip_ended_before_return'});this.awayAt=null;}
}
export function feature(frame,rest){
 const d=Array.from(frame,(x,i)=>x-rest[i]),sorted=d.slice().sort((a,b)=>a-b),median=(sorted[511]+sorted[512])/2;
 return d.map((x,i)=>i%32<10?0:Math.max(-.5,Math.min(.5,x-median)));
}
export function predict(model,frame,rest){
 const x=feature(frame,rest),hidden=model.w1.map((row,i)=>Math.max(0,row.reduce((sum,w,j)=>sum+w*x[j],model.b1[i])));
 const logits=model.w2.map((row,i)=>row.reduce((sum,w,j)=>sum+w*hidden[j],model.b2[i])),max=Math.max(...logits);
 const e=logits.map(x=>Math.exp(x-max)),sum=e.reduce((a,b)=>a+b,0);return e.map(x=>x/sum);
}
