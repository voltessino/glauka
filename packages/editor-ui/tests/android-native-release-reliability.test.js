'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const UI=path.resolve(__dirname,'..');
const read=(name)=>fs.readFileSync(path.join(UI,name),'utf8');
const UUID='550e8400-e29b-41d4-a716-446655440000';
function runtime(options={}){
  const sent=[], timers=[];
  let signalSent;
  const whenSent=new Promise(resolve=>signalSent=resolve);
  const host={
    Blob, Promise, Uint8Array, TextEncoder, console,
    setTimeout(fn,ms){const job={fn,ms,cancelled:false};timers.push(job);return job;},
    clearTimeout(job){if(job)job.cancelled=true;},
    document:{documentElement:{lang:'it'}},
    crypto:{randomUUID:()=>UUID},
    FileReader:class{
      readAsDataURL(blob){this.result='data:application/octet-stream;base64,YQ==';this.onload?.();}
    }
  };
  host.globalThis=host;host.window=host;
  vm.runInNewContext(read('workspace-recovery.js'),host,{filename:'workspace-recovery.js'});
  host.NMAndroid={saveProject(filename,encoded,id){
    sent.push({filename,encoded,id});
    signalSent();
    if(options.respond!==false)
      host.NeuroMapLifecycle.androidSaved(id,{ok:options.ok!==false});
  }};
  vm.runInNewContext(read('lifecycle.js'),host,{filename:'lifecycle.js'});
  return {host,sent,timers,whenSent};
}
test('Android exports send a native-accepted canonical save UUID',async()=>{
  const {host,sent,timers}=runtime();
  assert.equal(await host.NeuroMapLifecycle.androidExport(new Blob(['a']),'concept.svg'),true);
  assert.equal(sent.length,1);
  assert.equal(sent[0].filename,'concept.svg');
  assert.match(sent[0].id,/^save_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.ok(timers[0].cancelled,'success clears the long-running picker timeout');
});
test('cancel does not acknowledge an export, and pending calls have a bounded timeout',async()=>{
  const canceled=runtime({ok:false});
  assert.equal(await canceled.host.NeuroMapLifecycle.androidExport(new Blob(['a']),'notes.md'),false);
  const timed=runtime({respond:false});
  const result=timed.host.NeuroMapLifecycle.androidExport(new Blob(['a']),'notes.md');
  await timed.whenSent;
  assert.equal(timed.sent.length,1);
  assert.equal(timed.timers[0].ms,600000);
  timed.timers[0].fn();
  await assert.rejects(result,/Tempo massimo/);
});
test('fallback UUID is canonical and valid on old Android WebViews',()=>{
  const {host}=runtime();
  const fallback=host.NeuroMapRecovery.requestId({
    getRandomValues:bytes=>{for(let i=0;i<bytes.length;i++)bytes[i]=i;return bytes;}
  });
  assert.match(fallback,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('512 recovery tabs remain valid; 513 are rejected with no truncation',()=>{
  const {host}=runtime();
  const tabs=Array.from({length:512},(_,i)=>({id:'tab'+i,root:{id:'r'+i,text:'Map '+i,children:[]}}));
  assert.equal(host.NeuroMapRecovery.validate({tabs}).tabs.length,512);
  assert.throws(()=>host.NeuroMapRecovery.validate({tabs:[...tabs,{id:'overflow',root:{id:'last',text:'excess',children:[]}}]}),/Copia di recupero non valida/);
});
