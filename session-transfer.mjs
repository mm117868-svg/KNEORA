const required=['schema_version','patient_id','exercise','started_at','duration_s'];
export function validateSessionRecord(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('This is not a Kneora session file.');
  for(const key of required)if(value[key]===undefined||value[key]===null||value[key]==='')throw Error(`The session file is missing ${key.replaceAll('_',' ')}.`);
  if(value.schema_version!==1)throw Error('This session file version is not supported.');
  if(!Number.isFinite(Number(value.duration_s))||Number(value.duration_s)<0)throw Error('The session duration is invalid.');
  return value;
}
export function sessionIdentity(record){return [record.patient_id,record.operation_date||'',record.exercise,record.started_at].join('|');}
export function importSessionRecord(record,records){
  const checked=validateSessionRecord(record),all=Array.isArray(records)?records:[];
  if(all.some(existing=>sessionIdentity(existing)===sessionIdentity(checked)))return {records:all,record:checked,duplicate:true};
  return {records:[...all,checked],record:checked,duplicate:false};
}
export async function shareSessionRecord(record,{share=globalThis.navigator?.share,canShare=globalThis.navigator?.canShare,FileCtor=globalThis.File}={}){
  validateSessionRecord(record);const name=`KNEORA_${record.patient_id}_${String(record.started_at).replaceAll(':','-')}_session.json`;
  if(share&&FileCtor){const file=new FileCtor([JSON.stringify(record,null,2)],name,{type:'application/json'}),payload={title:'Kneora exercise session',text:'Kneora exercise session for review on a computer.',files:[file]};if(!canShare||canShare.call(globalThis.navigator,payload)){await share.call(globalThis.navigator,payload);return {shared:true,name};}}
  return {shared:false,name,blob:new Blob([JSON.stringify(record,null,2)],{type:'application/json'})};
}
