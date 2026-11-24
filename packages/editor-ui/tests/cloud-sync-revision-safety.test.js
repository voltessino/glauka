'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,
 '../../../apps/desktop-shared/src/cloud_sync_ui.js'),'utf8');
const anchor='return Object.freeze({enabled,setEnabled,onWorkspaceSaved,syncNow,summary,';
assert.ok(source.includes(anchor),'Cloud Sync API source changed');
// Expose the real internal remote-applier only in the test isolate.
const instrumented=source.replace(anchor,'return Object.freeze({__testApplyRemote:applyRemote,__testRemote:remote,__testReconcile:reconcile,enabled,setEnabled,onWorkspaceSaved,syncNow,summary,');

function fixture(){
 const values=new Map([['glauka.cloud.optin.google','1']]);
 const root={
  _disk:'old',
  localStorage:{
   getItem:key=>values.get(key)??null,
   setItem:(key,val)=>values.set(key,String(val)),
   removeItem:key=>values.delete(key)
  },
  GlaukaCloudHash:{sha256:async json=>json},
  GlaukaCloudCore:{
   assertDocument:()=>{},
   createManager(){throw Error('stale local workspace reached cloud manager')}
  },
  GlaukaCloudProviders:{},
  neuroMapApp:{persistWorkspace:async()=>true},
  neuromapDesktop:{
   cloudAuth:{status:async()=>({supported:true,google:{configured:true,connected:true}})},
   cloudLocal:{protectWorkspace:async()=>({saved:true})},
   cloudTransport:{},
   readWorkspace:async()=>root._disk
  },
 };
 vm.runInNewContext(instrumented,{globalThis:root,TextEncoder});
 return root;
}
test('a syncNow snapshot superseded on disk is never uploaded',async()=>{
 const root=fixture();
 let reads=0;
 root.neuromapDesktop.readWorkspace=async()=>++reads===1?'old':'new';
 const outcome=await root.GlaukaCloudSync.syncNow('google');
 assert.equal(outcome.status,'stale-local');
 assert.equal(reads,2);
});
test('remote apply never overwrites unsaved edits made during backup',async()=>{
 const root=fixture();
 let applied=0,saved=0;
 root.neuroMapApp={
  editorNodeId:null,drag:false,_desktopRecoveryPending:false,_nmRecoveryBlocked:false,
  loadAutosave(){applied++;return true;},
  async persistWorkspace(){saved++;root._disk='edited';return true;}
 };
 const remote='{"tabs":[{"root":{"text":"Cloud"}}]}';
 const changed=await root.GlaukaCloudSync.__testApplyRemote('google','remote-id','old',remote);
 assert.equal(changed,false);
 assert.equal(saved,1);
 assert.equal(applied,0);
 assert.equal(root._disk,'edited');
});
test('remote apply succeeds when in-memory state and durable baseline match',async()=>{
 const root=fixture();
 const remote='{"tabs":[{"root":{"text":"Cloud"}}]}';
 let loaded=0,saved=0;
 root.neuroMapApp={
  editorNodeId:null,drag:false,_desktopRecoveryPending:false,_nmRecoveryBlocked:false,
  loadAutosave(bytes){loaded++;assert.equal(bytes,remote);return true;},
  async persistWorkspace(){
   saved++;
   if(loaded)root._disk=remote;
   return true;
  },
 };
 const outcome=await root.GlaukaCloudSync.__testApplyRemote('google','remote-id','old',remote);
 assert.equal(outcome,true);
 assert.equal(loaded,1);
 assert.equal(saved,2);
 assert.equal(root._disk,remote);
});

test('new freshness read failure reports a recoverable error instead of an unhandled rejection',async()=>{
 const root=fixture();
 let calls=0;
 root.neuromapDesktop.readWorkspace=async()=>{
  if(++calls===1)return 'old';
  throw Error('Simulated read failure');
 };
 const outcome=await root.GlaukaCloudSync.syncNow('google');
 assert.equal(outcome.status,'error');
 assert.match(outcome.error,/Simulated read failure/);
});

test('a provider disabled while native auth is pending does not start a new upload',async()=>{
 const root=fixture();
 let finishAuth,uploaded=0;
 root.neuromapDesktop.cloudAuth.status=()=>new Promise(resolve=>{finishAuth=resolve;});
 root.GlaukaCloudProviders.google=()=>({create(){uploaded++;return {id:'unexpected'};}});
 const promise=root.GlaukaCloudSync.__testRemote.create({
  id:'glg_abcdef123456789',bytes:'{}'
 });
 assert.equal(typeof finishAuth,'function');
 root.localStorage.setItem('glauka.cloud.optin.google','0');
 finishAuth({supported:true,google:{configured:true,connected:true}});
 await assert.rejects(promise,/disabled/);
 assert.equal(uploaded,0);
});

test('last explicit cloud enable/disable wins during pending native authentication',async()=>{
 const root=fixture();
 root.setTimeout=()=>1;root.clearTimeout=()=>{};
 root.GlaukaCloudCore.createManager=()=>({initialize:async()=>{}});
 let resolveAuth;
 root.neuromapDesktop.cloudAuth.status=()=>new Promise(resolve=>{resolveAuth=resolve});
 const older=root.GlaukaCloudSync.setEnabled('google',true);
 assert.equal(typeof resolveAuth,'function');
 assert.equal(await root.GlaukaCloudSync.setEnabled('google',false),false);
 resolveAuth({supported:true,google:{configured:true,connected:true}});
 assert.equal(await older,false);
 assert.equal(root.GlaukaCloudSync.enabled('google'),false);
});
test('latest provider selection wins when two enable requests finish out of order',async()=>{
 const root=fixture();
 root.setTimeout=()=>1;root.clearTimeout=()=>{};
 root.GlaukaCloudCore.createManager=()=>({initialize:async()=>{}});
 const resolutions=[];
 root.neuromapDesktop.cloudAuth.status=()=>new Promise(resolve=>resolutions.push(resolve));
 const google=root.GlaukaCloudSync.setEnabled('google',true);
 const onedrive=root.GlaukaCloudSync.setEnabled('onedrive',true);
 assert.equal(resolutions.length,2);
 const auth={supported:true,google:{configured:true,connected:true},
  onedrive:{configured:true,connected:true}};
 resolutions[1](auth);resolutions[0](auth);
 assert.deepEqual(await Promise.all([google,onedrive]),[false,true]);
 assert.equal(root.GlaukaCloudSync.enabled('google'),false);
 assert.equal(root.GlaukaCloudSync.enabled('onedrive'),true);
});
test('a local edit during provider auth stops stale cloud flush',async()=>{
 const root=fixture();
 const original='{"tabs":[{"root":{"text":"Original"}}]}';
 const newer='{"tabs":[{"root":{"text":"Edited"}}]}';
 const id='glg_abcdef123456789';
 root._disk=original;
 root.localStorage.setItem('glauka.cloud.identity.google',id);
 root.GlaukaCloudHash.sha256=async value=>value;
 let flushes=0,resolveAuth;
 root.GlaukaCloudCore.STATES={CONFLICT:'conflict'};
 root.GlaukaCloudCore.createManager=()=>({
  initialize:async()=>{},
  snapshot:()=>({[id]:{hash:original,dirty:false,remoteVersion:'v1'}}),
  pull:async()=>({status:'synced'}),
  flush:async()=>{flushes++;return {status:'synced'}},
 });
 root.neuromapDesktop.cloudAuth.status=()=>new Promise(resolve=>{resolveAuth=resolve});
 const pending=root.GlaukaCloudSync.__testReconcile('google',original);
 for(let i=0;i<30&&!resolveAuth;i++)await Promise.resolve();
 assert.equal(typeof resolveAuth,'function','native auth never requested');
 root._disk=newer;
 resolveAuth({supported:true,google:{connected:true,configured:true}});
 const outcome=await pending;
 assert.equal(outcome.status,'stale-local');
 assert.equal(flushes,0);
});
test('disabling the provider during rollback backup blocks remote replacement',async()=>{
 const root=fixture();
 root._disk='old';
 let loaded=0;
 root.neuroMapApp={
  editorNodeId:null,drag:false,_desktopRecoveryPending:false,_nmRecoveryBlocked:false,
  loadAutosave(){loaded++;return true;},
  persistWorkspace:async()=>true,
 };
 root.GlaukaCloudHash.sha256=async value=>value;
 root.neuromapDesktop.cloudLocal.protectWorkspace=async()=>{
  root.localStorage.setItem('glauka.cloud.optin.google','0');
  return {saved:true};
 };
 const result=await root.GlaukaCloudSync.__testApplyRemote('google','doc-id','old',
  '{"tabs":[{"root":{"text":"Incoming"}}]}');
 assert.equal(result,false);
 assert.equal(loaded,0);
 assert.equal(root._disk,'old');
});
