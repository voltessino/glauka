'use strict';
const composeStateSource=require('../../editor-ui/tests/helpers/compose-state-source.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Core=require('..');
const states=['android','desktop-shared'].map(platform=>{
 const source=composeStateSource(platform);
 return new Function('NeuroMapCore',source+';return MindMapStateMachine;')(Core);
});
test('batch lookups preserve request order, repetitions, missing and falsy IDs',()=>{
 const first={id:'same',children:[]},later={id:'same',children:[]},hidden={id:'hidden',children:[]};
 const root={id:'root',children:[{id:'parent',collapsed:true,children:[first,hidden]},later]};
 const ids=['hidden','same','root','missing',null,0,'','same'];
 for(const State of states){const state=Object.create(State.prototype);state.root=root;
  assert.deepEqual(Core.findNodesById(root,ids),ids.map(id=>state.findNode(id)));
 }
 assert.equal(Core.findNodesById(root,['same'])[0],first);
});
test('cycles and shared objects keep preorder first-match behavior without looping',()=>{
 const shared={id:'shared',children:[]},root={id:'root',children:[shared,shared,null]};shared.children=[root];
 for(const State of states){const state=Object.create(State.prototype);state.root=root;
  assert.deepEqual(Core.findNodesById(root,['shared','missing','root']),['shared','missing','root'].map(id=>state.findNode(id)));
 }
});
test('empty/falsy requests do not traverse a tree, and null roots return missing entries',()=>{
 const root={get children(){throw Error('must not traverse')}};
 assert.deepEqual(Core.findNodesById(root,[]),[]);
 assert.deepEqual(Core.findNodesById(root,[null,'',0]),[null,null,null]);
 assert.deepEqual(Core.findNodesById(null,['x','x']),[null,null]);
});
test('fresh operations reflect deletion, insertion, ID edits, reordering and root replacement',()=>{
 const a={id:'a',children:[]},b={id:'b',children:[]},root={id:'root',children:[a,b]};
 assert.deepEqual(Core.findNodesById(root,['a','b']),[a,b]);
 root.children.splice(0,1);b.id='renamed';
 assert.deepEqual(Core.findNodesById(root,['a','b','renamed']),[null,null,b]);
 const replacement={id:'a',children:[]};root.children.unshift(replacement);
 assert.equal(Core.findNodesById(root,['a'])[0],replacement);
 assert.equal(Core.findNodesById({id:'new',children:[a]},['a'])[0],a);
});
test('10,000-deep model lookup remains iterative and does not add retained cache fields',()=>{
 const root={id:'0',children:[]};let last=root;
 for(let i=1;i<10000;i++){const next={id:String(i),children:[]};last.children=[next];last=next}
 assert.deepEqual(Core.findNodesById(root,['9999','missing','0']),[last,null,root]);
 assert.deepEqual(Object.keys(root),['id','children']);assert.deepEqual(Object.keys(last),['id','children']);
});
test('a deterministic broad tree matches both real state implementations for mixed requests',()=>{
 const root={id:'root',children:Array.from({length:40},(_,i)=>({id:'p'+i,collapsed:i%3===0,children:Array.from({length:5},(_,j)=>({id:'c'+i+'/'+j,children:[]}))}))};
 const before=JSON.stringify(root),ids=Array.from({length:200},(_,i)=>i%7?'c'+(i*13%40)+'/'+(i%5):'missing'+i);
 for(const State of states){const state=Object.create(State.prototype);state.root=root;
  assert.deepEqual(Core.findNodesById(root,ids),ids.map(id=>state.findNode(id)));
 }
 assert.equal(JSON.stringify(root),before);
});
