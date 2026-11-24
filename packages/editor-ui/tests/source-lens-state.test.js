'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../map-core');
const Source=require('../../../apps/desktop-shared/editor/source-lens-core.js');
const text=composeStateSource('desktop-shared');
const palette=['#f43f5e','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899','#3b82f6','#84cc16'];
const State=new Function('NeuroMapCore','NeuroMapSourceCore','localStorage',
 'nm70PreferredGap','ColorUtils','HARMONIC_PALETTE','THEME_PALETTES',
 text+'\nreturn MindMapStateMachine;')(
  Core,Source,{getItem:()=>null,setItem:()=>{}},()=>150,{lighten:x=>x},palette,{default:palette});
function ref(user){return {id:'src_'+String(user).padStart(9,'0'),kind:'pdf',
 fileName:'source.pdf',title:'Evidence '+user,page:3,quote:'Source '+user,sha256:'b'.repeat(64)}}
test('1000 real state-machine citation add/remove/Undo/Redo cycles retain IDs',()=>{
 let checks=0;
 for(let user=0;user<1000;user++){
  const state=new State();state.initStarterTree('Brain '+user);
  const node=state.root.children[0],id=node.id;
  const original=JSON.stringify(state.root);
  state.pushHistory();
  assert.equal(Source.attach(node,ref(user)),true);checks++;
  state.isDirty=true;
  const clone=State.cloneTree(state.root);
  assert.equal(clone.children[0].sourceRefs[0].page,3);checks++;
  assert.equal(clone.children[0].sourceRefs[0].id,ref(user).id);checks++;
  state.pushHistory();
  assert.equal(Source.detach(node,ref(user).id),true);checks++;
  assert.equal(state.undo(),true);checks++;
  assert.equal(state.root.children[0].sourceRefs[0].sha256,'b'.repeat(64));checks++;
  assert.equal(state.root.children[0].id,id);checks++;
  assert.equal(state.redo(),true);checks++;
  assert.equal(state.root.children[0].sourceRefs.length,0);checks++;
  assert.equal(original.includes(ref(user).id),false);checks++;
 }
 assert.equal(checks,10000);
});
test('a text edit keeps the citation through undo, redo and a saved copy',()=>{
 const state=new State();state.initStarterTree('Mappa');
 const node=state.root.children[0],original=node.text,citation=ref(7);
 state.pushHistory();
 assert.equal(Source.attach(node,citation),true);
 state.pushHistory();
 node.text='Nodo modificato';
 const saved=JSON.parse(JSON.stringify(State.cloneTree(state.root)));
 assert.equal(saved.children[0].text,'Nodo modificato');
 assert.equal(saved.children[0].sourceRefs[0].page,3);
 assert.equal(saved.children[0].sourceRefs[0].sha256,'b'.repeat(64));
 assert.equal(saved.children[0].sourceRefs[0].fileName,'source.pdf');
 assert.equal(Object.hasOwn(saved.children[0].sourceRefs[0],'filePath'),false);
 assert.equal(state.undo(),true);
 assert.equal(state.root.children[0].text,original);
 assert.equal(state.root.children[0].sourceRefs[0].page,3);
 assert.equal(state.redo(),true);
 assert.equal(state.root.children[0].text,'Nodo modificato');
 assert.equal(state.root.children[0].sourceRefs[0].fileName,'source.pdf');
 const reopened=State.cloneTree(JSON.parse(JSON.stringify(State.cloneTree(state.root))));
 assert.equal(reopened.children[0].sourceRefs[0].page,3);
 assert.equal(reopened.children[0].sourceRefs[0].sha256,'b'.repeat(64));
});
test('malicious imported references are filtered, not injected into source metadata',()=>{
 const root={id:'root',text:'Map',children:[{id:'child',text:'A',children:[],
  sourceRefs:[{id:'bad',kind:'web',url:'javascript:alert(1)',quote:'oops'},
   {id:'src_abcdefghij',kind:'pdf',fileName:'file.pdf',page:4,sha256:'a'.repeat(64),quote:'ok'}]}]};
 const clone=State.cloneTree(root);
 assert.equal(clone.children[0].sourceRefs.length,1);
 assert.equal(clone.children[0].sourceRefs[0].page,4);
});
