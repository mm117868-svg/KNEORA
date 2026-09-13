// A deliberate open palm starts one endpoint capture. A fresh release is
// required before another capture, and repeated/stale video frames cannot arm it.
export const ENDPOINT_GESTURE = Object.freeze({holdMs:2000, releaseMs:500, maximumGapMs:500});
export class EndpointGesture {
  constructor(){this.reset();}
  reset(){this.armed=true;this.since=null;this.released=null;this.last=null;this.videoTime=null;}
  disarm(){this.reset();this.armed=false;}
  update(state, now, videoTime){
    if(!Number.isFinite(now)||!Number.isFinite(videoTime)||
       (this.last!==null&&(now<=this.last||now-this.last>ENDPOINT_GESTURE.maximumGapMs))||
       (this.videoTime!==null&&videoTime<=this.videoTime)){
      this.since=null;this.released=null;
      this.last=Number.isFinite(now)?now:null;this.videoTime=Number.isFinite(videoTime)?videoTime:null;
      return {trigger:false,progress:0,armed:this.armed};
    }
    this.last=now;this.videoTime=videoTime;
    if(!this.armed){
      if(state==='absent'||state==='other'){
        this.released??=now;
        if(now-this.released>=ENDPOINT_GESTURE.releaseMs){this.armed=true;this.released=null;}
      }else this.released=null;
      return {trigger:false,progress:0,armed:this.armed};
    }
    if(state!=='open'){this.since=null;return {trigger:false,progress:0,armed:true};}
    this.since??=now;
    const progress=Math.min(1,(now-this.since)/ENDPOINT_GESTURE.holdMs);
    if(progress===1){this.disarm();return {trigger:true,progress,armed:false};}
    return {trigger:false,progress,armed:true};
  }
}
