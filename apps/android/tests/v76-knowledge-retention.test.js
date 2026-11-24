'use strict';
const composeStateSource=require('../../../packages/editor-ui/tests/helpers/compose-state-source.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const K=require('../../../apps/desktop-shared/editor/knowledge-db-core.js');
const Source=require('../../../apps/desktop-shared/editor/source-lens-core.js');
const Work=require('../../../packages/editor-ui/work-core.js');
const nc={continuationSettings:x=>x};
function stateClass(sourceFile){
 const s=fs.readFileSync(path.resolve(__dirname,sourceFile),'utf8');
 return new Function('NeuroMapCore','NeuroMapSourceCore','NeuroMapWorkCore','NeuroMapConceptNetwork','NeuroMapKnowledgeDB','HARMONIC_PALETTE','ColorUtils',
   s+'\nreturn MindMapStateMachine;')(nc,Source,Work,{position:x=>x},K,['#456abc','#15aabb'],{lighten:x=>x});
}
const Android=stateClass('../editor/state.js');
const Desktop=stateClass('../../desktop-shared/editor/state.js');
const node=()=>({id:'root',text:'Course',side:'root',children:[],
 knowledge:{tags:['Cardiology'],fields:{review:{type:'date',value:'2026-10-23'},difficulty:{type:'number',value:3}},dailyKey:''}});
test('Android/desktop clone original properties without touching source',()=>{
 const original=node(),before=JSON.stringify(original);
 for(const State of [Android,Desktop]){
  const copy=State.cloneTree(original);
  assert.deepEqual(K.normalize(copy.knowledge),K.normalize(original.knowledge));
  assert.equal(JSON.stringify(original),before);
  copy.knowledge.tags.push('Different');
  assert.deepEqual(original.knowledge.tags,['Cardiology']);
 }
});
test('real Android Undo rolls back property and template updates',()=>{
 const state=new Android();state.root=Android.cloneTree(node());
 assert.equal(K.applyTemplate(state,'root','study'),true);
 assert.ok(state.root.knowledge.tags.includes('Studio'));
 assert.equal(state.undo(),true);
 assert.deepEqual(state.root.knowledge.tags,['Cardiology']);
 assert.equal(K.update(state,'root',{tags:['Renal'],fields:{score:{type:'number',value:5}}}),true);
 assert.equal(state.undo(),true);
 assert.equal(state.root.knowledge.fields.difficulty.value,3);
});
test('actual Android state stores and restores one daily node',()=>{
 const state=new Android();state.root=Android.cloneTree(node());
 const first=K.createDaily(state,null,'2026-10-23');
 const second=K.createDaily(state,null,'2026-10-23');
 assert.equal(first.created,true);assert.equal(second.created,false);
 const clone=Android.cloneTree(state.root);
 assert.equal(clone.children[0].knowledge.dailyKey,'2026-10-23');
 assert.equal(state.undo(),true);
 assert.equal(state.root.children.length,0);
});
test('external file import transports typed properties on both platforms',()=>{
 for(const p of ['../editor/app-import.js','../../desktop-shared/editor/app-import.js']){
  const code=fs.readFileSync(path.resolve(__dirname,p),'utf8');
  assert.ok(code.includes('NeuroMapKnowledgeDB.normalize(topic.knowledge)'));
 }
});
