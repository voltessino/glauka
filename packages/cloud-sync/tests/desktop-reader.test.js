'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createReader}=require('../../../apps/desktop-shared/src/cloud_reader');
const DOC=JSON.stringify({root:{text:'Heart',children:[]}});
function setup(opts={}){
 const events=[],calls=[];
 const found=[{id:'doc_12345678',name:'Anatomia.glk',remoteId:'remote-v1',version:'v1',
  hash:'good',hashAlgorithm:'sha256'}];
 const source={listRemote:async()=>found,download:async()=>({
  bytes:DOC,metadata:{id:'remote-v1',version:'v1',hash:'good',hashAlgorithm:'sha256'}})};
 let imports=0,completed=0,saves=0;
 const app={importFile:async(file,options)=>{
  calls.push({file,options});imports++;return 2;
 },persistWorkspace:async()=>{saves++;return true;}};
 const reader=createReader({
  providers:{google:()=>source,dropbox:()=>source},
  hash:async()=> 'good',
  assertDocument:bytes=>{const doc=JSON.parse(bytes);if(!doc.root)throw Error('Invalid map')},
  editor:()=>app,
  onChange:e=>events.push(e)
 });
 return {reader,source,found,app,calls,events,stats:()=>({imports,saves})};
}
test('cloud discovery never changes the editor and only exposes sanitized identifiers',async()=>{
 const s=setup();
 const files=await s.reader.discover('google');
 assert.equal(files.length,1);
 assert.equal(files[0].name,'Anatomia.glk');
 assert.equal(s.stats().imports,0);
 assert.equal(s.stats().saves,0);
});
test('explicit import creates a new tab and waits for durable native workspace success',async()=>{
 const s=setup();await s.reader.discover('google');
 const imported=await s.reader.restore('google','doc_12345678');
 assert.equal(imported.savedLocally,true);
 assert.equal(s.calls[0].options.newTab,true);
 assert.equal(s.calls[0].file.name,'Anatomia.json');
 assert.equal(s.stats().imports,1);
 assert.equal(s.stats().saves,1);
 assert.equal(s.events.at(-1).state,'restored');
});
test('restoring without a verified list is never allowed',async()=>{
 const s=setup();
 await assert.rejects(s.reader.restore('google','doc_12345678'),/verified cloud list/);
 assert.equal(s.stats().imports,0);
});
test('remote revision changes between listing and restore block all imports',async()=>{
 const s=setup();await s.reader.discover('google');
 s.found[0]={...s.found[0],version:'new-revision'};
 await assert.rejects(s.reader.restore('google','doc_12345678'),/Remote revision changed/);
 assert.equal(s.stats().imports,0);
});
test('a second version appears during download: refuse to overwrite tabs',async()=>{
 const s=setup();await s.reader.discover('google');
 s.source.download=async()=>({bytes:DOC,metadata:{id:'remote-v2',version:'v2'}});
 await assert.rejects(s.reader.restore('google','doc_12345678'),/Remote revision changed/);
 assert.equal(s.stats().imports,0);
});
test('tampered SHA-256 blocks import',async()=>{
 const s=setup();await s.reader.discover('google');
 s.source.download=async()=>({bytes:DOC,metadata:{id:'remote-v1',version:'v1',hash:'bad',hashAlgorithm:'sha256'}});
 await assert.rejects(s.reader.restore('google','doc_12345678'),/integrity check failed/);
 assert.equal(s.stats().imports,0);
});
test('native local persistence failure cannot be reported as a restored map',async()=>{
 const s=setup();await s.reader.discover('google');s.app.persistWorkspace=async()=>false;
 await assert.rejects(s.reader.restore('google','doc_12345678'),/not confirmed/);
 assert.equal(s.events.at(-1).state,'error');
});
test('duplicate remote logical IDs block selection',async()=>{
 const s=setup();s.source.listRemote=async()=>[s.found[0],s.found[0]];
 await assert.rejects(s.reader.discover('google'),/Ambiguous cloud library/);
 assert.equal(s.stats().imports,0);
});
test('unsafe cloud filenames are sanitized before File creation',async()=>{
 const s=setup();s.found[0].name='../../bad\nname.glk';
 const [entry]=await s.reader.discover('google');
 assert.equal(entry.name.includes('/'),false);
 assert.equal(entry.name.includes('\n'),false);
 await s.reader.restore('google','doc_12345678');
 assert.equal(s.calls[0].file.name.includes('/'),false);
});
test('Google and Dropbox selections cannot be mixed across providers',async()=>{
 const s=setup();await s.reader.discover('google');
 await assert.rejects(s.reader.restore('dropbox','doc_12345678'),/verified cloud list/);
 assert.equal(s.stats().imports,0);
});

test('closing Cloud UI while download is in flight cancels before opening a tab',async()=>{
 const s=setup();await s.reader.discover('google');
 let release;
 s.source.download=()=>new Promise(resolve=>{release=resolve});
 // The controller's cancellation hook is supplied independently by the UI.
 let allowed=true;
 const reader=createReader({
  providers:{google:()=>s.source,dropbox:()=>s.source},
  hash:async()=> 'good',
  assertDocument:bytes=>JSON.parse(bytes),
  editor:()=>s.app,isAllowed:()=>allowed
 });
 await reader.discover('google');
 const pending=reader.restore('google','doc_12345678');
 await Promise.resolve();await Promise.resolve();
 allowed=false;
 release({bytes:DOC,metadata:{id:'remote-v1',version:'v1',hash:'good',hashAlgorithm:'sha256'}});
 await assert.rejects(pending,/cancelled/);
 assert.equal(s.stats().imports,0);
 assert.equal(s.stats().saves,0);
});
