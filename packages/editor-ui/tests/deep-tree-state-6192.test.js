'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=composeStateSource('desktop-shared');
const State=new Function('NeuroMapCore','localStorage','nm70PreferredGap','ColorUtils',
  'HARMONIC_PALETTE','THEME_PALETTES',src+'\nreturn MindMapStateMachine;')(
  {continuationSettings:x=>x},{getItem:()=>null},()=>150,{},[],{});
const deep=level=>{const root={id:'r',text:'Root',side:'root',children:[]};let cur=root;
  for(let i=0;i<level;i++){const c={id:'n'+i,text:'N'+i,side:'right',children:[]};cur.children.push(c);cur=c;}return root;};
test('20,000 nested nodes clone without recursive call stack overflow',()=>{
 const original=deep(20000),copy=State.cloneTree(original);
 assert.notStrictEqual(copy,original);let node=copy,n=0;
 while(node.children.length){node=node.children[0];n++;}
 assert.equal(n,20000);assert.equal(node.id,'n19999');
});
test('20,000 nested nodes visible traversal keeps DFS order and respects collapse',()=>{
 const s=new State();s.root=deep(20000);
 assert.equal(s.getAllNodes().length,20001);
 s.root.children[0].children[0].collapsed=true;
 assert.deepEqual(s.getAllNodes().map(n=>n.id),['r','n0','n1']);
 assert.equal(s.getAllNodesIncludingCollapsed().length,20001);
});
test('deep history snapshot retains independent tree and reversible edits',()=>{
 const s=new State();s.root=deep(8000);s.pushHistory();
 s.root.children[0].text='changed';assert.equal(s.undo(),true);
 assert.equal(s.root.children[0].text,'N0');assert.equal(s.redo(),true);
 assert.equal(s.root.children[0].text,'changed');
});
test('branches preserve ordering and metadata through iterative cloning',()=>{
 const a={id:'r',text:'A',children:[
  {id:'a',text:'A1',nodeShape:'hex',sourceRefs:[],children:[{id:'c',text:'C',children:[]}]},
  {id:'b',text:'B1',collapsed:true,children:[]}]};
 const c=State.cloneTree(a);
 assert.deepEqual(c.children.map(n=>n.id),['a','b']);
 assert.equal(c.children[0].children[0].id,'c');
 assert.equal(c.children[0].nodeShape,'hex');
 assert.equal(c.children[1].collapsed,true);
});
test('cycles and shared node references cause controlled copy failure',()=>{
 const a={id:'r',text:'R',children:[]};a.children=[a];
 assert.throws(()=>State.cloneTree(a),/ciclica o condivisa/);
 const leaf={id:'x',text:'X',children:[]};
 assert.throws(()=>State.cloneTree({id:'r',text:'R',children:[leaf,leaf]}),/ciclica o condivisa/);
});
