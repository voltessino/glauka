'use strict';
const composeStateSource=require('../../../packages/editor-ui/tests/helpers/compose-state-source.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path');
const W=require('../../../packages/editor-ui/work-core.js');
const Source=require('../../../apps/desktop-shared/editor/source-lens-core.js');
const K=require('../../../apps/desktop-shared/editor/wiki-links-core.js');
const stateCode=composeStateSource('android');
const State=new Function('NeuroMapCore','NeuroMapSourceCore','NeuroMapWorkCore',
 stateCode+'\nreturn MindMapStateMachine;')({continuationSettings:x=>x},Source,W);
test('Android snapshots keep Markdown and canonical link text without duplication',()=>{
 const r={id:'root',text:'Project',side:'root',children:[
  {id:'a',text:'A',parentId:'root',side:'right',children:[],notes:K.format({rootId:'root',nodeId:'b',title:'B'})},
  {id:'b',text:'B',parentId:'root',side:'right',children:[],notes:'# B'}
 ]};
 const copy=State.cloneTree(r);
 assert.equal(copy.children[0].notes,r.children[0].notes);
 copy.children[0].notes='# Modified';
 assert.equal(r.children[0].notes,K.format({rootId:'root',nodeId:'b',title:'B'}));
 assert.equal(K.index([{id:'tab',state:{root:copy}}]).forward('tab','a').length,0);
});
test('Android node Markdown Undo restores the previous note in one step',()=>{
 const state=new State();
 state.root={id:'root',text:'Root',side:'root',children:[],notes:'Before'};
 const before=String(state.root.notes);
 assert.equal(K.saveNote(state,'root','After [[Another]]'),true);
 assert.equal(state.undo(),true);
 assert.equal(state.root.notes,before);
});
test('Android import/clipboard source remapping protects internal references',()=>{
 const compose=require('../../../packages/editor-ui/tests/helpers/compose-app-source.cjs');
 const s=compose('android');
 assert.ok(s.includes('sourceRootId:this.state.root.id'));
 assert.ok(s.includes('NeuroMapWikiLinks.remapInternal'));
 const example=K.format({rootId:'import',nodeId:'node',title:'Node'});
 const edited=K.remapInternal(example,'import','newroot',new Map([['node','newnode']]));
 assert.equal(edited,'[[nm:newroot/newnode|Node]]');
});
