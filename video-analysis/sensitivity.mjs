// Small-range thresholds describe observed motion, not a prescribed exercise range.
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
export function cycleSensitivity(samples,value,small=false) {
  if(!small)return {small:false,resolved:true,onset:6,return:3,minimumExcursion:10,band:3};
  const first=samples[0]?.t,window=samples.filter(s=>s.t-first<=1.2),values=window.map(value);
  const valid=values.length>=10&&window.at(-1).t-first>=.8&&values.every(Number.isFinite)&&window.every((s,i)=>!i||s.t-window[i-1].t<=.25);
  if(!valid)return {small:true,resolved:false,onset:Infinity,return:0,minimumExcursion:Infinity,band:.3,reason:'A clear, still starting position is needed to measure very small movements.'};
  const centre=median(values),deviations=values.map(n=>Math.abs(n-centre));
  const noise=median(deviations)*1.4826,excursion=Math.max(1.5,noise*6);
  return {small:true,resolved:true,baseline:centre,noiseDeg:noise,onset:excursion*.6,return:excursion*.3,minimumExcursion:excursion,band:Math.max(.3,noise*2)};
}
