'use strict';
// Mobile mount contract: Glauka header (not hidden topbar), exclusive overlay, no split.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const view=require('../view-core');
const flow=require('../flow-core');
const work=require('../work-core');
const network=require('../concept-network');
const guided=require('../guided-flow');
const appearance=require('../view-appearance-core');
const composeUiSource=require('./helpers/compose-ui-source.cjs');

function harness({mobile=false,withHeader=true}={}){
  const ids=new Map(),frames=[];
  class Element{
    constructor(tag){
      this.tagName=tag;this.children=[];this.parentElement=null;this.dataset={};
      this.style={setProperty(){},cssText:''};this.attributes={};this._listeners={};
      this.value='';this.hidden=false;this.disabled=false;this.textContent='';this.className='';
      this.options=[];
      this.classList={
        add:v=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),v])].join(' ')},
        remove:v=>{this.className=this.className.split(/\s+/).filter(x=>x&&x!==v).join(' ')},
        toggle:(v,force)=>{
          const has=this.className.split(/\s+/).includes(v);
          const on=force===undefined?!has:!!force;
          this.className=this.className.split(/\s+/).filter(x=>x&&x!==v).concat(on?[v]:[]).join(' ');
          return on;
        },
        contains:v=>this.className.split(/\s+/).includes(v),
      };
    }
    set id(value){this._id=value;ids.set(value,this)}
    get id(){return this._id||''}
    append(...items){
      for(const child of items){
        if(child.parentElement){
          const at=child.parentElement.children.indexOf(child);
          if(at>=0)child.parentElement.children.splice(at,1);
        }
        this.children.push(child);child.parentElement=this;
      }
      if(this.tagName==='select'){this.options=this.children;if(!this.value&&this.options.length)this.value=this.options[0].value||'';}
    }
    prepend(...items){for(let i=items.length-1;i>=0;i--){this.children.unshift(items[i]);items[i].parentElement=this}}
    before(...items){
      if(!this.parentElement)return;
      let index=this.parentElement.children.indexOf(this);
      for(const c of items){this.parentElement.children.splice(index++,0,c);c.parentElement=this.parentElement}
    }
    contains(other){for(let p=other;p;p=p.parentElement)if(p===this)return true;return false}
    setAttribute(name,value){this.attributes[name]=String(value)}
    getAttribute(name){return this.attributes[name]}
    addEventListener(name,fn){(this._listeners[name]??=[]).push(fn)}
    dispatch(name,e={}){for(const fn of this._listeners[name]||[])fn(e)}
    matches(sel){
      return String(sel).split(',').some(item=>{
        const value=item.trim();
        return value[0]==='#'?this.id===value.slice(1):
          value[0]==='.'?this.className.split(' ').includes(value.slice(1)):
          this.tagName===value;
      });
    }
    querySelectorAll(query){
      const parts=query.split(/\s+/),items=[];
      const walk=parent=>{
        for(const child of parent.children){
          if(child.matches(parts.at(-1)))items.push(child);
          walk(child);
        }
      };
      walk(this);return items;
    }
    querySelector(query){return this.querySelectorAll(query)[0]||null}
    replaceChildren(...items){this.children=[];this.append(...items)}
  }
  const body=new Element('body');body.className=mobile?'glauka-mobile-app':'';
  const head=new Element('head');
  const document={
    body,head,documentElement:{lang:'it'},_listeners:{},
    addEventListener(name,fn){(this._listeners[name]??=[]).push(fn)},
    getElementById:id=>ids.get(id)||null,
    createElement:t=>new Element(t),
    createElementNS:(_ns,t)=>new Element(t),
    createDocumentFragment:()=>new Element('fragment'),
    querySelector(query){
      if(query==='.topbar.nm-ribbon'||query==='.topbar')return ids.get('topbar')||null;
      if(query==='.hud-bottom-left')return ids.get('hud')||null;
      if(query[0]==='#'&&!/[ >,+]/.test(query))return ids.get(query.slice(1))||null;
      return body.querySelector(query);
    },
    querySelectorAll:query=>body.querySelectorAll(query),
  };
  const topbar=new Element('div');topbar.id='topbar';topbar.className='topbar nm-ribbon';body.append(topbar);
  const hud=new Element('section');hud.id='hud';hud.className='hud-bottom-left';body.append(hud);
  if(!mobile){
    const layouts=new Element('div');layouts.id='nm-layout-modes';hud.append(layouts);
  }
  if(mobile&&withHeader){
    const header=new Element('header');header.id='glauka-app-header';
    const ai=new Element('button');ai.id='glauka-ai-open';
    header.append(ai);body.append(header);
  }
  let dismissed=0;
  const context={
    document,window:{innerWidth:mobile?390:1200,addEventListener(){}},
    NeuroMapViewCore:view,NeuroMapFlowCore:flow,NeuroMapWorkCore:work,
    NeuroMapConceptNetwork:network,NeuroMapGuidedFlow:guided,NeuroMapViewAppearance:appearance,
    GlaukaMobile:mobile||undefined,
    GlaukaMobileShell:mobile?{dismissChrome(){dismissed++;return true}}:undefined,
    requestAnimationFrame:fn=>frames.push(fn),console,globalThis:null,
  };
  context.globalThis=context;
  vm.runInNewContext(composeUiSource('linked-views'),context,{filename:'linked-views.js'});
  class App{bindUI(){}recalculateAndRender(){}requestRender(){}closeEditor(){}markChanged(){}}
  context.NeuroMapLinkedViewsInstall(App,class State{});
  const app=new App();
  app.state={
    root:{id:'root',text:'Project',children:[{id:'a',text:'A',parentId:'root',children:[]}]},
    relationships:[],selectedNodeId:'root',
    pushHistory(){},findNode(id){return id==='root'?this.root:this.root.children.find(n=>n.id===id)||null},
  };
  app.bindUI();
  function flush(){let guard=40;while(frames.length&&guard--)frames.shift()()}
  flush();
  return {document,context,app,flush,dismissed:()=>dismissed,body};
}

test('Android linked views mount in the Glauka header without split chrome',()=>{
  const {document}=harness({mobile:true});
  const picker=document.getElementById('nm-view-picker');
  const split=document.getElementById('nm-view-split');
  const options=document.getElementById('nm-project-view-options');
  const row=document.getElementById('nm-view-switch');
  assert.ok(picker,'picker mounts');
  assert.equal(row.parentElement?.id,'glauka-app-header');
  assert.equal(split.hidden,true);
  assert.equal(split.disabled,true);
  assert.equal(options.hidden,true);
  const css=document.head.children[0]?.textContent||'';
  assert.ok(css.includes('glauka-mobile-app'));
  assert.ok(css.includes('nm-linked-view-open'));
  // Header picker stays in the DOM for sync, but mobile chrome hides it.
  assert.match(css,/body\.glauka-mobile-app #nm-view-switch\{display:none!important\}/);
});

test('Desktop linked views keep split controls on the HUD',()=>{
  const {document}=harness({mobile:false});
  const split=document.getElementById('nm-view-split');
  const options=document.getElementById('nm-project-view-options');
  assert.equal(split.hidden,false);
  assert.equal(split.disabled,false);
  assert.equal(options.hidden,false);
  assert.equal(document.getElementById('nm-view-switch').parentElement.id,'hud');
});

test('Mobile opens an exclusive linked view, dismisses chrome, and ignores split',()=>{
  const {document,context,app,flush,dismissed,body}=harness({mobile:true});
  context.NeuroMapLinkedViews.setMode(app,'orgchart');
  flush();
  assert.equal(app.state.root.viewMode,'orgchart');
  assert.equal(document.getElementById('nm-view-overlay').hidden,false);
  assert.ok(body.classList.contains('nm-linked-view-open'));
  assert.ok(dismissed()>=1,'sheet/style chrome is dismissed when a view opens');
  document.getElementById('nm-view-split').dispatch('click');
  flush();
  assert.equal(document.getElementById('nm-dual-pane').hidden,true);
  context.NeuroMapLinkedViews.setMode(app,'mindmap');
  flush();
  assert.equal(document.getElementById('nm-view-overlay').hidden,true);
  assert.equal(body.classList.contains('nm-linked-view-open'),false);
});

test('Mobile relocates the picker into the header when the shell mounts later',()=>{
  const {document,context,app,flush}=harness({mobile:true,withHeader:false});
  assert.equal(document.getElementById('nm-view-switch').parentElement,document.body);
  const header=document.createElement('header');header.id='glauka-app-header';
  const ai=document.createElement('button');ai.id='glauka-ai-open';
  header.append(ai);document.body.append(header);
  context.NeuroMapLinkedViews.refresh(app);
  flush();
  assert.equal(document.getElementById('nm-view-switch').parentElement.id,'glauka-app-header');
});

test('Exclusive smoke: Kanban opens over dock class, mind map restores',()=>{
  const {document,context,app,flush,dismissed,body}=harness({mobile:true});
  const dock=document.createElement('nav');dock.id='glauka-app-dock';document.body.append(dock);
  context.NeuroMapLinkedViews.setMode(app,'kanban');
  flush();
  assert.equal(app.state.root.viewMode,'kanban');
  assert.equal(document.getElementById('nm-view-overlay').hidden,false);
  assert.ok(body.classList.contains('nm-linked-view-open'));
  assert.ok(dismissed()>=1);
  assert.ok((document.head.children[0]?.textContent||'').includes('#glauka-app-dock'));
  context.NeuroMapLinkedViews.setMode(app,'mindmap');
  flush();
  assert.equal(document.getElementById('nm-view-overlay').hidden,true);
  assert.equal(body.classList.contains('nm-linked-view-open'),false);
});
