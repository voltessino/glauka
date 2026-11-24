const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../orbit-core');

function harness(saved=null){
 const elements=new Map(),listeners={},storage=new Map(saved?[ [core.STORAGE_KEY,saved] ]:[]);
 let document;
 class Node {
   constructor(tag='div'){
     this.tagName=tag.toLowerCase();this.children=[];this.parentElement=null;
     this.dataset={};this.attributes={};this._listeners={};this.className='';
     this.hidden=false;this.disabled=false;this.textContent='';this.value='';
     this.style={};this.type='';this.isConnected=true;
   }
   get classList(){const node=this;return {
     contains:cls=>node.className.split(' ').includes(cls),
     toggle:(cls,on)=>{const has=node.className.split(' ').includes(cls),enabled=on===undefined?!has:!!on;
       node.className=node.className.split(' ').filter(x=>x&&x!==cls).concat(enabled?[cls]:[]).join(' ');
       return enabled;}
   }}
   set id(value){this._id=value;if(value)elements.set(value,this)}
   get id(){return this._id||''}
   get options(){return this.children.filter(c=>c.tagName==='option')}
   append(...children){for(const c of children){c.parentElement=this;this.children.push(c)}}
   prepend(...children){for(const c of children)c.parentElement=this;this.children.unshift(...children)}
   insertBefore(item,before){const i=this.children.indexOf(before);
     if(i===-1)this.append(item);else{this.children.splice(i,0,item);item.parentElement=this}}
   insertAdjacentElement(where,el){
     if(where!=='afterend'||!this.parentElement)throw Error('Bad insertion');
     const group=this.parentElement,i=group.children.indexOf(this);
     group.children.splice(i+1,0,el);el.parentElement=group;
   }
   replaceChildren(...children){this.children=[];this.append(...children)}
   setAttribute(k,v){this.attributes[k]=String(v)}
   getAttribute(k){return this.attributes[k]??null}
   addEventListener(k,fn){(this._listeners[k]??=[]).push(fn)}
   dispatch(k,e={}){for(const fn of this._listeners[k]||[])fn(e)}
   click(){this.calls=(this.calls||0)+1;this.dispatch('click',{target:this})}
   focus(){document.activeElement=this}
   scrollIntoView(){}
   querySelector(selector){return this.querySelectorAll(selector)[0]||null}
   querySelectorAll(selector){
     const selectors=selector.split(',').map(s=>s.trim()),nodes=[];
     const matches=n=>selectors.some(s=>s[0]==='.'?n.className.split(' ').includes(s.slice(1)):
       s[0]==='#'?n.id===s.slice(1):n.tagName===s);
     const stack=[...this.children];while(stack.length){const n=stack.shift();if(matches(n))nodes.push(n);stack.push(...n.children)}
     return nodes;
   }
 }
 document={
   body:new Node('body'),head:new Node('head'),documentElement:{lang:'it'},
   activeElement:null,
   createElement:tag=>new Node(tag),
   getElementById:id=>elements.get(id)||null,
   querySelector:selector=>document.body.querySelector(selector),
   addEventListener:(event,callback)=>(listeners[event]??=[]).push(callback)
 };
 const top=new Node('header');top.className='top-chrome';document.body.append(top);
 const bar=new Node('div');bar.className='tab-bar';top.append(bar);
 const fullscreen=new Node('button');fullscreen.id='btn-fullscreen';bar.append(fullscreen);
 const sidebar=new Node('aside');sidebar.id='inspector-sidebar';document.body.append(sidebar);
 const header=new Node('div');header.className='inspector-header';sidebar.append(header);
 const commandIds=['btn-new-tab','menu-save-file','menu-save-file-as','menu-undo','menu-add-child','btn-spotlight','btn-ai-settings'];
 for(const id of commandIds){const node=new Node('button');node.id=id;document.body.append(node)}
 const fakeStorage={getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,val)};
 const sandbox={document,localStorage:fakeStorage,NeuroMapOrbitCore:core,console,globalThis:null};sandbox.globalThis=sandbox;
 const code=fs.readFileSync(path.join(__dirname,'../orbit-workspace.js'),'utf8');
 vm.runInNewContext(code,sandbox,{filename:'orbit-workspace.js'});
 class App {bindUI(){this.bound=true}}
 sandbox.NeuroMapOrbitInstall(App);
 const app=new App();app.state={root:{id:'r',text:'original'},undoStack:[]};
 app.bindUI();
 function key(k,opts={}){
   const e={key:k,ctrlKey:!!opts.ctrlKey,shiftKey:!!opts.shiftKey,altKey:false,
     isComposing:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},
     stopPropagation(){},stopImmediatePropagation(){}};
   for(const fn of listeners.keydown||[])fn(e);
   return e;
 }
 return {app,document,sandbox,storage,elements,key,Node};
}
test('Orbit starts in Classic with only theme selection and command deck, not redundant switches',()=>{
 const {app,document,sandbox}=harness();
 const snapshot=JSON.stringify(app.state),orbit=sandbox.NeuroMapOrbit;
 assert.deepEqual({...orbit.get()},{enabled:false,accent:'auto',density:'comfortable'});
 assert.equal(document.body.classList.contains('nm-orbit-workspace'),false);
 assert.ok(document.getElementById('nm-orbit-desktop-settings'));
 assert.equal(document.getElementById('nm-orbit-desktop-settings').hidden,true);
 assert.equal(document.getElementById('nm-orbit-quick-toggle'),null);
 assert.equal(document.getElementById('nm-orbit-desktop-toggle'),null);
 assert.ok(document.getElementById('nm-orbit-command-trigger'));
 assert.equal(JSON.stringify(app.state),snapshot);
});
test('desktop appearance and density persist independently of project data',()=>{
 const {app,document,sandbox,storage}=harness(),before=JSON.stringify(app.state);
 sandbox.NeuroMapOrbit.set({enabled:true});
 assert.equal(document.body.classList.contains('nm-orbit-workspace'),true);
 const accent=document.getElementById('nm-orbit-desktop-accent');accent.value='violet';accent.dispatch('change');
 const density=document.getElementById('nm-orbit-desktop-density');density.value='compact';density.dispatch('change');
 assert.equal(document.body.dataset.nmOrbitAccent,'violet');
 assert.equal(document.body.dataset.nmOrbitDensity,'compact');
 assert.deepEqual(JSON.parse(storage.get(core.STORAGE_KEY)),{enabled:true,accent:'violet',density:'compact'});
 assert.equal(JSON.stringify(app.state),before);
 sandbox.NeuroMapOrbit.set({enabled:false});
 assert.equal(document.body.classList.contains('nm-orbit-workspace'),false);
 assert.equal(document.getElementById('nm-orbit-desktop-accent').disabled,true);
});
test('command deck searches approved existing buttons and routes via click',()=>{
 const {app,document,sandbox,key}=harness(),before=JSON.stringify(app.state);
 const e=key('P',{ctrlKey:true,shiftKey:true});
 assert.equal(e.defaultPrevented,true);
 const panel=document.getElementById('nm-orbit-command-overlay');
 assert.equal(panel.hidden,false);
 const search=document.getElementById('nm-orbit-command-search');
 assert.equal(document.activeElement,search);
 search.value='salva con nome';search.dispatch('input');
 const rows=panel.querySelectorAll('.nm-orbit-command-result');
 assert.equal(rows.length,1);
 assert.equal(rows[0].dataset.action,'menu-save-file-as');
 rows[0].click();
 assert.equal(document.getElementById('menu-save-file-as').calls,1);
 assert.equal(panel.hidden,true);
 assert.equal(JSON.stringify(app.state),before);
});
test('Escape closes the deck, Tab stays within it and focus returns to launch button',()=>{
 const {document,key}=harness();
 const launch=document.getElementById('nm-orbit-command-trigger');launch.focus();launch.click();
 const panel=document.getElementById('nm-orbit-command-overlay');
 assert.equal(panel.hidden,false);
 key('Tab');assert.notEqual(document.activeElement,launch);
 const event=key('Escape');assert.equal(event.defaultPrevented,true);
 assert.equal(panel.hidden,true);
 assert.equal(document.activeElement,launch);
});
test('unknown commands and disabled controls never run',()=>{
 const {document,sandbox}=harness(),api=sandbox.NeuroMapOrbit;
 const existing=document.getElementById('menu-save-file');
 existing.disabled=true;
 assert.equal(api.invoke('menu-save-file'),false);
 assert.equal(existing.calls,undefined);
 assert.equal(api.invoke('node:fs'),false);
 assert.equal(api.find('save').some(x=>x.id==='menu-save-file'),false);
});
test('English UI translates presentation labels, not map text or existing commands',()=>{
 const {document,sandbox,app}=harness(),before=app.state.root.text;
 document.documentElement.lang='en';
 sandbox.NeuroMapOrbit.set({enabled:true,accent:'amber'});
 assert.equal(document.getElementById('nm-orbit-desktop-title').textContent,'Theme details');
 assert.equal(document.getElementById('nm-orbit-command-trigger').textContent,'⌘ Commands');
 assert.equal(document.getElementById('nm-orbit-desktop-accent').options[3].textContent,'Solar amber');
 assert.equal(app.state.root.text,before);
});

test('audit: saved cyan remains intentionally selected, with no destructive migration',()=>{
 const saved={enabled:true,accent:'cyan',density:'compact'};
 const {sandbox,storage}=harness(JSON.stringify(saved));
 assert.equal(sandbox.NeuroMapOrbit.get().accent,'cyan');
 assert.deepEqual(JSON.parse(storage.get(core.STORAGE_KEY)),saved);
 assert.equal(storage.get('nm_orbit_theme_accent_v2'),undefined);
 const fresh=harness();
 assert.equal(fresh.sandbox.NeuroMapOrbit.get().accent,'auto');
});
