'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const E=require('../../../apps/desktop-shared/editor/portable-exchange-core.js');
function project(text='First'){
 return {schema:'NeuroMapArchitect-SingleTab-v6',savedAt:'2026-10-23T10:00:00Z',
  root:{id:'root',text:'Project',children:[{id:'a',text,children:[]}]},images:[],relationships:[],studyCards:[]};
}
test('portable export integrity survives timestamp-only differences',async()=>{
 const p=project(),packet=await E.create(p);
 const local=project();local.savedAt='2026-10-24T09:00:00Z';
 const review=await E.inspect(JSON.stringify(packet),local);
 assert.equal(review.status,'identical');
 assert.equal(review.differences.added,0);
 assert.equal(review.incomingHash.length,64);
});
test('same logical project with changes is divergent, never auto-merged',async()=>{
 const p=project(),packet=await E.create(p);
 const local=project('Second'),before=JSON.stringify(local);
 const review=await E.inspect(JSON.stringify(packet),local);
 assert.equal(review.status,'divergent');
 assert.equal(review.differences.modified,1);
 assert.equal(JSON.stringify(local),before);
});
test('unrelated projects are distinguished',async()=>{
 const packet=await E.create(project());
 const local=project();local.root.id='another-root';
 assert.equal((await E.inspect(packet,local)).status,'different-project');
});
test('checksum tampering or manifest corruption fails closed',async()=>{
 const packet=await E.create(project());packet.project.root.children[0].text='Tampered';
 await assert.rejects(()=>E.inspect(JSON.stringify(packet),project()),/checksum/);
 const good=await E.create(project());
 good.manifest.sha256='broken';
 await assert.rejects(()=>E.inspect(good,project()),/checksum/);
});
test('duplicate IDs and malformed models are rejected',async()=>{
 const p=project();p.root.children.push({id:'a',text:'dup',children:[]});
 await assert.rejects(()=>E.create(p),/Invalid map structure/);
 const cyclic=project();cyclic.root.children.push(cyclic.root);
 assert.throws(()=>E.validate(cyclic),/Invalid/);
});
