'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
// Deterministic source-level regression. No real person, device or GUI is simulated.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../map-core');
const ROOT=path.resolve(__dirname,'../../..');
const src=platform=>composeStateSource(platform);
function stateClass(platform){
 const palette=['#d75a77','#04afc6','#3b82f6'];
 return new Function('NeuroMapCore','nm70PreferredGap','localStorage','HARMONIC_PALETTE',
  'ColorUtils','THEME_PALETTES','globalThis',composeStateSource(platform==='android'?'android':'desktop-shared')+'\nreturn MindMapStateMachine;')(
  Core,()=>150,{getItem:()=>null},palette,
  {lighten:(hex,depth)=>hex+'-'+depth},{test:palette},{});
}
function node(id,parentId=null,collapsed=false){
 return {id,text:id,side:parentId?'right':'root',parentId,collapsed,children:[]};
}
for(const platform of ['desktop-shared','android']){
 test(platform+': deleting a different branch does not erase references in hidden subtrees',()=>{
  const State=stateClass(platform),s=new State(),root=node('root');
  const closed=node('closed',root.id,true),hidden=node('hidden',closed.id);
  const doomed=node('doomed',root.id),deleted=node('deleted',doomed.id);
  const summary=node('summary',root.id);summary.isSummary=true;
  summary.summaryTargetIds=[hidden.id,deleted.id];
  closed.children=[hidden];doomed.children=[deleted];root.children=[closed,doomed,summary];
  s.root=root;s.selectedNodeId=root.id;s.selectedNodeIds=[root.id];
  s.images=[
   {id:'keep-image',src:'data:image/png;base64,AAAA',mode:'attached',attachedNodeId:hidden.id},
   {id:'remove-image',src:'data:image/png;base64,AAAA',mode:'attached',attachedNodeId:deleted.id}
  ];
  s.relationships=[
   {id:'keep-link',fromId:root.id,toId:hidden.id,label:'Keep'},
   {id:'remove-link',fromId:root.id,toId:deleted.id,label:'Remove'}
  ];
  const before=s.createSnapshot();
  assert.equal(s.deleteNode(doomed.id),true);
  assert.equal(s.findNode(hidden.id)?.id,hidden.id);
  assert.deepEqual(s.images.map(i=>i.id),['keep-image']);
  assert.deepEqual(s.relationships.map(r=>r.id),['keep-link']);
  assert.deepEqual(summary.summaryTargetIds,[hidden.id]);
  assert.equal(s.undo(),true);
  assert.equal(s.findNode(deleted.id)?.id,deleted.id);
  assert.equal(s.images.length,2);
  assert.equal(s.relationships.length,2);
  assert.deepEqual(s.createSnapshot(),before);
  assert.equal(s.redo(),true);
  assert.equal(s.findNode(deleted.id),null);
  assert.deepEqual(s.images.map(i=>i.id),['keep-image']);
 });
 test(platform+': deep maps clone, colour and theme without recursive stack overflow',()=>{
  const State=stateClass(platform),root=node('root'),s=new State();
  let cursor=root;
  for(let n=0;n<12000;n++){
   const next=node('n'+n,cursor.id);
   cursor.children=[next];cursor=next;
  }
  const copy=State.cloneTree(root);
  assert.equal(copy.children[0].id,'n0');
  s.root=root;
  assert.equal(s.findNode(cursor.id),cursor);
  s.pushHistory=()=>{}; // Isolate traversal, not history memory usage.
  assert.equal(s.updateNodeColorWithPropagation('n0','#123456'),true);
  assert.equal(cursor.color,'#123456-48');
  assert.equal(s.applyGlobalTheme('test'),true);
  assert.equal(cursor.color,'#d75a77-48');
  assert.equal(s.getAllNodesIncludingCollapsed().length,12001);
 });
}
test('Android copy fails closed for cyclic or shared references',()=>{
 const State=stateClass('android'),shared=node('shared');
 assert.throws(()=>State.cloneTree({id:'root',text:'Root',children:[shared,shared]}),/ciclica|condivisa/);
 const cycle=node('cycle');cycle.children=[cycle];
 assert.throws(()=>State.cloneTree(cycle),/ciclica|condivisa/);
});
