'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
// Source-level replay of Ctrl/Shift selection + Delete with hidden descendants,
// images, links and Undo/Redo. No browser, OS keypress or human tester involved.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../map-core');
const ROOT=path.resolve(__dirname,'../../..');
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const extract=(source,method,next)=>{
 const a=source.indexOf('      '+method),b=source.indexOf('\n      '+next,a);
 assert.ok(a>=0&&b>a,'Missing '+method);
 return new Function('return ({'+source.slice(a,b)+'}).'+method.slice(0,method.indexOf('(')))();
};
function fixture(platform){
 const src=composeStateSource(platform);
 const palette=['#f43f5e','#06b6d4'];
 const State=new Function('NeuroMapCore','nm70PreferredGap','localStorage',
  'HARMONIC_PALETTE','ColorUtils','THEME_PALETTES','globalThis',
  src+'\nreturn MindMapStateMachine;')(
   Core,()=>150,{getItem:()=>null},palette,{lighten:x=>x},{},{});
 const compose=require('./helpers/compose-app-source.cjs');
 const code=compose(platform);
 const deleteSelected=extract(code,'deleteSelected() {','undo() {');
 const selectedTopLevelNodes=extract(code,'selectedTopLevelNodes() {','hasSelectedAncestor(');
 const hasSelectedAncestor=extract(code,'hasSelectedAncestor(node, ids) {','collectDescendantIds(');
 const collectDescendantIds=extract(code,'collectDescendantIds(nodes) {','buildClipboardPayload(');
 return {State,deleteSelected,selectedTopLevelNodes,hasSelectedAncestor,collectDescendantIds};
}
const randomFor=seed=>{
 let s=seed>>>0;
 return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
};
test('2000 mixed Ctrl/Shift/Delete selections preserve all hidden metadata and history',t=>{
 const counters={scenarios:0,selected:0,deleted:0,undo:0,redo:0,retainedImages:0,retainedLinks:0};
 for(const platform of ['desktop-shared','android']){
  const {State,deleteSelected,selectedTopLevelNodes,hasSelectedAncestor,collectDescendantIds}=fixture(platform);
  for(let seed=1;seed<=1000;seed++){
   const rnd=randomFor(seed*7369+(platform==='android'?1337:0));
   const state=new State();
   const root={id:'root',text:'Centro',side:'root',children:[]},nodes=[root];
   const add=(parent,id)=>{
    const n={id,parentId:parent.id,text:id,side:'right',children:[],collapsed:rnd()<.25};
    parent.children.push(n);nodes.push(n);return n;
   };
   for(let i=0;i<16;i++){
    const parent=i<4?root:nodes[Math.floor(rnd()*nodes.length)];
    add(parent,'n'+i);
   }
   state.root=root;state.selectedNodeIds=[];state.selectedNodeId='root';
   const visible=state.getAllNodes().filter(n=>n.id!=='root');
   for(let i=0;i<Math.min(visible.length,3);i++)
    if(rnd()<.6)state.selectedNodeIds.push(visible[Math.floor(rnd()*visible.length)].id);
   if(!state.selectedNodeIds.length)state.selectedNodeIds=[visible[0].id];
   state.selectedNodeId=state.selectedNodeIds.at(-1);
   state.images=nodes.slice(1).map(n=>({
    id:'i-'+n.id,src:'data:image/png;base64,AAAA',mode:'attached',attachedNodeId:n.id
   }));
   state.relationships=nodes.slice(1).map(n=>({
    id:'l-'+n.id,fromId:'root',toId:n.id
   }));
   const app={state,deleteSelected,selectedTopLevelNodes,
    hasSelectedAncestor,collectDescendantIds,closeEditor(){},markChanged(){}};
   const before=JSON.stringify(state.createSnapshot());
   const top=selectedTopLevelNodes.call(app),removed=collectDescendantIds.call(app,top);
   assert.ok(removed.size>0);
   deleteSelected.call(app);
   const present=new Set(state.getAllNodesIncludingCollapsed().map(n=>n.id));
   for(const old of nodes.slice(1))
    assert.notEqual(present.has(old.id),removed.has(old.id),
     'Unexpected hidden tree change: '+platform+' seed='+seed+' node='+old.id);
   for(const img of state.images)
    assert.ok(present.has(img.attachedNodeId),'Orphan image: '+platform+' seed='+seed);
   for(const rel of state.relationships)
    assert.ok(present.has(rel.fromId)&&present.has(rel.toId),'Orphan link: '+platform+' seed='+seed);
   assert.equal(state.images.length,nodes.length-1-removed.size);
   assert.equal(state.relationships.length,nodes.length-1-removed.size);
   const after=JSON.stringify(state.createSnapshot());
   assert.equal(state.undo(),true);assert.equal(JSON.stringify(state.createSnapshot()),before);
   assert.equal(state.redo(),true);assert.equal(JSON.stringify(state.createSnapshot()),after);
   counters.scenarios++;counters.selected+=top.length;counters.deleted+=removed.size;
   counters.undo++;counters.redo++;
   counters.retainedImages+=state.images.length;counters.retainedLinks+=state.relationships.length;
  }
 }
 assert.equal(counters.scenarios,2000);
 t.diagnostic(JSON.stringify(counters));
});
