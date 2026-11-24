'use strict';
const composeStateSource=require('../../../packages/editor-ui/tests/helpers/compose-state-source.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const content=composeStateSource('android');
const match=/function nm72PreserveHotspots\(rows\)\{[\s\S]*?\n    \}/.exec(content);
if(!match)throw Error('Android hotspot retention function missing');
const normalize=new Function(match[0]+'\nreturn nm72PreserveHotspots;')();
test('Android preserves bounded, source-linked desktop visual hotspots without enabling UI',()=>{
 const original=[{x:.25,y:.75,nodeId:'node-12',label:'Heart'}];
 assert.deepEqual(normalize(original),original);
 assert.equal(content.includes('studyHotspots:nm72PreserveHotspots(img.studyHotspots)'),true);
 assert.equal(content.includes('studyHotspots:nm72PreserveHotspots(payload.studyHotspots)'),true);
 assert.deepEqual(normalize([{x:10,y:.5,nodeId:'node-12',label:'Heart'}]),[]);
});
test('Android image metadata cannot balloon via malicious hotspot inputs',()=>{
 const original=Array.from({length:100},(_,i)=>({x:i/100,y:.5,nodeId:'node-'+i,label:'H'+i}));
 assert.equal(normalize(original).length,40);
});
