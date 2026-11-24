'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('path');
const vm=require('node:vm');
const appearance=require('../view-appearance-core');
const network=require('../concept-network');

const from=name=>fs.readFileSync(path.join(__dirname,'../'+name),'utf8');

class NodeElement{
  constructor(tag='div'){
    this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.textContent='';
    this.className='';
    const names=new Set();
    this.classList={
      add:(...values)=>values.forEach(v=>names.add(v)),
      contains:name=>names.has(name),
      toggle:(name,force)=>{if(force===undefined?!names.has(name):force)names.add(name);else names.delete(name);},
      remove:(...values)=>values.forEach(v=>names.delete(v))
    };
    const styles={};this.style={setProperty:(key,value)=>{styles[key]=value},getPropertyValue:key=>styles[key]||''};
  }
  setAttribute(key,value){this.attrs[key]=String(value)}
  getAttribute(key){return this.attrs[key]||null}
  append(...items){this.children.push(...items)}
  replaceChildren(...items){this.children=items.slice()}
}

function decorations(){
  const ctx={
    document:{createElement:tag=>new NodeElement(tag),createElementNS:(_,tag)=>new NodeElement(tag)},
    appearance,TREE_GROUP_COLORS:appearance.GROUP_COLORS,NETWORK_CLUSTER_COLORS:appearance.GROUP_COLORS,
    network,tr:(it)=>it,KANBAN_STATUS_COLORS:appearance.KANBAN_STATUS_COLORS,
    kanbanStatusColor:appearance.kanbanStatusColor,semanticFlowColor:()=>'#38bdf8',
    flows:{TYPES:['sequence','yes','no'],isFlowKind:()=>true},mixHex:(a)=>a
  };
  vm.runInNewContext(from('linked-view-decorations.js')+
    '\nthis.api={decorateTreeCard,decorateCollapseControl,hiddenDirectChildCount,formatHiddenBadge,'+
    'buildNetworkAdjacency,applyNetworkNeighborhood,clearNetworkNeighborhood,'+
    'accessibleNetworkLabelColors,contrastRatio,drawNetworkLabel};',
    ctx,{filename:'linked-view-decorations.js'});
  return ctx.api;
}

test('concept-tree cards gain compact marks and hidden badges without mutating nodes',()=>{
  const api=decorations();
  const node={id:'n1',text:'Μαθηματικά',depth:2,groupIndex:1,hiddenChildren:12,childIds:[]};
  const before=JSON.stringify(node);
  const card=new NodeElement();
  card.setAttribute('aria-label',node.text);
  api.decorateTreeCard(card,'concept-tree',node);
  assert.equal(card.classList.contains('nm-tree-card'),true);
  assert.equal(card.dataset.treeTier,'leaf');
  assert.equal(card.children.find(x=>x.className==='nm-tree-mark')?.textContent,'Μ');
  assert.equal(card.children.find(x=>x.className==='nm-hierarchy-hidden-badge')?.textContent,'+12');
  assert.ok(card.getAttribute('aria-label').includes('figli nascosti'));
  assert.equal(JSON.stringify(node),before);
});

test('collapse control exposes chevron and aria-expanded without display:none',()=>{
  const api=decorations();
  const button=new NodeElement('button');
  api.decorateCollapseControl(button,true,'Ramo');
  assert.equal(button.classList.contains('is-collapsed'),true);
  assert.equal(button.getAttribute('aria-expanded'),'false');
  assert.equal(button.children[0]?.className,'nm-view-collapse-chevron');
  api.decorateCollapseControl(button,false,'Ramo');
  assert.equal(button.getAttribute('aria-expanded'),'true');
});

test('adjacency highlight is proportional to incident edges and restores cleanly',()=>{
  const api=decorations();
  const layout={mode:'concept-network',edges:[
    {id:'r1',fromId:'a',toId:'b',type:'relation'},
    {id:'r2',fromId:'a',toId:'c',type:'relation'},
    {id:'h1',fromId:'root',toId:'a',type:'hierarchy'}
  ]};
  const index=api.buildNetworkAdjacency(layout);
  assert.equal(index.byNode.get('a').size,3);
  assert.equal(index.byEdge.get('r1').toId,'b');

  function makeListable(extraClass){
    const el=new NodeElement();
    if(extraClass)el.classList.add(extraClass);
    return el;
  }
  const cards={
    a:makeListable('nm-network-card'),
    b:makeListable('nm-network-card'),
    c:makeListable('nm-network-card'),
    root:makeListable('nm-network-card'),
    lone:makeListable('nm-network-card')
  };
  for(const [id,card] of Object.entries(cards))card.dataset.nodeId=id;
  const paths={
    r1:makeListable('nm-network-edge'),
    r2:makeListable('nm-network-edge')
  };
  for(const [id,path] of Object.entries(paths))path.dataset.relationId=id;

  const stageNames=new Set();
  const stage={
    classList:{
      add:name=>stageNames.add(name),
      remove:name=>stageNames.delete(name),
      contains:name=>stageNames.has(name)
    },
    querySelectorAll(selector){
      if(selector==='.nm-network-card')return Object.values(cards);
      if(selector==='.nm-network-edge')return Object.values(paths);
      if(selector==='svg path:not(.nm-network-edge)')return [];
      if(selector==='.nm-network-label, .nm-network-label-plate')return [];
      if(selector==='.nm-network-edge, path')return Object.values(paths);
      return [];
    }
  };
  api.applyNetworkNeighborhood(stage,index,'a');
  assert.equal(stage.classList.contains('nm-network-neighborhood-active'),true);
  assert.equal(cards.a.classList.contains('is-neighborhood-active'),true);
  assert.equal(cards.b.classList.contains('is-neighborhood-neighbor'),true);
  assert.equal(cards.root.classList.contains('is-neighborhood-neighbor'),true);
  assert.equal(cards.lone.classList.contains('is-neighborhood-dimmed'),true);
  assert.equal(paths.r1.classList.contains('is-neighborhood-edge'),true);
  api.clearNetworkNeighborhood(stage);
  assert.equal(stage.classList.contains('nm-network-neighborhood-active'),false);
  assert.equal(cards.a.classList.contains('is-neighborhood-active'),false);
});

test('premium evolution stylesheet scopes org/tree/network chrome with shared tokens',()=>{
  const styles=from('linked-view-styles.js');
  for(const needle of [
    'nm-hierarchy-hidden-badge','nm-tree-mark','is-neighborhood-edge',
    'nm-hierarchy-edge','data-tree-tier','--gv-shadow-card'
  ])assert.ok(styles.includes(needle),needle);
  assert.match(styles,/prefers-reduced-motion/);
});
