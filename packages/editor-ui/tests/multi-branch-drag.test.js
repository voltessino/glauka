'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Core=require('../../map-core'),ROOT=path.resolve(__dirname,'../../..'),scope={};
vm.runInNewContext(require('./helpers/compose-drag-preview.cjs')(),{globalThis:scope});
const drag=scope.NeuroMapDrag;
function fixture(platform,count=3){
 const palette=['#f43f5e','#06b6d4'];
 const State=new Function('NeuroMapCore','nm70PreferredGap','localStorage','HARMONIC_PALETTE','ColorUtils','THEME_PALETTES','globalThis',composeStateSource(platform)+';return MindMapStateMachine;')(Core,()=>150,{getItem:()=>null},palette,{lighten:x=>x},{},{});
 const state=new State();
 const node=(id,parentId,children=[])=>({id,text:id,parentId,side:'right',children,notes:'Notes '+id});
 const children=Array.from({length:count},(_,i)=>node('s'+i,'p',[node('c'+i,'s'+i)]));children[0].collapsed=true;
 state.root=node('root',null,[node('p','root',children),node('q','root',[node('target','q')])]);state.root.side='root';
 state.images=[{id:'img',mode:'attached',attachedNodeId:'c0',src:'data:image/png;base64,AA==',width:32,height:32}];
 state.relationships=[{id:'edge',fromId:'c0',toId:'target',label:'Keep'}];
 state.selectedNodeIds=children.map(n=>n.id);state.selectedNodeId='s0';
 state.root=State.cloneTree(state.root);state.images=State.cloneImages(state.images);state.relationships=State.cloneRelationships(state.relationships);
 const geometry=new Map(state.getAllNodesIncludingCollapsed().map((n,i)=>[n.id,{x:200,y:i*60}]));
 const app={state,layout:{getLayout:id=>geometry.get(id)}};
 return {app,state,ids:children.map(n=>n.id)};
}
for(const platform of ['desktop-shared','android']){
 for(const count of [2,3,10])test(`${platform}: ${count} roots, one undo, metadata and saved roundtrip`,()=>{
  const {app,state,ids}=fixture(platform,count),before=state.createSnapshot();
  // Reversed selection and redundant hidden descendant must not reorder/duplicate roots.
  const selection=[...ids].reverse().concat('c0');
  assert.deepEqual(Array.from(drag.rootsFor(state,selection),n=>n.id),ids);
  assert.equal(drag.applyGroup(app,state,selection,{kind:'child',targetId:'target'},{x:400,y:100},true,'s1'),true);
  assert.deepEqual(Array.from(state.findNode('target').children,n=>n.id),ids);
  assert.equal(state.findNode('p').children.length,0);assert.equal(state.findNode('c0').parentId,'s0');
  assert.equal(state.undoStack.length,1);assert.deepEqual(state.images,before.images);assert.deepEqual(state.relationships,before.relationships);
  const after=state.createSnapshot(),saved=JSON.parse(JSON.stringify(after));
  assert.deepEqual(StateClone(state,saved.root),after.root);
  assert.equal(state.undo(),true);assert.deepEqual(state.createSnapshot(),before);
  assert.equal(state.redo(),true);assert.deepEqual(state.createSnapshot(),after);
 });
 test(`${platform}: invalid target, cycles and missing source are atomic`,()=>{
  const {app,state,ids}=fixture(platform),before=state.createSnapshot();
  for(const intent of [{kind:'child',targetId:'c0'},{kind:'place',parentId:'c1',side:'left'},{kind:'reorder',targetId:'s2'},{kind:'place',parentId:'q',side:'right',beforeId:'missing'},{kind:'keep'}]){
   assert.equal(drag.applyGroup(app,state,ids,intent,{x:10,y:20},true),false);assert.deepEqual(state.createSnapshot(),before);assert.equal(state.undoStack.length,0);
  }
  assert.equal(drag.applyGroup(app,state,[...ids,'missing'],{kind:'child',targetId:'target'},{x:0,y:0},true),false);
 });
 test(`${platform}: cross-parent group, reorder, detach and no-op`,()=>{
  const {app,state}=fixture(platform);const sources=['s0','target'];
  assert.equal(drag.applyGroup(app,state,sources,{kind:'reorder',targetId:'s2',after:true},{x:250,y:90},true),true);
  assert.deepEqual(Array.from(state.findNode('p').children,n=>n.id),['s1','s2','s0','target']);
  assert.equal(drag.applyGroup(app,state,sources,{kind:'reorder',targetId:'s2',after:true},{x:250,y:90},true),false);
  assert.equal(state.undoStack.length,1);
  assert.equal(drag.applyGroup(app,state,sources,{kind:'detach'},{x:400,y:500},true),true);
  assert.equal(state.findNode('s0').isFloating,true);assert.equal(state.findNode('target').isFloating,true);
  assert.notDeepEqual(state.findNode('s0').floatingPosition,state.findNode('target').floatingPosition);
  assert.equal(state.undoStack.length,2);
 });
}
function StateClone(state,root){return state.constructor.cloneTree(root)}
