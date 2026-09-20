/* MediaPipe Pose landmark numbers. Squats need the trunk, both legs and both feet so that
   the picture shows the whole load-bearing chain without adding face or hand landmarks. */
const IDS={leftShoulder:11,rightShoulder:12,leftHip:23,rightHip:24,leftKnee:25,rightKnee:26,leftAnkle:27,rightAnkle:28,leftHeel:29,rightHeel:30,leftFoot:31,rightFoot:32};
const valid=(p,min)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??0)>=min&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
const point=(body,id,width,height)=>[body[id].x*width,body[id].y*height];

export function squatLandmarkPaths(body,width,height,minVisibility=.2){
 if(!body||!(width>0&&height>0))return null;
 const ids=Object.values(IDS);if(!ids.every(id=>valid(body[id],minVisibility)))return null;
 const p=name=>point(body,IDS[name],width,height),visibility=Math.min(...ids.map(id=>body[id].visibility??1));
 return {
  visibility,
  torso:[p('leftShoulder'),p('rightShoulder'),p('rightHip'),p('leftHip'),p('leftShoulder')],
  leftLeg:[p('leftHip'),p('leftKnee'),p('leftAnkle')],
  rightLeg:[p('rightHip'),p('rightKnee'),p('rightAnkle')],
  leftFoot:[p('leftAnkle'),p('leftHeel'),p('leftFoot')],
  rightFoot:[p('rightAnkle'),p('rightHeel'),p('rightFoot')]
 };
}
