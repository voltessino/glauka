'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/src/bridge.js'),'utf8')
 .replace('{{TOKEN}}','qa-session')
 .replace('{{DEV_EDITION}}','true');

function bridge(){
 const sent=[];let browserPickerCalls=0;
 const ctx={
  Uint8Array,TextEncoder,Buffer,
  btoa:s=>Buffer.from(s,'binary').toString('base64'),
  atob:s=>Buffer.from(s,'base64').toString('binary'),
  crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
  fetch:async(url,args)=>{
   if(url==='/__desktop/file/export')sent.push(JSON.parse(args.body));
   return {ok:true,status:200,json:async()=>({cancelled:false,name:'export.md'})};
  },
  document:{hidden:false,addEventListener(){}},
  setInterval:()=>1,clearInterval(){},
  AbortController,
  showSaveFilePicker:()=>{browserPickerCalls++;throw Error('Browser picker should never open');}
 };
 ctx.window={addEventListener(){}};
 vm.runInNewContext(source,ctx,{filename:'desktop-bridge.js'});
 return {bridge:ctx.window.neuromapDesktop,sent,pickerCount:()=>browserPickerCalls};
}

test('native dialog is always used even when a browser picker is available',async()=>{
 const t=bridge();
 const bytes=new Uint8Array([0,1,2,255,0,250]);
 await t.bridge.saveExport({filename:'notes.md',bytes});
 assert.equal(t.pickerCount(),0);
 assert.equal(t.sent.length,1);
 assert.equal(t.sent[0].filename,'notes.md');
 assert.deepEqual(Buffer.from(t.sent[0].base64,'base64'),Buffer.from(bytes));
});

test('chunk boundary and binary zeros remain byte-exact for large exports',async()=>{
 const t=bridge();
 for(const length of [1,3,12287,12288,12289,12290,65537,1000000]){
  const bytes=Uint8Array.from({length},(_,i)=>(i*149+17)%256);
  await t.bridge.saveExport({filename:'large.json',bytes});
  const sent=t.sent.at(-1);
  assert.deepEqual(Buffer.from(sent.base64,'base64'),Buffer.from(bytes));
 }
 assert.equal(t.pickerCount(),0);
});
