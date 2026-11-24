'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const composeAppSource=require('../../../packages/editor-ui/tests/helpers/compose-app-source.cjs');
const source=composeAppSource('android');
const begin=source.indexOf('\n      loadAutosave(');
const end=source.indexOf('\n      toggleBoundary()',begin);
assert.ok(begin>=0&&end>begin,'Android recovery method not found');
const method=source.slice(begin,end);
function setup(){
 const clone=x=>JSON.parse(JSON.stringify(x));
 const load=new Function('localStorage','window','globalThis','console',
  'MindMapStateMachine','nmAndroidRestoreSpacing',
  'return ({'+method+'}).loadAutosave;')(
  {getItem(){return null}},{neuromapDesktop:{}},
  {NeuroMapRecovery:{MAX_TABS:512,validate(data){
   if(!Array.isArray(data.tabs)||data.tabs.length>512)throw Error('too many');
  },camera(){return null}}},
  {warn(){}},{cloneTree:clone,cloneImages:x=>x||[],cloneRelationships:x=>x||[]},()=>{});
 const existing={id:'existing',title:'Existing',
  state:{root:{id:'r0',text:'Existing',children:[]}}};
 const app={tabs:[existing],activeTabId:'existing',state:existing.state,
  renderer:{state:existing.state},_nmRecoveryBlocked:false,
  newState(text){return {root:{id:'new',text,children:[]},
   generateId(){return 'new-id'},findNode(){return null}}}
 };
 return {load:json=>load.call(app,json),app,existing};
}
function documentFor(count){
 return JSON.stringify({activeTabId:'tab-'+(count-1),
  tabs:Array.from({length:count},(_,i)=>({
   id:'tab-'+i,title:'Map '+i,
   root:{id:'r'+i,text:'Map '+i,children:[]},images:[],relationships:[],
  }))});
}
test('Android preserves every tab after a recovery including tab 512',()=>{
 for(const count of [21,100,512]){
  const f=setup(),ok=f.load(documentFor(count));
  assert.equal(ok,true,'failed '+count+' tabs');
  assert.equal(f.app.tabs.length,count);
  assert.equal(f.app.tabs[0].state.root.text,'Map 0');
  assert.equal(f.app.tabs[count-1].state.root.text,'Map '+(count-1));
  assert.equal(f.app.activeTabId,'tab-'+(count-1));
 }
});
test('Android rejects 513-tab snapshots without altering open tabs',()=>{
 const f=setup();
 assert.notEqual(f.load(documentFor(513)),true);
 assert.equal(f.app.tabs.length,1);
 assert.equal(f.app.tabs[0],f.existing);
 assert.equal(f.app.state.root.text,'Existing');
});
