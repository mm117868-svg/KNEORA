const finite=value=>Number.isFinite(value);

/* Short live cues from the angles already shown. These guide the current exercise only. They are not a score,
   diagnosis, maximum-range test or substitute for the patient's prescribed plan. */
export function liveExerciseFeedback(exercise,{knee,hip,toeUp,target,tracking=true}={}){
  if(!tracking)return {text:'Keep the key exercise landmarks in view.',ok:false};
  if(exercise==='straight_leg_raise'){
    if(finite(toeUp)&&toeUp>25)return {text:'Ensure your toes are pointing towards the ceiling.',ok:false};
    if(finite(knee)&&knee>15)return {text:'Keep your knee straight as you lift.',ok:false};
    if(finite(hip)&&hip<8)return {text:'Lift the whole leg while keeping the knee straight.',ok:false};
    if(finite(toeUp)&&finite(knee)&&finite(hip))return {text:'Toes up and knee straight. Keep the movement slow and controlled.',ok:true};
  }
  if(exercise==='seated_extension'&&finite(knee)){
    if(knee>15)return {text:'Keep straightening your knee, within your comfortable range.',ok:false};
    return {text:'Knee near straight on camera. Lower the leg slowly.',ok:true};
  }
  if(exercise==='heel_slide'&&finite(knee)){
    if(finite(target)&&knee>=target-5)return {text:'Bend reached on camera. Return the heel slowly.',ok:true};
    return {text:'Slide your heel towards you, within your comfortable range.',ok:false};
  }
  return null;
}
