import test from 'node:test';
import assert from 'node:assert/strict';
import {squatLandmarkPaths} from '../squat-view.mjs';

const body=Array.from({length:33},()=>({x:.5,y:.5,visibility:.9}));
Object.assign(body[11],{x:.3,y:.2});Object.assign(body[12],{x:.7,y:.2});Object.assign(body[23],{x:.4,y:.45});Object.assign(body[24],{x:.6,y:.45});Object.assign(body[25],{x:.35,y:.7});Object.assign(body[26],{x:.65,y:.7});Object.assign(body[27],{x:.3,y:.9});Object.assign(body[28],{x:.7,y:.9});
Object.assign(body[29],{x:.26,y:.94});Object.assign(body[30],{x:.74,y:.94});Object.assign(body[31],{x:.36,y:.96});Object.assign(body[32],{x:.64,y:.96});

test('squats show the trunk, both legs and both feet from MediaPipe Pose',()=>{
 const paths=squatLandmarkPaths(body,1000,500);
 assert.equal(paths.torso.length,5);
 assert.deepEqual(paths.leftLeg,[[400,225],[350,350],[300,450]]);
 assert.deepEqual(paths.rightLeg,[[600,225],[650,350],[700,450]]);
 assert.deepEqual(paths.leftFoot,[[300,450],[260,470],[360,480]]);
 assert.deepEqual(paths.rightFoot,[[700,450],[740,470],[640,480]]);
});

test('a missing required squat landmark leaves the squat overlay unavailable',()=>{
 const missing=body.map(p=>({...p}));missing[12].visibility=.1;
 assert.equal(squatLandmarkPaths(missing,1000,500),null);
});
