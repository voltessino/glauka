'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../work-core.js');
function tree(){
 return {id:'root',text:'Project',children:[
  {id:'a',text:'Design',startDate:'2026-10-20',dueDate:'2026-10-23',children:[]},
  {id:'b',text:'Build',startDate:'2026-10-23',dueDate:'2026-10-28',taskDependsOn:['a'],children:[]},
  {id:'c',text:'Release',startDate:'2026-10-30',dueDate:'2026-11-01',taskDependsOn:['b'],children:[]}
 ]};
}
test('validated DAG handles successors, duplicate refs, cycles and missing IDs',()=>{
 const root=tree();
 assert.deepEqual(W.validateDependencies(root,'c',['b']),['b']);
 assert.throws(()=>W.validateDependencies(root,'a',['c']),/cycle/);
 assert.throws(()=>W.validateDependencies(root,'b',['missing']),/existing/);
 assert.throws(()=>W.validateDependencies(root,'b',['a','a']),/duplicated/);
 assert.throws(()=>W.validateDependencies(root,'a',['a']),/different/);
 assert.deepEqual(W.cleanDependencies(['a','a','NO SPACE!']),['a']);
});
test('timeline draws dependency edges and warns on date conflicts without modifying dates',()=>{
 const root=tree(),before=JSON.stringify(root);
 const projection=W.project(root,'timeline');
 assert.deepEqual(projection.edges.map(x=>[x.fromId,x.toId,x.conflict]),
  [['a','b',true],['b','c',false]]);
 assert.equal(JSON.stringify(root),before);
});
test('missing-date dependencies remain stored but are not drawn until both ends are dated',()=>{
 const root=tree();delete root.children[0].startDate;delete root.children[0].dueDate;
 assert.deepEqual(W.project(root,'timeline').edges.map(x=>x.fromId),['b']);
 assert.equal(root.children[1].taskDependsOn[0],'a');
});
