'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const views=require('../view-core');

// F10b: the former 154px card clipped the title "2. Architettura Prodotto".
// Guard the conceptual-tree layout independently of browser-specific fonts.
test('conceptual tree reserves readable card width without mutating user content or colors',()=>{
  const root={id:'root',text:'Mappa Centrale',color:'#6441df',children:[
    {id:'strategy',text:'1. Strategia e Visione',color:'#237d68',children:[]},
    {id:'architecture',text:'2. Architettura Prodotto',color:'#ed8936',children:[]}
  ]};
  const before=JSON.stringify(root);
  const tree=views.project(root,'concept-tree');
  const byId=new Map(tree.nodes.map(node=>[node.id,node]));
  const card=byId.get('architecture');
  assert.ok(card.w>=188&&card.w<=208,
    'concept-tree title card must reserve the widened 188-208px range');
  assert.ok(card.h>=58,'the title card must retain its minimum height');
  assert.equal(card.text,'2. Architettura Prodotto');
  assert.equal(card.color,'#ed8936','preserve the explicit user color');
  assert.ok(card.x>byId.get('root').x,'conceptual hierarchy flows left to right');
  assert.ok(tree.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
  assert.deepEqual(views.project(root,'concept-tree'),tree,'layout is deterministic');
  assert.equal(JSON.stringify(root),before,'layout never writes to the source document');
  const org=views.project(root,'orgchart');
  assert.equal(org.nodes.find(n=>n.id==='architecture').w,172,
    'concept-tree sizing must not leak into organigram cards');
});
