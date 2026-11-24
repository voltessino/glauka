'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const K=require('../../../apps/desktop-shared/editor/knowledge-core.js');
const make=(n)=>({id:'n'+n,text:'Node '+n,children:[],notes:n%9===0?'case-study':''});
const sample={id:'root',text:'Root',children:[
 {id:'a',text:'Cardiologia',collapsed:true,children:[{id:'a1',text:'Aorta',notes:'pagina 12',children:[]}]},
 {id:'b',text:'Biologia',children:[]}
]};
test('Outline includes ancestors when search finds nodes under a collapsed branch',()=>{
 assert.deepEqual(K.outline(sample).map(x=>x.id),['root','a','b']);
 assert.deepEqual(K.outline(sample,'aorta').map(x=>x.id),['root','a','a1']);
 assert.deepEqual(K.outline(sample,'PAGINA 12').map(x=>x.id),['root','a','a1']);
 assert.equal(sample.children[0].collapsed,true);
});
test('Deep trees and cycles do not overflow or mutate source objects',()=>{
 let root=make(0),cursor=root;
 for(let i=1;i<12000;i++){let child=make(i);cursor.children.push(child);cursor=child;}
 const data=K.walk(root);assert.equal(data.length,12000);
 cursor.children.push(root);assert.equal(K.walk(root).length,12000);
 assert.equal(root.children[0].id,'n1');
});
test('Unique logical ID projection and bounded traversal',()=>{
 const r={id:'x',text:'x',children:[{id:'x',text:'duplicate',children:[]},{id:'y',text:'distinct',children:[]}]};
 assert.deepEqual(K.walk(r).map(x=>x.id),['x','y']);
 assert.equal(K.walk(r,1).length,1);
});
test('Atlas uses existing node identity and distinguishes lexical suggestions',()=>{
 const tabs=[
  {id:'one',title:'Anatomia',state:{root:sample}},
  {id:'two',title:'Fisiologia',state:{root:{id:'z',text:'Second',children:[{id:'v',text:'Aorta',children:[]}]}}}
 ];
 const source=JSON.stringify(tabs);
 const index=K.indexTabs(tabs);
 assert.equal(K.search(index,'aorta').length,2);
 assert.equal(K.suggested(index).length,1);
 assert.equal(JSON.stringify(tabs),source);
 assert.equal(index.perTab.get('one').get('a1').nodeId,'a1');
});
test('Atlas validates cross-tab edges and finds backlinks and paths',()=>{
 const idx=K.indexTabs([
  {id:'one',state:{root:sample}},
  {id:'two',state:{root:{id:'z',text:'2',children:[{id:'v',text:'Aorta',children:[]}]}}}
 ]);
 const edge={fromTab:'one',fromNode:'a1',toTab:'two',toNode:'v',label:'ref'};
 const links=K.normalizeEdges([edge,edge,{...edge,toNode:'missing'},
  {fromTab:'one',fromNode:'a1',toTab:'one',toNode:'a1'}],idx);
 assert.equal(links.length,1);
 assert.equal(K.backlinks(idx,links,'two','v').length,1);
 assert.deepEqual(K.route(idx,links,'one','b','two','v').map(x=>x.nodeId),['b','root','a','a1','v']);
 assert.deepEqual(K.route(idx,[],'one','b','two','v'),[]);
});
test('Stress: 20,000 nodes across 40 maps; deterministic indexing/search',()=>{
 const tabs=[];
 for(let t=0;t<40;t++){
  const root={id:'r'+t,text:'root',children:[]};
  for(let n=0;n<500;n++)root.children.push({id:'x'+n,text:'topic '+n,children:[]});
  tabs.push({id:'tab'+t,title:'Map '+t,state:{root}});
 }
 const start=performance.now();
 for(let i=0;i<4;i++){
  const idx=K.indexTabs(tabs);
  assert.equal(idx.records.length,20040);
  assert.equal(K.search(idx,'topic 499',100).length,40);
  assert.ok(K.suggested(idx,80).length<=80);
 }
 assert.ok(performance.now()-start<20000,'index time budget exceeded (20 seconds)');
});
test('Stress: 5,000 explicit edges are bounded, deduplicated, and routable',()=>{
 const root={id:'r',text:'root',children:[]};
 for(let i=0;i<5500;i++)root.children.push({id:'n'+i,text:'node '+i,children:[]});
 const idx=K.indexTabs([{id:'t',state:{root}}]);
 const edges=[];for(let i=0;i<6000;i++)edges.push({fromTab:'t',fromNode:'r',toTab:'t',toNode:'n'+i});
 const normalized=K.normalizeEdges(edges,idx);
 assert.equal(normalized.length,5000);
 assert.equal(K.route(idx,normalized,'t','n4','t','n299').length,3);
});


test('Knowledge Journey retains source IDs, notes and collapsed descendants',()=>{
 const previous=JSON.stringify(sample);
 const chapters=K.journey(sample);
 assert.deepEqual(chapters.map(c=>c.id),['root','a','a1','b']);
 assert.equal(chapters[2].notes,'pagina 12');
 assert.equal(chapters[2].parentId,'a');
 assert.equal(JSON.stringify(sample),previous);
});
test('Memory Radar reports observed data only, not invented confidence',()=>{
 const tree={id:'root',text:'Root',children:[
  {id:'due',text:'Due',sr:{reviews:2,lapses:1,dueAt:500},children:[]},
  {id:'future',text:'Future',sr:{reviews:4,lapses:0,dueAt:5000},children:[]},
  {id:'fresh',text:'New',children:[]}
 ]};
 const actual=K.memoryRadar(tree,[{sourceTabId:'t',sourceNodeId:'fresh',
   sr:{reviews:1,lapses:0,dueAt:0}}],'t',1000);
 assert.deepEqual(actual.totals,{unreviewed:1,due:1,scheduled:1,reviewed:1});
 assert.ok(!('mastery' in actual.nodes[1]));
 assert.equal(actual.nodes.find(x=>x.nodeId==='due').lapses,1);
 const noCards=K.memoryRadar(tree,[],'t',1000);
 assert.equal(noCards.totals.unreviewed,2);
});
test('Stress: 12,000-chapter journey, no recursive stack overflow',()=>{
 let node={id:'leaf',text:'leaf',children:[]};
 for(let i=0;i<11999;i++)node={id:'branch'+i,text:'branch',children:[node]};
 const result=K.journey(node,12000);
 assert.equal(result.length,12000);
 assert.equal(result.at(-1).id,'leaf');
});
