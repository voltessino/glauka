'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=composeStateSource('desktop-shared');
function stateWithNodes(count){
 const context={
   localStorage:{getItem(){return null;}},nm70PreferredGap(){return 150;},
   HARMONIC_PALETTE:[{color:'#123456'}],
   NeuroMapCore:{continuationSettings:v=>v}
 };
 const MindMapStateMachine=vm.runInNewContext(code+'\nMindMapStateMachine',{...context});
 const state=new MindMapStateMachine();
 state.root={id:'root',text:'Root',side:'root',children:
   Array.from({length:count},(_,i)=>({id:'n'+i,text:'Node '+i,side:'right',children:[]}))};
 return state;
}
test('large-map undo/redo preserves data and redo state after snapshot',()=>{
 const state=stateWithNodes(2000);
 const original=state.root.children[0].text;
 state.pushHistory();
 state.root.children[0].text='changed';
 assert.equal(state.undo(),true);
 assert.equal(state.root.children[0].text,original);
 assert.equal(state.redo(),true);
 assert.equal(state.root.children[0].text,'changed');
 assert.equal(state.undoStack.length,1);
});
test('history stays capped at 60 snapshots and does not retain removed entries',()=>{
 const state=stateWithNodes(400);
 for(let i=0;i<70;i++){state.pushHistory();state.root.children[0].text='edit '+i;}
 assert.equal(state.undoStack.length,60);
 assert.equal(state.redoStack.length,0);
 state.undo();state.root.children[0].text='after undo';state.pushHistory();
 assert.equal(state.redoStack.length,0);
});
test('baseline documents full-tree cloning cost without claiming optimization',()=>{
 const state=stateWithNodes(4000);
 state.pushHistory();
 assert.notStrictEqual(state.undoStack[0].root,state.root);
 assert.equal(state.undoStack[0].root.children.length,4000);
 assert.notStrictEqual(state.undoStack[0].root.children[0],state.root.children[0]);
});
