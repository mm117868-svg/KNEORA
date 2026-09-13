// Descriptive observations only. Missing values are never converted to zero.
export function distribution(values) {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const count=sorted.length,minimum=sorted[0],maximum=sorted.at(-1);
  const mean=sorted.reduce((sum,n)=>sum+n,0)/count;
  const quantile=p=>{const at=(count-1)*p,lo=Math.floor(at),hi=Math.ceil(at);return sorted[lo]+(sorted[hi]-sorted[lo])*(at-lo);};
  return {count,minimum,maximum,mean,median:quantile(.5),range:maximum-minimum,p05:quantile(.05),p95:quantile(.95),
    standardDeviation:count>=2?Math.sqrt(sorted.reduce((sum,n)=>sum+(n-mean)**2,0)/count):null};
}
