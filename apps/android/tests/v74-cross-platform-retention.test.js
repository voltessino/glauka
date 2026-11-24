'use strict';
const composeStateSource=require('../../../packages/editor-ui/tests/helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=composeStateSource('android');
const Core=require('../../../apps/desktop-shared/editor/source-lens-core.js');
const Work=require('../../../packages/editor-ui/work-core.js');
const State=new Function('NeuroMapCore','NeuroMapSourceCore','NeuroMapWorkCore',
 source+'\nreturn MindMapStateMachine;')({continuationSettings:v=>v},Core,Work);
const sha='a'.repeat(64);
const reference=()=>Core.normalize({id:'src_12345678',kind:'pdf',title:'Atlas',fileName:'source.pdf',
 sha256:sha,page:3,quote:'Original wording',createdAt:'2026-10-23T10:00:00Z'});
const hierarchy=()=>({id:'root',text:'Map',side:'root',children:[
 {id:'a',text:'First',side:'right',parentId:'root',children:[],sourceRefs:[reference()]},
 {id:'b',text:'Second',side:'right',parentId:'root',
  taskDependsOn:['a'],taskStatus:'doing',startDate:'2026-10-23',dueDate:'2026-10-25',children:[]}
]});
test('Android retains validated Source Lens citations and source fingerprint in snapshots',()=>{
 const old=hierarchy(),copy=State.cloneTree(old);
 assert.equal(copy.children[0].sourceRefs[0].sha256,sha);
 assert.equal(copy.children[0].sourceRefs[0].quote,'Original wording');
 copy.children[0].sourceRefs[0].quote='Edited';
 assert.equal(old.children[0].sourceRefs[0].quote,'Original wording');
});
test('Android keeps stable task dependencies and explicit dates when cloning',()=>{
 const value=State.cloneTree(hierarchy());
 assert.deepEqual(value.children[1].taskDependsOn,['a']);
 assert.equal(value.children[1].startDate,'2026-10-23');
 assert.equal(value.children[1].dueDate,'2026-10-25');
 assert.equal(value.children[1].taskStatus,'doing');
});
test('Android refuses dangling and cyclic dependencies without mutation',()=>{
 const state=new State();state.root=hierarchy();state.images=[];state.relationships=[];
 const before=JSON.stringify(state.root);
 assert.equal(state.setNodeTaskDependencies('a',['missing']),false);
 assert.equal(state.setNodeTaskDependencies('a',['b']),false);
 assert.equal(JSON.stringify(state.root),before);
 assert.equal(state.setNodeTaskDependencies('b',[]),true);
 assert.deepEqual(state.findNode('b').taskDependsOn,[]);
 assert.equal(state.undo(),true);
 assert.deepEqual(state.findNode('b').taskDependsOn,['a']);
});
test('Android import has guarded reference remapping for dependent fields',()=>{
 const composeAppSource=require('../../../packages/editor-ui/tests/helpers/compose-app-source.cjs');
const js=composeAppSource('android');
 for(const literal of ['const ids=new Map(),pairs=',"ids.get(id)","studyHotspots:(img.studyHotspots||[])","NeuroMapSourceCore.normalizeAll(topic.sourceRefs)"])
  assert.ok(js.includes(literal),'Missing '+literal);
});


test('collapsed subtrees count toward the 3,500-node safety limit',()=>{
 const state=new State();
 state.root={id:'root',text:'Root',children:[{id:'a',text:'Hidden',
  collapsed:true,children:[{id:'b',text:'Still present',children:[]}]}]};
 assert.equal(state.getAllNodes().length,2);
 assert.equal(state.getNodeCountIncludingCollapsed(),3);
});
test('PDF citations keep the 16-reference limit when copying snapshots',()=>{
 const many=Array.from({length:30},(_,i)=>({...reference(),id:'src_'+String(i).padStart(8,'0')}));
 const data={id:'root',text:'Root',sourceRefs:many,children:[]};
 assert.equal(State.cloneTree(data).sourceRefs.length,16);
});
