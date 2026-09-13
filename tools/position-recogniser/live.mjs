import {PositionCycle,predict} from './position.mjs';
export class LivePositionCounter {
 constructor(model=null,exercise='straight_leg_raise'){this.model=model;this.exercise=exercise;this.reset();}
 reset(){this.cycle=new PositionCycle({acceptIntermediate:this.exercise==='heel_slide'});this.reference=null;this.samples=[];this.start=null;this.last=null;this.message=!['straight_leg_raise','seated_extension','heel_slide'].includes(this.exercise)?'Position model not yet trained for this exercise. Recording is available.':!this.model?'Position model unavailable. No repetitions will be estimated.':'Keep your leg resting and still for 3 seconds.';}
 get supported(){return ['straight_leg_raise','seated_extension','heel_slide'].includes(this.exercise)&&!!this.model&&(!this.model.exercise?this.exercise==='straight_leg_raise':this.model.exercise===this.exercise);}
 get ready(){return this.supported&&!!this.reference;}
 update(frame,t){
  if(!this.supported||!Number.isFinite(t)||(this.last!==null&&t<=this.last))return;
  if(!this.reference&&this.last!==null&&t-this.last>.6){this.start=null;this.samples=[];}
  this.last=t;
  if(!this.reference){this.start??=t;this.samples.push(frame);this.message=`Keep your leg resting and still for ${Math.max(0,Math.ceil(3-(t-this.start)))} seconds.`;if(t-this.start<3)return;this.reference=Array.from({length:1024},(_,i)=>this.samples.map(s=>s[i]).sort((a,b)=>a-b)[Math.floor(this.samples.length/2)]);this.samples=[];this.cycle.reset();}
  const p=predict(this.model,frame,this.reference);this.cycle.update(p,t);this.message=Math.max(...p)<.75?'Position uncertain. This movement may remain unconfirmed.':this.cycle.state==='raised'?(this.exercise==='heel_slide'?'Movement away from rest. Return to the resting position.':'Leg raised. Lower to the resting position.'):'Resting or moving between positions.';
 }
 summary(t){this.cycle.finish(t);return {version:'position-prototype-1',exercise:this.exercise,repetitions:this.ready?this.cycle.reps:null,count_status:this.ready?'experimental':'unavailable',events:this.cycle.events,selected_leg_confirmed:false};}
}
export function readPositionFrame(video,ctx){
 const top=Math.round(video.videoHeight*.12),height=Math.round(video.videoHeight*.90)-top;
 ctx.imageSmoothingEnabled=false;ctx.drawImage(video,0,top,video.videoWidth,height,0,0,128,128);
 const d=ctx.getImageData(0,0,128,128).data;
 return Array.from({length:1024},(_,i)=>{let sum=0;const x=(i%32)*4,y=Math.floor(i/32)*4;for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++){const k=((y+dy)*128+x+dx)*4;sum+=(.299*d[k]+.587*d[k+1]+.114*d[k+2])/255;}return sum/16;});
}
