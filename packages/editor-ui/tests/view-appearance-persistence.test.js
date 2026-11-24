'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const appearance=require('../view-appearance-core');

const source=composeStateSource('desktop-shared');
const State=new Function('globalThis','nm70PreferredGap',
 source+'\nreturn MindMapStateMachine;')({NeuroMapViewAppearance:appearance},()=>150);

test('linked-view preferences survive cloning, project JSON, undo and redo',()=>{
 const state=new State();
 state.root={id:'root',text:'Anatomy',color:'#112233',children:[
  {id:'neuron',text:'Neuron',color:'#445566',children:[]}
 ]};
 const sourceColor=state.root.children[0].color;
 state.pushHistory();
 state.root.viewAppearance=appearance.update(null,'orgchart',{preset:'paper',background:'#eafafa'});
 const snapshot=State.cloneTree(state.root);
 assert.equal(snapshot.viewAppearance.modes.orgchart.background,'#eafafa');
 const restored=State.cloneTree(JSON.parse(JSON.stringify(snapshot)));
 assert.equal(restored.viewAppearance.modes.orgchart.preset,'paper');
 assert.equal(state.undo(),true);
 assert.equal(state.root.viewAppearance,undefined);
 assert.equal(state.root.text,'Anatomy');
 assert.equal(state.redo(),true);
 assert.equal(state.root.viewAppearance.modes.orgchart.background,'#eafafa');
 assert.equal(state.root.children[0].color,sourceColor);
});

test('malformed view styles in imported project do not leak into cloned state',()=>{
 const raw={id:'root',text:'Legacy',children:[],
  viewAppearance:{modes:{orgchart:{background:'url(javascript:evil)',preset:'paper',fontSize:999}}}};
 const restored=State.cloneTree(raw);
 assert.equal(restored.viewAppearance.modes.orgchart.preset,'paper');
 assert.equal(restored.viewAppearance.modes.orgchart.background,undefined);
 assert.equal(restored.viewAppearance.modes.orgchart.fontSize,18);
});

test('Android roundtrip preserves validated desktop view metadata without enabling desktop UI',()=>{
 const android=composeStateSource('android');
 const Android=new Function('globalThis',android+';return MindMapStateMachine;')({NeuroMapViewAppearance:appearance});
 const raw={id:'root',text:'Shared',children:[{id:'task',text:'Task',flowShape:'decision',taskOrder:7,children:[]}],viewAppearance:appearance.update(null,'orgchart',{preset:'corporate'})};
 const result=Android.cloneTree(raw);
 assert.deepEqual(result.viewAppearance,raw.viewAppearance);
 assert.equal(result.children[0].flowShape,'decision');assert.equal(result.children[0].taskOrder,7);
 const invalid=Android.cloneTree({id:'root',text:'Invalid',viewAppearance:{modes:{orgchart:{background:'url(evil)'}}},taskOrder:-1,flowShape:'<bad>',children:[]});
 assert.equal(invalid.viewAppearance.modes.orgchart.background,undefined);assert.equal(invalid.taskOrder,undefined);assert.equal(invalid.flowShape,undefined);
});
