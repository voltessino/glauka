'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
class FakeElement {
 constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.dataset={};
  this.style={setProperty(key,value){this[key]=value}};this.attributes={};this.value='';this.hidden=false;this.scrollTop=0;
  this.clientHeight=600;this.clientWidth=340;
  this.classList={add(){},remove(){},contains(){return false}};}
 append(...items){this.children.push(...items)}
 replaceChildren(...items){this.children=[];this.append(...items)}
 addEventListener(key,fn){this.listeners[key]=fn}
 setAttribute(key,value){this.attributes[key]=String(value)}
 focus(){}select(){}replaceWith(){}
 get firstElementChild(){return this.children[0]||null}
 get lastElementChild(){return this.children.at(-1)||null}
 querySelector(){return null}querySelectorAll(){return []}
}

test('1000 synthetic desktop layouts × four Knowledge panel modes',()=>{
 const previous={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,
  NeuroMapKnowledgeCore:globalThis.NeuroMapKnowledgeCore};
 globalThis.NeuroMapKnowledgeCore=require('../../../apps/desktop-shared/editor/knowledge-core.js');
 globalThis.document={documentElement:{lang:'it'},head:new FakeElement('head'),body:new FakeElement('body'),
  createElement:tag=>new FakeElement(tag),createElementNS:(_ns,tag)=>new FakeElement(tag),createDocumentFragment:()=>new FakeElement('fragment'),
  getElementById:()=>null};
 globalThis.requestAnimationFrame=fn=>{fn();return 1};
 try {
  // Evaluated once in this isolated Node test process; does not mount on real DOM.
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const dir=path.join(__dirname,'../../../apps/desktop-shared/editor');
  const knowledge=fs.readFileSync(path.join(dir,'knowledge-ui.js'),'utf8')
    .replace('/* @neuromap-knowledge-ui-draw */\n',
      fs.readFileSync(path.join(dir,'knowledge-ui-draw.js'),'utf8'));
  vm.runInThisContext(knowledge,{filename:'knowledge-ui.js'});
  class App {
   bindUI(){}renderTabBar(){}markChanged(){}selectNode(id){this.state.selectedNodeId=id}
   activateTab(){}undo(){}redo(){}
  }
  globalThis.NeuroMapKnowledgeUI.install(App);
  const app=new App();
  app.hideMenus=()=>{};app.scheduleSave=()=>{};app.canvas={clientWidth:1366,clientHeight:900};
  app.bindUI();
  for(let i=0;i<1000;i++){
   const root={id:'root'+i,text:'User '+i,children:Array.from({length:2+i%55},(_,j)=>({
    id:'node'+i+'-'+j,text:'concept '+j,collapsed:j%7===0,children:[]}))};
   app.state={root,selectedNodeId:root.id};app.activeTabId='tab'+i;
   app.tabs=[{id:app.activeTabId,title:'Main',state:app.state},
    {id:'other'+i,title:'Extra',state:{root:{id:'peer'+i,text:'Archive',children:[]}}}];
   app.studyCards=i%3===0?[{sourceTabId:app.activeTabId,sourceNodeId:root.children[0].id,
    sr:{reviews:2,lapses:i%2,dueAt:100}}]:[];
   const original=JSON.stringify(root);
   for(const mode of ['outline','atlas','journey','radar'])app._nmKnowledge.open(mode);
   assert.equal(JSON.stringify(root),original,'panel must not mutate node data for persona '+i);
  }
  assert.equal(globalThis.document.body.children.length,1);
  assert.equal(globalThis.document.body.children[0].hidden,false);
 }finally {
  globalThis.document=previous.document;
  globalThis.requestAnimationFrame=previous.requestAnimationFrame;
  globalThis.NeuroMapKnowledgeCore=previous.NeuroMapKnowledgeCore;
 }
});
