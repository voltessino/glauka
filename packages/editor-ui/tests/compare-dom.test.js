const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../compare-core');
function harness(){
  const ids=new Map(),listeners={};
  let document;
  class Element{
    constructor(tag){
      this.tagName=tag;this.children=[];this.parentElement=null;this.className='';
      this.hidden=false;this.textContent='';this.dataset={};this.attributes={};
      this.style={};this._events={};this.disabled=false;this.value='';
    }
    set id(value){this._id=value;if(value)ids.set(value,this)}
    get id(){return this._id}
    append(...children){for(const c of children){c.parentElement=this;this.children.push(c)}}
    replaceChildren(...children){this.children=[];this.append(...children)}
    setAttribute(k,v){this.attributes[k]=String(v)}
    addEventListener(k,fn){(this._events[k]??=[]).push(fn)}
    dispatch(k,event={}){for(const fn of this._events[k]||[])fn(event)}
    querySelectorAll(selector){
      const matches=[],wanted=selector.split(',').map(s=>s.trim());
      const match=n=>wanted.some(w=>w[0]==='.'?n.className.split(' ').includes(w.slice(1)):n.tagName===w);
      const stack=[...this.children];while(stack.length){const n=stack.shift();if(match(n))matches.push(n);stack.push(...n.children)}
      return matches;
    }
    querySelector(selector){return this.querySelectorAll(selector)[0]||null}
    focus(){document.activeElement=this}
  }
  document={body:new Element('body'),head:new Element('head'),activeElement:null,
    documentElement:{lang:'it'},createElement:tag=>new Element(tag),getElementById:id=>ids.get(id)||null,
    querySelector:selector=>document.body.querySelector(selector),
    addEventListener:(k,fn)=>(listeners[k]??=[]).push(fn)};
  const controls=new Element('div');controls.id='nm616-context-actions';document.body.append(controls);
  const global={document,NeuroMapComparisonCore:core,innerWidth:1200,innerHeight:800,
    console,globalThis:null};global.globalThis=global;
  const src=fs.readFileSync(path.join(__dirname,'..','compare-workspace.js'),'utf8');
  vm.runInNewContext(src,global,{filename:'compare-workspace.js'});
  const root={id:'root',text:'Epithelia',children:[
    {id:'a',text:'Simple',parentId:'root',children:[
      {id:'a1',text:'Basal lamina',parentId:'a',children:[]},
      {id:'a2',text:'One layer',parentId:'a',children:[]}
    ]},
    {id:'b',text:'Stratified',parentId:'root',children:[
      {id:'b1',text:'basal lamina',parentId:'b',children:[]},
      {id:'b2',text:'Multiple layers',parentId:'b',children:[]}
    ]}
  ]};
  const nodes=[root,...root.children,...root.children.flatMap(n=>n.children)];
  const state={root,selectedNodeIds:['a','b'],selectedNodeId:'b',undoStack:[],
    findNode:id=>nodes.find(n=>n.id===id)||null};
  class App{
    bindUI(){}
    activateTab(id){this.activeTabId=id}
    selectNode(id){this.state.selectedNodeId=id}
    requestRender(){this.rendered=(this.rendered||0)+1}
  }
  global.NeuroMapComparisonInstall(App);
  const app=new App();app.state=state;app.activeTabId='first';
  app.layout={getLayout:id=>nodes.some(n=>n.id===id)?{x:id.charCodeAt(0)*3,y:80}:null};
  app.renderer={camera:{x:50,y:40,zoom:.8}};app.bindUI();
  return {app,state,document,global,listeners};
}
test('Ctrl+selected branches produce a read-only comparison with literal shared labels',()=>{
  const {app,state,document}=harness(),before=JSON.stringify(state.root);
  document.getElementById('nm616-compare-open').dispatch('click');
  assert.equal(document.getElementById('nm616-compare').hidden,false);
  assert.equal(document.getElementById('nm616-compare-left').querySelector('h3').textContent,'Simple');
  assert.equal(document.getElementById('nm616-compare-right').querySelector('h3').textContent,'Stratified');
  assert.equal(document.getElementById('nm616-compare-common-count').textContent,'1 etichette condivise');
  assert.equal(JSON.stringify(state.root),before);
  assert.equal(state.undoStack.length,0);
});
test('swap and depth changes modify projection only, not the document',()=>{
  const {state,document}=harness(),before=JSON.stringify(state.root);
  document.getElementById('nm616-compare-open').dispatch('click');
  document.getElementById('nm616-compare-swap').dispatch('click');
  assert.equal(document.getElementById('nm616-compare-left').querySelector('h3').textContent,'Stratified');
  const picker=document.getElementById('nm616-compare-depth');
  picker.value='1';picker.dispatch('change');
  assert.equal(document.getElementById('nm616-compare-left').querySelector('.nm616-compare-items').children.length,2);
  assert.equal(JSON.stringify(state.root),before);
});
test('clicking a comparison entry navigates to same logical node without history',()=>{
  const {app,state,document}=harness();
  document.getElementById('nm616-compare-open').dispatch('click');
  const entry=document.getElementById('nm616-compare-left').querySelector('.nm616-compare-item');
  entry.dispatch('click');
  assert.equal(state.selectedNodeId,'a1');
  assert.equal(document.getElementById('nm616-compare').hidden,true);
  assert.equal(state.undoStack.length,0);
});
test('Esc closes the modal and focus returns to the launch button',()=>{
  const {state,document,listeners}=harness();
  const open=document.getElementById('nm616-compare-open');open.focus();open.dispatch('click');
  listeners.keydown.forEach(fn=>fn({key:'Escape',defaultPrevented:false,
    preventDefault(){},stopImmediatePropagation(){}}));
  assert.equal(document.getElementById('nm616-compare').hidden,true);
  assert.equal(document.activeElement,open);
  assert.equal(state.undoStack.length,0);
});
