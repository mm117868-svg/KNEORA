import test from 'node:test';
import assert from 'node:assert/strict';
import {shortDate,parseShortDate} from '../short-date.mjs';
const options={today:'2026-09-13'};
test('short dates retain full ISO years for age and surgery calculations',()=>{
  assert.equal(shortDate('1978-12-01'),'01/12/78');
  assert.equal(shortDate('2026-09-05'),'05/09/26');
  assert.equal(shortDate('2026-09-17',{fullYear:true}),'17/09/2026');
  assert.equal(parseShortDate('01/12/78',{...options,birthDate:true}),'1978-12-01');
  assert.equal(parseShortDate('01/12/01',{...options,birthDate:true}),'2001-12-01');
  assert.equal(parseShortDate('05/09/26',options),'2026-09-05');
  assert.equal(parseShortDate('050926',options),'2026-09-05');
  assert.equal(parseShortDate('01121978',{...options,birthDate:true}),'1978-12-01');
  assert.equal(parseShortDate('05/09/27',options),'2027-09-05');
  assert.equal(parseShortDate('05/09/99',options),'1999-09-05');
});
test('explicit centuries and existing centenarian dates are preserved',()=>{
  assert.equal(parseShortDate('01/12/1901',{...options,birthDate:true}),'1901-12-01');
  assert.equal(parseShortDate('02/12/01',{...options,birthDate:true,previous:'1901-12-01'}),'1901-12-02');
  assert.equal(parseShortDate('01/12/01',{...options,birthDate:true,previous:'0001-12-01'}),'2001-12-01');
});
test('impossible dates, incomplete years and explicit future births are rejected',()=>{
  for(const text of ['31/02/26','29/02/25','01/13/26','01/12/1','01/12/0001'])assert.throws(()=>parseShortDate(text,options));
  assert.throws(()=>parseShortDate('01/12/2026',{...options,birthDate:true}));
  assert.equal(parseShortDate('29/02/24',options),'2024-02-29');
  assert.equal(parseShortDate('',options),'');
});
