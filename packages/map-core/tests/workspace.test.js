const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateWorkspaceTabs}=require('..');

test('workspace preflight preserves input and accepts legacy nodes with missing IDs or children',()=>{
  const tabs=[{root:{text:'Legacy',children:[{text:'Child',children:null}]},images:null,relationships:null,studyCards:null},{root:{id:'r',text:'Other',children:[]}}];
  const before=JSON.stringify(tabs);
  assert.equal(validateWorkspaceTabs(tabs),3);
  assert.equal(JSON.stringify(tabs),before);
});

test('duplicate IDs within a sheet are rejected; IDs may repeat in independent sheets',()=>{
  const root={id:'r',text:'Root',children:[{id:'child',text:'Child',children:[]}]};
  assert.equal(validateWorkspaceTabs([{root},{root:structuredClone(root)}]),4);
  root.children[0].id='r';
  assert.throws(()=>validateWorkspaceTabs([{root}]),/ID/);
});

test('workspace node, depth and sheet limits reject excess instead of truncating',()=>{
  const root={text:'Root',children:Array.from({length:3499},(_,i)=>({id:`n${i}`,text:`N ${i}`}))};
  assert.equal(validateWorkspaceTabs([{root}]),3500);
  root.children.push({text:'Excess'});
  assert.throws(()=>validateWorkspaceTabs([{root}]),/3500/);
  const tabs=Array.from({length:20},()=>({root:{text:'Sheet'}}));
  assert.equal(validateWorkspaceTabs(tabs),20);
  assert.throws(()=>validateWorkspaceTabs([...tabs,tabs[0]]),/20/);
  const deep={text:'Root'};let node=deep;
  for(let i=0;i<101;i++){const child={text:'Child'};node.children=[child];node=child;}
  assert.throws(()=>validateWorkspaceTabs([{root:deep}]),/livelli/);
});

test('invalid later sheets and metadata are rejected during preflight',()=>{
  const good={root:{id:'r',text:'Valid',children:[]}};
  for(const bad of [null,{root:null},{root:{text:'Bad',children:[null]}},{root:{text:'Bad',children:{}}},{...good,images:{}},{...good,relationships:[null]},{...good,studyCards:[null]}]){
    assert.throws(()=>validateWorkspaceTabs([good,bad]));
  }
  assert.throws(()=>validateWorkspaceTabs([]));
});
