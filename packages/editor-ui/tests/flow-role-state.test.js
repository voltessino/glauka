'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const flows=require('../flow-core');
const source=composeStateSource('desktop-shared');
const State=new Function('NeuroMapFlowCore','nm70PreferredGap','nm64PreferredWrap',
 source+'\nreturn MindMapStateMachine;')(flows,()=>150,()=>48);
function fixture(){
 const state=new State();
 state.root={id:'r',text:'Workflow',children:[
  {id:'a',text:'Start',parentId:'r',children:[]},
  {id:'b',text:'Review',parentId:'r',children:[]},
  {id:'c',text:'Finish',parentId:'r',children:[]}
 ]};
 state.relationships=[
  {id:'ab',fromId:'a',toId:'b',kind:'sequence',label:'Segue'},
  {id:'bc',fromId:'b',toId:'c',kind:'yes',label:'Sì'}
 ];
 return state;
}
test('explicit flow shape is one undoable presentation change and retains links',()=>{
 const s=fixture(),edgeSummary=rels=>rels.map(({id,fromId,toId,kind,label})=>({id,fromId,toId,kind,label})),
   before=JSON.stringify(edgeSummary(s.relationships)),ids=s.root.children.map(n=>n.id);
 assert.equal(s.setNodeFlowShape('b','process'),true);
 assert.equal(s.undoStack.length,1);
 assert.equal(s.findNode('b').flowShape,'process');
 assert.equal(flows.project(s.root,s.relationships).nodes.find(n=>n.id==='b').shape,'process');
 assert.equal(s.undo(),true);
 assert.equal(s.findNode('b').flowShape,undefined);
 assert.equal(s.redo(),true);
 assert.equal(s.findNode('b').flowShape,'process');
 assert.equal(JSON.stringify(edgeSummary(s.relationships)),before);
 assert.deepEqual(s.root.children.map(n=>n.id),ids);
});
test('saved flow shape survives cloning and JSON reload',()=>{
 const s=fixture();
 assert.equal(s.setNodeFlowShape('a','start'),true);
 assert.equal(s.setNodeFlowShape('c','end'),true);
 const cloned=State.cloneTree(s.root),reloaded=JSON.parse(JSON.stringify(cloned));
 assert.equal(reloaded.children[0].flowShape,'start');
 assert.equal(reloaded.children[2].flowShape,'end');
 assert.equal(flows.project(reloaded,s.relationships).nodes.find(n=>n.id==='c').shape,'end');
 assert.equal(s.setNodeFlowShape('a','auto'),true);
 assert.equal(s.findNode('a').flowShape,undefined);
});
test('invalid flow shape, root, absent IDs and redundant edits produce no history',()=>{
 const s=fixture(),original=JSON.stringify(s.root);
 for(const args of [
  ['r','start'],['gone','start'],['a','bad'],['a','__proto__'],['a','auto']
 ])assert.equal(s.setNodeFlowShape(...args),false);
 assert.equal(s.undoStack.length,0);
 assert.equal(JSON.stringify(s.root),original);
});
test('untrusted imported flow-shape properties do not bypass clone validation',()=>{
 const s=fixture();
 s.findNode('a').flowShape='__proto__';
 s.findNode('b').flowShape='decision';
 const clone=State.cloneTree(s.root);
 assert.equal(clone.children[0].flowShape,undefined);
 assert.equal(clone.children[1].flowShape,'decision');
 assert.equal(flows.project(clone,s.relationships).nodes.find(n=>n.id==='b').decision,true);
});
