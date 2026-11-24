'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=composeStateSource('desktop-shared');
const palette=['#f43f5e','#8b5cf6','#06b6d4','#10b981','#f59e0b'];
const State=new Function('NeuroMapCore','localStorage','nm70PreferredGap','ColorUtils',
 'HARMONIC_PALETTE','THEME_PALETTES',source+'\nreturn MindMapStateMachine;')(
 {continuationSettings:config=>config},{getItem:()=>null},()=>150,
 {lighten:x=>x},palette,{default:palette});
function stateWithNodes(count=1,notes=''){
 const s=new State();
 s.root={id:'root',text:'Project',side:'root',children:
  Array.from({length:count},(_,i)=>({id:'node-'+i,side:'right',
   text:'Topic '+i,notes,children:[]}))};
 return s;
}
function deepTree(n){
 const root={id:'root',text:'Project',side:'root',children:[]};
 let at=root;
 for(let i=0;i<n;i++){const next={id:'n'+i,text:'Deep '+i,children:[],side:'right'};at.children=[next];at=next;}
 return root;
}
test('default keeps 60 small-map undo snapshots and unchanged redo behavior',()=>{
 const s=stateWithNodes(3);
 for(let i=0;i<70;i++){s.pushHistory();s.root.children[0].text='edit-'+i;}
 assert.equal(s.maxHistory,60);
 assert.equal(s.undoStack.length,60);
 assert.equal(s.getHistoryMemoryStats().budgetBytes,64*1024*1024);
 assert.equal(s.undo(),true);
 assert.equal(s.root.children[0].text,'edit-68');
 assert.equal(s.redo(),true);
 assert.equal(s.root.children[0].text,'edit-69');
});
test('large projects evict oldest snapshots under one combined history budget',()=>{
 const s=stateWithNodes(1,'🧠'.repeat(230000));
 s.maxHistoryBytes=2*1024*1024;
 for(let i=0;i<22;i++){s.pushHistory();s.root.text='revision-'+i;}
 const stats=s.getHistoryMemoryStats();
 assert.ok(stats.undoSteps<22, 'old large snapshots should be discarded');
 assert.ok(stats.undoSteps>=1, 'keep at least one reversible edit');
 assert.ok(stats.estimatedTotalBytes<=s.maxHistoryBytes);
 const expected=s.root.text;
 assert.equal(s.undo(),true);
 assert.notEqual(s.root.text,expected);
 assert.equal(s.redo(),true);
 assert.equal(s.root.text,expected);
});
test('both undo and redo count toward the same budget, never independently each at 60MB',()=>{
 const s=stateWithNodes(1,'Z'.repeat(350000));
 s.maxHistoryBytes=2800000;
 for(let i=0;i<5;i++){s.pushHistory();s.root.text='version '+i;}
 assert.ok(s.undoStack.length<5);
 assert.equal(s.undo(),true);
 const stats=s.getHistoryMemoryStats();
 assert.ok(stats.estimatedTotalBytes<=s.maxHistoryBytes ||
  (stats.undoSteps<=1 && stats.redoSteps<=1),'only last reversible steps may exceed the soft budget');
 assert.ok(stats.redoSteps>0);
});
test('redo is invalidated by the next edit, even after memory-based eviction',()=>{
 const s=stateWithNodes(1,'P'.repeat(270000));
 s.maxHistoryBytes=1500000;
 for(let i=0;i<5;i++){s.pushHistory();s.root.text='v'+i;}
 assert.equal(s.undo(),true);
 assert.ok(s.redoStack.length>0);
 s.pushHistory();
 s.root.text='diverged';
 assert.equal(s.redoStack.length,0);
 assert.equal(s.redo(),false);
 assert.equal(s.undo(),true);
 assert.notEqual(s.root.text,'diverged');
});
test('20k nested nodes can be budgeted iteratively and survive undo/redo',()=>{
 const s=stateWithNodes(0);
 s.root=deepTree(20000);
 s.maxHistoryBytes=500000;
 s.pushHistory();
 s.root.text='Changed';
 assert.equal(s.undo(),true);
 assert.equal(s.root.text,'Project');
 assert.equal(s.redo(),true);
 assert.equal(s.root.text,'Changed');
 assert.equal(s.undoStack.length,1);
 assert.ok(s.getHistoryMemoryStats().estimatedUndoBytes>500000,
  'one oversized snapshot is preserved as emergency recovery');
});
test('image attachments, typed edges and appearance metadata survive eviction',()=>{
 const s=stateWithNodes(2,'e'.repeat(60000));
 s.maxHistoryBytes=850000;
 s.images=[{id:'image-1',src:'data:image/png;base64,abcd',mode:'attached',
  attachedNodeId:'node-0',width:170,height:140,offset:{dx:10,dy:-40}}];
 s.relationships=[{id:'edge',fromId:'node-0',toId:'node-1',
  kind:'sequence',label:'依存 · علاقة'}];
 s.branchStyle='xmind8';s.strokeScale=1.2;
 for(let i=0;i<14;i++){
  s.pushHistory();
  s.root.text='Change '+i;
  s.images[0].width=170+i;
  s.relationships[0].label='revision '+i;
  s.branchStyle=i%2?'neon':'xmind8';
 }
 assert.ok(s.undoStack.length<14);
 const current={root:s.root.text,width:s.images[0].width,
  edge:s.relationships[0].label,style:s.branchStyle};
 assert.equal(s.undo(),true);
 assert.equal(s.images[0].id,'image-1');
 assert.equal(s.images[0].attachedNodeId,'node-0');
 assert.equal(s.relationships[0].kind,'sequence');
 assert.equal(s.redo(),true);
 assert.equal(s.root.text,current.root);
 assert.equal(s.images[0].width,current.width);
 assert.equal(s.relationships[0].label,current.edge);
 assert.equal(s.branchStyle,current.style);
});
test('invalid user-configured budget falls back safely, and stats do not change state',()=>{
 const s=stateWithNodes(10);
 s.maxHistoryBytes=NaN;
 const initial=JSON.stringify(s.root);
 s.pushHistory();
 const stat=s.getHistoryMemoryStats();
 assert.equal(stat.undoSteps,1);
 assert.equal(stat.budgetBytes,64*1024*1024);
 assert.ok(stat.estimatedUndoBytes>0);
 assert.equal(JSON.stringify(s.root),initial);
});
test('up to 1000 representative small edits remain reversible with normal limits',()=>{
 for(let user=0;user<1000;user++){
  const s=stateWithNodes(2);
  s.root.children[0].text='初期 '+user;
  s.pushHistory();
  s.root.children[0].text='مرحلة '+user;
  assert.equal(s.undo(),true);
  assert.equal(s.root.children[0].text,'初期 '+user);
  assert.equal(s.redo(),true);
  assert.equal(s.root.children[0].text,'مرحلة '+user);
 }
});
