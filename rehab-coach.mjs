// Written technique reminders based on linked NHS guidance. No technique score.
export const REHAB_SOURCES = {
 cuh: {label:'CUH knee exercises',url:'https://www.cuh.nhs.uk/patient-information/knee-exercises/'},
 early: {label:'CUH early knee exercises',url:'https://www.cuh.nhs.uk/patient-information/early-knee-exercises/'},
 slr: {label:'South Tees straight leg raise',url:'https://www.southtees.nhs.uk/resources/straight-leg-raise/'}
};
export const REHAB_PROMPTS = {
 rehab_slr_setup:'Support yourself lying down. Bend your other knee and keep your operated leg straight.',
 rehab_slr_move:'Tighten your thigh, then lift your operated leg while keeping the knee straight.',
 rehab_slr_return:'Bring your operated leg down slowly, keeping control of the movement.',
 rehab_slr_bend:'Try to keep your operated knee as straight as it was at the start. Do not force it.',
 rehab_slide_setup:'Rest on your back with your operated leg extended.',
 rehab_slide_move:'Draw your heel towards you, stopping at a comfortable bend.',
 rehab_slide_return:'Ease your heel away again to return to your starting position.',
 rehab_extension_setup:'Sit with your thigh supported and your operated knee bent.',
 rehab_extension_move:'Raise your foot to straighten your operated knee within your comfortable range.',
 rehab_extension_return:'Bring your foot back down gently. Keep the movement controlled.',
 rehab_view:'Keep your operated hip, knee and ankle in the camera picture.',
 rehab_hold:'Hold for the time in your exercise plan, then return slowly.'
};
const profiles={
 straight_leg_raise:{setup:'rehab_slr_setup',move:'rehab_slr_move',return:'rehab_slr_return',source:REHAB_SOURCES.slr},
 heel_slide:{setup:'rehab_slide_setup',move:'rehab_slide_move',return:'rehab_slide_return',source:REHAB_SOURCES.cuh},
 seated_extension:{setup:'rehab_extension_setup',move:'rehab_extension_move',return:'rehab_extension_return',source:REHAB_SOURCES.early}
};
export function coachingKeys(exercise){const p=profiles[exercise];return p?[p.setup,p.move,p.return,'rehab_view','rehab_hold',...(exercise==='straight_leg_raise'?['rehab_slr_bend']:[])]:[];}
export class RehabCoach {
 constructor(){this.reset();}
 reset(){this.restKnee=null;this.bentAt=null;this.candidate=null;this.since=0;this.shown=null;}
 update({exercise,running,visible,knee,away=false,holdSeconds=0,heldSeconds=0,now,steps=[]}){
   const p=profiles[exercise];
   if(!p)return {key:null,text:steps[Math.floor(now/8000)%Math.max(1,steps.length)]||'Follow the exercise plan agreed with your physiotherapist.',kind:'reminder',source:null};
   let key=p.setup,kind='reminder';
   if(!visible){key='rehab_view';kind='visibility';this.restKnee=null;this.bentAt=null;}
   else if(!running){this.restKnee=Number.isFinite(knee)?knee:null;this.bentAt=null;}
   else {
     key=away?(holdSeconds>0&&heldSeconds<holdSeconds?'rehab_hold':p.return):p.move;
     if(exercise==='straight_leg_raise'&&away&&Number.isFinite(knee)&&this.restKnee!==null&&knee-this.restKnee>10){
       this.bentAt??=now;if(now-this.bentAt>=800){key='rehab_slr_bend';kind='camera-reminder';}
     }else this.bentAt=null;
   }
   // Visibility loss clears any movement correction immediately. Other cues settle.
   if(this.candidate!==key){this.candidate=key;this.since=now;}
   if(!this.shown||kind==='visibility'||now-this.since>=600)this.shown={key,text:REHAB_PROMPTS[key],kind,source:p.source};
   return this.shown;
 }
}
export class RehabVoice {
 constructor(voice,{gapMs=12000,repeatMs=35000}={}){this.voice=voice;this.gapMs=gapMs;this.repeatMs=repeatMs;this.reset();}
 reset(){this.lastAt=-Infinity;this.spoken=new Map();}
 trySpeak(cue,{enabled,running,countdown,now}){
   if(!enabled||!running||countdown||!cue?.key||this.voice.source||now-this.lastAt<this.gapMs||now-(this.spoken.get(cue.key)??-Infinity)<this.repeatMs)return false;
   // Do not interrupt a countdown/completion clip or substitute another voice.
   if(!this.voice.buffers.has(cue.key)||!this.voice.play(cue.key))return false;
   this.lastAt=now;this.spoken.set(cue.key,now);return true;
 }
}
