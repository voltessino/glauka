'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Learning=require('../../../apps/desktop-shared/editor/learn-core.js');
const Adaptive=require('../../../apps/desktop-shared/editor/learn-adaptive-core.js');
const Atlas=require('../../../apps/desktop-shared/editor/atlas-library-core.js');
const composeAppSource=require('./helpers/compose-app-source.cjs');
const appSource=composeAppSource('desktop-shared');
// The persistence helpers are composed before app.js by desktop sources.json.
// Always test their canonical source rather than extracting a now-empty app.js prefix.
const workspaceMetadataSource=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/workspace-view-metadata.js'),'utf8');
const begin=appSource.indexOf('\n      loadAutosave(');
const end=appSource.indexOf('\n      toggleBoundary()',begin);
assert.ok(begin>=0&&end>begin,'actual desktop recovery method not found');
const method=appSource.slice(begin,end);
const copy=data=>JSON.parse(JSON.stringify(data));
const load=new Function('localStorage','window','MindMapStateMachine',
  'nm68ClampGap','nm64PreferredWrap','nm64WasCustom','nm64ApplyWrapPreference','console',
  'NeuroMapLearningCore','NeuroMapAdaptiveCore','NeuroMapAtlasLibrary',
  workspaceMetadataSource+'\nreturn ({'+method+'}).loadAutosave;')(
   {getItem(){return null}}, {neuromapDesktop:{}},
   {cloneTree:copy,cloneImages:copy,cloneRelationships:copy},
   x=>x,()=>48,()=>false,()=>{},{warn(){}},Learning,Adaptive,Atlas
  );
function fixture(){
 const original={root:{id:'root',text:'My working map',children:[]},
  images:[{id:'image-existing',attachedNodeId:'root'}],relationships:[],isDirty:true};
 const app={tabs:[{id:'tab-old',title:'Original',state:original,camera:null}],
  activeTabId:'tab-old',state:original,studyCards:[{id:'important-card',sourceTabId:'tab-old'}],
  learningAttempts:[],learningPlans:[],_nmAtlasArchive:[],
  _nmAtlasEdges:[{fromTab:'tab-old',fromNode:'root',toTab:'tab-old',toNode:'root'}],
  _nmJourneyProgress:{'tab-old':8},
  renderer:{state:original,camera:{}},
  newState(title){return {root:{id:'starter',text:title,children:[]},
   generateId(){return 'generated'},isDirty:false}},
 };
 const snapshot=()=>JSON.stringify({tabs:app.tabs,active:app.activeTabId,cards:app.studyCards,
  edges:app._nmAtlasEdges,journey:app._nmJourneyProgress,attempts:app.learningAttempts,
  plans:app.learningPlans,archive:app._nmAtlasArchive,state:app.state,renderer:app.renderer.state});
 return {app,snapshot,load:json=>load.call(app,json)};
}
test('1000 damaged or unusable workspace snapshots cannot erase active cards, Atlas or tabs',()=>{
 for(let user=0;user<1000;user++){
  const f=fixture(),before=f.snapshot();
  const corrupt=user%4===0?'{"tabs":[':user%4===1?
   JSON.stringify({tabs:[{id:'broken',root:{id:'x'}}],studyCards:[],atlasEdges:[],journeyProgress:{}}):
   user%4===2?JSON.stringify({tabs:[],studyCards:[],atlasEdges:[]}):
   JSON.stringify({tabs:[{id:'bad',root:{id:'r',children:'not-an-array'}}],studyCards:[],atlasEdges:[]});
  assert.notEqual(f.load(corrupt),true,'invalid workspace accepted for scenario '+user);
  assert.equal(f.snapshot(),before,'live session corrupted by invalid backup scenario '+user);
 }
});
test('valid native workspace restore remains complete, including study and link metadata',()=>{
 const f=fixture();
 const json=JSON.stringify({version:3,activeTabId:'active',
  tabs:[{id:'active',title:'Study',root:{id:'valid',text:'Restored',children:[{id:'n1',text:'Anatomia',children:[]}]},
   images:[{id:'img',attachedNodeId:'n1'}],relationships:[{id:'rel',fromId:'valid',toId:'n1'}],
   balanceBias:65,thresholdY:500,isDirty:true}],
  studyCards:[{id:'card-new',sourceTabId:'active',sourceNodeId:'n1'}],
  learningAttempts:Learning.addAttempt([],{tabId:'active',nodeId:'n1',itemId:'quiz-1',format:'choice',correct:false,sourceSignature:'sig'},1700000000000),
  learningPlans:Adaptive.setPlan([],{tabId:'active',examDate:'2027-05-12',minutesPerDay:50},1700000000000),
  atlasEdges:[{fromTab:'active',fromNode:'valid',toTab:'active',toNode:'n1'}],
  journeyProgress:{active:1}});
 assert.equal(f.load(json),true);
 assert.equal(f.app.activeTabId,'active');
 assert.equal(f.app.state.root.children[0].id,'n1');
 assert.equal(f.app.state.images[0].id,'img');
 assert.equal(f.app.studyCards[0].id,'card-new');
 assert.equal(f.app.learningAttempts[0].itemId,'quiz-1');
 assert.equal(f.app.learningPlans[0].examDate,'2027-05-12');
 assert.equal(f.app._nmAtlasEdges.length,1);
 assert.equal(f.app._nmJourneyProgress.active,1);
});
test('1000 valid offline recovery profiles preserve saved IDs and image/study associations',()=>{
 for(let user=0;user<1000;user++){
  const f=fixture(),id='node-'+user;
  const doc={activeTabId:'tab-'+user,tabs:[{id:'tab-'+user,title:'Recovered '+user,
    root:{id:'root-'+user,text:'Recovered map',children:[{id,text:'Concept',notes:'source '+user,children:[]}]},
    images:[{id:'img-'+user,attachedNodeId:id}],relationships:[],isDirty:true}],
    studyCards:[{id:'card-'+user,sourceTabId:'tab-'+user,sourceNodeId:id}],
    atlasEdges:[],journeyProgress:{['tab-'+user]:1}};
  assert.equal(f.load(JSON.stringify(doc)),true);
  assert.equal(f.app.state.root.children[0].id,id);
  assert.equal(f.app.state.images[0].attachedNodeId,id);
  assert.equal(f.app.studyCards[0].sourceNodeId,id);
  assert.equal(f.app._nmJourneyProgress['tab-'+user],1);
 }
});

test('desktop restores 21 and 100 tabs without silently dropping the last map',()=>{
 for(const count of [21,100]){
  const f=fixture();
  const doc={version:3,activeTabId:'tab-'+(count-1),
   tabs:Array.from({length:count},(_,i)=>({
    id:'tab-'+i,title:'Recovered '+i,root:{id:'r-'+i,text:'Map '+i,children:[]},
    images:[],relationships:[],isDirty:i%2===0
   }))};
  assert.equal(f.load(JSON.stringify(doc)),true,'failed to restore '+count+' tabs');
  assert.equal(f.app.tabs.length,count);
  assert.equal(f.app.tabs[0].state.root.text,'Map 0');
  assert.equal(f.app.tabs[count-1].state.root.text,'Map '+(count-1));
  assert.equal(f.app.activeTabId,'tab-'+(count-1));
 }
});
test('desktop rejects 101-tab recovery before changing an existing workspace',()=>{
 const f=fixture(),before=f.snapshot();
 const tooMany={version:3,activeTabId:'t100',tabs:Array.from({length:101},(_,i)=>({
  id:'t'+i,root:{id:'r'+i,text:'Map '+i,children:[]}
 }))};
 assert.notEqual(f.load(JSON.stringify(tooMany)),true);
 assert.equal(f.snapshot(),before,'invalid backup must not replace live tabs');
});
