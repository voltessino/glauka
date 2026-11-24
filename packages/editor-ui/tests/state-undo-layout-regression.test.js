'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../map-core');
// Instantiate the real shared desktop state machine in isolation: no UI or OS
// dependencies. This explicitly tests its actual clone/history implementation.
const source=composeStateSource('desktop-shared');
const colors=['#f43f5e','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899','#3b82f6','#84cc16','#f97316','#14b8a6'];
const State=new Function('NeuroMapCore','localStorage','nm70PreferredGap',
 'ColorUtils','HARMONIC_PALETTE','THEME_PALETTES',
 source+'\nreturn MindMapStateMachine;')(
 Core,{getItem:()=>null,setItem:()=>{}},()=>150,{lighten:hex=>hex},colors,{default:colors}
);
test('1000 real-state-machine profiles: adaptive limit, shape, attached image and Undo/Redo survive cloning',()=>{
 let checks=0;
 for(let user=0;user<1000;user++){
  const state=new State();
  state.initStarterTree('Persona '+user);
  const rootId=state.root.id,childIDs=state.root.children.map(n=>n.id);
  state.root.layoutDistribution.height=480;
  state.root.children[0].notes='Clinical note '+user;
  state.root.children[0].nodeShape='hex';
  state.images=[{id:'image-'+user,src:'data:image/png;base64,',mode:'attached',
   attachedNodeId:childIDs[0],width:220,height:180}];
  const original=state.createSnapshot();
  state.pushHistory();
  state.root.layoutDistribution.height=480+20*(user%60);
  state.root.children[0].nodeShape='glass';
  state.root.children[0].notes='Changed note';
  assert.equal(state.undo(),true);checks++;
  const previous=state.createSnapshot();
  assert.equal(previous.root.layoutDistribution.height,480);checks++;
  assert.equal(previous.root.children[0].nodeShape,'hex');checks++;
  assert.equal(previous.root.children[0].notes,original.root.children[0].notes);checks++;
  assert.equal(previous.images[0].id,'image-'+user);checks++;
  assert.equal(previous.root.id,rootId);checks++;
  assert.deepEqual(previous.root.children.map(n=>n.id),childIDs);checks++;
  assert.equal(state.redo(),true);checks++;
  assert.equal(state.root.layoutDistribution.height,480+20*(user%60));checks++;
  assert.equal(state.root.children[0].nodeShape,'glass');checks++;
  const cloned=State.cloneTree(state.root);
  assert.equal(cloned.layoutDistribution.overflowMode,'expand');checks++;
  assert.equal(cloned.children[0].nodeShape,'glass');checks++;
 }
 assert.equal(checks,12000);
});
test('old map without adaptive layout retains its original mode and no new opt-in',()=>{
 const old={id:'old-root',text:'Legacy',side:'root',layoutMode:'balanced',
  children:[{id:'old-child',text:'Original',side:'left',children:[]}]};
 const restored=State.cloneTree(old);
 assert.equal(restored.layoutMode,'balanced');
 assert.equal(restored.layoutDistribution,undefined);
 assert.equal(restored.children[0].side,'left');
});


test('geometric layout marker survives serialization, undo and redo without mutating old maps',()=>{
 const state=new State();
 state.initStarterTree('Geometry test');
 state.root.layoutMode='balanced';
 state.root.layoutDistribution={enabled:false,height:960,minimumHeight:480};
 state.root.layoutBalanceMode='geometry';
 const saved=JSON.parse(JSON.stringify(state.createSnapshot()));
 assert.equal(saved.root.layoutBalanceMode,'geometry');
 assert.equal(saved.root.layoutMode,'balanced');
 state.pushHistory();
 state.root.layoutMode='clockwise';
 state.root.layoutDistribution.enabled=true;
 assert.equal(state.undo(),true);
 assert.equal(state.root.layoutBalanceMode,'geometry');
 assert.equal(state.root.layoutMode,'balanced');
 assert.equal(state.redo(),true);
 assert.equal(state.root.layoutMode,'clockwise');
 const legacy=State.cloneTree({id:'old',text:'Old',side:'root',layoutMode:'balanced',children:[]});
 assert.equal(legacy.layoutBalanceMode,undefined);
});
test('only generated defaults use the injected UI language; authored text and Undo keep their values',()=>{
 let language='A';const state=new State(text=>language+':'+text);state.initStarterTree();
 assert.equal(state.root.text,'A:Mappa Centrale');assert.ok(state.root.children.every(n=>n.text.startsWith('A:')));
 state.initStarterTree('Save');assert.equal(state.root.text,'Save');
 const first=state.addChildNode(state.root.id,null);assert.equal(first.text,'A:Nuovo Nodo');
 const authored=state.addChildNode(first.id,null,'Nuovo Nodo');assert.equal(authored.text,'Nuovo Nodo');
 language='B';const sibling=state.addSiblingNode(authored.id,null);assert.equal(sibling.text,'B:Nodo Fratello');
 assert.equal(first.text,'A:Nuovo Nodo');assert.equal(authored.text,'Nuovo Nodo');
 state.undo();assert.equal(state.findNode(sibling.id),null);assert.equal(state.findNode(authored.id).text,'Nuovo Nodo');
 assert.equal(Object.keys(state).includes('_labelText'),false);assert.equal(JSON.stringify(state.createSnapshot()).includes('_labelText'),false);
});
