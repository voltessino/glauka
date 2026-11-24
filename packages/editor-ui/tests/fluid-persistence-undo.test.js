'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const core=require('../../map-core/index.js');
const repo=path.resolve(__dirname,'../../..');
function stateClass(platform){
 const src=composeStateSource(platform);
 return new Function('NeuroMapCore','nm70PreferredGap','localStorage',
  src+'\nreturn MindMapStateMachine;')(core,()=>150,{getItem(){return null;}});
}
for(const platform of ['desktop-shared','android']){
 test(platform+' persists Fluid pins, offsets and sibling ordering through snapshot Undo/Redo',()=>{
  const State=stateClass(platform),state=new State();
  state.root={id:'root',side:'root',text:'Central',layoutMode:'fluid',
   layoutDistribution:{enabled:false,height:960,minimumHeight:480},
   children:[{id:'a',text:'Alpha',side:'left',sidePinned:'left',
     manualOffset:{dx:-350,dy:132},parentId:'root',children:[{
      id:'a1',text:'Child',side:'left',parentId:'a',children:[]
     }]},{id:'b',text:'Beta',side:'right',parentId:'root',children:[]}]};
  state.selectedNodeId='a';state.selectedNodeIds=['a'];
  const before=state.createSnapshot();
  assert.equal(before.root.layoutMode,'fluid');
  assert.equal(before.root.children[0].sidePinned,'left');
  assert.deepEqual(before.root.children[0].manualOffset,{dx:-350,dy:132});
  state.pushHistory();
  state.root.children[0].manualOffset={dx:-170,dy:-214};
  state.root.children[0].sidePinned='right';
  state.root.children.reverse();
  state.normalizeChildrenOrder(state.root);
  const changed=state.createSnapshot();
  const restored=JSON.parse(JSON.stringify(changed));
  assert.equal(restored.root.children[1].id,'a');
  assert.equal(restored.root.children[1].manualOffset.dy,-214);
  assert.equal(state.undo(),true);
  assert.equal(state.root.children[0].id,'a');
  assert.equal(state.root.children[0].manualOffset.dy,132);
  assert.equal(state.root.children[0].sidePinned,'left');
  assert.equal(state.redo(),true);
  assert.equal(state.root.children[1].id,'a');
  assert.equal(state.root.children[1].manualOffset.dy,-214);
  assert.equal(state.root.children[1].sidePinned,'right');
 });
}
