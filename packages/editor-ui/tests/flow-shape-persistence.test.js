const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function stateType(platform){
 const folder=platform==='android'?'apps/android/editor':'apps/desktop-shared/editor';
 const source=fs.readFileSync(path.join(__dirname,'..','..','..',folder,'state.js'),'utf8');
 // Evaluate the production state class, without launching an editor, accessing
 // local storage, or replacing the production class with a test reimplementation.
 const context={};context.globalThis=context;
 vm.runInNewContext(source+'\nglobalThis.__FlowTestState=MindMapStateMachine;',context);
 return context.__FlowTestState;
}

test('desktop and Android preserve explicit Input/Output through genuine cloneTree and JSON',()=>{
 const sample={id:'root',text:'Study map',children:[
  {id:'input',text:'Read document',flowShape:'input',children:[]},
  {id:'output',text:'Write document',flowShape:'output',children:[]},
  {id:'legacy',text:'Legacy',flowShape:'not-real',children:[]}
 ]};
 const original=JSON.stringify(sample);
 for(const platform of ['desktop','android']){
  const State=stateType(platform);
  const first=State.cloneTree(sample),saved=JSON.parse(JSON.stringify(first));
  const second=State.cloneTree(saved);
  assert.equal(second.children[0].flowShape,'input',platform);
  assert.equal(second.children[1].flowShape,'output',platform);
  assert.equal(second.children[2].flowShape,undefined,'invalid metadata must be sanitized');
  assert.equal(second.children.length,3);
 }
 assert.equal(JSON.stringify(sample),original);
});

test('desktop state keeps single-step flow-shape Undo validation for both new roles',()=>{
 const State=stateType('desktop');
 const prototype=State.prototype;
 // Exercise the actual setter implementation without requiring renderer
 // dependencies in the constructor.
 const input={id:'input',text:'Import',children:[]};
 const fake={
  root:{id:'root',children:[input]},
  findNode(id){return id==='input'?input:null},
  pushHistory(){this.history=(this.history||0)+1},
  selectedNodeId:null,
 };
 const context={NeuroMapFlowCore:{SHAPES:['auto','start','end','process','decision','input','output']}};
 // The production setter refers to the global flow core. Bind it through
 // a fresh VM so it cannot leak into the caller's environment.
 const source=fs.readFileSync(path.join(__dirname,'..','..','..','apps/desktop-shared/editor/state.js'),'utf8');
 context.globalThis=context;
 vm.runInNewContext(source+'\nglobalThis.__FlowTestState=MindMapStateMachine;',context);
 const setter=context.__FlowTestState.prototype.setNodeFlowShape;
 assert.equal(setter.call(fake,'input','input'),true);
 assert.equal(input.flowShape,'input');
 assert.equal(fake.history,1);
 assert.equal(setter.call(fake,'input','input'),false);
 assert.equal(fake.history,1);
 assert.equal(setter.call(fake,'input','output'),true);
 assert.equal(input.flowShape,'output');
 assert.equal(fake.history,2);
 assert.equal(setter.call(fake,'input','not-real'),false);
 assert.equal(fake.history,2);
 assert.equal(setter.call(fake,'input','auto'),true);
 assert.equal(input.flowShape,undefined);
 assert.equal(fake.history,3);
});
