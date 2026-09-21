// Visibility and continuity heuristics only. These do not establish clinical accuracy.
export class TrackingQuality {
 constructor(){this.reset();}
 reset(){this.previous=null;this.last=-Infinity;this.resumeAt=0;this.result={usable:false,label:'Waiting for camera',message:'Keep your operated hip, knee and ankle in the picture.'};}
 update(poses,side,now){
  const prior=this.previous,dt=now-this.last;this.last=now;
  const fail=(label,message)=>{this.previous=null;return this.result={usable:false,label,message};};
  if(poses?.length>1)return fail('Multiple people','Only one person should be visible.');
  const body=poses?.[0],ids=side==='left'?[23,25,27]:side==='right'?[24,26,28]:null;
  if(!body||!ids)return fail('Leg not visible','Measurement paused until your operated leg is visible again.');
  const pts=ids.map(i=>body[i]),outside=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.x<0||p.x>1||p.y<0||p.y>1);
  if(outside(pts[2]))return fail('Ankle outside frame','Your ankle is outside the picture. Move the camera slightly further back.');
  if(pts.some(outside))return fail('Leg outside frame','Move the camera slightly further back to include your operated hip, knee and ankle.');
  if(pts.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||(p.visibility??0)<.2))return fail('Low visibility','I cannot see enough of your operated leg. Keep your hip, knee and ankle unobstructed.');
  this.previous=pts.map(p=>({x:p.x,y:p.y}));
  if(prior&&dt<1200&&pts.some((p,i)=>Math.hypot(p.x-prior[i].x,p.y-prior[i].y)>.25))this.resumeAt=now+150;
  if(now<this.resumeAt)return this.result={usable:false,label:'Tracking settling',message:'Measurement paused while tracking settles. Keep the camera steady.'};
  return this.result={usable:true,label:'Leg visible · tracking stable',message:''};
 }
 read(now){return now-this.last>1200?{usable:false,label:'Tracking interrupted',message:'Measurement paused until your leg is visible again.'}:this.result;}
}
