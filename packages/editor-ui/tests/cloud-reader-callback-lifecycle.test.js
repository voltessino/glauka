'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createReader}=require('../../../apps/desktop-shared/src/cloud_reader.js');

test('cloud operation is not permanently locked if a UI callback throws',async()=>{
 const item={id:'safeid000001',remoteId:'remote-1',version:'v1',name:'Map.glk'};
 const driver={
  listRemote:async()=>[item],
  download:async()=>{throw Error('simulated network failure');},
 };
 let failDiscover=true,failRestore=true;
 const reader=createReader({
  providers:{google:()=>driver,dropbox:()=>driver},
  hash:async()=>'',assertDocument:()=>{},editor:()=>({}),
  onChange({state}){
   if(state==='searching'&&failDiscover)throw Error('discover UI unmounted');
   if(state==='downloading'&&failRestore)throw Error('restore UI unmounted');
  },
 });
 await assert.rejects(reader.discover('google'),/discover UI unmounted/);
 failDiscover=false;
 const listed=await reader.discover('google');
 assert.equal(listed.length,1);
 await assert.rejects(reader.restore('google',item.id),/restore UI unmounted/);
 failRestore=false;
 await assert.rejects(reader.restore('google',item.id),/simulated network failure/);
});
