'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const Core=require('../core');
const source=fs.readFileSync(path.resolve(__dirname,'../../../apps/desktop-shared/src/cloud_sync_ui.js'),'utf8');
const json=n=>JSON.stringify({version:3,tabs:[{id:'tab',root:{id:'r',text:'Map '+n,children:[]}}]});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function harness({remoteFiles=new Map(),initial=json(1)}={}){
 const prefs=new Map(),files=new Map(),calls=[],timers=[],backups=[];
 let current=initial,online=true,google=true,dropbox=true,onedrive=true,seq=0;
 const storage={_index:null,readIndex:async function(){return this._index},
  writeIndex:async function(x){this._index=x},listDocuments:async()=>[...files.keys()],
  readDocument:async id=>files.get(id)||null,
  writeDocument:async(id,bytes)=>{files.set(id,bytes)},
  protectWorkspace:async digest=>{
   if(sha(current)!==digest)throw Error('Local workspace changed');
   backups.push(current);return {saved:true};
  }};
 const driver=p=>({
  getMeta:async({id})=>{calls.push(p+':meta');const row=remoteFiles.get(p+id);return row?{id:row.remoteId,version:row.version,hash:row.hash,hashAlgorithm:'sha256'}:null},
  listRemote:async()=>{calls.push(p+':list');return [...remoteFiles.entries()]
   .filter(([key])=>key.startsWith(p)).map(([,item])=>({...item}))},
  create:async({id,hash,bytes})=>{
   calls.push(p+':create');const old=remoteFiles.get(p+id);
   const result={id,remoteId:p+'-remote-'+id,
     version:'v'+(++seq),hash,bytes,name:'Glauka workspace'};
   if(old)throw Error('Remote copy already existed');
   remoteFiles.set(p+id,result);return {id:result.remoteId,version:result.version,hash};
  },
  update:async({id,hash,bytes})=>{
   calls.push(p+':update');const old=remoteFiles.get(p+id);
   if(!old)throw Error('Remote missing');
   const result={...old,version:'v'+(++seq),hash,bytes};
   remoteFiles.set(p+id,result);return {id:result.remoteId,version:result.version,hash};
  },
  download:async({id})=>{
   calls.push(p+':download');const value=remoteFiles.get(p+id);
   if(!value)throw Error('Remote missing');
   return {bytes:value.bytes,metadata:{id:value.remoteId||value.id,
    version:value.version,hash:value.hash,hashAlgorithm:'sha256'}};
  }
 });
 const root={module:{exports:{}},TextEncoder,
  crypto:{getRandomValues:a=>crypto.randomFillSync(a)},
  localStorage:{getItem:k=>prefs.get(k)||null,setItem:(k,v)=>prefs.set(k,v),
   removeItem:k=>prefs.delete(k)},
  navigator:{get onLine(){return online}},
  document:{documentElement:{lang:'it'}},
  setTimeout(fn,ms){timers.push({fn,ms,cancelled:false});return timers.length},
  clearTimeout(id){if(timers[id-1])timers[id-1].cancelled=true},
  GlaukaCloudCore:Core,GlaukaCloudHash:{sha256:sha},
  GlaukaCloudProviders:{google:()=>driver('google'),dropbox:()=>driver('dropbox'),onedrive:()=>driver('onedrive')}};
 root.neuromapDesktop={cloudLocal:storage,cloudTransport:{send(){}},
  cloudAuth:{status:async()=>({supported:true,
   google:{configured:true,connected:google},dropbox:{configured:true,connected:dropbox},
   onedrive:{configured:true,connected:onedrive}})},
  readWorkspace:async()=>current};
 const app={_nmRecoveryBlocked:false,editorNodeId:null,drag:null,
  persistWorkspace:async()=>true,
  loadAutosave:incoming=>{current=incoming;return true},
  recalculateAndRender(){},renderTabBar(){},requestRender(){}};
 root.neuroMapApp=app;
 vm.runInNewContext(source,root,{filename:'cloud_sync_ui.js'});
 return {api:root.module.exports,storage,files,prefs,calls,timers,backups,remoteFiles,app,
  getWorkspace:()=>current,setWorkspace:val=>{current=typeof val==='string'?val:json(val)},
  setOnline:value=>{online=value},setConnected:(p,v)=>{if(p==='google')google=v;else if(p==='onedrive')onedrive=v;else dropbox=v},
  modifyRemote:(p,id,val)=>{
   const old=remoteFiles.get(p+id);assert.ok(old);
   remoteFiles.set(p+id,{...old,version:'external-'+(++seq),hash:sha(json(val)),bytes:json(val)});
  }
 };
}
test('no network by default; disabled account never uploads',async()=>{
 const h=harness();
 h.api.onWorkspaceSaved(json(1));assert.equal(h.timers.length,0);
 await h.api.setEnabled('google',true);
 assert.equal((await h.api.syncNow('google')).status,'synced');
 const sent=h.calls.length;
 await h.api.setEnabled('google',false);
 h.api.onWorkspaceSaved(json(2));
 assert.equal(h.calls.length,sent);
 await assert.rejects(h.api.syncNow('google'),/Attiva prima/);
});
test('accounts stay separate; switching provider disables the other to prevent overwrite',async()=>{
 const h=harness();await h.api.setEnabled('google',true);
 assert.equal((await h.api.syncNow('google')).status,'synced');
 assert.equal(h.api.enabled('google'),true);
 await h.api.setEnabled('dropbox',true);
 assert.equal(h.api.enabled('google'),false);
 assert.equal(h.api.enabled('dropbox'),true);
 await assert.rejects(h.api.syncNow('google'),/Attiva prima/);
 assert.equal((await h.api.syncNow('dropbox')).status,'synced');
 assert.equal(h.files.size,2);
 assert.ok([...h.files.keys()].some(id=>id.startsWith('glg_')));
 assert.ok([...h.files.keys()].some(id=>id.startsWith('gld_')));
});
test('clean remote update is verified, backed up and applied locally automatically',async()=>{
 const h=harness();await h.api.setEnabled('google',true);
 const first=await h.api.syncNow('google');assert.equal(first.status,'synced');
 h.modifyRemote('google',first.id,8);
 const result=await h.api.syncNow('google');
 assert.equal(result.status,'synced');assert.equal(result.direction,'download');
 assert.equal(h.getWorkspace(),json(8));assert.equal(h.backups.length,1);
 assert.equal(h.backups[0],json(1));
 assert.equal(h.calls.filter(x=>x==='google:create').length,1);
});
test('two users changing the same workspace create a conflict, not a silent overwrite',async()=>{
 const h=harness();await h.api.setEnabled('google',true);
 const first=await h.api.syncNow('google');
 h.modifyRemote('google',first.id,22);h.setWorkspace(33);
 const result=await h.api.syncNow('google');
 assert.equal(result.status,'conflict');
 assert.equal(h.getWorkspace(),json(33));
 assert.equal(h.remoteFiles.get('google'+first.id).bytes,json(22));
 assert.equal(h.backups.length,0);
});
test('new computer discovers existing remote identity; requires explicit first-time adoption',async()=>{
 const shared=new Map(),first=harness({remoteFiles:shared});
 await first.api.setEnabled('google',true);
 const synced=await first.api.syncNow('google');assert.equal(synced.status,'synced');
 const second=harness({remoteFiles:shared,initial:json(999)});
 await second.api.setEnabled('google',true);
 const discovered=await second.api.syncNow('google');
 assert.equal(discovered.status,'incoming');assert.equal(second.getWorkspace(),json(999));
 assert.equal(second.api.enabled('google'),true);
 assert.equal((await second.api.acceptIncoming('google')).status,'review');
 const accepted=await second.api.acceptIncoming('google',{replaceLocal:true});
 assert.equal(accepted.status,'synced');
 assert.equal(second.getWorkspace(),json(1));
 assert.equal(second.backups[0],json(999));
});
test('offline edits remain durably queued and resume when a provider is reachable',async()=>{
 const h=harness();await h.api.setEnabled('google',true);
 h.setOnline(false);h.api.onWorkspaceSaved(json(13));
 const timer=h.timers.find(x=>x.ms===9000&&!x.cancelled);assert.ok(timer);
 const offline=await h.api.syncNow('google');assert.equal(offline.status,'offline');
 assert.equal(h.files.size,1);
 assert.ok(!h.calls.some(x=>x==='google:create'));
 h.setOnline(true);
 const result=await h.api.syncNow('google');
 assert.equal(result.status,'synced');assert.ok(h.calls.includes('google:create'));
});
test('invalid or changed remote revision is never applied',async()=>{
 const h=harness();await h.api.setEnabled('google',true);
 const first=await h.api.syncNow('google');
 h.modifyRemote('google',first.id,3);
 const record=h.remoteFiles.get('google'+first.id);record.hash='0'.repeat(64);
 const result=await h.api.syncNow('google');
 assert.equal(result.status,'error');
 assert.equal(h.getWorkspace(),json(1));assert.equal(h.backups.length,0);
});
test('local edits already open in an editor block automatic remote replacement',async()=>{
 const h=harness();await h.api.setEnabled('google',true);
 const first=await h.api.syncNow('google');h.modifyRemote('google',first.id,4);
 h.app.editorNodeId='currently-typing';
 const result=await h.api.syncNow('google');
 assert.equal(result.status,'incoming');assert.equal(h.getWorkspace(),json(1));
 h.app.editorNodeId=null;
 const applied=await h.api.acceptIncoming('google');
 assert.equal(applied.status,'synced');assert.equal(h.getWorkspace(),json(4));
});
test('disconnected accounts cannot enable sync; disconnect clears provider binding',async()=>{
 const h=harness();h.setConnected('google',false);
 await assert.rejects(h.api.setEnabled('google',true),/Collega prima/);
 assert.equal(h.api.enabled('google'),false);
 h.setConnected('google',true);await h.api.setEnabled('google',true);
 await h.api.syncNow('google');
 h.api.forgetAccount('google');
 assert.equal(h.prefs.has('glauka.cloud.identity.google'),false);
});
test('provider queues avoid uploading the previous account identity to a new account',async()=>{
 const h=harness();await h.api.setEnabled('google',true);
 await h.api.syncNow('google');
 h.api.forgetAccount('google');await h.api.setEnabled('google',false);
 h.remoteFiles.clear();await h.api.setEnabled('google',true);
 const result=await h.api.syncNow('google');
 assert.equal(result.status,'synced');
 assert.ok([...h.remoteFiles.keys()].length===1);
});


test('remote workspace with 21 tabs applies completely after native loader limit increase',async()=>{
 const h=harness();await h.api.setEnabled('google',true);
 const first=await h.api.syncNow('google');
 const large=JSON.stringify({version:3,tabs:Array.from({length:21},(_,i)=>({
  id:'tab_'+i,root:{id:'r_'+i,text:'Topic '+i,children:[]}}))});
 const record=h.remoteFiles.get('google'+first.id);
 h.remoteFiles.set('google'+first.id,{...record,version:'many-tabs',
  bytes:large,hash:sha(large)});
 const result=await h.api.syncNow('google');
 assert.equal(result.status,'synced');
 assert.equal(result.direction,'download');
 assert.equal(h.getWorkspace(),large);
 assert.equal(JSON.parse(h.getWorkspace()).tabs.at(-1).root.text,'Topic 20');
 assert.deepEqual(h.backups,[json(1)]);
});
test('remote 101-tab workspace refuses automatic apply without replacing local maps',async()=>{
 const h=harness();await h.api.setEnabled('google',true);
 const first=await h.api.syncNow('google');
 const oversized=JSON.stringify({version:3,tabs:Array.from({length:101},(_,i)=>({
  id:'tab_'+i,root:{id:'r_'+i,text:'Topic '+i,children:[]}}))});
 const record=h.remoteFiles.get('google'+first.id);
 h.remoteFiles.set('google'+first.id,{...record,version:'many-tabs-101',
  bytes:oversized,hash:sha(oversized)});
 const result=await h.api.syncNow('google');
 assert.equal(result.status,'incoming');
 assert.equal(h.getWorkspace(),json(1));
 assert.equal(h.backups.length,0);
});
test('changed remote revision after staging cannot be accepted from stale cache',async()=>{
 const h=harness();await h.api.setEnabled('google',true);
 const first=await h.api.syncNow('google');
 h.app.editorNodeId='typing';
 h.modifyRemote('google',first.id,12);
 const incoming=await h.api.syncNow('google');
 assert.equal(incoming.status,'incoming');
 h.app.editorNodeId=null;
 h.modifyRemote('google',first.id,13);
 const stale=await h.api.acceptIncoming('google',{replaceLocal:true});
 assert.equal(stale.status,'review');
 assert.equal(h.getWorkspace(),json(1));
 assert.equal(h.backups.length,0);
});
test('a failed native rollback backup prevents importing remote data',async()=>{
 const h=harness();await h.api.setEnabled('google',true);
 const first=await h.api.syncNow('google');
 h.modifyRemote('google',first.id,42);
 h.storage.protectWorkspace=async()=>{throw Error('disk full')};
 const result=await h.api.syncNow('google');
 assert.equal(result.status,'error');
 assert.equal(h.getWorkspace(),json(1));
});

test('OneDrive: first upload and second device adoption use isolated glw identity',async()=>{
 const shared=new Map(),a=harness({remoteFiles:shared});
 await a.api.setEnabled('onedrive',true);
 const initial=await a.api.syncNow('onedrive');
 assert.equal(initial.status,'synced');
 assert.ok(initial.id.startsWith('glw_'));
 assert.equal(a.api.enabled('google'),false);
 const second=harness({remoteFiles:shared,initial:json(45)});
 await second.api.setEnabled('onedrive',true);
 const staged=await second.api.syncNow('onedrive');
 assert.equal(staged.status,'incoming');
 assert.equal(second.getWorkspace(),json(45));
 const adopted=await second.api.acceptIncoming('onedrive',{replaceLocal:true});
 assert.equal(adopted.status,'synced');
 assert.equal(second.getWorkspace(),json(1));
 assert.equal(second.backups.length,1);
});
test('switching Google to OneDrive disables old writes without deleting either cloud copy',async()=>{
 const h=harness();
 await h.api.setEnabled('google',true);
 assert.equal((await h.api.syncNow('google')).status,'synced');
 await h.api.setEnabled('onedrive',true);
 assert.equal(h.api.enabled('google'),false);
 assert.equal(h.api.enabled('onedrive'),true);
 assert.equal((await h.api.syncNow('onedrive')).status,'synced');
 assert.equal(h.remoteFiles.size,2);
 await assert.rejects(h.api.syncNow('google'),/Attiva prima/);
});
