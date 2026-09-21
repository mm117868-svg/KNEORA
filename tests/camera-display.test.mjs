import test from 'node:test';
import assert from 'node:assert/strict';
import {colourisePixel,DISPLAY_SATURATION} from '../camera-display.mjs';

test('display colour correction leaves neutral greys neutral',()=>{
 assert.deepEqual(colourisePixel(128,128,128),[128,128,128]);
});

test('display colour correction adds restrained colour without changing analysis frames',()=>{
 const source=[150,100,80],shown=colourisePixel(...source);
 assert.equal(DISPLAY_SATURATION,1.22);
 assert.ok(shown[0]-shown[2]>source[0]-source[2]);
 assert.deepEqual(source,[150,100,80]);
 assert.ok(shown.every(value=>value>=0&&value<=255));
});
