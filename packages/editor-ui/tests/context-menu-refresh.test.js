'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/context-menu-refresh.js'),'utf8');
class Element{
 constructor(tag='div',id=''){
  this.tag=tag;this.id=id;this.children=[];this.parent=null;
  this.dataset={};this.attributes={};this.events={};this.style={setProperty(k,v){this[k]=v},getPropertyValue(k){return this[k]||''}};
  this.classList={set:new Set(),add(x){this.set.add(x)},remove(x){this.set.delete(x)},contains(x){return this.set.has(x)},toggle(x,on){if(on===undefined)on=!this.set.has(x);if(on)this.set.add(x);else this.set.delete(x);return on}};
  this._text='';this.open=false;this.offsetWidth=350;this.scrollHeight=400;
 }
 set className(v){for(const name of String(v).split(/\s+/).filter(Boolean))this.classList.add(name);}
 get className(){return [...this.classList.set].join(' ');}
 set textContent(v){this._text=String(v);this.children=[];}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 append(...items){for(const child of items){if(child.parent)child.parent.children=child.parent.children.filter(x=>x!==child);child.parent=this;this.children.push(child);}}
 prepend(...items){for(const child of [...items].reverse()){if(child.parent)child.parent.children=child.parent.children.filter(x=>x!==child);child.parent=this;this.children.unshift(child);}}
 get firstChild(){return this.children[0]||null;}
 contains(el){return this===el||this.children.some(child=>child.contains(el));}
 getBoundingClientRect(){return {left:parseFloat(this.style.left)||0,top:parseFloat(this.style.top)||0,width:this.offsetWidth,height:Math.min(this.scrollHeight,704)}}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,cb){this.events[k]=cb;}
 querySelectorAll(selector){
  if(selector.includes(','))return [...new Set(selector.split(',').flatMap(part=>this.querySelectorAll(part.trim())))];
  if(selector.includes(' > ')){
   const parts=selector.split(' > ').map(s=>s.trim());
   let roots=parts[0]===':scope'?[this]:this.querySelectorAll(parts.shift());
   if(parts[0]===':scope')parts.shift();
   for(const part of parts)roots=roots.flatMap(n=>n.children.filter(e=>matches(e,part)));
   return roots;
  }
  const result=[];const traverse=e=>{for(const child of e.children){if(matches(child,selector))result.push(child);traverse(child);}};
  traverse(this);return result;
 }
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function matches(el,selector){return selector.startsWith('.')?el.classList.contains(selector.slice(1)):
 selector.startsWith('#')?el.id===selector.slice(1):el.tag===selector;}
function fixture(){
 const ids=new Map();
 function node(tag,id='',className=''){const e=new Element(tag,id);e.className=className;if(id)ids.set(id,e);return e;}
 const d={documentElement:{lang:'it'},getElementById:id=>ids.get(id)||menu.querySelector("#"+id)||null,createElement:tag=>node(tag)};
 const menu=node('div','context-menu','hidden'),head=node('div','','ctx-header');
 const main=node('div','ctx-group-node'),image=node('div','ctx-group-image','hidden');
 const canvas=node('div','ctx-group-canvas','hidden');
 menu.append(head,main,image,canvas);
 const names=['Nodo e contenuti','Assistente AI','Struttura e disposizione','Appunti e operazioni'];
 const groups=names.map(text=>{
  const details=node('details','','nm70-menu-group'),summary=node('summary');
  summary.textContent=text;const items=node('div','','nm70-menu-items');
  details.append(summary,items);main.append(details);return items;
 });
 const calls={};
 function button(id,parent){const b=node('button',id,'ctx-item'),s=node('span');s.textContent=id;b.append(s);
  calls[id]=()=>id;b.addEventListener('click',calls[id]);parent.append(b);return b;}
 for(const id of ['ctx-add-child','ctx-add-sibling','ctx-edit-text','ctx-add-image'])button(id,groups[0]);
 button('btn-ai-expand',groups[1]);
 for(const id of ['ctx-cut','ctx-copy','ctx-paste'])button(id,groups[3]);
 button('ctx-delete-node',main);
 button('ctx-canvas-new-floating',canvas);button('ctx-canvas-center',canvas);
 node('div','ctx-canvas-heading');node('div','ctx-canvas-hint');
 node('div','ctx-node-title');node('div','ctx-header-type');
 const extra=node('div','','v5-context-extra');button('v5-ctx-promote',extra);main.append(extra);
 for(const id of ['ctx-img-toggle-mode','ctx-img-reset-aspect','ctx-img-toggle-zlayer',
  'ctx-img-cut','ctx-img-copy','ctx-img-paste','ctx-img-delete'])button(id,image);
 const storage={value:'it'};
 const window={document:d,innerWidth:900,innerHeight:720,addEventListener(){},
  localStorage:{getItem(){return storage.value}}};
 vm.runInNewContext(source,{window});
 class App{
  constructor(){this.renderer={screenToWorld:(x,y)=>({x:x-10,y:y-20})};
   this.created=[];this.fitted=0;}
  bindUI(){}
  showContextMenu(){menu.classList.remove('hidden');main.classList.remove('hidden');}
  hideMenus(){menu.classList.add('hidden');}
  createFloatingTopicAt(x,y){this.created.push({x,y});}
  fitWholeMap(){this.fitted++;}
 }
 window.NeuroMapContextRefresh.install(App);
 const app=new App();
 return {app,window,ids,menu,main,image,canvas,groups,extra,calls,storage};
}
test('existing callbacks and all contextual actions survive a one-time restyle',()=>{
 const f=fixture();f.app.bindUI();f.app.bindUI();
 assert.equal(f.menu.dataset.nmContextRefresh,'1');
 assert.equal(f.main.querySelectorAll('.nm-context-quick').length,1);
 assert.deepEqual(f.main.querySelector('#nm-context-primary-node').children.map(x=>x.id),
   ['ctx-add-child','ctx-add-sibling','ctx-edit-text']);
 assert.deepEqual(f.main.querySelector('#nm-context-editbar-node').children.map(x=>x.id),
   ['ctx-cut','ctx-copy','ctx-paste','ctx-delete-node']);
 assert.equal(f.ids.get('ctx-add-child').events.click,f.calls['ctx-add-child']);
 assert.ok(f.groups[2].children.includes(f.extra),'V5 actions remain inside Structure');
 assert.equal(f.main.querySelectorAll('.nm-context-section').length,4);
 for(const sec of f.main.querySelectorAll('.nm-context-section'))assert.equal(sec.open,true);
});
test('all image actions remain accessible and deletion sits in editbar',()=>{
 const f=fixture();f.app.bindUI();
 assert.deepEqual(f.image.querySelector('#nm-context-primary-image').children.map(x=>x.id),
  ['ctx-img-toggle-mode','ctx-img-reset-aspect']);
 assert.deepEqual(f.image.querySelector('#nm-context-editbar-image').children.map(x=>x.id),
  ['ctx-img-cut','ctx-img-copy','ctx-img-paste','ctx-img-delete']);
 const sections=f.image.querySelectorAll('.nm-context-image-section');
 assert.equal(sections.length,2);
 assert.deepEqual(sections[0].querySelectorAll('button').map(x=>x.id),
  ['ctx-img-toggle-zlayer']);
 for(const sec of sections)assert.equal(sec.open,true);
});
test('menu switches language and clamps to the screen edge',()=>{
 const f=fixture();f.app.bindUI();
 f.storage.value='en';f.app.showContextMenu(860,700,{type:'node'});
 assert.equal(f.ids.get('ctx-add-child').querySelector('span').textContent,'＋ Child');
 assert.equal(f.menu.style.left,'538px');
 assert.equal(f.menu.style.top,'308px');
 assert.equal(f.menu.attributes.role,'region');
});

test('empty-canvas context shows only its own actions and preserves world coordinates',()=>{
 const f=fixture();f.app.bindUI();f.app.showContextMenu(410,260,null);
 assert.equal(f.canvas.classList.contains('hidden'),false);
 assert.equal(f.main.classList.contains('hidden'),true);
 assert.equal(f.image.classList.contains('hidden'),true);
 f.ids.get('ctx-canvas-new-floating').events.click();
 assert.deepEqual(f.app.created,[{x:400,y:240}]);
 assert.equal(f.menu.classList.contains('hidden'),true);
 f.app.showContextMenu(220,200,{type:'node'});
 assert.equal(f.canvas.classList.contains('hidden'),true);
 assert.equal(f.main.classList.contains('hidden'),false);
 f.app.showContextMenu(320,250,null);
 f.ids.get('ctx-canvas-center').events.click();
 assert.equal(f.app.fitted,1);
});
test('canvas actions localize to English and never replace node handlers',()=>{
 const f=fixture();f.app.bindUI();f.storage.value='en';
 f.app.showContextMenu(300,200,null);
 assert.match(f.ids.get('ctx-canvas-new-floating').querySelector('span').textContent,/New floating topic/);
 assert.match(f.ids.get('ctx-canvas-center').querySelector('span').textContent,/Fit whole map/);
 assert.equal(f.ids.get('ctx-add-child').events.click,f.calls['ctx-add-child']);
});
