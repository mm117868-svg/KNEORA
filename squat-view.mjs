/* MediaPipe Pose knee landmarks. The squat screen deliberately shows only the operated knee. */
const KNEE={left:25,right:26};
const valid=(p,min)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??0)>=min&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
const point=(body,id,width,height)=>[body[id].x*width,body[id].y*height];

export function squatLandmarkPaths(body,side,width,height,minVisibility=.1){
 if(!body||!(width>0&&height>0))return null;
 const id=KNEE[side];if(!Number.isInteger(id)||!valid(body[id],minVisibility))return null;
 return {visibility:body[id].visibility??1,knee:[point(body,id,width,height)]};
}
