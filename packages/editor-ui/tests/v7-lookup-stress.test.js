'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=composeStateSource('desktop-shared');
const State=new Function('NeuroMapCore','localStorage','nm70PreferredGap','ColorUtils',
 'HARMONIC_PALETTE','THEME_PALETTES',source+'\nreturn MindMapStateMachine;')(
 {continuationSettings:v=>v},{getItem:()=>null},()=>150,{},[],{});
const languages=['Gehirn','脑图','علم الأعصاب','हिन्दी','神経','מפה','Νευρικό','🧠'];
function chain(levels){
 const root={id:'root',text:'Root',children:[]};let current=root;
 for(let i=0;i<levels;i++){const child={id:'id-'+i,
  text:languages[i%languages.length],children:[]};current.children=[child];current=child;}
 return root;
}
test('25,000 levels: node selection reaches deepest ID without a call-stack overflow',()=>{
 const s=new State();s.root=chain(25000);
 const deepest=s.findNode('id-24999');
 assert.equal(deepest.id,'id-24999');
 assert.equal(deepest.text,languages[24999%languages.length]);
 assert.equal(s.findNode('missing'),null);
 assert.equal(s.findNode(''),null);
});
test('50,000 siblings: 300 seeded selections preserve exact IDs and never alter stored text',()=>{
 const s=new State();
 s.root={id:'root',text:'Mixed languages',children:Array.from({length:50000},(_,i)=>({
  id:'wide-'+i,text:languages[i%languages.length],sourceRefs:[{id:'ref'+i,page:i+1}],children:[]}))};
 let seed=1776;
 const next=()=>((seed=Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
 for(let i=0;i<300;i++){
  const index=Math.floor(next()*50000);
  const node=s.findNode('wide-'+index);
  assert.equal(node.id,'wide-'+index);
  assert.equal(node.text,languages[index%languages.length]);
  assert.equal(node.sourceRefs[0].page,index+1);
 }
 assert.equal(s.root.children.length,50000);
});
test('repeated IDs return first node in legacy preorder, including a subtree query',()=>{
 const a={id:'duplicate',text:'First',children:[]};
 const b={id:'branch',text:'Intermediate',
  children:[{id:'duplicate',text:'Second',children:[]}]};
 const s=new State();s.root={id:'root',text:'Root',children:[a,b]};
 assert.equal(s.findNode('duplicate'),a);
 assert.equal(s.findNode('duplicate',b),b.children[0]);
});
test('collapsed descendants remain discoverable for editing and search',()=>{
 const s=new State();s.root=chain(3000);
 s.root.children[0].collapsed=true;
 assert.equal(s.findNode('id-2999').id,'id-2999');
 assert.equal(s.getAllNodes().length,2,'visible traversal is intentionally different');
});
test('damaged cycles/shared object aliases do not hang node search',()=>{
 const root={id:'root',children:[]},child={id:'child',children:[]};
 root.children=[child];child.children=[root,child];
 const s=new State();s.root=root;
 assert.equal(s.findNode('child'),child);
 assert.equal(s.findNode('missing'),null);
});
test('no native project structure or history data changes during repeated lookups',()=>{
 const s=new State();s.root=chain(1200);
 s.images=[{id:'picture',src:'local://image',zLayer:'front'}];
 s.relationships=[{id:'edge',fromId:'id-0',toId:'id-1'}];
 const before=JSON.stringify(s.root),history=s.undoStack.length;
 for(let i=0;i<900;i++)s.findNode('id-'+i);
 assert.equal(JSON.stringify(s.root),before);
 assert.equal(s.undoStack.length,history);
 assert.equal(s.images.length,1);assert.equal(s.relationships.length,1);
});
