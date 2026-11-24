'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
// Test the real desktop state methods, not a reimplemented mock.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const work=require('../work-core');
const source=composeStateSource('desktop-shared');
const State=new Function('NeuroMapWorkCore','nm70PreferredGap','nm64PreferredWrap',
 source+'\nreturn MindMapStateMachine;')(work,()=>150,()=>48);
const fixture=()=>{
 const s=new State();
 s.root={id:'root',text:'Project',side:'root',children:[
  {id:'a',text:'Design',parentId:'root',taskStatus:'todo',startDate:'2026-11-02',children:[]},
  {id:'b',text:'Build',parentId:'root',taskStatus:'todo',dueDate:'2026-11-08',children:[]},
  {id:'c',text:'Review',parentId:'root',taskStatus:'doing',children:[]},
  {id:'d',text:'Deploy',parentId:'root',taskStatus:'doing',taskDependsOn:['a'],children:[]}
 ]};
 return s;
};
const order=s=>work.project(s.root,'kanban').nodes.map(n=>n.id);
test('Kanban reorder is a single Undo/Redo step and never moves mind-map branches',()=>{
 const state=fixture(),treeBefore=state.root.children.map(n=>n.id),refs=JSON.stringify(state.root.children.map(n=>n.taskDependsOn));
 assert.deepEqual(order(state),['a','b','c','d']);
 assert.equal(state.moveKanbanTask('b','todo','a'),true);
 assert.deepEqual(order(state),['b','a','c','d']);
 assert.equal(state.undoStack.length,1);
 assert.deepEqual(state.root.children.map(n=>n.id),treeBefore);
 assert.equal(state.findNode('a').startDate,'2026-11-02');
 assert.equal(state.findNode('b').dueDate,'2026-11-08');
 assert.equal(JSON.stringify(state.root.children.map(n=>n.taskDependsOn)),refs);
 assert.equal(state.undo(),true);
 assert.deepEqual(order(state),['a','b','c','d']);
 assert.equal(state.redo(),true);
 assert.deepEqual(order(state),['b','a','c','d']);
});
test('cross-column move appends or inserts in one history step and roundtrips through project clone',()=>{
 const state=fixture(),before=JSON.stringify(state.root);
 assert.equal(state.moveKanbanTask('b','doing','d'),true);
 assert.deepEqual(order(state),['a','c','b','d']);
 assert.equal(state.undoStack.length,1);
 assert.equal(state.findNode('b').taskStatus,'doing');
 assert.equal(state.findNode('b').taskOrder,1);
 const serialized=JSON.parse(JSON.stringify(State.cloneTree(state.root)));
 const restored=fixture();restored.root=serialized;
 assert.deepEqual(order(restored),['a','c','b','d']);
 assert.equal(restored.findNode('b').dueDate,'2026-11-08');
 assert.equal(state.undo(),true);
 assert.equal(JSON.stringify(state.root.children.map(n=>[n.id,n.taskStatus])),
   JSON.stringify(JSON.parse(before).children.map(n=>[n.id,n.taskStatus])));
 assert.deepEqual(order(state),['a','b','c','d']);
 assert.equal(state.redo(),true);
 assert.deepEqual(order(state),['a','c','b','d']);
});
test('no-op and invalid destination never allocate undo snapshots',()=>{
 const state=fixture();
 for(const args of [['a','todo','b'],['a','todo','a'],['a','doing','b'],
  ['ghost','todo',null],['a','wrong',null],['root','todo',null]])
  assert.equal(state.moveKanbanTask(...args),false);
 assert.equal(state.undoStack.length,0);
 assert.deepEqual(order(state),['a','b','c','d']);
});
test('inspector status change appends with a fresh column rank while preserving history',()=>{
 const state=fixture();
 assert.equal(state.moveKanbanTask('a','todo',null),true); // move to bottom
 assert.deepEqual(order(state),['b','a','c','d']);
 assert.equal(state.findNode('a').taskOrder,1);
 assert.equal(state.setNodeWorkMetadata('a',{taskStatus:'doing'}),true);
 assert.equal(state.findNode('a').taskOrder,2);
 assert.deepEqual(order(state),['b','c','d','a']);
 assert.equal(state.undo(),true);
 assert.deepEqual(order(state),['b','a','c','d']);
 assert.equal(state.findNode('a').startDate,'2026-11-02');
});
test('saved task ranking is strictly bounded and rejects malicious values on clone',()=>{
 const state=fixture();
 state.findNode('a').taskOrder=12;
 state.findNode('b').taskOrder=-12;
 state.findNode('c').taskOrder='5';
 state.findNode('d').taskOrder=999999;
 const clone=State.cloneTree(state.root);
 assert.equal(clone.children[0].taskOrder,12);
 assert.equal(clone.children[1].taskOrder,undefined);
 assert.equal(clone.children[2].taskOrder,undefined);
 assert.equal(clone.children[3].taskOrder,undefined);
});

test('status plus due-date edit remains one undoable operation and inserts at target end',()=>{
 const state=fixture();
 const original=JSON.stringify(state.root);
 assert.equal(state.setNodeWorkMetadata('a',{taskStatus:'doing',dueDate:'2026-11-11'}),true);
 assert.equal(state.undoStack.length,1);
 assert.deepEqual(order(state),['b','c','d','a']);
 assert.equal(state.findNode('a').dueDate,'2026-11-11');
 assert.equal(state.findNode('a').taskOrder,2);
 assert.equal(state.undo(),true);
 assert.deepEqual(order(state),['a','b','c','d']);
 assert.deepEqual(state.root.children.map(n=>n.id),JSON.parse(original).children.map(n=>n.id));
 assert.equal(state.findNode('a').dueDate,undefined);
 assert.equal(state.redo(),true);
 assert.deepEqual(order(state),['b','c','d','a']);
});
