require('../../../apps/desktop-shared/editor/learn-core.js');
require('../../../apps/desktop-shared/editor/learn-adaptive-core.js');
require('../../../apps/desktop-shared/editor/stack-safe-json.js');
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const K=require('../../../apps/desktop-shared/editor/knowledge-core.js');
const A=require('../../../apps/desktop-shared/editor/atlas-library-core.js');
const Queue=require('../../../apps/desktop-shared/editor/workspace-save-queue.js');
const composeAppSource=require('./helpers/compose-app-source.cjs');
const source=composeAppSource('desktop-shared');
// These functions moved out of app.js, but still precede it in the staged editor.
const workspaceMetadataSource=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/workspace-view-metadata.js'),'utf8');
const begin=source.indexOf('\n      persistWorkspace() {'),end=source.indexOf('\n      toggleBoundary()',begin);
assert.ok(begin>0&&end>begin,'workspace methods not found');
const extract=source.slice(begin,end).replace('\n      loadAutosave(', '\n      ,loadAutosave(');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 let disk='',nextId=0;
 const window={neuromapDesktop:{writeWorkspace:async json=>{disk=json;return {saved:true}}}};
 const proto=new Function('window','NeuroMapAtlasLibrary','NeuroMapKnowledgeCore',
  'NeuroMapWorkspaceWriteQueue','localStorage','MindMapStateMachine',
  'nm68ClampGap','nm64PreferredWrap','nm64WasCustom','nm64ApplyWrapPreference','document','console',
  workspaceMetadataSource+'\nreturn ({'+extract+'});')(
   window,A,K,Queue,{getItem:()=>disk,setItem:(k,v)=>{disk=v}},
   {cloneTree:clone,cloneImages:clone,cloneRelationships:clone},
   x=>Number(x)||130,()=>48,()=>false,()=>{},
   {getElementById:()=>({value:''})},{warn(){}});
 function state(title,id,dirty=false){return {root:{id:'root-'+id,text:title,children:[
   {id:'concept-'+id,text:'Cardiology '+id,notes:'cardiac physiology',children:[]}]},
  images:[],relationships:[],isDirty:dirty,findNode(nodeId){const nodes=[this.root,...this.root.children];
   return nodes.find(x=>x.id===nodeId)||null},
  generateId(){return 'gen-'+(++nextId)}};}
 const app={tabs:[],studyCards:[],activeTabId:'',editorNodeId:null,renderer:{state:null,camera:{}},
  saveActiveTabSnapshot(){},newState(title){return state(title,'fresh-'+(++nextId))},
  showToast(){},_desktopRecoveryPending:false};
 app.persistWorkspace=proto.persistWorkspace;app.loadAutosave=proto.loadAutosave;
 return {app,state,read:()=>disk,proto};
}
test('1000 native workspace roundtrips retain closed document search without original tabs open',async()=>{
 for(let user=0;user<1000;user++){
  const f=fixture(),s=f.state('Heart '+user,'n'+user);
  const filePath='C:\\Study\\cardio-'+user+'.neuromap';
  f.app.tabs=[{id:'before-'+user,title:'Heart '+user,filePath,originSheetIndex:0,state:s}];
  f.app.activeTabId='before-'+user;f.app.state=s;
  assert.equal(await f.app.persistWorkspace(),true);
  assert.equal(f.app._nmAtlasArchive.length,1);
  const archivedId=A.keyFor(f.app.tabs[0]);
  // Replace the visible tab by an unrelated empty tab. Atlas archive is untouched.
  const empty=f.state('New empty map','new');
  f.app.tabs=[{id:'empty',title:'New empty map',state:empty}];
  f.app.activeTabId='empty';f.app.state=empty;
  assert.equal(await f.app.persistWorkspace(),true);
  const saved=f.read();assert.ok(saved.includes('"atlasLibrary"'));
  const restored=fixture();
  assert.equal(restored.app.loadAutosave(saved),true);
  assert.equal(restored.app._nmAtlasArchive.length,1);
  const idx=A.project(K,restored.app.tabs,restored.app._nmAtlasArchive);
  const found=K.search(idx,'cardiology '+user,10).find(x=>x.tabId===archivedId);
  assert.ok(found,'lost saved closed document '+user);
  assert.equal(found.nodeId,'concept-n'+user);
  assert.equal(found.archived,true);
 }
});
test('cross-file backlinks persist through a closed-document reboot and match new tab IDs',async()=>{
 const f=fixture(),a=f.state('A','A'),b=f.state('B','B');
 const left={id:'tab-left',title:'Left',state:a,filePath:'C:\\Study\\A.neuromap'};
 const right={id:'tab-right',title:'Right',state:b,filePath:'C:\\Study\\B.neuromap'};
 f.app.tabs=[left,right];f.app.activeTabId='tab-left';f.app.state=a;
 f.app._nmAtlasEdges=[{fromTab:'tab-left',fromNode:'concept-A',toTab:'tab-right',toNode:'concept-B',label:'Evidence'}];
 await f.app.persistWorkspace();
 const empty=f.state('Empty','X');
 f.app.tabs=[{id:'empty',title:'Empty',state:empty}];f.app.activeTabId='empty';f.app.state=empty;
 await f.app.persistWorkspace();
 const session=fixture();assert.equal(session.app.loadAutosave(f.read()),true);
 const idx=A.project(K,session.app.tabs,session.app._nmAtlasArchive);
 const edges=A.normalizeEdges(K,session.app._nmAtlasEdges,idx);
 assert.equal(edges.length,1);
 assert.equal(edges[0].fromTab,A.keyFor(left));
 assert.equal(edges[0].toTab,A.keyFor(right));
});
test('an unsaved document is deliberately NOT archived as if it existed on disk',async()=>{
 const f=fixture(),dirty=f.state('Draft','draft',true);
 f.app.tabs=[{id:'draft',title:'Draft',state:dirty,filePath:'C:\\Study\\Draft.neuromap'}];
 f.app.activeTabId='draft';f.app.state=dirty;
 await f.app.persistWorkspace();
 assert.equal(f.app._nmAtlasArchive.length,0);
});
