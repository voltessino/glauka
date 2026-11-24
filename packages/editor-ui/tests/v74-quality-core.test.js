'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Q=require('../../../apps/desktop-shared/editor/quality-core.js');
function fixture(){
 const root={id:'r',text:'Anatomy',children:[
  {id:'a',text:'Kidney',taskStatus:'todo',dueDate:'2026-10-20',taskDependsOn:['missing'],children:[]},
  {id:'b',text:'Kidney',children:[]},
  {id:'c',text:'Aorta',children:[]}
 ]};
 return {tabs:[{id:'tab',state:{root,
  images:[{id:'image',mode:'attached',attachedNodeId:'missing',studyHotspots:[{nodeId:'missing'}]}],
  relationships:[{id:'r1',fromId:'a',toId:'missing'}]}}],studyCards:[
   {sourceTabId:'tab',sourceNodeId:'missing',question:'Missing source?'},
   {sourceTabId:'tab',sourceNodeId:'a',question:'Old answer?'}
 ]};
}
test('detect real broken data without changing the original map',()=>{
 const input=fixture(),before=JSON.stringify(input);
 const report=Q.inspect({...input,today:'2026-10-23',staleness:()=> 'stale'});
 const kinds=new Set(report.items.map(x=>x.kind));
 for(const key of ['same-label','broken-dependency','overdue','orphan-image',
  'broken-hotspot','broken-relation','orphan-card','stale-card'])
  assert.ok(kinds.has(key),'Missing '+key);
 assert.equal(report.counts.nodes,4);
 assert.equal(report.counts.overdue,1);
 assert.equal(JSON.stringify(input),before);
});
test('identical sibling labels are informational, not an automatic deletion',()=>{
 const input=fixture();
 const report=Q.inspect(input);
 assert.equal(report.items.find(x=>x.kind==='same-label').severity,'info');
 assert.equal(input.tabs[0].state.root.children.length,3);
});
test('closed-tab cards are not falsely reported as orphaned',()=>{
 const report=Q.inspect({tabs:fixture().tabs,
  studyCards:[{sourceTabId:'closed-tab',sourceNodeId:'x',question:'Past card'}]});
 assert.equal(report.items.filter(x=>x.kind==='orphan-card').length,0);
});
test('old projects without dependencies or study images remain valid',()=>{
 const result=Q.inspect({tabs:[{id:'one',state:{root:{id:'root',text:'Empty',children:[]}}}]});
 assert.equal(result.items.length,0);
 assert.deepEqual(Q.summary(result),{error:0,warning:0,info:0});
});
test('detect cyclic node hierarchy rather than infinite loop',()=>{
 const root={id:'self',text:'Self',children:[]};root.children.push(root);
 assert.throws(()=>Q.inspect({tabs:[{id:'t',state:{root}}]}),/Cyclic/);
});

test('missing predecessor repair is preview-only until explicit commit',()=>{
 const input=fixture(),before=JSON.stringify(input);
 const plan=Q.missingPredecessorPlan(input.tabs[0].state.root);
 assert.equal(plan.length,1);
 assert.deepEqual(plan[0].previous,['missing']);
 assert.deepEqual(plan[0].next,[]);
 assert.equal(JSON.stringify(input),before);
});
test('plan preserves valid dependencies, rejects self and root targets',()=>{
 const root={id:'r',text:'Root',children:[
  {id:'a',text:'First',children:[]},
  {id:'b',text:'Second',taskDependsOn:['a','missing','b','r'],children:[]}
 ]};
 const plan=Q.missingPredecessorPlan(root);
 assert.deepEqual(plan,[{nodeId:'b',previous:['a','missing','b','r'],next:['a']}]);
});
