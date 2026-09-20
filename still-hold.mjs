// Pacing heuristic, not a clinical assessment of muscle activation or exercise form.
export class StillHold {
  constructor(){this.reset();}
  reset(){this.anchor=null;this.since=null;this.started=null;this.last=null;this.seconds=0;this.ended=null;}
  end(reason){if(this.started!==null&&!this.ended)this.ended={reason,held_s:+this.seconds.toFixed(2)};}
  update(angle,t,knee=null){
    if(this.ended)return this.seconds;
    if(!Number.isFinite(t)||!Number.isFinite(angle)){this.end('tracking_lost');if(!this.ended)this.reset();return this.seconds;}
    if(this.last!==null&&t<=this.last)return this.seconds;
    if(this.last!==null&&t-this.last>0.5){this.end('tracking_lost');if(this.ended)return this.seconds;this.reset();}
    this.last=t;
    const moved=!this.anchor||Math.abs(angle-this.anchor.angle)>2||(knee&&this.anchor.knee&&Math.hypot(knee[0]-this.anchor.knee[0],knee[1]-this.anchor.knee[1])>0.012);
    if(moved){this.end('movement');if(this.ended)return this.seconds;this.anchor={angle,knee};this.since=t;this.started=null;this.seconds=0;}
    else if(this.started===null&&t-this.since>=0.6)this.started=t;
    this.seconds=this.started===null?0:t-this.started;
    return this.seconds;
  }
  read(t){if(this.last!==null&&t-this.last>0.5)this.end('tracking_lost');return this.ended?0:this.seconds;}
}
