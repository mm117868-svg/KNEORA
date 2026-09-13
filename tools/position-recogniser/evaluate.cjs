const fs=require('node:fs');
(async()=>{
 const {PositionCycle}=await import('./position.mjs');
 const root=process.env.KNEE_TRACKER_HOME||'/Users/mattmccann/knee code/knee-dis-evaluation';
 const path=root+'/position-recogniser/predictions.json',data=JSON.parse(fs.readFileSync(path));
 for(const clip of data.clips){const cycle=new PositionCycle();for(const row of clip.rows){cycle.update(row.probabilities,row.t);row.reps=cycle.reps;row.count_state=cycle.state;}cycle.finish(clip.rows.at(-1).t);clip.repetitions=cycle.reps;clip.events=cycle.events;console.log({clip:clip.id,role:clip.role,reps:cycle.reps,events:cycle.events});}
 fs.writeFileSync(path,JSON.stringify(data));
})();
