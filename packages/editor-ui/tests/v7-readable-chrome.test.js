'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'..');
const skinCode=fs.readFileSync(path.join(base,'workspace-skins.js'),'utf8');
const guideCode=fs.readFileSync(path.join(base,'first-steps.js'),'utf8');
const core=require('../ui-skin-core');
class Element{
 constructor(tag='div',all=null){this.tagName=tag.toUpperCase();this.children=[];
  this.id='';this.dataset={};this.options=[];this.attributes={};this.listeners={};
  this.style={};this.textContent='';this.title='';this.value='';this.open=false;this.all=all;
  this.focused=false;this.className='';}
 append(...children){for(const child of children){this.children.push(child);child.parentElement=this;}
  if(this.tagName==='SELECT')this.options=this.children;}
 insertAdjacentElement(where,node){if(!this.parentElement)throw Error('Missing parent');
  const siblings=this.parentElement.children,index=siblings.indexOf(this);
  siblings.splice(where==='afterend'?index+1:index,0,node);node.parentElement=this.parentElement;}
 addEventListener(name,callback){(this.listeners[name]??=[]).push(callback);}
 click(){for(const listener of this.listeners.click||[])listener();}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name]??null;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){
  const upper=selector.toUpperCase(),result=[];
  function walk(node){for(const child of node.children){
   if(child.tagName===upper)result.push(child);walk(child);
  }}walk(this);return result;
 }
 showModal(){this.open=true;}
 close(){this.open=false;for(const callback of this.listeners.close||[])callback();}
 focus(){this.focused=true;}
}
function fixture(){
 const all=[];const createElement=tag=>{const item=new Element(tag,all);all.push(item);return item;};
 const body=createElement('body'),head=createElement('head');
 const document={body,head,documentElement:{lang:'it'},
  getElementById:id=>all.find(n=>n.id===id)||null,createElement};
 const anchor=createElement('section');anchor.id='nm-orbit-desktop-settings';body.append(anchor);
 const button=createElement('button');button.id='nm7-guide-open';body.append(button);
 class App{constructor(){this.state={root:{id:'root',text:'Original',children:[]}};}bindUI(){}}
 const store={},root={document,localStorage:{getItem:k=>store[k]||null,
  setItem:(k,v)=>{store[k]=v}},NeuroMapUISkinCore:core,
  NeuroMapOrbit:{get:()=>({enabled:true}),set:()=>{}}};
 vm.runInNewContext(skinCode,root);vm.runInNewContext(guideCode,root);
 root.NeuroMapUISkinInstall(App);root.NeuroMapFirstStepsInstall(App);
 const app=new App();app.bindUI();
 return {app,root,document,button,store};
}
test('existing skin panel contains one opt-in readability selector',()=>{
 const f=fixture();
 const selector=f.document.getElementById('nm-ui-skin-readability');
 assert.ok(selector);assert.equal(selector.value,'standard');
 assert.equal(selector.options.length,2);
 f.app.bindUI();
 assert.equal(f.document.body.children.filter(x=>x.id==='nm-ui-skin-settings').length,1);
});
test('comfortable mode is persistent chrome preference, never a map mutation',()=>{
 const f=fixture(),before=JSON.stringify(f.app.state);
 const settings=f.root.NeuroMapUISkin.set({readability:'comfortable',contrast:'high'});
 assert.equal(settings.readability,'comfortable');
 assert.equal(f.document.body.dataset.nmSkinReadability,'comfortable');
 assert.equal(f.document.body.dataset.nmSkinContrast,'high');
 assert.match(f.store[core.STORAGE_KEY],/comfortable/);
 assert.equal(JSON.stringify(f.app.state),before);
 assert.equal(f.root.NeuroMapUISkin.set({readability:'standard'}).readability,'standard');
});
test('guide opens only on explicit click, has named modal and returns focus on close',()=>{
 const f=fixture(),dialog=f.document.getElementById('nm7-guide-dialog');
 assert.ok(dialog);assert.equal(dialog.open,false);
 assert.equal(dialog.getAttribute('role'),'dialog');
 assert.equal(dialog.getAttribute('aria-labelledby'),'nm7-guide-title');
 f.button.click();assert.equal(dialog.open,true);
 assert.equal(f.document.getElementById('nm7-guide-steps').children.length,3);
 assert.ok(f.document.getElementById('nm7-guide-close').focused);
 f.document.getElementById('nm7-guide-close').click();
 assert.equal(dialog.open,false);assert.ok(f.button.focused);
});
test('guide localizes English/Italian UI without changing Unicode user text',()=>{
 const f=fixture();
 const original='علم الأعصاب · 脑图 · न्यूरॉन · 🧠';
 f.app.state.root.text=original;
 f.document.documentElement.lang='en';f.button.click();
 assert.match(f.document.getElementById('nm7-guide-title').textContent,/Start in three steps/);
 assert.match(f.document.getElementById('nm7-guide-note').textContent,/Comfortable/);
 assert.equal(f.app.state.root.text,original);
 f.document.getElementById('nm7-guide-close').click();
 f.document.documentElement.lang='it';f.button.click();
 assert.match(f.document.getElementById('nm7-guide-title').textContent,/Comincia in tre gesti/);
 assert.equal(f.app.state.root.text,original);
});
test('guide mounting and repeated UI binds do not duplicate event listeners',()=>{
 const f=fixture();
 const count=f.button.listeners.click.length;
 f.app.bindUI();f.app.bindUI();
 assert.equal(f.button.listeners.click.length,count);
 assert.equal(f.document.body.children.filter(x=>x.id==='nm7-guide-dialog').length,1);
});

test('theme and readability CSS mounts once instead of being silently unused',()=>{
 const f=fixture(),style=f.document.getElementById('nm-ui-skin-styles');
 assert.ok(style);assert.match(style.textContent,/min-height:44px/);
 f.app.bindUI();f.app.bindUI();
 assert.equal(f.document.head.children.filter(n=>n.id==='nm-ui-skin-styles').length,1);
 assert.equal(f.document.getElementById('nm-ui-theme-label').textContent,'Tema');
 assert.equal(f.document.getElementById('nm-ui-contrast-label').textContent,'Contrasto');
 f.document.documentElement.lang='en';f.root.NeuroMapUISkin.set({});
 assert.equal(f.document.getElementById('nm-ui-theme-label').textContent,'Theme');
 assert.equal(f.document.getElementById('nm-ui-contrast-label').textContent,'Contrast');
});
