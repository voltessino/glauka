'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('each of the seven views exposes the same hint in the tooltip and in both languages',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../view-picker.js'),'utf8');
  const ids=new Map();
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.hidden=false;this.textContent='';this.className='';this.value='mindmap';this.options=[];this.dataset={};this.attributes={};this._listeners={};}
    set id(value){this._id=value;ids.set(value,this)}
    get id(){return this._id}
    append(...nodes){this.children.push(...nodes)}
    replaceChildren(){this.children=[]}
    setAttribute(k,v){this.attributes[k]=String(v)}
    getAttribute(k){return this.attributes[k]}
    addEventListener(){}
    after(node){node.parent=this}
    querySelector(selector){
      const stack=[...this.children];
      while(stack.length){
        const node=stack.shift();
        if(selector.startsWith('[')&&node.getAttribute(selector.slice(1,selector.indexOf('=')))===selector.slice(selector.indexOf('=')+1).replace(/[[\]"]/g,''))return node;
        stack.push(...node.children);
      }
      return null;
    }
    style={}
    focus(){}
    getBoundingClientRect(){return {left:20,top:40,width:160,height:36,right:180,bottom:76}}
    querySelector(){return null}
  }
  const document={
    documentElement:{lang:'it'},
    head:new Element('head'),
    body:new Element('body'),
    getElementById:id=>ids.get(id)||null,
    createElement:tag=>new Element(tag),
    createElementNS:()=>new Element('svg'),
    addEventListener(){}
  };
  document.head.append=function(node){if(node.id)ids.set(node.id,node)};
  document.body.append=()=>{};
  const context={document,globalThis:null,innerWidth:800,innerHeight:600,addEventListener(){}};
  context.globalThis=context;
  vm.runInNewContext(source,context,{filename:'view-picker.js'});
  const select=new Element('select');
  select.id='nm-view-picker';
  const modes=[
    ['mindmap','Mappa mentale','Mind map','Idee intorno a un centro','Ideas around a center'],
    ['orgchart','Organigramma','Org chart','Una gerarchia dall’alto in basso','A hierarchy from top to bottom'],
    ['concept-tree','Albero concettuale','Concept tree','Dal generale al dettaglio','From overview to detail'],
    ['concept-network','Rete concettuale','Concept network','Concetti e relazioni','Concepts and relationships'],
    ['flowchart','Flusso di lavoro','Flowchart','Passaggi e decisioni','Steps and decisions'],
    ['kanban','Bacheca Kanban','Kanban board','Attività divise per stato','Tasks grouped by status'],
    ['timeline','Linea del tempo','Timeline','Attività disposte per data','Tasks arranged by date']
  ];
  select.options=modes.map(([value,it])=>({value,textContent:it}));
  context.NeuroMapViewPicker.create(select);
  const trigger=ids.get('nm-view-picker-trigger');
  const gallery=ids.get('nm-view-picker-gallery');
  const choices=()=>gallery.children.find(node=>node.className==='nm-view-gallery').children;
  trigger.onclick();
  assert.equal(choices().length,7);
  for(const [value,,,itHint] of modes){
    const choice=choices().find(node=>node.dataset.view===value);
    assert.ok(choice,value);
    assert.match(choice.title,new RegExp(itHint.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(trigger.title,/Idee intorno a un centro/);
  document.documentElement.lang='en';
  select.options=modes.map(([value,,en])=>({value,textContent:en}));
  select.value='timeline';
  select.dispatchEvent=()=>{};
  trigger.onclick();
  trigger.onclick();
  for(const [value,,,,enHint] of modes){
    const choice=choices().find(node=>node.dataset.view===value);
    assert.match(choice.title,new RegExp(enHint.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(trigger.title,/Tasks arranged by date/);
});
