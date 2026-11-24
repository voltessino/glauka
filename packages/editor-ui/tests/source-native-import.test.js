'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../../apps/desktop-shared/editor/source-lens-core.js');
const MapCore=require('../../../packages/map-core');
const composeAppSource=require('./helpers/compose-app-source.cjs');
const code=composeAppSource('desktop-shared');
const start=code.indexOf('      importHierarchy(source, options = {}) {');
const end=code.indexOf('      parseTextHierarchy(',start);
assert.ok(start>0&&end>start,'cannot locate the real importHierarchy method');
const palette=Array.from({length:10},(_,i)=>'#'+(i+5).toString(16).repeat(6));
let counter=0;
class FakeState{
 constructor(){this.images=[];this.relationships=[];this.generateId=()=>('new_'+(++counter));}
 findNode(id){const stack=[this.root];while(stack.length){const n=stack.pop();if(n.id===id)return n;stack.push(...n.children)}return null}
}
const importHierarchy=new Function('MindMapStateMachine','NeuroMapCore','NeuroMapSourceCore','HARMONIC_PALETTE',
 'return ({'+code.slice(start,end)+'}).importHierarchy;')({
  cloneTree:node=>structuredClone(node),
  linkedMetadata:()=>{}
 },MapCore,Core,palette);
function mock(){
 const app={tabs:[],state:null,layout:null,
  newState(){return new FakeState()},saveActiveTabSnapshot(){},closeEditor(){},
  addTab(state){const tab={id:'tab_'+(++counter),state};this.tabs.push(tab);this.state=state;return tab},
  recalculateAndRender(){},fitToScreen(){},renderTabBar(){},scheduleSave(){}};
 return {app,import:(root,options={})=>importHierarchy.call(app,root,options)};
}
const source=(user)=>({id:'native-root-'+user,text:'Root '+user,
 children:[{id:'medical-node-'+user,text:'Brain',notes:'Original note',
  sourceRefs:[{id:'src_abcdefghij',kind:'pdf',fileName:'paper.pdf',title:'Paper',
   sha256:'a'.repeat(64),page:42,quote:'Supporting evidence'}],children:[]}]});
test('1000 native map imports retain logical node IDs, references, notes and child order',()=>{
 for(let i=0;i<1000;i++){
  const {app,import:load}=mock();const doc=source(i);
  assert.equal(load(doc,{preserveIds:true}),2);
  assert.equal(app.state.root.id,doc.id);
  assert.equal(app.state.root.children[0].id,'medical-node-'+i);
  assert.equal(app.state.root.children[0].notes,'Original note');
  assert.equal(app.state.root.children[0].sourceRefs[0].page,42);
  assert.equal(app.state.root.children[0].sourceRefs[0].sha256,'a'.repeat(64));
 }
});
test('external imports still receive fresh IDs to avoid document ID collision',()=>{
 const {app,import:load}=mock();
 const doc=source(5);
 load(doc,{preserveIds:false});
 assert.notEqual(app.state.root.id,doc.id);
 assert.notEqual(app.state.root.children[0].id,doc.children[0].id);
});
test('duplicate or malformed native IDs are replaced safely without deleting nodes',()=>{
 const {app,import:load}=mock();
 const doc={id:'a-valid-root',text:'Root',children:[
  {id:'repeat-1',text:'One',children:[]},
  {id:'repeat-1',text:'Two',children:[]},
  {id:'../../bad',text:'Three',children:[]}]};
 assert.equal(load(doc,{preserveIds:true}),4);
 const ids=app.state.root.children.map(n=>n.id);
 assert.equal(new Set(ids).size,3);
 assert.equal(ids[0],'repeat-1');
 assert.ok(ids.every(x=>/^[a-zA-Z0-9_-]+$/.test(x)));
});
