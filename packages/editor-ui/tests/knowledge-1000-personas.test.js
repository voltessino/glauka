'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const K=require('../../../apps/desktop-shared/editor/knowledge-core.js');

// Exactly 1,000 distinct simulated profiles. Deterministic, independent
// data sets include collapsed branches, notes, Unicode, explicit references,
// lexical matches, flashcard histories, and persistence-like roundtrips.
test('1,000 independent desktop knowledge-workspace scenarios',()=>{
 let assertions=0;
 for(let user=0;user<1000;user++){
  const name='persona-'+user,n=4+user%73,depth=user%17;
  const root={id:'root-'+name,text:user%2?'Studio α':'Research 🧠',children:[],notes:''};
  let parent=root;
  for(let j=0;j<depth;j++){
   const x={id:'ancestor-'+user+'-'+j,text:'Level '+j,collapsed:user%7===0,children:[]};
   parent.children.push(x);parent=x;
  }
  const target={id:'target-'+name,text:'Brain #'+user+' <&>',notes:user%2?'pagina 44':'🔬 unicode',children:[]};
  parent.children.push(target);
  for(let j=0;j<n;j++)root.children.push({id:'s-'+user+'-'+j,text:j%5===0?'Cardiologia':'Topic '+j,collapsed:j%9===0,children:[]});
  const other={id:'other-'+user,text:'Other',children:[{id:'peer-'+user,text:target.text,children:[]}]};
  const tabs=[{id:'primary-'+name,title:'Primary',state:{root}},{id:'secondary-'+name,title:'Secondary',state:{root:other}}];
  const before=JSON.stringify(tabs),index=K.indexTabs(tabs),rows=K.walk(root);
  assert.equal(rows.length,n+depth+2);assertions++;
  assert.ok(rows.some(x=>x.id===target.id));assertions++;
  assert.ok(K.outline(root,target.text).some(x=>x.id===target.id));assertions++;
  assert.equal(K.search(index,target.text,20).length,2);assertions++;
  assert.equal(K.suggested(index,10).length,1);assertions++;
  const edge={fromTab:tabs[0].id,fromNode:target.id,toTab:tabs[1].id,toNode:other.children[0].id,label:'reference'};
  const valid=K.normalizeEdges([edge,edge,{...edge,toNode:'missing'}],index);
  assert.equal(valid.length,1);assertions++;
  assert.equal(K.backlinks(index,valid,tabs[1].id,other.children[0].id).length,1);assertions++;
  assert.equal(K.route(index,valid,tabs[0].id,root.id,tabs[1].id,other.children[0].id).length,depth+3);assertions++;
  assert.equal(K.journey(root).length,rows.length);assertions++;
  const cards=[{sourceTabId:tabs[0].id,sourceNodeId:target.id,sr:{
   reviews:user%4===0?0:user%10+1,lapses:user%3,dueAt:user%4===1?100:user%4===2?500000:0
  }}];
  const radar=K.memoryRadar(root,cards,tabs[0].id,1000);
  assert.equal(radar.nodes.find(x=>x.nodeId===target.id).hasEvidence,user%4!==0);assertions++;
  assert.ok(!radar.nodes.some(x=>Object.hasOwn(x,'mastery')));assertions++;
  assert.equal(JSON.stringify(tabs),before,'projection modified original user data');assertions++;
 }
 assert.equal(assertions,12000);
});
