import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('operation date requests and displays an unambiguous four-digit year',()=>{
 assert.match(source,/id="opdateShort" placeholder="DD\/MM\/YYYY"/);
 assert.match(source,/aria-label="Operation date, DD\/MM\/YYYY"/);
 assert.match(source,/bindShortDate\(\$\("opdate"\),\$\("opdateShort"\),\(\)=>\(\{today:todayKey\(\),fullYear:true\}\)\)/);
});
