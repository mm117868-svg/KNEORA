// Preview only. Final endpoint statistics always use the original accepted angles.
export class EndpointPreviewAverage {
 constructor(){this.reset();}
 reset(){this.frames=[];this.last=null;}
 update(angle,points,now){
  if(!Number.isFinite(angle)||!Number.isFinite(now)||points?.length!==3||!points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y))){this.reset();return null;}
  if(this.last!==null&&(now<=this.last||now-this.last>400))this.reset();
  this.last=now;this.frames.push({angle,points});if(this.frames.length>5)this.frames.shift();
  const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
  return {angle:mean(this.frames.map(f=>f.angle)),samples:this.frames.length,
   points:points.map((_,i)=>({x:mean(this.frames.map(f=>f.points[i].x)),y:mean(this.frames.map(f=>f.points[i].y))}))};
 }
}
