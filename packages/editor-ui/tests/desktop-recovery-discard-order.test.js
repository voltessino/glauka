'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/src/bridge.js'),'utf8')
 .replace('{{TOKEN}}','qa')
 .replace('{{DEV_EDITION}}','true');

function create(){
 const steps=[],writes=[];
 const context={
  window:{addEventListener(){}},document:{hidden:false,addEventListener(){}},
  setInterval:()=>0,clearInterval(){},TextEncoder,TextDecoder,Uint8Array,AbortController,
  crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
  fetch:async(route,request)=>{
   if(route.endsWith('/workspace/write')){
    steps.push('write');
    return new Promise(resolve=>writes.push({resolve,body:JSON.parse(request.body)}));
   }
   if(route.endsWith('/workspace/discard'))steps.push('discard');
   // Other internal window-heartbeat requests are incidental to this test.
   if(route.endsWith('/window/live'))return {ok:true,body:null,json:async()=>({})};
   return {ok:true,status:200,json:async()=>({ok:true})};
  }
 };
 vm.runInNewContext(source,context,{filename:'bridge.js'});
 return {bridge:context.window.neuromapDesktop,writes,steps};
}
test('discard never races in-flight native workspace writes',async()=>{
 const q=create();
 const a=q.bridge.writeWorkspace('revision-1');
 const b=q.bridge.writeWorkspace('revision-2');
 const discard=q.bridge.discardWorkspace();
 for(let i=0;i<8;i++)await Promise.resolve();
 assert.deepEqual(q.steps,['write']);
 assert.equal(q.writes[0].body.json,'revision-1');
 q.writes[0].resolve({ok:true,status:200,json:async()=>({saved:true})});
 await a;
 for(let i=0;i<8;i++)await Promise.resolve();
 assert.deepEqual(q.steps,['write','write']);
 assert.equal(q.writes[1].body.json,'revision-2');
 q.writes[1].resolve({ok:true,status:200,json:async()=>({saved:true})});
 await Promise.all([b,discard]);
 assert.deepEqual(q.steps,['write','write','discard']);
});
test('failed in-flight write still permits a requested discard to run last',async()=>{
 const q=create();
 const first=q.bridge.writeWorkspace('draft').then(()=>false,()=>true);
 const clear=q.bridge.discardWorkspace();
 for(let i=0;i<8;i++)await Promise.resolve();
 q.writes[0].resolve({ok:false,status:500,json:async()=>({message:'Disk full'})});
 assert.equal(await first,true);
 await clear;
 assert.deepEqual(q.steps,['write','discard']);
});
