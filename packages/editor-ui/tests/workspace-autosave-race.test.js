require('../../../apps/desktop-shared/editor/stack-safe-json.js');
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Queue=require('../../../apps/desktop-shared/editor/workspace-save-queue.js');
const Learning=require('../../../apps/desktop-shared/editor/learn-core.js');
const Adaptive=require('../../../apps/desktop-shared/editor/learn-adaptive-core.js');
const Atlas=require('../../../apps/desktop-shared/editor/atlas-library-core.js');
const Knowledge=require('../../../apps/desktop-shared/editor/knowledge-core.js');
const composeAppSource=require('./helpers/compose-app-source.cjs');
const appSource=composeAppSource('desktop-shared');
// These functions moved out of app.js, but still precede it in the staged editor.
const workspaceMetadataSource=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/workspace-view-metadata.js'),'utf8');
// Evaluate the complete controller; never locate a method by whitespace or neighbours.
// Its constructor is not invoked: the fixture supplies the bridge and app state.
const settleTurn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(native=true){
 const requests=[],notices=[],local=[],sentWaiters=[];
 const whenSent=count=>requests.length>=count?Promise.resolve(requests[count-1]):new Promise(resolve=>sentWaiters.push({count,resolve}));
 const window={neuromapDesktop:native?{writeWorkspace(json){
  return new Promise((resolve,reject)=>{requests.push({
   json, resolve(){resolve({saved:true})},reject(error){reject(error)}
  });
  for(let i=sentWaiters.length-1;i>=0;i--)if(requests.length>=sentWaiters[i].count){const waiter=sentWaiters.splice(i,1)[0];waiter.resolve(requests[waiter.count-1]);}
  });
 }}:null};
 const persist=new Function('window','NeuroMapWorkspaceWriteQueue','localStorage',
  'nm68ClampGap','nm64PreferredWrap','document','console',
  'NeuroMapLearningCore','NeuroMapAdaptiveCore','NeuroMapAtlasLibrary','NeuroMapKnowledgeCore',
  workspaceMetadataSource+'\n'+appSource+'\nreturn NeuroMapApp.prototype.persistWorkspace;')(
   window,Queue,{setItem(key,value){local.push({key,value})}},x=>x,()=>48,
   {getElementById(){return {value:''}}},console,Learning,Adaptive,Atlas,Knowledge);
 const root={id:'root',text:'Before',children:[]};
 const state={root,images:[],relationships:[],isDirty:true};
 const tab={id:'tab1',title:'Original',state};
 const app={tabs:[tab],activeTabId:'tab1',studyCards:[],learningAttempts:[],learningPlans:[],_nmAtlasArchive:[],_desktopRecoveryPending:false,
  editorNodeId:null,_nmAtlasEdges:[],_nmJourneyProgress:{},
  saveActiveTabSnapshot(){},showToast(message){notices.push(message)}};
 const save=()=>persist.call(app);
 return {requests,notices,local,root,app,save,whenSent};
}
test('original race is eliminated: an older in-flight save cannot overwrite a newer revision',async()=>{
 const f=fixture();
 const first=f.save();await f.whenSent(1);
 assert.equal(f.requests.length,1);
 f.root.text='Newest';
 const second=f.save();await settleTurn();
 assert.equal(f.requests.length,1,'second write must not start while the first is pending');
 f.requests[0].resolve();assert.equal(await first,true);await f.whenSent(2);
 assert.equal(f.requests.length,2);
 assert.equal(JSON.parse(f.requests[1].json).tabs[0].root.text,'Newest');
 f.requests[1].resolve();assert.equal(await second,true);
 assert.equal(f.app._nativeWorkspaceWrites.isIdle(),true);
});
test('coalesce 1000 rapid edits, preserving the newest snapshot without 1000 disk writes',async()=>{
 const f=fixture();f.root.text='Revision 0';
 const first=f.save();await f.whenSent(1);const all=[first];
 for(let i=1;i<1000;i++){
  f.root.text='Revision '+i;
  all.push(f.save());
 }
 assert.equal(f.requests.length,1,'at most one write is active');
 f.requests[0].resolve();await f.whenSent(2);
 assert.equal(f.requests.length,2,'only last pending revision should be written');
 assert.equal(JSON.parse(f.requests[1].json).tabs[0].root.text,'Revision 999');
 f.requests[1].resolve();
 const outcomes=await Promise.all(all);
 assert.equal(outcomes.filter(Boolean).length,1000);
 assert.equal(f.requests.length,2);
 assert.equal(f.app._nativeWorkspaceWrites.isIdle(),true);
});
test('1000 independent fixtures with delayed disk completions remain monotonic',async()=>{
 let actualWrites=0;
 for(let user=0;user<1000;user++){
  const f=fixture();f.root.text='Initial-'+user;
  const old=f.save();await f.whenSent(1);
  f.root.text='Edited-'+user;
  f.app.studyCards=[{id:'card-'+user,sourceTabId:'tab1',answer:'Saved '+user}];
  const last=f.save();
  assert.equal(f.requests.length,1,'concurrent writer for '+user);
  f.requests[0].resolve();await f.whenSent(2);
  assert.equal(f.requests.length,2);
  const serialized=JSON.parse(f.requests[1].json);
  assert.equal(serialized.tabs[0].root.text,'Edited-'+user);
  assert.equal(serialized.studyCards[0].answer,'Saved '+user);
  f.requests[1].resolve();
  assert.deepEqual(await Promise.all([old,last]),[true,true]);
  actualWrites+=f.requests.length;
 }
 assert.equal(actualWrites,2000);
});
test('writer failure must be reported and a later save can recover',async()=>{
 const f=fixture();
 const first=f.save();await f.whenSent(1);
 f.requests[0].reject(new Error('Disk full'));
 assert.equal(await first,false);
 assert.equal(f.notices.length,1);
 f.root.text='Corrected';
 const next=f.save();await f.whenSent(2);
 assert.equal(f.requests.length,2);
 f.requests[1].resolve();
 assert.equal(await next,true);
 assert.equal(f.app._desktopAutosaveWarned,false);
});
test('browser localStorage fallback stays independent of native serialization',()=>{
 const f=fixture(false);
 const ok=f.save();
 assert.equal(ok,true);
 assert.equal(f.local.length,1);
 assert.equal(f.local[0].key,'neuromap.workspace.v2');
 assert.equal(JSON.parse(f.local[0].value).tabs[0].root.text,'Before');
 assert.equal(f.app._nativeWorkspaceWrites,undefined);
});

test('6.19 learning attempts and exam plans persist in the newest coalesced workspace',async()=>{
 const f=fixture();
 const first=f.save();await f.whenSent(1);
 f.app.learningAttempts=Learning.addAttempt([],{tabId:'tab1',nodeId:'root',itemId:'choice-1',format:'choice',correct:false,sourceSignature:'sig'},1700000000000);
 f.app.learningPlans=Adaptive.setPlan([],{tabId:'tab1',examDate:'2027-05-12',minutesPerDay:50},1700000000000);
 const latest=f.save();await settleTurn();
 assert.equal(f.requests.length,1);
 f.requests[0].resolve();await f.whenSent(2);
 assert.equal(f.requests.length,2);
 const disk=JSON.parse(f.requests[1].json);
 assert.equal(disk.learningAttempts[0].itemId,'choice-1');
 assert.equal(disk.learningPlans[0].examDate,'2027-05-12');
 f.requests[1].resolve();
 assert.deepEqual(await Promise.all([first,latest]),[true,true]);
});

test('whenIdle waits for every serialized write before a native Discard',async()=>{
 const f=fixture();
 const first=f.save();await f.whenSent(1);
 f.root.text='Pending revision';
 const last=f.save();await settleTurn();
 let ready=false;
 const idle=f.app._nativeWorkspaceWrites.whenIdle().then(()=>{ready=true;});
 await settleTurn();assert.equal(ready,false);
 f.requests[0].resolve();await f.whenSent(2);
 assert.equal(f.requests.length,2);
 assert.equal(ready,false);
 f.requests[1].resolve();
 await Promise.all([first,last,idle]);
 assert.equal(ready,true);
 assert.equal(f.app._nativeWorkspaceWrites.isIdle(),true);
});
