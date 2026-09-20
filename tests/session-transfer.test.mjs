import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSessionRecord,importSessionRecord,sessionIdentity} from '../session-transfer.mjs';
const record={schema_version:1,patient_id:'P001',operation_date:'2026-09-01',exercise:'heel_slide',started_at:'2026-09-20T12:00:00',duration_s:30};
test('a phone session imports once into the computer record list',()=>{
  assert.equal(validateSessionRecord(record),record);const first=importSessionRecord(record,[]);assert.equal(first.records.length,1);assert.equal(first.duplicate,false);
  const second=importSessionRecord({...record},first.records);assert.equal(second.records.length,1);assert.equal(second.duplicate,true);assert.equal(sessionIdentity(record),sessionIdentity({...record}));
});
test('unrecognised or incomplete files are rejected',()=>{
  assert.throws(()=>validateSessionRecord({}),/missing schema version/i);assert.throws(()=>validateSessionRecord({...record,schema_version:2}),/not supported/i);
});
