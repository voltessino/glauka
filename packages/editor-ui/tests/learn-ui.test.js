'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../../apps/desktop-shared/editor/learn-core');
const UI=(fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/learn-ui.js'),'utf8').replace('/* @neuromap-learn-ui-session */\n',fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/learn-ui-session.js'),'utf8')));
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.handlers={};this.parent=null;
  this.hidden=false;this.id='';this.textContent='';this.value='';this.attributes={};this.style={};
  const set=new Set();this.classList={add:x=>set.add(x),remove:x=>set.delete(x),
   contains:x=>set.has(x),toggle:(x,force)=>{if(force===undefined? !set.has(x):force)set.add(x);else set.delete(x);}};
 }
 append(...items){for(const item of items){this.children.push(item);item.parent=this;}}
 get lastElementChild(){return this.children.at(-1)}
 replaceChildren(...items){this.children=[];this.append(...items)}
 addEventListener(type,callback){(this.handlers[type]??=[]).push(callback)}
 setAttribute(name,value){this.attributes[name]=value}
 removeAttribute(name){delete this.attributes[name]}
 focus(){this.focused=true}
 contains(node){return this===node||this.children.some(c=>c.contains(node))}
 querySelectorAll(selector){
  const result=[];const walk=e=>{if(selector==='button'&&e.tag==='button')result.push(e);
   for(const c of e.children)walk(c)};
  walk(this);return result;
 }
 click(){for(const f of this.handlers.click||[])f({target:this,preventDefault(){},stopPropagation(){}})}
}
function fixture(){
 const root={id:'r',text:'Organs',children:[
  {id:'a',text:'Heart',parentId:'r',notes:'Pumps blood',
   children:[{id:'a1',text:'Atrium',parentId:'a',children:[]}]},
  {id:'b',text:'Kidney',parentId:'r',notes:'Filters',children:[]},
  {id:'c',text:'Liver',parentId:'r',children:[]},
  {id:'d',text:'Lung',parentId:'r',children:[]}
 ]};
 const before=JSON.stringify(root);
 const body=new Element('body'),head=new Element('head'),dock=new Element('nav');
 dock.id='nm614-right-dock';body.append(dock);
 const inspector=new Element('aside');inspector.id='inspector-sidebar';body.append(inspector);
 const doc={head,body,documentElement:{lang:'it'},
  createElement:tag=>new Element(tag),
  getElementById(id){const find=e=>e.id===id?e:e.children.map(find).find(Boolean);
   return find(this.body)||find(this.head)||null},
  querySelector(selector){if(selector==='.v4-toolstrip')return dock;return null},
  handlers:{},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)}
 };
 const globals={NeuroMapLearningCore:Core,addEventListener(){}};
 const drawn=[];
 class Renderer{
  drawIllustratedLabel(ctx,node){drawn.push(node.text)}
 }
 class App{
  constructor(){
   this.activeTabId='t';this.studyCards=[];this.learningAttempts=[];
   this.state={root,selectedNodeId:'r',isDirty:false,
    findNode(id){let stack=[root];while(stack.length){const n=stack.pop();if(n.id===id)return n;stack.push(...n.children)}return null}};
   this.renderer=new Renderer();this.renderer.camera={x:0,y:0,zoom:1};this.canvas=new Element('canvas');
   this.canvas.clientWidth=900;this.canvas.clientHeight=600;
   this.saved=0;this.rendered=0;this.requests=0;this._desktopUserEdited=false;
  }
  bindUI(){}
  requestRender(){this.requests++}
  closeEditor(){}
  renderTabBar(){this.rendered++}
  scheduleSave(){this.saved++}
  v5Signature(node){return node.text}
  v5Staleness(){return 'fresh'}
  findHit(){return {type:'node',item:this.state.findNode('a')}}
  activateTab(id){this.activeTabId=id}
  closeTab(){}
 }
 new Function('globalThis','document',UI)(globals,doc);
 globals.NeuroMapLearningUI.install(App,Renderer);
 const app=new App();app.bindUI();
 const byId=id=>doc.getElementById(id);
 const match=(parent,tag,text)=>parent.querySelectorAll(tag).find(e=>e.textContent===text);
 const event=(name,x=10,y=10)=>{
  const ev={type:name,pointerId:1,button:0,clientX:x,clientY:y,preventDefault(){this.prevented=true},
   stopImmediatePropagation(){this.stopped=true}};
  for(const fn of app.canvas.handlers[name]||[])fn(ev);
  return ev;
 };
 const drawing=()=>{app.renderer.drawIllustratedLabel({
  save(){},restore(){},fillText:v=>drawn.push(v)},root.children[0],{x:0,y:0,fontSize:14},0)};
 return {app,root,before,doc,inspector,byId,match,event,drawn,drawing,globals};
}
test('canvas labels are paint-only masks; click reveals without node edits',()=>{
 const {app,root,before,byId,match,event,drawn,drawing}=fixture();
 byId('nm-learn-open').click();
 const panel=byId('nm-learn-panel');
 match(panel,'button','Nascondi concetti').click();
 assert.equal(app.renderer._nmLearnRecall.hiddenIds.size,5);
 drawing();assert.equal(drawn.at(-1),'?');
 event('pointerdown');event('pointerup');assert.equal(app.renderer._nmLearnRecall.hiddenIds.has('a'),false);
 drawing();assert.equal(drawn.at(-1),'Heart');
 assert.equal(JSON.stringify(root),before);
 assert.equal(app.state.isDirty,false);assert.equal(app.saved,0);
});
test('quiz from existing map results in durable attempt without modifying map',()=>{
 const {app,before,root,byId,match}=fixture();
 byId('nm-learn-open').click();
 const panel=byId('nm-learn-panel');
 match(panel,'button','Quiz').click();
 match(panel,'button','Inizia quiz').click();
 let choice=panel.querySelectorAll('button').find(b=>b.parent?.className==='nm-learn-options');
 if(!choice)choice=panel.querySelectorAll('button').find(b=>b.textContent==='Mostra risposta');
 assert.ok(choice);
 choice.click();
 if(choice.textContent==='Mostra risposta'){
  match(panel,'button','✓ Ricordato').click();
 }
 assert.equal(app.learningAttempts.length,1);
 assert.equal(app.saved,1);assert.equal(app.state.isDirty,true);
 assert.equal(JSON.stringify(root),before);
});
test('active recall is closed when switching maps',()=>{
 const {app,byId,match}=fixture();
 byId('nm-learn-open').click();
 const panel=byId('nm-learn-panel');
 match(panel,'button','Nascondi concetti').click();
 assert.ok(app.renderer._nmLearnRecall);
 app.activateTab('other');
 assert.equal(app.renderer._nmLearnRecall,null);
 assert.equal(panel.hidden,true);
});
test('quiz commands stay outside the scrolling question',()=>{
 const {byId}=fixture();
 byId('nm-learn-open').click();
 const panel=byId('nm-learn-panel');
 const commands=panel.children.find(c=>String(c.className).includes('nm-learn-commands'));
 assert.ok(commands);
 assert.match(commands.className,/nm-panel-fixed/);
 assert.ok(commands.children.some(c=>String(c.className).includes('nm-learn-tabs')));
 assert.equal(commands.children.some(c=>c.className==='nm-learn-quiz'),false);
});
test('refusing to leave keeps the open quiz',()=>{
 const {app,byId,match,globals}=fixture();
 let asked=0;
 globals.confirm=()=>{asked++;return false};
 byId('nm-learn-open').click();
 const panel=byId('nm-learn-panel');
 match(panel,'button','Quiz').click();
 match(panel,'button','Inizia quiz').click();
 byId('nm-learn-close').click();
 assert.equal(asked,1);
 assert.equal(panel.hidden,false);
 assert.ok(app._nmLearning.quiz);
});
