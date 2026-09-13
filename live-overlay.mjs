// Display only: counting, angle measurements and saved frames use raw input.
import {visiblePosePoint} from './kneerec.js';
export class SkeletonAverage {
  constructor(){this.reset();}
  reset(){this.history=Array.from({length:33},()=>[]);this.last=null;}
  update(points,now){
    if(!Array.isArray(points)||!Number.isFinite(now)){this.reset();return null;}
    if(this.last!==null&&(now<=this.last||now-this.last>450))this.reset();
    this.last=now;
    return Array.from({length:33},(_,i)=>{
      const p=points[i];
      if(!visiblePosePoint(p)){this.history[i]=[];return undefined;}
      let frames=this.history[i].filter(f=>now-f.time<=500);
      const previous=frames.at(-1);
      // A reacquired joint should appear at its new location, not trail across the frame.
      if(previous&&Math.hypot(p.x-previous.x,p.y-previous.y)>.2)frames=[];
      frames.push({x:p.x,y:p.y,time:now});if(frames.length>6)frames.shift();
      this.history[i]=frames;
      return {...p,x:frames.reduce((n,f)=>n+f.x,0)/frames.length,y:frames.reduce((n,f)=>n+f.y,0)/frames.length};
    });
  }
}
