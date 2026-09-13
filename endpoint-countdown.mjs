// Countdown timing is shared by the open palm and the helper's button.
export class EndpointCountdown {
 constructor({voice,onTick=()=>{},onStart=()=>{},onCancel=()=>{},now=()=>performance.now(),schedule=(fn,delay)=>setTimeout(fn,delay),unschedule=id=>clearTimeout(id)}){Object.assign(this,{voice,onTick,onStart,onCancel,now,schedule,unschedule});this.active=false;this.timer=null;}
 start(trigger='button'){
  if(this.active)return false;
  this.active=true;const end=this.now()+5000;this.voice.play('countdown');
  const tick=()=>{if(!this.active)return;const left=end-this.now();if(left<=0){this.active=false;this.timer=null;this.voice.stop();this.onStart(trigger);return;}this.onTick(Math.ceil(left/1000));this.timer=this.schedule(tick,Math.min(100,left));};tick();return true;
 }
 cancel(){const wasActive=this.active;this.active=false;this.unschedule(this.timer);this.timer=null;this.voice.stop();if(wasActive)this.onCancel();}
}
