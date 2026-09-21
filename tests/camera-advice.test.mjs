import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('camera advice gives practical clothing and positioning instructions',()=>{
  assert.match(page,/plain, matte blue or green fitted top/);
  assert.match(page,/shorts that leave the knee visible/);
  assert.match(page,/Place the camera side-on/);
  assert.match(page,/Avoid direct sunlight, glare and mirrors/);
});

test('camera advice links exact D415 studies without claiming clinical validation',()=>{
  for(const pmid of ['30691011','33824790','42451232']) assert.match(page,new RegExp(`pubmed\\.ncbi\\.nlm\\.nih\\.gov\\/${pmid}\\/`));
  assert.match(page,/do not validate Kneora's knee-angle measurements or its use after total knee replacement/);
});
