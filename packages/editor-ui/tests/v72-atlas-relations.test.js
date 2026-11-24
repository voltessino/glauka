'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const K=require('../../../apps/desktop-shared/editor/knowledge-core.js');
test('Atlas explicit semantic labels preserve user-authored relationship',()=>{
 const first={id:'node_1',text:'Aorta',children:[]},second={id:'node_2',text:'Heart',children:[]};
 const index=K.indexTabs([{id:'tab_a',title:'Anatomy',state:{root:first}},
                          {id:'tab_b',title:'Physiology',state:{root:second}}]);
 const edges=K.normalizeEdges([{fromTab:'tab_a',fromNode:'node_1',
  toTab:'tab_b',toNode:'node_2',label:'prerequisito'}],index);
 assert.equal(edges.length,1);assert.equal(edges[0].label,'prerequisito');
 assert.equal(K.backlinks(index,edges,'tab_b','node_2').length,1);
 assert.deepEqual(K.route(index,edges,'tab_a','node_1','tab_b','node_2').map(x=>x.nodeId),['node_1','node_2']);
});
test('Atlas does not auto-create semantic links from matching titles',()=>{
 const index=K.indexTabs([
  {id:'tab_a',title:'Anatomy',state:{root:{id:'a',text:'Fegato',children:[]}}},
  {id:'tab_b',title:'Physiology',state:{root:{id:'b',text:'Fegato',children:[]}}}
 ]);
 assert.deepEqual(K.backlinks(index,[],'tab_b','b'),[]);
 assert.equal(K.suggested(index,10).length,1);
});
