'use strict';
const composeStateSource=require('../../../packages/editor-ui/tests/helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('path');
const Work=require('../../../packages/editor-ui/work-core.js');
const Flow=require('../../../packages/editor-ui/flow-core.js');
const Network=require('../../../packages/editor-ui/concept-network.js');
const source=composeStateSource('android');
const State=new Function(
  'NeuroMapCore','NeuroMapSourceCore','NeuroMapWorkCore','NeuroMapFlowCore','NeuroMapConceptNetwork',
  source+'\nreturn MindMapStateMachine;'
)({continuationSettings:v=>v},undefined,Work,Flow,Network);

function seeded(){
  const state=new State();
  state.root={
    id:'root',text:'Map',side:'root',children:[
      {id:'a',text:'Research',side:'right',parentId:'root',taskStatus:'todo',children:[]},
      {id:'b',text:'Build',side:'right',parentId:'root',taskStatus:'todo',children:[]},
      {id:'c',text:'Ship',side:'right',parentId:'root',taskStatus:'doing',children:[]},
    ],
  };
  state.images=[];state.relationships=[];state.undoStack=[];state.redoStack=[];
  return state;
}

test('Android Kanban move changes only task metadata with one Undo',()=>{
  const state=seeded();
  assert.equal(state.moveKanbanTask('a','doing'),true);
  assert.equal(state.findNode('a').taskStatus,'doing');
  assert.equal(state.undoStack.length,1);
  assert.deepEqual(state.root.children.map(n=>n.id),['a','b','c']);
  assert.equal(state.undo(),true);
  assert.equal(state.findNode('a').taskStatus,'todo');
});

test('Android work metadata rejects inverted dates and keeps history clean',()=>{
  const state=seeded();
  assert.equal(state.setNodeWorkMetadata('b',{startDate:'2026-11-10',dueDate:'2026-11-01'}),false);
  assert.equal(state.undoStack.length,0);
  assert.equal(state.setNodeWorkMetadata('b',{startDate:'2026-11-01',dueDate:'2026-11-10',taskStatus:'done'}),true);
  assert.equal(state.findNode('b').taskStatus,'done');
  assert.equal(state.undoStack.length,1);
});

test('Android flow shape and network position are undoable linked-view edits',()=>{
  const state=seeded();
  assert.equal(state.setNodeFlowShape('a','decision'),true);
  assert.equal(state.findNode('a').flowShape,'decision');
  const edge=state.addFlowTransition('a','b','yes');
  assert.equal(edge.kind,'yes');
  assert.equal(state.setNodeNetworkPosition('c',{x:400,y:300}),true);
  assert.deepEqual(state.findNode('c').networkPosition,{x:400,y:300});
  assert.ok(state.undoStack.length>=3);
  const cloned=State.cloneRelationships(state.relationships);
  assert.equal(cloned.find(r=>r.fromId==='a'&&r.toId==='b').kind,'yes');
});
