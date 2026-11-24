// Lightweight DOM-level regression without Playwright, network or GitHub Actions.
// Run with: node --test packages/editor-ui/tests/linked-views-dom.test.js
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const view=require('../view-core');
const flow=require('../flow-core');
const work=require('../work-core');
const network=require('../concept-network');
const guided=require('../guided-flow');
const appearance=require('../view-appearance-core');

function harness(){
 const ids=new Map(),frames=[];
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.parentElement=null;this.dataset={};this.style={setProperty(name,value){this[name]=String(value)},getPropertyValue(name){return this[name]||''}};this.attributes={};this._listeners={};this.value='';this.hidden=false;this.textContent='';this.className='';this.scrollLeft=this.scrollTop=0;this.clientWidth=900;this.clientHeight=600;this.options=[];this.classList={
   add:v=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),v])].join(' ')},
   remove:v=>{this.className=this.className.split(' ').filter(x=>x!==v).join(' ')},
   toggle:(v,force)=>{const has=this.className.split(' ').includes(v),on=force===undefined?!has:!!force;this.className=this.className.split(' ').filter(x=>x&&x!==v).concat(on?[v]:[]).join(' ');return on}
  };}
  set id(value){this._id=value;ids.set(value,this)}get id(){return this._id||''}
  append(...items){for(const child of items){if(child.parentElement){const at=child.parentElement.children.indexOf(child);if(at>=0)child.parentElement.children.splice(at,1)}this.children.push(child);child.parentElement=this}if(this.tagName==='select'){this.options=this.children;if(!this.value&&this.options.length)this.value=this.options[0].value||''}}
  prepend(...items){for(let i=items.length-1;i>=0;i--){this.children.unshift(items[i]);items[i].parentElement=this}}
  before(...items){if(!this.parentElement)return;let index=this.parentElement.children.indexOf(this);for(const c of items){this.parentElement.children.splice(index++,0,c);c.parentElement=this.parentElement}}
  replaceWith(other){if(!this.parentElement)return;let p=this.parentElement;const index=p.children.indexOf(this);if(index>=0)p.children.splice(index,1,other);other.parentElement=p;this.parentElement=null}
  replaceChildren(...items){this.children=[];this.append(...items)}
  setAttribute(name,value){this.attributes[name]=String(value)}getAttribute(name){return this.attributes[name]}
  addEventListener(name,fn){(this._listeners[name]??=[]).push(fn)}
  removeEventListener(name,fn){this._listeners[name]=(this._listeners[name]||[]).filter(cb=>cb!==fn)}
  dispatch(name,e={}){for(const fn of this._listeners[name]||[])fn(e);this['on'+name]?.(e)}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this)}
  matches(sel){
   // Grouped CSS selectors are used by closest() to exclude native input
   // controls from pinch and wheel zoom. The mock must model those selectors.
   return String(sel).split(',').some(item=>{
    const value=item.trim();
    const except=value.match(/^(.+):not\((.+)\)$/);
    if(except)return this.matches(except[1])&&!this.matches(except[2]);
    const attr=value.match(/^\[([\w-]+)=["']([^"']+)["']\]$/);
    if(attr)return this.getAttribute(attr[1])===attr[2];
    return value[0]==='#'?this.id===value.slice(1):
      value[0]==='.'?this.className.split(' ').includes(value.slice(1)):
      this.tagName===value;
   });
  }
  closest(sel){for(let n=this;n;n=n.parentElement)if(n.matches(sel))return n;return null}
  querySelectorAll(query){const parts=query.split(/\s+/),items=[];const walk=parent=>{for(const child of parent.children){if(child.matches(parts.at(-1))){let p=child.parentElement,i=parts.length-2;while(p&&i>=0){if(p.matches(parts[i]))i--;p=p.parentElement}if(i<0)items.push(child)}walk(child)}};walk(this);return items}
  querySelector(query){return this.querySelectorAll(query)[0]||null}
  get offsetWidth(){return Number.parseFloat(this.style.width)||1000}
  get offsetHeight(){return Number.parseFloat(this.style.height)||900}
  contains(other){for(let p=other;p;p=p.parentElement)if(p===this)return true;return false}
  getBoundingClientRect(){return {left:0,top:0,width:this.offsetWidth,height:this.offsetHeight}}
  focus(){}select(){}blur(){this.dispatch('blur')}
 }
 const body=new Element('body'),head=new Element('head');
 const document={
  body,head,documentElement:{lang:'it'},_listeners:{},
  addEventListener(name,fn){(this._listeners[name]??=[]).push(fn)},
  dispatch(name,event){for(const listener of this._listeners[name]||[])listener(event)},
  getElementById:id=>ids.get(id)||null,
  createElement:t=>new Element(t),
  createElementNS:(ns,t)=>new Element(t),
  createDocumentFragment:()=>new Element('fragment'),
  // Real document.querySelector supports descendant selectors. Do not interpret
  // '#nm-dual-stage .nm-view-edit' as one ID when testing tab switches.
  querySelector:query=>query[0]==='#'&&!/[ >,+]/.test(query)?
    ids.get(query.slice(1))||null:body.querySelector(query),
  querySelectorAll:query=>body.querySelectorAll(query)
 };
 const hud=new Element('section');hud.className='hud-bottom-left';body.append(hud);
 const layouts=new Element('div');layouts.id='nm-layout-modes';hud.append(layouts);
 const context={document,window:{innerWidth:1200,addEventListener(){}},NeuroMapViewCore:view,NeuroMapFlowCore:flow,NeuroMapWorkCore:work,NeuroMapConceptNetwork:network,NeuroMapGuidedFlow:guided,NeuroMapViewAppearance:appearance,requestAnimationFrame:fn=>frames.push(fn),console,globalThis:null};
 context.globalThis=context;
 const composeUiSource=require('./helpers/compose-ui-source.cjs');
 let source=composeUiSource('linked-views');
 vm.runInNewContext(source,context,{filename:'linked-views.js'});
 const root={id:'root',text:'Project',children:[]},children=[
  {id:'prepare',text:'Prepare',parentId:'root',children:[]},
  {id:'check',text:'Review',parentId:'root',children:[]}
 ];root.children.push(...children);
 const state={
  root,relationships:[],selectedNodeId:'root',undos:[],
  pushHistory(){this.undos.push(JSON.stringify({root:this.root,relationships:this.relationships}))},
  findNode(id){
   const stack=[root],seen=new Set();
   while(stack.length){
    const node=stack.pop();
    if(!node||seen.has(node))continue;
    seen.add(node);
    if(node.id===id)return node;
    for(const child of node.children||[])stack.push(child);
   }
   return null;
  },
  addRelationship(fromId,toId,label){this.pushHistory();const edge={id:'ref'+this.relationships.length,fromId,toId,label};this.relationships.push(edge);return edge},
  setNodeNetworkPosition(id,position){const n=this.findNode(id);if(!n)return false;this.pushHistory();n.networkPosition={...position};return true},
  toggleCollapse(id){const node=this.findNode(id);if(!node||!node.children.length)return false;
   this.pushHistory();node.collapsed=!node.collapsed;return true},
  addFlowTransitionsBatch(items){
    if(!items?.length)return [];
    this.pushHistory();
    const created=items.map((e,i)=>({...e,id:'bulk-'+i,label:'Segue'}));
    this.relationships.push(...created);return created;
  },
  setNodeFlowShape(id,role){
    const node=this.findNode(id);
    if(!node||node===this.root||!flow.SHAPES.includes(role))return false;
    const next=role==='auto'?undefined:role;
    if(node.flowShape===next)return false;
    this.pushHistory();node.flowShape=next;this.selectedNodeId=id;return true;
  },
  addFlowTransition(fromId,toId,kind){this.pushHistory();const edge={id:'rel'+this.relationships.length,fromId,toId,kind,label:kind};this.relationships.push(edge);return edge},
  deleteRelationship(id){const index=this.relationships.findIndex(e=>e.id===id);if(index<0)return false;this.pushHistory();this.relationships.splice(index,1);return true},
  setNodeWorkMetadata(id,patch){const n=this.findNode(id);if(!n)return false;
   const start=Object.prototype.hasOwnProperty.call(patch,'startDate')?(patch.startDate||undefined):n.startDate;
   const end=Object.prototype.hasOwnProperty.call(patch,'dueDate')?(patch.dueDate||undefined):n.dueDate;
   if(start&&end&&start>end)return false;
   this.pushHistory();
   if(Object.prototype.hasOwnProperty.call(patch,'taskStatus')&&n.taskStatus!==patch.taskStatus)
    n.taskOrder=undefined;
   Object.assign(n,patch);return true},
  moveKanbanTask(id,status,beforeId=null){
   const plan=work.planKanbanMove(this.root,id,status,beforeId);if(!plan)return false;
   this.pushHistory();
   for(const entry of plan.changes){
    const node=this.findNode(entry.id);if(!node)return false;
    if(Object.prototype.hasOwnProperty.call(entry,'taskStatus'))
     node.taskStatus=entry.taskStatus==='unassigned'?undefined:entry.taskStatus;
    node.taskOrder=entry.taskOrder;
   }
   this.selectedNodeId=id;this.selectedNodeIds=[id];return true;
  },
  updateNodeText(id,value){const n=this.findNode(id);if(!n)return false;this.pushHistory();n.text=String(value);return true},
  addChildNode(id){const n=this.findNode(id);if(!n)return null;this.pushHistory();
   const child={id:'child-'+(n.children.length+1),text:'New node',parentId:id,children:[]};
   n.children.push(child);children.push(child);return child},
  generateId(prefix='id'){return prefix+'-'+Math.random().toString(36).slice(2)}
 };
 class App{
  bindUI(){}recalculateAndRender(){}requestRender(){}
  v5ReparentNode(nodeId,targetId,after=false,forceChild=false){
   const source=state.findNode(nodeId),dest=state.findNode(targetId);
   if(!source||!dest||source===state.root||source.id===dest.id)return false;
   const contains=(node,id)=>{
    if(!node)return false;
    if(node.id===id)return true;
    return (node.children||[]).some(child=>contains(child,id));
   };
   if(contains(source,dest.id))return false;
   const oldParent=state.findNode(source.parentId);
   if(!oldParent)return false;
   const from=oldParent.children.indexOf(source);
   if(from<0)return false;
   state.pushHistory();
   oldParent.children.splice(from,1);
   const sibling=!forceChild&&dest.parentId===source.parentId&&dest!==state.root;
   if(sibling){
    const index=oldParent.children.indexOf(dest);
    oldParent.children.splice(Math.max(0,index+(after?1:0)),0,source);
   }else{
    dest.children.push(source);source.parentId=dest.id;
   }
   return true;
  }
  selectNode(id){state.selectedNodeId=id}
  closeEditor(){}
  activateTab(id){this.activeTabId=id;return id}
  markChanged(){this.edits=(this.edits||0)+1;this.recalculateAndRender()}
 }
 context.NeuroMapLinkedViewsInstall(App,class State{});
 const app=new App();app.state=state;app.activeTabId='tab1';app.bindUI();
 function flush(){let guard=50;while(frames.length&&guard--){frames.shift()()}assert.ok(guard>0,'requestAnimationFrame converged')}
 flush();
 return {app,state,context,document,flush};
}
test('manual network overlaps warn in primary and split without rewriting coordinates',()=>{
 const {app,state,context,document,flush}=harness();
 const a=state.root.children[0],b=state.root.children[1];
 a.networkPosition={x:300,y:200};b.networkPosition={x:300,y:200};
 const snapshot=JSON.stringify(state.root.children);
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const primary=document.getElementById('nm-view-stage').querySelectorAll('.nm-network-card')
   .filter(card=>['prepare','check'].includes(card.dataset.nodeId));
 assert.equal(primary.length,2);
 assert.ok(primary.every(card=>card.className.includes('nm-network-manual-overlap')));
 assert.ok(primary.every(card=>/sovrapposte/i.test(card.getAttribute('aria-label'))));
 assert.equal(JSON.stringify(state.root.children),snapshot);
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');
 picker.value='concept-network';picker.dispatch('change');flush();
 const dual=document.getElementById('nm-dual-stage').querySelectorAll('.nm-network-card')
   .filter(card=>['prepare','check'].includes(card.dataset.nodeId));
 assert.equal(dual.length,2);
 assert.ok(dual.every(card=>card.className.includes('nm-network-manual-overlap')));
 assert.equal(JSON.stringify(state.root.children),snapshot);
});
test('workflow editor does not invent steps, and creates typed arrows using visible controls',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 assert.equal(document.getElementById('nm-view-overlay').hidden,false);
 assert.ok(document.getElementById('nm-view-stage').querySelector('.nm-flow-empty'));
 const from=document.getElementById('nm-flow-from'),to=document.getElementById('nm-flow-to'),kind=document.getElementById('nm-flow-type');
 from.value='prepare';to.value='check';kind.value='yes';
 document.getElementById('nm-flow-connect').dispatch('click');flush();
 assert.equal(state.relationships[0].kind,'yes');
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').length,2);
 assert.equal(document.getElementById('nm-flow-list').querySelectorAll('.nm-flow-pill').length,1);
 assert.ok(document.getElementById('nm-view-lines').querySelectorAll('path').length>=2);
});
test('workflow removal and direct return to mind map are reversible and preserve document nodes',()=>{
 const {app,state,context,document,flush}=harness();
 const original=JSON.stringify(state.root);
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const from=document.getElementById('nm-flow-from'),to=document.getElementById('nm-flow-to');
 from.value='prepare';to.value='check';
 document.getElementById('nm-flow-connect').dispatch('click');flush();
 const deleteButton=document.getElementById('nm-flow-list').querySelector('.nm-flow-remove');
 assert.ok(deleteButton);
 deleteButton.dispatch('click');flush();
 assert.equal(state.relationships.length,0);
 assert.equal(document.getElementById('nm-flow-list').querySelectorAll('.nm-flow-pill').length,0);
 context.NeuroMapLinkedViews.setMode(app,'mindmap');flush();
 assert.equal(document.getElementById('nm-view-overlay').hidden,true);
 assert.equal(state.root.layoutMode,undefined);
 assert.deepEqual(state.root.children.map(n=>n.id),['prepare','check']);
 assert.equal(JSON.stringify({...state.root,viewMode:undefined}),JSON.stringify({...JSON.parse(original),viewMode:undefined}));
});

test('Kanban displays unclassified tasks and only moves the selected task after explicit status change',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 assert.equal(document.getElementById('nm-view-overlay').hidden,false);
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').length,2);
 assert.ok(document.getElementById('nm-work-toolbar').hidden===false);
 const picker=document.getElementById('nm-work-node');
 picker.value='prepare';picker.dispatch('change');
 document.getElementById('nm-work-status').value='doing';
 document.getElementById('nm-work-apply').dispatch('click');flush();
 assert.equal(state.findNode('prepare').taskStatus,'doing');
 assert.equal(state.findNode('check').taskStatus,undefined);
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-work-column').length,4);
});
test('timeline does not invent dates; adds an activity only after explicit date entry',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-timeline-card').length,0);
 assert.ok(document.getElementById('nm-view-stage').querySelector('.nm-work-blank'));
 const target=document.getElementById('nm-work-node');
 target.value='check';target.dispatch('change');
 document.getElementById('nm-work-start').value='2026-11-02';
 document.getElementById('nm-work-end').value='2026-11-06';
 document.getElementById('nm-work-apply').dispatch('click');flush();
 assert.equal(state.findNode('check').startDate,'2026-11-02');
 assert.equal(state.findNode('prepare').startDate,undefined);
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-timeline-card').length,1);
});

test('free concept network links two selected nodes, draws the label and keeps source IDs',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const stage=document.getElementById('nm-view-stage');
 assert.equal(stage.querySelectorAll('.nm-network-card').length,3);
 const before=state.root.children.map(x=>x.id);
 document.getElementById('nm-network-label').value='causes';
 document.getElementById('nm-network-link').dispatch('click');flush();
 stage.querySelectorAll('.nm-network-card').find(n=>n.dataset.nodeId==='prepare').dispatch('click');flush();
 assert.equal(document.getElementById('nm-network-status').textContent,'Scegli il concetto di arrivo');
 stage.querySelectorAll('.nm-network-card').find(n=>n.dataset.nodeId==='check').dispatch('click');flush();
 assert.equal(state.relationships[0].fromId,'prepare');
 assert.equal(state.relationships[0].toId,'check');
 assert.equal(state.relationships[0].label,'causes');
 assert.equal(stage.querySelectorAll('.nm-network-label').length,1);
 assert.deepEqual(state.root.children.map(x=>x.id),before);
 assert.equal(state.undos.length>0,true);
});
test('free concept network drag changes only node presentation coordinates',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const stage=document.getElementById('nm-view-stage');
 const card=stage.querySelectorAll('.nm-network-card').find(n=>n.dataset.nodeId==='prepare');
 card.dispatch('pointerdown',{target:card,button:0,pointerId:11,clientX:100,clientY:100});
 card.dispatch('pointermove',{pointerId:11,clientX:230,clientY:180});
 card.dispatch('pointerup',{pointerId:11});
 flush();
 assert.deepEqual(state.findNode('prepare').networkPosition,{x:566,y:190});
 assert.equal(state.findNode('check').networkPosition,undefined);
 assert.equal(state.root.children[0].text,'Prepare');
});
test('Kanban drag updates only status and keeps date fields intact',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').startDate='2026-11-10';
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const stage=document.getElementById('nm-view-stage');
 const card=stage.querySelectorAll('.nm-work-card').find(n=>n.dataset.nodeId==='prepare');
 card.dispatch('dragstart',{target:card,dataTransfer:{setData(){},effectAllowed:null}});
 stage.dispatch('dragover',{clientX:800,preventDefault(){},dataTransfer:{dropEffect:null}});
 stage.dispatch('drop',{clientX:800,preventDefault(){}});
 flush();
 assert.equal(state.findNode('prepare').taskStatus,'done');
 assert.equal(state.findNode('prepare').startDate,'2026-11-10');
 assert.equal(state.findNode('check').taskStatus,undefined);
});

test('guided preview is opt-in, shows a sibling chain and applies one Undo only after confirmation',()=>{
 const {app,state,context,document,flush}=harness();
 const original=JSON.stringify(state.root),undoneBefore=state.undos.length;
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 document.getElementById('nm-flow-suggest').dispatch('click');flush();
 const preview=document.getElementById('nm-flow-guide');
 assert.equal(preview.hidden,false);
 assert.equal(preview.querySelectorAll('.nm-flow-guide-item').length,1);
 assert.equal(state.relationships.length,0);
 const entry=preview.querySelector('.nm-flow-guide-item'),input=entry.querySelector('input');
 assert.equal(document.getElementById('nm-flow-guide-confirm').disabled,true);
 input.checked=true;input.dispatch('change');
 assert.equal(document.getElementById('nm-flow-guide-confirm').disabled,false);
 document.getElementById('nm-flow-guide-confirm').dispatch('click');flush();
 assert.equal(state.relationships.length,1);
 assert.deepEqual(state.relationships.map(x=>[x.fromId,x.toId,x.kind]),[['prepare','check','sequence']]);
 assert.equal(state.undos.length,undoneBefore+2,'one view switch and one atomic approval');
 assert.equal(JSON.stringify({...state.root,viewMode:undefined}),JSON.stringify({...JSON.parse(original),viewMode:undefined}));
});
test('guided flow can be cancelled without any content changes',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const initial=state.undos.length;
 document.getElementById('nm-flow-suggest').dispatch('click');flush();
 document.getElementById('nm-flow-guide-cancel').dispatch('click');flush();
 assert.equal(document.getElementById('nm-flow-guide').hidden,true);
 assert.equal(state.relationships.length,0);
 assert.equal(state.undos.length,initial);
});

test('split view keeps original mind map active while showing a synchronized organization chart',()=>{
 const {app,state,document,flush}=harness();
 const before=JSON.stringify(state.root),undos=state.undos.length;
 document.getElementById('nm-view-split').dispatch('click');flush();
 const overlay=document.getElementById('nm-view-overlay');
 assert.equal(overlay.hidden,false);
 assert.equal(overlay.className.includes('nm-side-panel'),true);
 assert.equal(document.getElementById('nm-view-picker').value,'mindmap');
 assert.equal(document.getElementById('nm-view-overlay-picker').value,'orgchart');
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').length,3);
 assert.equal(state.root.viewMode,undefined);
 assert.equal(state.undos.length,undos);
 document.getElementById('nm-view-back').dispatch('click');flush();
 assert.equal(overlay.hidden,true);
 assert.equal(JSON.stringify(state.root),before);
 assert.equal(state.undos.length,undos);
});
test('split mode can change the alternate view without altering original mode or duplicating children',()=>{
 const {app,state,document,flush}=harness();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-view-overlay-picker');
 picker.value='concept-network';picker.dispatch('change');flush();
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-network-card').length,3);
 assert.equal(document.getElementById('nm-view-picker').value,'mindmap');
 assert.equal(state.root.viewMode,undefined);
 state.root.children[0].text='Updated from original';
 app.recalculateAndRender();flush();
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-network-card')
  .some(n=>n.querySelector('.nm-view-title')?.textContent==='Updated from original'),true);
 assert.deepEqual(state.root.children.map(n=>n.id),['prepare','check']);
});
test('Escape closes split mode without committing a view-mode transition',()=>{
 const {state,document,flush}=harness();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const before=state.undos.length;
 document.getElementById('nm-view-overlay').dispatch('keydown',{
  key:'Escape',defaultPrevented:false,ctrlKey:false,metaKey:false,altKey:false,
  stopPropagation(){},preventDefault(){this.defaultPrevented=true}
 });
 flush();
 assert.equal(document.getElementById('nm-view-overlay').hidden,true);
 assert.equal(state.undos.length,before);
 assert.equal(state.root.viewMode,undefined);
});

test('split camera offset keeps the original map centered in the uncovered pane and restores user pan',()=>{
 const {app,document,flush}=harness();
 app.renderer={camera:{x:500,y:200,zoom:1}};
 app.requestRender=()=>{};
 document.getElementById('nm-view-split').dispatch('click');flush();
 assert.equal(app.renderer.camera.x,212);
 app.renderer.camera.x+=40;
 document.getElementById('nm-view-back').dispatch('click');flush();
 assert.equal(app.renderer.camera.x,540);
 assert.equal(app.renderer.camera.y,200);
});

test('7.0 preflight prevents an unrenderable concept network from replacing a valid view',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 assert.equal(state.root.viewMode,'orgchart');
 const originalHistory=state.undos.length;
 const originalMode=state.root.viewMode;
 // Existing network hard-limit is 1,200; organization view still supports 2,000.
 for(let i=0;i<1201;i++)
   state.root.children.push({id:'large-'+i,text:'Concept '+i,parentId:'root',children:[]});
 const previousIds=state.root.children.map(n=>n.id);
 const errors=[];app.showToast=(text,type)=>errors.push({text,type});
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 assert.equal(state.root.viewMode,originalMode,'unrenderable mode must not be persisted');
 assert.equal(state.undos.length,originalHistory,'failed preview must not add Undo');
 assert.deepEqual(state.root.children.map(n=>n.id),previousIds,'no source nodes lost');
 assert.ok(errors.some(e=>e.type==='VISTA'&&/limit/i.test(e.text)));
 assert.equal(document.getElementById('nm-view-picker').value,'orgchart');
});
test('7.0 preflight leaves original mind map open when a requested view exceeds its limit',()=>{
 const {app,state,context,document,flush}=harness();
 for(let i=0;i<1202;i++)
   state.root.children.push({id:'large-'+i,text:'Concept '+i,parentId:'root',children:[]});
 const serialized=JSON.stringify(state.root),history=state.undos.length;
 let warnings=0;app.showToast=()=>{warnings++};
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 assert.equal(state.root.viewMode,undefined);
 assert.equal(state.undos.length,history);
 assert.equal(JSON.stringify(state.root),serialized);
 assert.equal(document.getElementById('nm-view-overlay').hidden,true);
 assert.equal(warnings,1);
});

test('7.0 scoped preview opens oversized map as a bounded concept network without deleting nodes',()=>{
 const {app,state,context,document,flush}=harness();
 state.root.children[0].children.push(
  {id:'inside-a',text:'A',children:[]},{id:'inside-b',text:'B',children:[]});
 for(let i=0;i<1550;i++)
  state.root.children.push({id:'offscreen-'+i,text:'Other '+i,children:[]});
 const original=JSON.stringify(state.root),undoBefore=state.undos.length;
 assert.equal(context.NeuroMapLinkedViews.setFocus(app,'prepare'),true);
 flush();
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 assert.equal(state.root.viewMode,'concept-network');
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-network-card').length,3);
 assert.equal(document.getElementById('nm-view-focus').getAttribute('aria-pressed'),'true');
 assert.equal(state.root.children.length,1552);
 assert.equal(state.undos.length,undoBefore+1,'only view switch creates an Undo snapshot');
 assert.equal(JSON.stringify({...state.root,viewMode:undefined}),JSON.stringify({...JSON.parse(original),viewMode:undefined}));
});
test('7.0 removing focus is rejected if full map cannot be displayed',()=>{
 const {app,state,context,document,flush}=harness();
 state.root.children[0].children.push({id:'small-a',text:'A',children:[]});
 for(let i=0;i<1300;i++)
  state.root.children.push({id:'other-'+i,text:'Offscreen',children:[]});
 const warnings=[];app.showToast=(value)=>warnings.push(value);
 assert.equal(context.NeuroMapLinkedViews.setFocus(app,'prepare'),true);flush();
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const previousHistory=state.undos.length;
 assert.equal(context.NeuroMapLinkedViews.setFocus(app,null),false);
 flush();
 assert.equal(document.getElementById('nm-view-focus').getAttribute('aria-pressed'),'true');
 assert.equal(state.undos.length,previousHistory);
 assert.equal(state.root.viewMode,'concept-network');
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-network-card').length,2);
 assert.ok(warnings.some(s=>/limit/i.test(s)));
});
test('7.0 scoped view includes only internal workflow edges and tasks',()=>{
 const {app,state,context,document,flush}=harness();
 state.root.children[0].children.push(
  {id:'task-a',text:'Task A',taskStatus:'doing',startDate:'2026-10-25',dueDate:'2026-10-27',children:[]},
  {id:'task-b',text:'Task B',taskStatus:'done',startDate:'2026-10-28',dueDate:'2026-10-29',children:[]});
 state.relationships.push(
  {id:'inside',fromId:'task-a',toId:'task-b',kind:'sequence',label:'Next'},
  {id:'outside',fromId:'task-b',toId:'check',kind:'sequence',label:'Offscreen'});
 for(let i=0;i<1550;i++)state.root.children.push({id:'other-'+i,text:'Elsewhere',children:[]});
 const original=JSON.stringify(state.relationships);
 assert.equal(context.NeuroMapLinkedViews.setFocus(app,'prepare'),true);flush();
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').length,2);
 assert.equal(document.getElementById('nm-flow-list').querySelectorAll('.nm-flow-pill').length,1);
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').length,2);
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-timeline-card').length,2);
 assert.equal(JSON.stringify(state.relationships),original);
 assert.equal(state.root.children.length,1552);
});
test('7.0 focus action is session-only and does not create an Undo or save a schema field',()=>{
 const {app,state,context,document,flush}=harness();
 state.root.children[0].children.push({id:'child',text:'Child',children:[]});
 state.selectedNodeId='prepare';
 const snapshot=JSON.stringify(state.root),before=state.undos.length;
 document.getElementById('nm-view-focus').dispatch('click');flush();
 assert.equal(document.getElementById('nm-view-focus').getAttribute('aria-pressed'),'true');
 assert.equal(JSON.stringify(state.root),snapshot);
 assert.equal(state.undos.length,before);
 document.getElementById('nm-view-focus').dispatch('click');flush();
 assert.equal(document.getElementById('nm-view-focus').getAttribute('aria-pressed'),'false');
 assert.equal(state.undos.length,before);
});
test('7.0 leaf focus is refused without corrupting original view selection',()=>{
 const {app,state,context,document,flush}=harness();
 const before=JSON.stringify(state.root),count=state.undos.length;
 const alerts=[];app.showToast=(msg)=>alerts.push(msg);
 assert.equal(context.NeuroMapLinkedViews.setFocus(app,'check'),false);
 flush();
 assert.equal(document.getElementById('nm-view-focus').getAttribute('aria-pressed'),'false');
 assert.equal(JSON.stringify(state.root),before);assert.equal(state.undos.length,count);
 assert.ok(alerts.some(x=>/discendenti/.test(x)));
});
test('7.0 oversized organization views work after focus, and split view remains non-destructive',()=>{
 const {app,state,context,document,flush}=harness();
 state.root.children[0].children.push({id:'sub-a',text:'a',children:[]});
 for(let i=0;i<2100;i++)state.root.children.push({id:'other-'+i,text:'Other',children:[]});
 const before=JSON.stringify(state.root),undos=state.undos.length;
 assert.equal(context.NeuroMapLinkedViews.setFocus(app,'prepare'),true);flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').length,2);
 assert.equal(state.root.viewMode,undefined);
 assert.equal(state.undos.length,undos);
 assert.equal(JSON.stringify(state.root),before);
 document.getElementById('nm-view-back').dispatch('click');flush();
 assert.equal(document.getElementById('nm-view-overlay').hidden,true);
});

test('7.0 scope toggle inside alternate-view header is keyboard-accessible and restores whole preview',()=>{
 const {app,state,context,document,flush}=harness();
 state.root.children[0].children.push({id:'inner',text:'Inner',children:[]});
 state.selectedNodeId='prepare';
 assert.equal(context.NeuroMapLinkedViews.setFocus(app,'prepare'),true);flush();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const headerButton=document.getElementById('nm-view-overlay-focus');
 assert.ok(headerButton);
 assert.equal(headerButton.getAttribute('aria-pressed'),'true');
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').length,2);
 const before=state.undos.length;
 headerButton.dispatch('click');flush();
 assert.equal(headerButton.getAttribute('aria-pressed'),'false');
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').length,4);
 assert.equal(state.undos.length,before);
 headerButton.dispatch('click');flush();
 assert.equal(headerButton.getAttribute('aria-pressed'),'true');
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').length,2);
});
test('7.0 5,000-node inventory can project a small subtree and preserve outside media refs',()=>{
 const {app,state,context,document,flush}=harness();
 state.root.children[0].children.push(
  {id:'small-a',text:'A',sourceRefs:[{id:'pdf-10',page:10}],children:[]},
  {id:'small-b',text:'B',children:[]});
 for(let i=0;i<5000;i++)state.root.children.push({id:'outside-'+i,text:'Unrelated',children:[]});
 const beforeIds=state.root.children.map(n=>n.id);
 const beforeRef=JSON.stringify(state.root.children[0].children[0].sourceRefs);
 assert.equal(context.NeuroMapLinkedViews.setFocus(app,'prepare'),true);flush();
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-network-card').length,3);
 assert.deepEqual(state.root.children.map(n=>n.id),beforeIds);
 assert.equal(JSON.stringify(state.root.children[0].children[0].sourceRefs),beforeRef);
});

test('7.0 nonexistent branch identifiers fail gracefully without modifying saved content',()=>{
 const {app,state,context,document,flush}=harness();
 const before=JSON.stringify(state.root),undo=state.undos.length;
 const errors=[];app.showToast=(message)=>errors.push(message);
 assert.equal(context.NeuroMapLinkedViews.setFocus(app,'missing-branch'),false);
 flush();
 assert.equal(state.undos.length,undo);
 assert.equal(JSON.stringify(state.root),before);
 assert.equal(document.getElementById('nm-view-focus').getAttribute('aria-pressed'),'false');
 assert.equal(errors.length,1);
});

function pointer(id,x,y,target,type='touch'){
 return {pointerId:id,clientX:x,clientY:y,pointerType:type,button:0,target,
  preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}};
}
test('touch pinch zooms the linked view stage without editing tree data',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const original=JSON.stringify(state.root),count=state.undos.length;
 const scroller=document.getElementById('nm-view-scroller'),stage=document.getElementById('nm-view-stage');
 scroller.dispatch('pointerdown',pointer(1,200,200,stage));
 scroller.dispatch('pointerdown',pointer(2,300,200,stage));
 scroller.dispatch('pointermove',pointer(2,400,200,stage));
 assert.equal(document.getElementById('nm-view-zoom-status').textContent,'200%');
 assert.equal(stage._nmGesturePinching,true);
 scroller.dispatch('pointerup',pointer(2,400,200,stage));
 scroller.dispatch('pointerup',pointer(1,200,200,stage));
 assert.equal(stage._nmGesturePinching,false);
 assert.equal(state.undos.length,count);
 assert.equal(JSON.stringify(state.root),original);
});
test('one-finger background pan changes only viewport scroll, not nodes',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const scroller=document.getElementById('nm-view-scroller'),stage=document.getElementById('nm-view-stage');
 scroller.scrollLeft=200;
 scroller.dispatch('pointerdown',pointer(3,250,120,stage));
 scroller.dispatch('pointermove',pointer(3,200,120,stage));
 assert.equal(scroller.scrollLeft,250);
 scroller.dispatch('pointerup',pointer(3,200,120,stage));
 assert.equal(state.undos.length,1,'the only history entry is the view switch');
});
test('pinch gesture never commits a concept network card drag',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const scroller=document.getElementById('nm-view-scroller'),stage=document.getElementById('nm-view-stage');
 const card=stage.querySelectorAll('.nm-network-card').find(n=>n.dataset.nodeId==='prepare');
 const left=card.style.left;
 card.dispatch('pointerdown',pointer(11,100,100,card));
 scroller.dispatch('pointerdown',pointer(11,100,100,card));
 scroller.dispatch('pointerdown',pointer(12,200,100,stage));
 card.dispatch('pointermove',pointer(11,230,180,card));
 assert.equal(card.style.left,left);
 card.dispatch('pointerup',pointer(11,230,180,card));
 scroller.dispatch('pointerup',pointer(11,230,180,card));
 scroller.dispatch('pointerup',pointer(12,200,100,stage));
 assert.equal(state.findNode('prepare').networkPosition,undefined);
});
test('touch Kanban drag moves one task with one history entry',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const before=state.undos.length;
 const scroller=document.getElementById('nm-view-scroller'),stage=document.getElementById('nm-view-stage');
 const card=stage.querySelectorAll('.nm-work-card').find(n=>n.dataset.nodeId==='prepare');
 card.dispatch('pointerdown',pointer(14,100,100,card));
 scroller.dispatch('pointerdown',pointer(14,100,100,card));
 card.dispatch('pointermove',pointer(14,800,100,card));
 card.dispatch('pointerup',pointer(14,800,100,card));
 scroller.dispatch('pointerup',pointer(14,800,100,card));
 flush();
 assert.equal(state.findNode('prepare').taskStatus,'done');
 assert.equal(state.findNode('check').taskStatus,undefined);
 assert.equal(state.undos.length,before+1);
});
test('native gesture and Ctrl-wheel on a select do not zoom or change Undo',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const overlay=document.getElementById('nm-view-overlay');
 const select=document.createElement('select');overlay.append(select);
 const zoom=document.getElementById('nm-view-zoom-status').textContent;
 const undo=state.undos.length;
 let prevented=0;
 const emit=(name,extra={})=>document.dispatch(name,{target:select,
  scale:1.5,ctrlKey:true,metaKey:false,deltaMode:0,deltaY:-100,
  clientX:100,clientY:100,preventDefault(){prevented++},
  stopPropagation(){},stopImmediatePropagation(){},...extra});
 emit('gesturestart');emit('gesturechange');emit('gestureend');emit('wheel');
 assert.equal(prevented,0,'select gestures should retain native behavior');
 assert.equal(document.getElementById('nm-view-zoom-status').textContent,zoom);
 assert.equal(state.undos.length,undo);
});
test('Ctrl+trackpad-wheel zooms only the linked diagram and prevents browser default',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const stage=document.getElementById('nm-view-stage');
 let prevented=false,stopped=false;
 document.dispatch('wheel',{ctrlKey:true,metaKey:false,deltaMode:0,deltaY:-100,
  target:stage,clientX:180,clientY:200,
  preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});
 assert.equal(prevented,true);assert.equal(stopped,true);
 assert.notEqual(document.getElementById('nm-view-zoom-status').textContent,'100%');
});

test('pinch keeps the previous midpoint world-coordinate beneath its new midpoint',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const scroller=document.getElementById('nm-view-scroller'),stage=document.getElementById('nm-view-stage');
 scroller.scrollLeft=240;scroller.scrollTop=110;
 scroller.dispatch('pointerdown',pointer(1,200,200,stage));
 scroller.dispatch('pointerdown',pointer(2,300,200,stage));
 const oldWorldX=(240+250),oldWorldY=(110+200);
 scroller.dispatch('pointermove',pointer(2,400,200,stage));
 const newWorldX=(scroller.scrollLeft+300)/2,newWorldY=(scroller.scrollTop+200)/2;
 assert.equal(newWorldX,oldWorldX);
 assert.equal(newWorldY,oldWorldY);
 scroller.dispatch('pointercancel',pointer(2,400,200,stage));
 scroller.dispatch('pointercancel',pointer(1,200,200,stage));
 assert.equal(stage._nmGesturePinching,false);
});
test('touch pinch cancels a pending Kanban touch drop',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const scroller=document.getElementById('nm-view-scroller'),stage=document.getElementById('nm-view-stage');
 const card=stage.querySelectorAll('.nm-work-card').find(x=>x.dataset.nodeId==='prepare');
 const initial=state.undos.length;
 card.dispatch('pointerdown',pointer(51,100,100,card));scroller.dispatch('pointerdown',pointer(51,100,100,card));
 scroller.dispatch('pointerdown',pointer(52,250,100,stage));
 card.dispatch('pointermove',pointer(51,800,100,card));
 card.dispatch('pointerup',pointer(51,800,100,card));
 scroller.dispatch('pointerup',pointer(51,800,100,card));
 scroller.dispatch('pointerup',pointer(52,250,100,stage));
 flush();
 assert.equal(state.findNode('prepare').taskStatus,undefined);
 assert.equal(state.undos.length,initial);
});

test('native gestures outside the linked-view overlay never consume other panels',()=>{
  const {app,state,context,document,flush}=harness();
  context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
  const outsider=document.createElement('button');document.body.append(outsider);
  let prevented=0,stopped=0;
  const gesture=scale=>({target:outsider,scale,clientX:30,clientY:30,
    preventDefault(){prevented++},stopPropagation(){stopped++}});
  const original=JSON.stringify(state.root);
  document.dispatch('gesturestart',gesture(1));
  document.dispatch('gesturechange',gesture(1.6));
  document.dispatch('gestureend',gesture(1.6));
  assert.equal(prevented,0,'other panels must retain their own native pinch actions');
  assert.equal(stopped,0,'linked view must not suppress another panel event');
  assert.equal(document.getElementById('nm-view-zoom-status').textContent,'100%');
  assert.equal(JSON.stringify(state.root),original);
});
test('WebKit gesturechange leaving a linked view does not hijack another panel or zoom the view',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const stage=document.getElementById('nm-view-stage');
 const outsider=document.createElement('button');document.body.append(outsider);
 const status=document.getElementById('nm-view-zoom-status');
 const original=JSON.stringify(state.root);
 let prevented=0,stopped=0;
 const gesture=(target,scale)=>({target,scale,clientX:90,clientY:80,
   preventDefault(){prevented++},stopPropagation(){stopped++}});
 document.dispatch('gesturestart',gesture(stage,1));
 assert.equal(prevented,1);
 const before=status.textContent;
 document.dispatch('gesturechange',gesture(outsider,1.7));
 assert.equal(prevented,1,'external gesturechange must not be consumed');
 assert.equal(stopped,1,'external gesturechange must propagate to its owner');
 assert.equal(status.textContent,before,'external pinch must not zoom the linked canvas');
 document.dispatch('gestureend',gesture(outsider,1.7));
 assert.equal(prevented,1,'external gestureend remains available');
 document.dispatch('gesturestart',gesture(stage,1));
 document.dispatch('gesturechange',gesture(stage,1.25));
 assert.notEqual(status.textContent,before,'a new in-view pinch still works');
 document.dispatch('gestureend',gesture(stage,1.25));
 assert.equal(JSON.stringify(state.root),original,'gesture never edits canonical data or Undo');
});
test('WebKit gestureend on another panel is not swallowed after a view pinch',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const stage=document.getElementById('nm-view-stage');
 const outsider=document.createElement('button');document.body.append(outsider);
 let prevented=0,stopped=0;
 const gesture=(target,scale)=>({target,scale,clientX:120,clientY:160,
   preventDefault(){prevented++},stopPropagation(){stopped++}});
 document.dispatch('gesturestart',gesture(stage,1));
 assert.equal(prevented,1,'view pinch begins in linked canvas');
 document.dispatch('gestureend',gesture(outsider,1.2));
 assert.equal(prevented,1,'unrelated panel gestureend must remain available');
 assert.equal(stopped,1,'external event must propagate');
 document.dispatch('gesturestart',gesture(stage,1));
 assert.equal(prevented,2,'native pinch state must have been released');
 document.dispatch('gestureend',gesture(stage,1));
 assert.equal(prevented,3,'in-view gestureend remains consumed');
});
test('modified Escape does not dismiss linked view or its menus',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const overlay=document.getElementById('nm-view-overlay');
 const rootMode=app.state.root.viewMode;
 for(const modifier of [{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}]){
  let prevented=0;
  overlay.dispatch('keydown',{key:'Escape',defaultPrevented:false,...modifier,
    preventDefault(){prevented++},stopPropagation(){}});
  flush();
  assert.equal(app.state.root.viewMode,rootMode,'modified Escape must preserve view');
  assert.equal(prevented,0,'modified Escape must not be consumed');
 }
});
test('primary scroller does not register a second Ctrl/Cmd zoom listener',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const scroller=document.getElementById('nm-view-scroller');
 const stage=document.getElementById('nm-view-stage');
 const status=document.getElementById('nm-view-zoom-status');
 assert.equal((scroller._listeners.keydown||[]).length,0,
   'document capture is the single keyboard zoom owner');
 const original=app.viewWorkspace.cameras.orgchart.zoom;
 let prevented=0;
 const event={target:stage,key:'+',ctrlKey:true,metaKey:false,altKey:false,
   preventDefault(){prevented++},stopImmediatePropagation(){}};
 document.dispatch('keydown',event);
 assert.equal(prevented,1);
 assert.equal(app.viewWorkspace.cameras.orgchart.zoom,original*1.2,
   'one keypress must apply exactly one zoom step');
 assert.equal(status.textContent,'120%');
 scroller.dispatch('keydown',event);
 assert.equal(app.viewWorkspace.cameras.orgchart.zoom,original*1.2,
   'scroller cannot apply a duplicate zoom step');
});
test('Ctrl/Cmd zoom shortcut on external chrome cannot zoom an unrelated linked canvas',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const outside=document.createElement('button');document.body.append(outside);
 const stage=document.getElementById('nm-view-stage');
 const zoom=document.getElementById('nm-view-zoom-status');
 const before=zoom.textContent;
 let prevented=0,stopped=0;
 const key=target=>({target,key:'+',ctrlKey:true,metaKey:false,altKey:false,
   preventDefault(){prevented++},stopImmediatePropagation(){stopped++}});
 document.dispatch('keydown',key(outside));
 assert.equal(zoom.textContent,before,'global shortcut on toolbar must not zoom canvas');
 assert.equal(prevented,1,'native application zoom remains blocked');
 assert.equal(stopped,0,'unrelated toolbar shortcut propagation remains available');
 document.dispatch('keydown',key(stage));
 assert.notEqual(zoom.textContent,before,'shortcut on linked canvas still zooms the view');
 assert.equal(prevented,2);
 assert.equal(stopped,1,'canvas consumes its own zoom command');
});
test('Ctrl/Cmd zoom leaves select fields and decision modal untouched',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const overlay=document.getElementById('nm-view-overlay');
 const stage=document.getElementById('nm-view-stage');
 const zoom=document.getElementById('nm-view-zoom-status');
 const before=zoom.textContent,undo=state.undos.length;
 const select=document.createElement('select');stage.append(select);
 const decision=document.createElement('div');decision.id='nm-decision-overlay';
 stage.append(decision);
 let prevented=0,stopped=0;
 const fire=(target,blocked)=>document.dispatch('keydown',{
   target:{closest:selector=>selector.includes(blocked)?target:null},
   key:'+',ctrlKey:true,metaKey:false,altKey:false,
   preventDefault(){prevented++},stopImmediatePropagation(){stopped++}
 });
 // The synthetic targets remain inside the overlay, as in real DOM.
 const originalContains=overlay.contains.bind(overlay);
 overlay.contains=target=>target===select||target===decision||originalContains(target);
 fire(select,'select');
 fire(decision,'#nm-decision-overlay');
 assert.equal(zoom.textContent,before,'modal and picker must not zoom the diagram');
 assert.equal(prevented,2,'native WebView page zoom is still blocked');
 assert.equal(stopped,0,'modal shortcuts retain propagation');
 assert.equal(state.undos.length,undo,'zoom shortcuts must not change Undo');
});
test('Ctrl/Cmd wheel outside the linked view is not captured or zoomed',()=>{
  const {app,context,document,flush}=harness();
  context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
  const outsider=document.createElement('button');
  document.body.append(outsider);
  const stage=document.getElementById('nm-view-stage');
  const zoom=document.getElementById('nm-view-zoom-status');
  let prevented=0,stopped=0;
  const wheel=(target,modifier)=>({
    target,ctrlKey:modifier==='ctrl',metaKey:modifier==='meta',
    deltaY:-110,deltaMode:0,clientX:280,clientY:240,
    preventDefault(){prevented++},
    stopImmediatePropagation(){stopped++}
  });
  const before=zoom.textContent;
  document.dispatch('wheel',wheel(outsider,'ctrl'));
  document.dispatch('wheel',wheel(outsider,'meta'));
  assert.equal(prevented,0,'other workspace chrome keeps Ctrl/Cmd-wheel');
  assert.equal(stopped,0,'other workspace wheel handlers still receive the event');
  assert.equal(zoom.textContent,before,'external wheel must not zoom a linked view');
  document.dispatch('wheel',wheel(stage,'ctrl'));
  assert.equal(prevented,1,'canvas Ctrl-wheel must still prevent page zoom');
  assert.equal(stopped,1,'canvas Ctrl-wheel is handled by the view');
  assert.notEqual(zoom.textContent,before,'canvas Ctrl-wheel still zooms the view');
});

test('hiding a view releases native pinch state even if WebKit omits gestureend',()=>{
  const {app,context,document,flush}=harness();
  context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
  const stage=document.getElementById('nm-view-stage');
  document.dispatch('gesturestart',{target:stage,scale:1,clientX:80,clientY:80,
    preventDefault(){},stopPropagation(){}});
  context.NeuroMapLinkedViews.setMode(app,'mindmap');flush();
  // Some operating systems cancel a native gesture without gestureend.
  context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
  const before=document.getElementById('nm-view-zoom-status').textContent;
  document.dispatch('wheel',{ctrlKey:true,metaKey:false,target:stage,deltaY:-105,deltaMode:0,
    preventDefault(){},stopImmediatePropagation(){}});
  assert.notEqual(document.getElementById('nm-view-zoom-status').textContent,before);
});
test('ending a native pinch after a view closes does not lock later Ctrl-wheel zoom',()=>{
  const {app,context,document,flush}=harness();
  context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
  const stage=document.getElementById('nm-view-stage');
  const gesture=scale=>({target:stage,scale,clientX:210,clientY:150,
    preventDefault(){},stopPropagation(){}});
  document.dispatch('gesturestart',gesture(1));
  context.NeuroMapLinkedViews.setMode(app,'mindmap');flush();
  document.dispatch('gestureend',gesture(1.2)); // macOS may finish after panel closes
  context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
  const before=document.getElementById('nm-view-zoom-status').textContent;
  document.dispatch('wheel',{ctrlKey:true,metaKey:false,target:stage,deltaY:-110,deltaMode:0,
    preventDefault(){},stopImmediatePropagation(){}});
  const after=document.getElementById('nm-view-zoom-status').textContent;
  assert.notEqual(after,before,'a stale nativeGesture must not block a new zoom');
});
test('WebKit native gesture scales a linked view without changing the logical map',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const stage=document.getElementById('nm-view-stage');
 let prevented=0;
 const make=scale=>({target:stage,scale,clientX:250,clientY:160,
  preventDefault(){prevented++},stopPropagation(){}});
 const original=JSON.stringify(state.root),undos=state.undos.length;
 document.dispatch('gesturestart',make(1));
 document.dispatch('gesturechange',make(1.5));
 assert.equal(document.getElementById('nm-view-zoom-status').textContent,'150%');
 document.dispatch('wheel',{ctrlKey:true,metaKey:false,target:stage,deltaY:-100,deltaMode:0,
  preventDefault(){prevented++},stopImmediatePropagation(){}});
 assert.equal(document.getElementById('nm-view-zoom-status').textContent,'150%',
   'do not apply Ctrl-wheel twice while native gesture is active');
 document.dispatch('gestureend',make(1.5));
 assert.equal(prevented,4);
 assert.equal(JSON.stringify(state.root),original);
 assert.equal(state.undos.length,undos);
});

test('workspace presets switch split views and store per-tab UI configuration without copying nodes',()=>{
 const {app,state,document,flush}=harness(),root=JSON.stringify(state.root);
 const selector=document.getElementById('nm-workspace-layouts');
 assert.ok(selector,'workspace picker exists');
 assert.equal(document.getElementById('nm-workspace-controls').hidden,false);
 const begin=state.undos.length;
 selector.value='builtin:kanban';selector.dispatch('change');flush();
 assert.equal(document.getElementById('nm-view-overlay').className.includes('nm-side-panel'),true);
 assert.equal(document.getElementById('nm-view-overlay-picker').value,'kanban');
 assert.equal(app.viewWorkspace.sideMode,'kanban');
 assert.equal(app.viewWorkspace.width,50);
 assert.equal(state.undos.length,begin,'split view does not alter Undo history');
 assert.equal(JSON.stringify(state.root),root,'same tree');
 selector.value='builtin:none';selector.dispatch('change');flush();
 assert.equal(document.getElementById('nm-view-overlay').hidden,true);
 assert.equal(app.viewWorkspace.sideMode,null);
});
test('a custom workspace can be named, resized, reapplied and removed',()=>{
 const {app,state,document,flush}=harness(),history=state.undos.length;
 const selector=document.getElementById('nm-workspace-layouts');
 selector.value='builtin:timeline';selector.dispatch('change');flush();
 const width=document.getElementById('nm-workspace-width');
 width.value='63';width.dispatch('input');flush();
 assert.equal(app.viewWorkspace.width,63);
 const input=document.getElementById('nm-workspace-layout-name');
 input.value='Studio';document.getElementById('nm-workspace-save').dispatch('click');flush();
 assert.equal(app.viewWorkspace.layouts.length,1);
 assert.deepEqual({...app.viewWorkspace.layouts[0]},{name:'Studio',primaryMode:'mindmap',sideMode:'timeline',width:63});
 assert.equal(app.viewWorkspace.activeName,'Studio');
 selector.value='builtin:none';selector.dispatch('change');flush();
 assert.equal(app.viewWorkspace.sideMode,null);
 selector.value='user:0';selector.dispatch('change');flush();
 assert.equal(app.viewWorkspace.sideMode,'timeline');
 assert.equal(app.viewWorkspace.width,63);
 assert.equal(app.viewWorkspace.activeName,'Studio');
 document.getElementById('nm-workspace-remove').dispatch('click');flush();
 assert.equal(app.viewWorkspace.layouts.length,0);
 assert.equal(state.undos.length,history);
});
test('restored split workspace retains the already saved main-camera offset',()=>{
 const {app,state,context,document,flush}=harness();
 const recovered={...state,root:{...state.root,viewMode:'mindmap'}};
 const storedCamera={x:155,y:50,zoom:1};
 app.renderer={camera:{...storedCamera}};
 app.tabs=[{id:'saved',state:recovered,camera:{...storedCamera},
   viewWorkspace:{sideMode:'kanban',width:60,layouts:[],activeName:null}}];
 app.activeTabId='saved';app.state=recovered;
 context.NeuroMapLinkedViews.refresh(app);flush();
 assert.equal(document.getElementById('nm-view-overlay').className.includes('nm-side-panel'),true);
 assert.equal(document.getElementById('nm-view-overlay-picker').value,'kanban');
 assert.equal(app.renderer.camera.x,155,'camera was already offset before recovery');
 assert.equal(app.tabs[0].viewWorkspace.sideMode,'kanban');
 assert.equal(recovered.undos.length,state.undos.length,'no extra Undo step');
});
test('separate tabs remember separate workspace layouts',()=>{
 const {app,state,context,document,flush}=harness();
 const original={id:'one',state,viewWorkspace:{sideMode:'orgchart',width:50,layouts:[]}};
 const otherState={...state,root:{...state.root,viewMode:'mindmap'}};
 const other={id:'two',state:otherState,viewWorkspace:{sideMode:'kanban',width:62,layouts:[]}};
 app.tabs=[original,other];app.activeTabId='one';app.state=state;
 // Existing state was initialized before tabs; explicitly select its workspace preset.
 const picker=document.getElementById('nm-workspace-layouts');
 picker.value='builtin:orgchart';picker.dispatch('change');flush();
 app.activeTabId='two';app.state=otherState;context.NeuroMapLinkedViews.refresh(app);flush();
 assert.equal(document.getElementById('nm-view-overlay-picker').value,'kanban');
 assert.equal(other.viewWorkspace.width,62);
 app.activeTabId='one';app.state=state;context.NeuroMapLinkedViews.refresh(app);flush();
 assert.equal(document.getElementById('nm-view-overlay-picker').value,'orgchart');
 assert.equal(original.viewWorkspace.sideMode,'orgchart');
});

test('a rejected split-layout preset does not persist a phantom secondary view',()=>{
 const {app,state,context,document,flush}=harness();
 const before=JSON.stringify(app.viewWorkspace);
 const undos=state.undos.length;
 context.NeuroMapWorkspaceLayout={claim:()=>false};
 const preset=document.getElementById('nm-workspace-layouts');
 preset.value='builtin:kanban';preset.dispatch('change');flush();
 assert.equal(document.getElementById('nm-view-overlay').hidden,true);
 assert.equal(JSON.stringify(app.viewWorkspace),before,
  'a protected panel must prevent persistent layout changes');
 assert.equal(state.undos.length,undos);
});
test('named workspace layouts also capture non-mind-map primary views',()=>{
 const {app,state,context,document,flush}=harness();
 const original=state.root.children.map(n=>n.id);
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const name=document.getElementById('nm-workspace-layout-name');name.value='Rete studio';
 document.getElementById('nm-workspace-save').dispatch('click');flush();
 assert.equal(app.viewWorkspace.layouts.length,1);
 assert.equal(app.viewWorkspace.layouts[0].primaryMode,'concept-network');
 const picker=document.getElementById('nm-workspace-layouts');
 picker.value='builtin:none';picker.dispatch('change');flush();
 assert.equal(state.root.viewMode,'mindmap');
 picker.value='user:0';picker.dispatch('change');flush();
 assert.equal(state.root.viewMode,'concept-network');
 assert.deepEqual(state.root.children.map(n=>n.id),original);
});
test('file reopening reapplies split layout and offsets an unshifted camera once',()=>{
 const {app,state,context,document,flush}=harness();
 const saved={sideMode:'kanban',width:60,layouts:[
  {name:'Scrivania',primaryMode:'mindmap',sideMode:'kanban',width:60}],activeName:'Scrivania'};
 const tab={id:'reopened',filePath:'C:/Study/Map.neuromap',state,
   camera:{zoom:1,x:180,y:90},viewWorkspace:saved};
 app.renderer={camera:{...tab.camera}};
 app.tabs=[tab];app.activeTabId='reopened';
 context.NeuroMapLinkedViews.restoreFromTab(app,true);flush();
 assert.equal(document.getElementById('nm-view-overlay-picker').value,'kanban');
 assert.equal(app.tabs[0].viewWorkspace.layouts[0].name,'Scrivania');
 assert.ok(app.renderer.camera.x<180,'newly imported camera receives its first split offset');
});


test('each linked view remembers distinct zoom and position when switching visualizations',()=>{
 const {app,context,document,flush}=harness();
 let autosaves=0;app.scheduleSave=()=>{autosaves++};
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-zoom-in').dispatch('click');
 const scroller=document.getElementById('nm-view-scroller');
 scroller.scrollLeft=142;scroller.scrollTop=86;scroller.dispatch('scroll');
 assert.equal(app.viewWorkspace.cameras.orgchart.left,142);
 const firstZoom=app.viewWorkspace.cameras.orgchart.zoom;
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 document.getElementById('nm-view-zoom-out').dispatch('click');
 scroller.scrollLeft=343;scroller.scrollTop=221;scroller.dispatch('scroll');
 assert.equal(app.viewWorkspace.cameras.timeline.left,343);
 assert.notEqual(app.viewWorkspace.cameras.timeline.zoom,firstZoom);
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 assert.equal(scroller.scrollLeft,142);
 assert.equal(scroller.scrollTop,86);
 assert.equal(app.viewWorkspace.cameras.orgchart.zoom,firstZoom);
 assert.ok(autosaves>=4,'zoom and scroll schedule recovery writes');
});
test('standalone and split presentations have independent camera slots',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const scroller=document.getElementById('nm-view-scroller');
 scroller.scrollLeft=129;scroller.scrollTop=83;scroller.dispatch('scroll');
 context.NeuroMapLinkedViews.setMode(app,'mindmap');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 assert.equal(document.getElementById('nm-view-overlay-picker').value,'orgchart');
 assert.equal(app.viewWorkspace.cameras['orgchart:side'].zoom,1);
 scroller.scrollLeft=342;scroller.scrollTop=216;scroller.dispatch('scroll');
 assert.equal(app.viewWorkspace.cameras.orgchart.left,129);
 assert.equal(app.viewWorkspace.cameras['orgchart:side'].left,342);
 document.getElementById('nm-view-split').dispatch('click');flush();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 assert.equal(scroller.scrollLeft,129);
 assert.equal(scroller.scrollTop,83);
});
test('workspace-recovered view camera restores position, zoom, and root identity',()=>{
 const first=harness();const {app,context,document,flush,state}=first;
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 document.getElementById('nm-view-zoom-in').dispatch('click');
 const camera=app.viewWorkspace.cameras['concept-tree'];
 const scroller=document.getElementById('nm-view-scroller');
 scroller.scrollLeft=230;scroller.scrollTop=144;scroller.dispatch('scroll');
 const previous=JSON.stringify(state.root);
 const snapshot=JSON.parse(JSON.stringify(app.viewWorkspace));
 const next=harness();
 next.app.tabs=[{id:'recovered',state:next.state,viewWorkspace:snapshot}];
 next.app.activeTabId='recovered';
 next.state.root.viewMode='concept-tree';
 next.context.NeuroMapLinkedViews.refresh(next.app);next.flush();
 assert.equal(next.document.getElementById('nm-view-zoom-status').textContent,Math.round(camera.zoom*100)+'%');
 assert.equal(next.document.getElementById('nm-view-scroller').scrollLeft,230);
 assert.equal(next.document.getElementById('nm-view-scroller').scrollTop,144);
 assert.deepEqual(JSON.parse(JSON.stringify(next.app.tabs[0].viewWorkspace.cameras['concept-tree'])),JSON.parse(JSON.stringify(camera)));
 assert.equal(JSON.stringify(state.root),previous,'recovery only stores the viewing camera');
});
test('two workspace tabs isolate their saved camera positions for the same view',()=>{
 const {app,state,context,document,flush}=harness();
 const clone={...state,root:{...state.root,viewMode:'orgchart'}};
 const first={id:'one',state,viewWorkspace:{sideMode:null,width:50,layouts:[],cameras:{}}};
 const second={id:'two',state:clone,viewWorkspace:{sideMode:null,width:50,layouts:[],
  cameras:{orgchart:{zoom:.65,left:410,top:270}}}};
 app.tabs=[first,second];app.activeTabId='one';
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const sc=document.getElementById('nm-view-scroller');
 sc.scrollLeft=102;sc.scrollTop=71;sc.dispatch('scroll');
 app.activeTabId='two';app.state=clone;context.NeuroMapLinkedViews.refresh(app);flush();
 assert.equal(sc.scrollLeft,410);
 assert.equal(sc.scrollTop,270);
 assert.equal(document.getElementById('nm-view-zoom-status').textContent,'65%');
 app.activeTabId='one';app.state=state;context.NeuroMapLinkedViews.refresh(app);flush();
 assert.equal(sc.scrollLeft,102);
 assert.equal(sc.scrollTop,71);
 assert.equal(first.viewWorkspace.cameras.orgchart.zoom,1);
 assert.equal(second.viewWorkspace.cameras.orgchart.zoom,.65);
});


test('all six alternative views have recoverable independent scroll and zoom',()=>{
 const {app,context,document,flush}=harness(),cameras={};
 const modes=['orgchart','concept-tree','concept-network','flowchart','kanban','timeline'];
 const scroller=document.getElementById('nm-view-scroller');
 for(const [i,mode]of modes.entries()){
  context.NeuroMapLinkedViews.setMode(app,mode);flush();
  if(i%2===0)document.getElementById('nm-view-zoom-in').dispatch('click');
  else document.getElementById('nm-view-zoom-out').dispatch('click');
  scroller.scrollLeft=120+i*70;scroller.scrollTop=65+i*35;scroller.dispatch('scroll');
  cameras[mode]={...app.viewWorkspace.cameras[mode]};
 }
 assert.equal(Object.keys(app.viewWorkspace.cameras).length,6);
 for(const mode of modes){
  context.NeuroMapLinkedViews.setMode(app,mode);flush();
  assert.equal(scroller.scrollLeft,cameras[mode].left,mode+' scrollLeft');
  assert.equal(scroller.scrollTop,cameras[mode].top,mode+' scrollTop');
  assert.equal(app.viewWorkspace.cameras[mode].zoom,cameras[mode].zoom);
 }
});
test('primary mind map schedules a recovery snapshot after viewport navigation',()=>{
 const {app,state}=harness();
 let saves=0;
 app.scheduleSave=()=>{saves++};
 app.renderer={camera:{x:500,y:210,zoom:1}};
 const before=state.undos.length;
 app.requestRender();
 assert.equal(saves,1);
 app.requestRender();assert.equal(saves,1,'painting alone must not repeatedly autosave');
 app.renderer.camera.x=465;app.requestRender();
 app.renderer.camera.zoom=.72;app.requestRender();
 app.renderer.camera.y=180;app.requestRender();
 assert.equal(saves,4,'pan and zoom each trigger a coalescible workspace autosave');
 assert.equal(state.undos.length,before,'viewport changes cannot mutate logical undo history');
 app._desktopRecoveryPending=true;
 app.renderer.camera.x=350;app.requestRender();
 assert.equal(saves,4,'do not overwrite an in-progress native startup recovery');
});
test('switching view captures pending scroll offsets even before a scroll event',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const scroll=document.getElementById('nm-view-scroller');
 scroll.scrollLeft=258;scroll.scrollTop=155;
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 assert.equal(app.viewWorkspace.cameras.orgchart.left,258);
 assert.equal(app.viewWorkspace.cameras.orgchart.top,155);
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 assert.equal(scroll.scrollLeft,258);
 assert.equal(scroll.scrollTop,155);
});


test('non-mind-map views can be paired with the live same-node second pane',()=>{
 const {app,state,context,document,flush}=harness();
 const before=JSON.stringify(state.root),history=state.undos.length;
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const pane=document.getElementById('nm-dual-pane');
 assert.equal(pane.hidden,false);
 assert.equal(document.getElementById('nm-view-overlay').hidden,false);
 assert.equal(document.getElementById('nm-view-overlay').className.includes('nm-dual-view'),true);
 assert.equal(document.getElementById('nm-dual-picker').value,'kanban');
 assert.equal(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').length,3);
 assert.equal(document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card').length,2);
 assert.equal(state.undos.length,history+1,'only the user-chosen primary view was persisted');
 assert.equal(JSON.stringify({...state.root,viewMode:undefined}),before);
 document.getElementById('nm-dual-picker').value='concept-tree';
 document.getElementById('nm-dual-picker').dispatch('change');flush();
 assert.equal(document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card').length,3);
 assert.equal(state.root.viewMode,'orgchart','secondary view does not rewrite primary');
 document.getElementById('nm-dual-close').dispatch('click');flush();
 assert.equal(document.getElementById('nm-dual-pane').hidden,true);
 assert.equal(state.root.viewMode,'orgchart');
});
test('secondary-pane Kanban status changes synchronize into the primary model and Undo',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const before=state.undos.length;
 const card=document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card').find(x=>x.dataset.nodeId==='prepare');
 const status=card.querySelector('select');
 assert.ok(status);
 status.value='done';status.dispatch('change');flush();
 assert.equal(state.findNode('prepare').taskStatus,'done');
 assert.equal(state.undos.length,before+1);
 assert.equal(document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card').length,2);
 assert.equal(state.root.children.length,2);
});
test('secondary-pane inline renames update the same node visible in the primary view',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');
 picker.value='concept-tree';picker.dispatch('change');flush();
 const card=document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card').find(x=>x.dataset.nodeId==='check');
 card.dispatch('dblclick',{target:card,stopPropagation(){}});
 const field=card.querySelector('input');assert.ok(field,'a real in-place editor opens');
 field.value='Revised name';field.dispatch('keydown',{key:'Enter',preventDefault(){},stopPropagation(){}});
 flush();
 assert.equal(state.findNode('check').text,'Revised name');
 assert.ok(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').some(
  x=>x.querySelector('.nm-view-title')?.textContent==='Revised name'));
});
test('two linked panes retain independent zoom and scroll cameras',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const main=document.getElementById('nm-view-scroller'),other=document.getElementById('nm-dual-scroller');
 main.scrollLeft=113;main.scrollTop=62;main.dispatch('scroll');
 other.scrollLeft=273;other.scrollTop=159;other.dispatch('scroll');
 document.getElementById('nm-dual-zoom-in').dispatch('click');
 const cameras=app.viewWorkspace.cameras;
 assert.equal(cameras.orgchart.left,113);
 assert.equal(cameras.kanban,undefined,'standalone Kanban slot is not opened by a secondary pane');
 assert.equal(cameras['kanban:side'].zoom,1.2);
 assert.equal(cameras.orgchart.zoom,1);
 assert.equal(main.scrollLeft,113);
 const before=state.undos.length;
 document.getElementById('nm-dual-picker').value='concept-tree';
 document.getElementById('nm-dual-picker').dispatch('change');flush();
 document.getElementById('nm-dual-picker').value='kanban';
 document.getElementById('nm-dual-picker').dispatch('change');flush();
 assert.equal(cameras['kanban:side'].zoom,1.2);
 assert.equal(state.undos.length,before,'secondary zoom/switch cannot edit logical document');
});
test('selecting mind map as the secondary view preserves the non-map source nodes',()=>{
 const {app,state,context,document,flush}=harness();
 const ids=state.root.children.map(n=>n.id);
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');
 picker.value='mindmap';picker.dispatch('change');flush();
 assert.equal(state.root.viewMode,'mindmap');
 assert.equal(document.getElementById('nm-view-overlay').className.includes('nm-side-panel'),true);
 assert.equal(document.getElementById('nm-view-overlay-picker').value,'kanban');
 assert.deepEqual(state.root.children.map(n=>n.id),ids);
});
test('named layouts restore a pair of alternate views without duplicate project trees',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 assert.equal(document.getElementById('nm-dual-picker').value,'timeline');
 const input=document.getElementById('nm-workspace-layout-name');input.value='Activities';
 document.getElementById('nm-workspace-save').dispatch('click');flush();
 const saved=app.viewWorkspace.layouts[0];
 assert.deepEqual({...saved},{name:'Activities',primaryMode:'kanban',sideMode:'timeline',width:50});
 document.getElementById('nm-dual-close').dispatch('click');flush();
 assert.equal(document.getElementById('nm-dual-pane').hidden,true);
 const layouts=document.getElementById('nm-workspace-layouts');
 layouts.value='user:0';layouts.dispatch('change');flush();
 assert.equal(document.getElementById('nm-dual-pane').hidden,false);
 assert.equal(document.getElementById('nm-dual-picker').value,'timeline');
 assert.equal(state.root.viewMode,'kanban');
});


test('header picker changes primary mode, not secondary, in a two-alternate-view split',()=>{
 const {app,state,context,document,flush}=harness();
 const originalChildren=JSON.stringify(state.root.children);
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const mainPicker=document.getElementById('nm-view-overlay-picker');
 const sidePicker=document.getElementById('nm-dual-picker');
 assert.equal(mainPicker.value,'orgchart');
 assert.equal(sidePicker.value,'kanban');
 const before=state.undos.length;
 mainPicker.value='concept-tree';mainPicker.dispatch('change');flush();
 assert.equal(state.root.viewMode,'concept-tree','the header owns the primary view');
 assert.equal(mainPicker.value,'concept-tree');
 assert.equal(sidePicker.value,'kanban','the secondary picker remains unchanged');
 assert.equal(document.getElementById('nm-dual-pane').hidden,false);
 assert.equal(state.undos.length,before+1,'only the primary view transition adds Undo');
 const noOpHistory=state.undos.length;
 mainPicker.dispatch('change');flush();
 assert.equal(document.getElementById('nm-dual-pane').hidden,false,
  'selecting the already active primary mode must not close split');
 assert.equal(state.undos.length,noOpHistory);
 mainPicker.value='mindmap';mainPicker.dispatch('change');flush();
 assert.equal(state.root.viewMode,'mindmap','main + alternate split remains supported');
 assert.equal(document.getElementById('nm-view-overlay-picker').value,'kanban');
 assert.equal(document.getElementById('nm-dual-pane').hidden,true,
  'the side panel representation replaces the two-alternate-view split');
 assert.equal(JSON.stringify(state.root.children),originalChildren,'canonical data unchanged');
});
test('every ordered pair of six alternate views shares one tree and keeps the chosen modes',()=>{
 const {app,state,context,document,flush}=harness();
 const modes=['orgchart','concept-tree','concept-network','flowchart','kanban','timeline'];
 const ids=state.root.children.map(n=>n.id),before=state.undos.length;
 let pairs=0;
 for(const primary of modes){
  context.NeuroMapLinkedViews.setMode(app,primary);flush();
  document.getElementById('nm-view-split').dispatch('click');flush();
  for(const secondary of modes.filter(x=>x!==primary)){
   const pick=document.getElementById('nm-dual-picker');
   pick.value=secondary;pick.dispatch('change');flush();
   assert.equal(document.getElementById('nm-dual-pane').hidden,false);
   assert.equal(pick.value,secondary);
   assert.equal(state.root.viewMode,primary);
   assert.deepEqual(state.root.children.map(n=>n.id),ids);
   pairs++;
  }
  document.getElementById('nm-dual-close').dispatch('click');flush();
 }
 assert.equal(pairs,30);
 assert.equal(state.undos.length,before+6,'only primary presentation changes enter history');
});


test('dual Timeline edits task dates atomically and synchronizes the same saved node',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');picker.value='timeline';picker.dispatch('change');flush();
 const task=document.getElementById('nm-dual-task'),start=document.getElementById('nm-dual-start'),
  due=document.getElementById('nm-dual-due');
 task.value='prepare';task.dispatch('change');
 start.value='2026-11-01';due.value='2026-11-10';
 const initial=state.undos.length;
 document.getElementById('nm-dual-apply-dates').dispatch('click');flush();
 assert.equal(state.findNode('prepare').startDate,'2026-11-01');
 assert.equal(state.findNode('prepare').dueDate,'2026-11-10');
 assert.equal(state.undos.length,initial+1);
 assert.ok(document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card')
  .some(x=>x.dataset.nodeId==='prepare'),'dated task is now visible in paired Timeline');
});
test('dual conceptual network creates labeled relations without duplicating logical nodes',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');picker.value='concept-network';picker.dispatch('change');flush();
 const orig=state.root.children.map(n=>n.id),begin=state.undos.length;
 document.getElementById('nm-dual-relation-label').value='causes';
 document.getElementById('nm-dual-connect').dispatch('click');flush();
 let card=document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card').find(x=>x.dataset.nodeId==='prepare');
 card.dispatch('click',{target:card,preventDefault(){},stopImmediatePropagation(){}});flush();
 card=document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card').find(x=>x.dataset.nodeId==='check');
 card.dispatch('click',{target:card,preventDefault(){},stopImmediatePropagation(){}});flush();
 assert.equal(state.relationships.length,1);
 assert.equal(state.relationships[0].label,'causes');
 assert.equal(state.undos.length,begin+1);
 assert.deepEqual(state.root.children.map(n=>n.id),orig);
});
test('dual workflow adds an explicit Yes transition, never implicit edges',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');picker.value='flowchart';picker.dispatch('change');flush();
 assert.equal(state.relationships.length,0);
 document.getElementById('nm-dual-flow-from').value='prepare';
 document.getElementById('nm-dual-flow-to').value='check';
 document.getElementById('nm-dual-flow-kind').value='yes';
 const begin=state.undos.length;
 document.getElementById('nm-dual-flow-add').dispatch('click');flush();
 assert.deepEqual(state.relationships.map(x=>[x.fromId,x.toId,x.kind]),[['prepare','check','yes']]);
 assert.equal(state.undos.length,begin+1);
 assert.equal(state.root.children.length,2);
});


test('restored Kanban and Timeline pair reloads saved right-hand zoom, width and nodes',()=>{
 const {app,state,context,document,flush}=harness();
 state.root.viewMode='kanban';
 const tab={id:'recover-pair',state,viewWorkspace:{
  sideMode:'timeline',width:60,activeName:'Research workflow',
  layouts:[{name:'Research workflow',primaryMode:'kanban',sideMode:'timeline',width:60}],
  cameras:{kanban:{zoom:.9,left:110,top:85},
   'timeline:side':{zoom:1.4,left:320,top:205}}}};
 app.tabs=[tab];app.activeTabId='recover-pair';
 const ids=state.root.children.map(n=>n.id);
 context.NeuroMapLinkedViews.restoreFromTab(app);flush();
 assert.equal(document.getElementById('nm-dual-pane').hidden,false);
 assert.equal(document.getElementById('nm-dual-picker').value,'timeline');
 assert.equal(document.getElementById('nm-dual-pane').style.flex,'0 0 60%');
 assert.equal(document.getElementById('nm-dual-zoom-status').textContent,'140%');
 assert.equal(document.getElementById('nm-dual-scroller').scrollLeft,320);
 assert.equal(document.getElementById('nm-dual-scroller').scrollTop,205);
 assert.equal(document.getElementById('nm-view-scroller').scrollLeft,110);
 assert.deepEqual(state.root.children.map(n=>n.id),ids);
 assert.equal(state.undos.length,0,'recovery does not create a new version');
});


test('two-finger pinch and one-finger pan on the right diagram do not affect left camera',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const sc=document.getElementById('nm-dual-scroller'),stage=document.getElementById('nm-dual-stage');
 const leftCam={...app.viewWorkspace.cameras.orgchart},history=state.undos.length;
 sc.dispatch('pointerdown',pointer(31,200,200,stage));
 sc.dispatch('pointerdown',pointer(32,300,200,stage));
 sc.dispatch('pointermove',pointer(32,400,200,stage));
 assert.equal(app.viewWorkspace.cameras['kanban:side'].zoom,2);
 sc.dispatch('pointerup',pointer(32,400,200,stage));
 sc.dispatch('pointerup',pointer(31,200,200,stage));
 assert.equal(stage._nmGesturePinching,false);
 sc.scrollLeft=250;
 sc.dispatch('pointerdown',pointer(33,240,150,stage));
 sc.dispatch('pointermove',pointer(33,210,150,stage));
 assert.equal(sc.scrollLeft,280);
 sc.dispatch('pointerup',pointer(33,210,150,stage));
 assert.equal(app.viewWorkspace.cameras['kanban:side'].left,280);
 assert.deepEqual({...app.viewWorkspace.cameras.orgchart},leftCam);
 assert.equal(state.undos.length,history);
});
test('Ctrl-wheel over second pane zooms only that pane, without changing app chrome',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const stage=document.getElementById('nm-dual-stage');let prevented=false;
 document.dispatch('wheel',{ctrlKey:true,metaKey:false,deltaMode:0,deltaY:-100,
  target:stage,clientX:170,clientY:180,
  preventDefault(){prevented=true},stopImmediatePropagation(){}});
 assert.equal(prevented,true);
 assert.ok(app.viewWorkspace.cameras['kanban:side'].zoom>1);
 assert.equal(app.viewWorkspace.cameras.orgchart.zoom,1);
});


test('three ready-made dual-view presets create synchronized pairs from one project',()=>{
 const {app,state,document,flush}=harness();
 const original=state.root.children.map(n=>n.id),layout=document.getElementById('nm-workspace-layouts');
 for(const [choice,primary,secondary]of [
  ['builtin:kanban-timeline','kanban','timeline'],
  ['builtin:network-orgchart','concept-network','orgchart'],
  ['builtin:tree-flow','concept-tree','flowchart']]){
  layout.value=choice;layout.dispatch('change');flush();
  assert.equal(state.root.viewMode,primary);
  assert.equal(document.getElementById('nm-dual-picker').value,secondary);
  assert.equal(document.getElementById('nm-dual-pane').hidden,false);
  assert.deepEqual(state.root.children.map(n=>n.id),original);
 }
});


test('F2 and Enter rename nodes consistently in primary, secondary and Timeline views',()=>{
 const {app,state,context,document,flush}=harness();
 const key=(card,kind)=>card.dispatch('keydown',{target:card,key:kind,preventDefault(){},stopPropagation(){}});
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 let card=document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').find(x=>x.dataset.nodeId==='prepare');
 key(card,'F2');
 let field=card.querySelector('.nm-view-edit');assert.ok(field,'F2 must open editor');
 field.value='Updated main';field.dispatch('keydown',{key:'Enter',stopPropagation(){},preventDefault(){}});
 flush();assert.equal(state.findNode('prepare').text,'Updated main');
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');picker.value='orgchart';picker.dispatch('change');flush();
 card=document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card').find(x=>x.dataset.nodeId==='check');
 key(card,'Enter');field=card.querySelector('.nm-view-edit');assert.ok(field,'Enter must edit second view');
 field.value='Updated secondary';field.dispatch('keydown',{key:'Enter',stopPropagation(){},preventDefault(){}});
 flush();assert.equal(state.findNode('check').text,'Updated secondary');
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 const task=document.getElementById('nm-work-node');task.value='check';task.dispatch('change');
 document.getElementById('nm-work-start').value='2026-11-01';
 document.getElementById('nm-work-end').value='2026-11-05';
 document.getElementById('nm-work-apply').dispatch('click');flush();
 card=document.getElementById('nm-view-stage').querySelectorAll('.nm-timeline-card').find(x=>x.dataset.nodeId==='check');
 assert.ok(card,'dated task exists in Timeline');
 key(card,'F2');field=card.querySelector('.nm-view-edit');assert.ok(field,'timeline supports inline F2');
 field.value='Updated timeline';field.dispatch('keydown',{key:'Enter',stopPropagation(){},preventDefault(){}});
 flush();assert.equal(state.findNode('check').text,'Updated timeline');
 assert.equal(document.getElementById('nm-view-action-status').textContent,'Nodo rinominato');
});
test('Insert adds one child and preserves ordinary Tab keyboard navigation',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 let card=document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').find(x=>x.dataset.nodeId==='prepare');
 const original=state.undos.length,childrenBefore=state.findNode('prepare').children.length;
 let caught=0;
 const keyboard=key=>card.dispatch('keydown',{target:card,key,preventDefault(){caught++},stopPropagation(){}});
 keyboard('Tab');assert.equal(caught,0,'Tab is left for focus navigation');
 keyboard('Insert');flush();assert.equal(caught,1);
 assert.equal(state.findNode('prepare').children.length,childrenBefore+1);
 assert.equal(state.undos.length,original+1);
 assert.equal(document.getElementById('nm-view-action-status').textContent,'Sottoramo aggiunto');
});
test('right click and Shift+F10 share contextual commands, Escape closes menu only',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 let card=document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card').find(x=>x.dataset.nodeId==='prepare');
 let prevented=false;
 card.dispatch('contextmenu',{target:card,clientX:180,clientY:220,
  preventDefault(){prevented=true},stopPropagation(){}});
 const menu=document.getElementById('nm-view-context');
 assert.equal(prevented,true);assert.equal(menu.hidden,false);
 assert.equal(menu.children.length,4);
 assert.equal(menu.children[0].dataset.action,'rename');
 assert.equal(menu.children[1].dataset.action,'child');
 assert.equal(menu.children[2].disabled,true,'no children yet to focus');
 const original=state.undos.length;
 document.getElementById('nm-view-overlay').dispatch('keydown',{key:'Escape',target:card,
  preventDefault(){},stopPropagation(){}});
 assert.equal(menu.hidden,true);
 assert.equal(document.getElementById('nm-view-overlay').hidden,false,'Escape should not close the view');
 assert.equal(state.undos.length,original);
 card.dispatch('keydown',{key:'F10',shiftKey:true,target:card,preventDefault(){},stopPropagation(){}});
 assert.equal(menu.hidden,false);
 menu.children[1].dispatch('click');flush();
 assert.equal(state.findNode('prepare').children.length,1);
 assert.equal(state.undos.length,original+1);
 assert.equal(menu.hidden,true);
});
test('context menus also work in paired secondary cards without copying nodes',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const mode=document.getElementById('nm-dual-picker');mode.value='concept-tree';mode.dispatch('change');flush();
 const target=document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card').find(x=>x.dataset.nodeId==='check');
 target.dispatch('contextmenu',{target,clientX:50,clientY:40,
  preventDefault(){},stopPropagation(){}});
 const menu=document.getElementById('nm-view-context');
 assert.equal(menu.hidden,false);
 const original=state.root.children.map(n=>n.id);
 menu.children[0].dispatch('click');
 assert.ok(target.querySelector('.nm-view-edit'));
 assert.deepEqual(state.root.children.map(n=>n.id),original);
});


test('dual organization chart uses the same expand/collapse button and one Undo step',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').children.push({id:'child-a',text:'Detail',parentId:'prepare',children:[]});
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 document.getElementById('nm-dual-picker').value='orgchart';
 document.getElementById('nm-dual-picker').dispatch('change');flush();
 let card=document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card')
   .find(x=>x.dataset.nodeId==='prepare');
 let button=card.querySelector('.nm-view-collapse');
 assert.ok(button,'matching collapse control in secondary view');
 assert.equal(button.getAttribute('aria-expanded'),'true');
 const previous=state.undos.length;
 button.dispatch('click',{stopPropagation(){}});flush();
 assert.equal(state.findNode('prepare').collapsed,true);
 assert.equal(state.undos.length,previous+1);
 card=document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card')
   .find(x=>x.dataset.nodeId==='prepare');
 button=card.querySelector('.nm-view-collapse');
 assert.ok(button);
 assert.equal(button.getAttribute('aria-expanded'),'false');
});
test('double-clicking a Timeline bar edits the same logical task',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').startDate='2026-11-01';
 state.findNode('prepare').dueDate='2026-11-03';
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 const card=document.getElementById('nm-view-stage').querySelectorAll('.nm-timeline-card')[0];
 assert.ok(card);
 const before=state.undos.length;
 card.dispatch('dblclick',{target:card,stopPropagation(){}});
 const input=card.querySelector('.nm-view-edit');
 assert.ok(input,'timeline has the same inline editor');
 input.value='Milestone changed';input.dispatch('keydown',{key:'Enter',stopPropagation(){},preventDefault(){}});
 flush();
 assert.equal(state.findNode('prepare').text,'Milestone changed');
 assert.equal(state.undos.length,before+1);
});


test('localized shortcut legend and menus retain accessible English action names',()=>{
 const {app,context,document,flush}=harness();
 document.documentElement.lang='en';
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 const help=document.getElementById('nm-view-help');
 assert.ok(help.textContent.includes('F2/Enter'));
 assert.ok(help.textContent.includes('Shift+F10'));
 const card=document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card')
   .find(x=>x.dataset.nodeId==='prepare');
 assert.ok(card.getAttribute('aria-keyshortcuts').includes('Shift+F10'));
 card.dispatch('contextmenu',{target:card,preventDefault(){},stopPropagation(){}});
 const menu=document.getElementById('nm-view-context');
 assert.equal(menu.getAttribute('aria-label'),'Actions for Prepare');
 assert.equal(menu.children[0].children[0].textContent,'Rename');
 assert.equal(menu.children[1].children[0].textContent,'Add child');
 assert.equal(menu.children[0].getAttribute('role'),'menuitem');
});
test('outside pointer press dismisses node menu without modifying the map',()=>{
 const {app,context,document,state,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const card=document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card')
   .find(x=>x.dataset.nodeId==='prepare');
 card.dispatch('contextmenu',{target:card,preventDefault(){},stopPropagation(){}});
 const menu=document.getElementById('nm-view-context');
 assert.equal(menu.hidden,false);
 const stateBefore=JSON.stringify(state.root),history=state.undos.length;
 document.dispatch('pointerdown',{target:document.getElementById('nm-view-scroller')});
 assert.equal(menu.hidden,true);
 assert.equal(JSON.stringify(state.root),stateBefore);
 assert.equal(state.undos.length,history);
});


test('per-view theme changes update live canvas, preserve the shared model and survive mode switching',()=>{
 const {app,state,context,document,flush}=harness();
 const original=JSON.stringify(state.root.children);
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const theme=document.getElementById('nm-view-appearance-theme');
 assert.equal(document.getElementById('nm-view-appearance').hidden,false);
 theme.value='paper';theme.dispatch('change');flush();
 assert.equal(state.root.viewAppearance.modes.kanban.preset,'paper');
 assert.equal(document.getElementById('nm-view-scroller').style.backgroundColor,'#f3f6fc');
 assert.ok(document.getElementById('nm-view-stage').querySelector('.nm-work-card').style.backgroundColor==='#ffffff');
 const old=state.undos.length;
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 assert.equal(document.getElementById('nm-view-scroller').style.backgroundColor,'#ffffff');
 assert.equal(document.querySelector('.nm-view-header').style.backgroundColor,'#ffffff');
 assert.equal(document.getElementById('nm-view-overlay').style.getPropertyValue('--nm-view-control'),'#ffffff');
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 assert.equal(theme.value,'paper');
 assert.equal(state.root.viewAppearance.modes.orgchart,undefined);
 assert.ok(state.undos.length>=old);
 assert.equal(JSON.stringify(state.root.children),original);
});

test('views without a saved appearance follow the chosen map background, including the header controls',()=>{
 const {app,state,context,document,flush}=harness();
 context.neuroMapApp=app;
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 const scroller=document.getElementById('nm-view-scroller');
 const overlay=document.getElementById('nm-view-overlay');
 assert.equal(scroller.style.backgroundColor,'#ffffff');
 assert.equal(overlay.style.backgroundColor,'#ffffff');
 assert.equal(document.querySelector('.nm-view-header').style.color,'#16243d');
 assert.equal(overlay.style.getPropertyValue('--nm-view-control'),'#ffffff');
 assert.match(document.getElementById('nm-view-styles').textContent,/#nm-view-appearance>summary,#nm-view-overlay #nm-view-export-menu>summary\{[^}]*var\(--nm-view-control,#ffffff\)/);
 context.getComputedStyle=()=>({getPropertyValue:name=>name==='--bg-canvas'?'#090e1b':''});
 document.dispatch('neuromap:canvas-theme');flush();
 assert.equal(scroller.style.backgroundColor,'#090e1b');
 assert.notEqual(overlay.style.getPropertyValue('--nm-view-control'),'#ffffff');
 state.root.viewAppearance=context.NeuroMapViewAppearance.update(null,'timeline',{preset:'paper'});
 document.dispatch('neuromap:canvas-theme');flush();
 assert.equal(scroller.style.backgroundColor,'#f3f6fc');
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 assert.equal(document.getElementById('nm-view-scroller').style.backgroundColor,'#090e1b');
});

test('node-only style does not affect sibling nodes, task fields, or other views',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 state.selectedNodeId='prepare';context.NeuroMapLinkedViews.refresh(app);flush();
 const only=document.getElementById('nm-view-appearance-node');
 only.checked=true;only.dispatch('change');
 const accent=document.getElementById('nm-view-appearance-accent');
 accent.value='#cc0066';accent.dispatch('change');flush();
 assert.equal(state.root.viewAppearance.modes.kanban.elements.prepare.accent,'#cc0066');
 assert.equal(state.root.children[0].color,undefined);
 assert.equal(state.root.children[0].taskStatus,undefined);
 const cards=document.getElementById('nm-view-stage').querySelectorAll('.nm-work-card');
 assert.equal(cards.find(c=>c.dataset.nodeId==='prepare').style.borderColor,'#cc0066');
 assert.notEqual(cards.find(c=>c.dataset.nodeId==='check').style.borderColor,'#cc0066');
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 assert.notEqual(document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card')
   .find(c=>c.dataset.nodeId==='prepare').style.borderColor,'#cc0066');
});


test('linked-view SVG export includes active background and per-node card colors',()=>{
 const {app,state,context,document,flush}=harness();
 let captured=null,download=null;
 context.XMLSerializer=class{serializeToString(svg){captured=svg;return '<svg data-test="linked-view"/>'}};
 context.Blob=class{constructor(parts,options){this.parts=parts;this.options=options}};
 app.io={triggerDownload(blob,name){download={blob,name};return true}};
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const theme=document.getElementById('nm-view-appearance-theme');
 theme.value='paper';theme.dispatch('change');flush();
 state.root.viewAppearance=appearance.update(state.root.viewAppearance,'orgchart',{accent:'#d00080'},'prepare');
 const successful=context.NeuroMapLinkedViews.exportSVG(app);
 assert.equal(successful,true);
 assert.ok(download.name.endsWith('orgchart.svg'));
 const rects=captured.children.filter(el=>el.tagName==='rect');
 assert.equal(rects[0].attributes.fill,'#f3f6fc');
 assert.equal(rects.find(el=>el.attributes.stroke==='#d00080').attributes.fill,'#ffffff');
 assert.equal(state.root.children[0].color,undefined);
});

test('network cards show stable cluster markers and abbreviate only visual relationship labels',()=>{
 const {app,state,context,document,flush}=harness();
 const full='A very long scientific connection that needs a shorter visual label';
 state.addRelationship('prepare','check',full);
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const stage=document.getElementById('nm-view-stage'),cards=stage.querySelectorAll('.nm-network-card');
 assert.equal(cards.length,3);
 assert.equal(cards.find(c=>c.dataset.nodeId==='root').dataset.cluster,undefined);
 assert.equal(cards.find(c=>c.dataset.nodeId==='prepare').dataset.cluster,'0');
 assert.equal(cards.find(c=>c.dataset.nodeId==='check').dataset.cluster,'1');
 const label=stage.querySelector('.nm-network-label');
 assert.ok(label.textContent.endsWith('…'));
 assert.equal(label.getAttribute('aria-label'),full);
 assert.equal(state.relationships[0].label,full,'the canonical relation is never shortened');
});

test('network SVG export includes cluster markers, theme-aware relation stroke and full accessible labels',()=>{
 const {app,state,context,flush}=harness();
 let captured=null;
 context.XMLSerializer=class{serializeToString(svg){captured=svg;return '<svg data-network-test="true"/>'}};
 context.Blob=class{constructor(parts,options){this.parts=parts;this.options=options}};
 app.io={triggerDownload(){return true}};
 const full='A very long meaningful relationship between two study concepts';
 state.addRelationship('prepare','check',full);
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const clusters=captured.children.filter(el=>el.tagName==='circle');
 assert.equal(clusters.length,2);
 assert.ok(clusters.every(el=>el.getAttribute('stroke-width')==='0'&&el.getAttribute('data-network-cluster')==='1'));
 const links=captured.children.filter(el=>el.tagName==='path');
 assert.ok(links.some(el=>el.attributes.stroke==='#6441df'&&el.attributes['stroke-width']==='2.5'));
 const text=captured.children.filter(el=>el.tagName==='text').find(el=>el.getAttribute('aria-label')===full);
 assert.ok(text&&text.textContent.endsWith('…'));
 assert.equal(state.relationships[0].label,full);
});

test('network-only themes are visible in the selector, retained, and isolated from other views',()=>{
 const {app,context,state,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const picker=document.getElementById('nm-view-appearance-theme');
 assert.equal(picker.options.length,6);
 picker.value='cluster';picker.dispatch('change');flush();
 assert.equal(state.root.viewAppearance.modes['concept-network'].preset,'cluster');
 assert.equal(document.getElementById('nm-view-scroller').style.backgroundColor,'#edf6f5');
 picker.value='signal';picker.dispatch('change');flush();
 assert.equal(state.root.viewAppearance.modes['concept-network'].preset,'signal');
 assert.equal(document.getElementById('nm-view-scroller').style.backgroundColor,'#090f20');
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 assert.equal(picker.options.length,8);
 assert.equal(state.root.viewAppearance.modes.orgchart,undefined);
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 assert.equal(picker.options.length,6);
 assert.equal(picker.value,'signal');
});

test('network labels have matching SVG background plates and keep full accessible text',()=>{
 const {app,state,context,document,flush}=harness();
 const full='A relationship name too long to fit without a readable label plate';
 state.addRelationship('prepare','check',full);
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const svg=document.getElementById('nm-view-lines');
 const plate=svg.querySelector('.nm-network-label-plate');
 const label=svg.querySelector('.nm-network-label');
 assert.ok(plate&&label);
 assert.equal(plate.getAttribute('visibility'),'visible');
 assert.equal(label.getAttribute('visibility'),'visible');
 assert.ok(label.textContent.endsWith('…'));
 assert.equal(label.getAttribute('aria-label'),full);
 const picker=document.getElementById('nm-view-appearance-theme');
 picker.value='cluster';picker.dispatch('change');flush();
 const updated=document.getElementById('nm-view-lines').querySelector('.nm-network-label');
 assert.equal(updated.getAttribute('fill'),'#123845');
 assert.equal(state.relationships[0].label,full);
});

test('concept tree shows group and depth metadata without recoloring shared node data',()=>{
 const {app,state,context,document,flush}=harness();
 const original=JSON.stringify(state.root.children);
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 const picker=document.getElementById('nm-view-appearance-theme');
 assert.equal(picker.options.length,9);
 picker.value='academic';picker.dispatch('change');flush();
 const cards=document.getElementById('nm-view-stage').querySelectorAll('.nm-tree-card');
 assert.equal(cards.length,2);
 assert.equal(cards[0].dataset.group,'0');
 assert.equal(cards[1].dataset.group,'1');
 assert.ok(cards.every(card=>card.dataset.depth==='1'));
 assert.equal(document.getElementById('nm-view-scroller').style.backgroundColor,'#f8fafc');
 assert.equal(JSON.stringify(state.root.children),original);
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 assert.equal(picker.options.length,8);
});

test('concept tree SVG exports the same group and depth visual markers as its cards',()=>{
 const {app,state,context,flush}=harness();
 let svg=null;
 context.XMLSerializer=class{serializeToString(value){svg=value;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const stripes=svg.children.filter(el=>el.tagName==='rect'&&el.getAttribute('height')==='4');
 const badges=svg.children.filter(el=>el.tagName==='circle');
 assert.equal(stripes.length,2);
 assert.equal(badges.length,2);
 assert.equal(state.root.children[0].color,undefined);
});

test('actual palette previews offer reversible one-click choices per view and respect node-only scope',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const container=document.getElementById('nm-view-appearance-presets');
 assert.equal(container.children.length,6);
 const cluster=container.children.find(el=>el.dataset.preset==='cluster');
 assert.ok(cluster.querySelector('.nm-preset-swatch'));
 const before=state.undos.length;
 cluster.dispatch('click');flush();
 assert.equal(state.root.viewAppearance.modes['concept-network'].preset,'cluster');
 assert.equal(state.undos.length,before+1);
 assert.equal(cluster.getAttribute('aria-pressed'),'true');
 assert.equal(document.getElementById('nm-view-appearance-theme').value,'cluster');
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 assert.equal(container.children.length,9);
 const academic=container.children.find(el=>el.dataset.preset==='academic');
 academic.dispatch('click');flush();
 assert.equal(state.root.viewAppearance.modes['concept-tree'].preset,'academic');
 assert.equal(state.root.viewAppearance.modes['concept-network'].preset,'cluster');
 const scope=document.getElementById('nm-view-appearance-node');
 scope.checked=true;scope.dispatch('change');
 assert.ok(container.children.every(button=>button.disabled));
});

test('full relationship text is accessible on network paths even if the visible pill is compact',()=>{
 const {app,state,context,document,flush}=harness();
 const full='This very long semantic connection must remain completely readable to assistive tools';
 state.addRelationship('prepare','check',full);
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const svg=document.getElementById('nm-view-lines');
 const paths=svg.querySelectorAll('path');
 const relation=paths.find(path=>path.getAttribute('aria-label')===full);
 assert.ok(relation,'relationship path must retain semantic label');
 assert.equal(relation.children[0].textContent,full);
 assert.equal(state.relationships[0].label,full);
});

test('reset action undoes only selected element style or the active view without touching other views',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const picker=document.getElementById('nm-view-appearance-theme');
 picker.value='cluster';picker.dispatch('change');flush();
 state.selectedNodeId='prepare';context.NeuroMapLinkedViews.refresh(app);flush();
 const scope=document.getElementById('nm-view-appearance-node');
 scope.checked=true;scope.dispatch('change');
 const accent=document.getElementById('nm-view-appearance-accent');
 accent.value='#ee0044';accent.dispatch('change');flush();
 assert.equal(state.root.viewAppearance.modes['concept-network'].elements.prepare.accent,'#ee0044');
 const reset=document.getElementById('nm-view-appearance-reset');
 assert.equal(reset.disabled,false);
 const undoBefore=state.undos.length;
 reset.dispatch('click');flush();
 assert.equal(state.undos.length,undoBefore+1);
 assert.equal(state.root.viewAppearance.modes['concept-network'].preset,'cluster');
 assert.equal(state.root.viewAppearance.modes['concept-network'].elements,undefined);
 scope.checked=false;scope.dispatch('change');
 assert.equal(reset.disabled,false);
 const undoMode=state.undos.length;
 reset.dispatch('click');flush();
 assert.equal(state.undos.length,undoMode+1);
 assert.equal(state.root.viewAppearance.modes['concept-network'],undefined);
 assert.equal(reset.disabled,true);
 assert.equal(state.root.children[0].color,undefined);
});

test('flowchart uses diamond decision geometry in live view and SVG export',()=>{
 const {app,state,context,document,flush}=harness();
 let captured=null;
 context.XMLSerializer=class{serializeToString(svg){captured=svg;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 state.addFlowTransition('prepare','check','yes');
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const card=document.getElementById('nm-view-stage').querySelector('.is-decision');
 assert.ok(card);
 assert.equal(Number.parseFloat(card.style.width),206);
 assert.equal(Number.parseFloat(card.style.height),148);
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const polygons=captured.children.filter(el=>el.tagName==='polygon');
 assert.equal(polygons.length,1);
 assert.equal(polygons[0].attributes.points.split(' ').length,4);
 assert.equal(state.findNode('prepare').text,'Prepare');
});

test('workflow-specific palette previews preserve actual styling and other view selections',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const select=document.getElementById('nm-view-appearance-theme');
 const previews=document.getElementById('nm-view-appearance-presets');
 assert.equal(select.options.length,8);
 assert.equal(previews.children.length,8);
 const blueprint=previews.children.find(n=>n.dataset.preset==='blueprint');
 blueprint.dispatch('click');flush();
 assert.equal(state.root.viewAppearance.modes.flowchart.preset,'blueprint');
 assert.equal(document.getElementById('nm-view-scroller').style.backgroundColor,'#0a2542');
 select.value='pastel-flow';select.dispatch('change');flush();
 assert.equal(state.root.viewAppearance.modes.flowchart.preset,'pastel-flow');
 assert.equal(document.getElementById('nm-view-scroller').style.backgroundColor,'#fdf7ff');
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 assert.equal(select.options.length,8);
 assert.equal(state.root.viewAppearance.modes.kanban,undefined);
});

test('organization orientation and 8 presets update main and split projections without mutating source nodes',()=>{
 const {app,state,context,document,flush}=harness();
 const initial=JSON.stringify(state.root.children);
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const dir=document.getElementById('nm-view-appearance-orientation');
 const preset=document.getElementById('nm-view-appearance-theme');
 assert.equal(dir.parentElement.hidden,false);
 assert.equal(dir.value,'vertical');
 assert.equal(preset.options.length,8);
 const stage=document.getElementById('nm-view-stage');
 const prepare=()=>stage.querySelectorAll('.nm-orgchart-card').find(n=>n.dataset.nodeId==='prepare');
 const root=()=>stage.querySelectorAll('.nm-orgchart-card').find(n=>n.dataset.nodeId==='root');
 assert.ok(prepare());assert.ok(root());
 const yBefore=Number.parseFloat(prepare().style.top);
 dir.value='horizontal';dir.dispatch('change');flush();
 assert.equal(state.root.viewAppearance.modes.orgchart.orientation,'horizontal');
 assert.equal(dir.value,'horizontal');
 assert.ok(Number.parseFloat(prepare().style.left)>Number.parseFloat(root().style.left));
 assert.notEqual(Number.parseFloat(prepare().style.top),yBefore);
 preset.value='executive';preset.dispatch('change');flush();
 assert.equal(document.getElementById('nm-view-scroller').style.backgroundColor,'#111827');
 assert.equal(JSON.stringify(state.root.children),initial);
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 assert.equal(dir.parentElement.hidden,true);
 assert.equal(state.root.viewAppearance.modes['concept-tree'],undefined);
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 assert.equal(dir.value,'horizontal');
});

test('organization SVG export includes genuine group color bars and orientation-aware connectors',()=>{
 const {app,state,context,flush}=harness();
 let snapshot=null;
 context.XMLSerializer=class{serializeToString(svg){snapshot=svg;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const dir=context.document.getElementById('nm-view-appearance-orientation');
 dir.value='horizontal';dir.dispatch('change');flush();
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const cardBars=snapshot.children.filter(n=>n.tagName==='rect'&&n.attributes['data-org-band']);
 assert.equal(cardBars.length,3);
 assert.equal(cardBars.filter(n=>n.attributes['data-org-band']==='root').length,1);
 assert.equal(cardBars.find(n=>n.attributes['data-org-band']==='root').attributes.height,'4');
 assert.ok(cardBars.filter(n=>n.attributes['data-org-band']==='report').every(n=>n.attributes.height==='3'));
 assert.match(String(snapshot.attributes.viewBox),/^0 0 [0-9.]+ [0-9.]+$/);
 assert.equal(/NaN|Infinity/.test(String(snapshot.attributes.viewBox)),false);
 const svgPaths=snapshot.children.filter(n=>n.tagName==='path');
 assert.ok(svgPaths.length>=2);
 assert.ok(svgPaths.every(p=>String(p.attributes.d).includes(' H')));
});

test('Kanban shows only real dates, status colors, and dedicated palette selectors',()=>{
 const {app,state,context,document,flush}=harness();
 const before=state.root.children.map(n=>n.text);
 state.findNode('prepare').taskStatus='doing';
 state.findNode('prepare').startDate='2026-11-03';
 state.findNode('prepare').dueDate='2026-11-08';
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const stage=document.getElementById('nm-view-stage');
 const cards=stage.querySelectorAll('.nm-kanban-card');
 assert.equal(cards.length,2);
 const prepare=cards.find(n=>n.dataset.nodeId==='prepare');
 const check=cards.find(n=>n.dataset.nodeId==='check');
 assert.equal(prepare.dataset.status,'doing');
 assert.equal(check.dataset.status,'unassigned');
 assert.equal(prepare.querySelector('.nm-kanban-date').textContent,'2026-11-03 → 2026-11-08');
 assert.equal(check.querySelector('.nm-kanban-date'),null);
 assert.equal(stage.querySelectorAll('.nm-work-column').length,4);
 assert.equal(stage.querySelectorAll('.nm-work-column').find(n=>n.dataset.status==='doing').dataset.status,'doing');
 assert.equal(document.getElementById('nm-view-appearance-theme').options.length,8);
 const preset=document.getElementById('nm-view-appearance-presets').children.find(n=>n.dataset.preset==='soft-saas');
 preset.dispatch('click');flush();
 assert.equal(document.getElementById('nm-view-scroller').style.backgroundColor,'#fcf8ff');
 assert.deepEqual(state.root.children.map(n=>n.text),before);
});

test('Kanban standalone SVG includes its actual deadline and colored status indicators',()=>{
 const {app,state,context,flush}=harness();
 state.findNode('prepare').taskStatus='todo';
 state.findNode('prepare').dueDate='2026-11-05';
 let svg=null;
 context.XMLSerializer=class{serializeToString(value){svg=value;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const realDeadline=svg.children.filter(n=>n.tagName==='text').find(n=>n.textContent.includes('2026-11-05'));
 assert.ok(realDeadline);
 const ribbons=svg.children.filter(n=>n.tagName==='rect'&&n.getAttribute('data-kanban-ribbon'));
 assert.equal(ribbons.length,2);
 assert.ok(ribbons.every(el=>el.getAttribute('height')==='3'));
 assert.ok(ribbons.some(el=>el.getAttribute('fill')==='#60a5fa'));
 const rules=svg.children.filter(n=>n.tagName==='rect'&&n.getAttribute('data-kanban-rule'));
 assert.equal(rules.length,4);
 assert.equal(state.findNode('check').dueDate,undefined);
});

test('Timeline distinguishes actual milestone diamonds and period bars with visible date captions',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').dueDate='2026-11-06';
 state.findNode('check').startDate='2026-11-03';
 state.findNode('check').dueDate='2026-11-10';
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 const stage=document.getElementById('nm-view-stage');
 const cards=stage.querySelectorAll('.nm-timeline-card');
 assert.equal(cards.length,2);
 const event=cards.find(c=>c.dataset.nodeId==='prepare');
 const period=cards.find(c=>c.dataset.nodeId==='check');
 assert.ok(event.className.includes('is-milestone'));
 assert.equal(period.className.includes('is-milestone'),false);
 const titles=stage.querySelectorAll('.nm-timeline-title');
 assert.equal(titles.length,2);
 assert.ok(titles.some(t=>t.querySelector('.nm-timeline-date').textContent==='2026-11-06'));
 assert.ok(titles.some(t=>t.querySelector('.nm-timeline-date').textContent==='2026-11-03 → 2026-11-10'));
 assert.equal(document.getElementById('nm-view-appearance-theme').options.length,8);
 const preset=document.getElementById('nm-view-appearance-presets').children.find(c=>c.dataset.preset==='history');
 preset.dispatch('click');flush();
 assert.equal(document.getElementById('nm-view-scroller').style.backgroundColor,'#fcf7eb');
 assert.equal(state.root.viewAppearance.modes.timeline.preset,'history');
 assert.equal(state.findNode('prepare').startDate,undefined);
});

test('Timeline split view shows real-date captions and avoids text inside short milestone glyphs',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').dueDate='2026-11-06';
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');
 picker.value='timeline';picker.dispatch('change');flush();
 const stage=document.getElementById('nm-dual-stage');
 const card=stage.querySelector('.nm-timeline-card');
 assert.ok(card);
 assert.ok(card.className.includes('is-milestone'));
 assert.equal(card.querySelector('.nm-view-title'),null,'short glyph must not contain a clipped task label');
 const heading=stage.querySelector('.nm-timeline-title');
 assert.ok(heading);
 assert.equal(heading.querySelector('.nm-timeline-date').textContent,'2026-11-06');
 assert.equal(card.getAttribute('aria-label'),'Prepare · 2026-11-06');
});

test('Timeline SVG faithfully renders explicit date labels and a milestone polygon',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').dueDate='2026-11-06';
 state.findNode('check').startDate='2026-11-03';
 state.findNode('check').dueDate='2026-11-10';
 let svg=null;
 context.XMLSerializer=class{serializeToString(value){svg=value;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const diamonds=svg.children.filter(n=>n.tagName==='polygon');
 assert.equal(diamonds.length,1);
 assert.equal(diamonds[0].attributes.points.split(' ').length,4);
 const titles=svg.children.filter(n=>n.tagName==='text');
 assert.ok(titles.some(x=>x.textContent==='2026-11-06'));
 assert.ok(titles.some(x=>x.textContent==='2026-11-03 → 2026-11-10'));
 const prepareTitle=titles.find(x=>x.getAttribute('aria-label')==='Prepare');
 assert.equal(prepareTitle.getAttribute('font-weight'),'700');
 assert.equal(titles.find(x=>x.textContent==='2026-11-06').getAttribute('opacity'),'.78');
 assert.equal(state.findNode('prepare').startDate,undefined);
});

test('light and dark flowchart themes keep yes/no paths and labels readable in live and SVG export',()=>{
 const {app,state,context,document,flush}=harness();
 state.addFlowTransition('prepare','check','yes');
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const picker=document.getElementById('nm-view-appearance-theme');
 picker.value='process';picker.dispatch('change');flush();
 const svg=document.getElementById('nm-view-lines');
 const mainPath=svg.children.find(el=>el.tagName==='path');
 const mainText=svg.children.find(el=>el.tagName==='text'&&el.textContent==='Sì');
 assert.equal(mainPath.getAttribute('stroke'),'#157354');
 assert.equal(mainText.getAttribute('fill'),'#157354');
 let exported=null;
 context.XMLSerializer=class{serializeToString(value){exported=value;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 assert.ok(exported.children.find(el=>el.tagName==='path'&&el.getAttribute('stroke')==='#157354'));
 picker.value='blueprint';picker.dispatch('change');flush();
 assert.ok(document.getElementById('nm-view-lines').children.some(el=>
  el.tagName==='path'&&el.getAttribute('stroke')==='#34d399'));
});

test('light Kanban theme uses text tokens to make column headers readable',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const picker=document.getElementById('nm-view-appearance-theme');
 picker.value='soft-saas';picker.dispatch('change');flush();
 const columns=document.getElementById('nm-view-stage').querySelectorAll('.nm-work-column');
 assert.equal(columns.length,4);
 assert.ok(columns.every(col=>col.style.color==='#342b4c'));
 picker.value='executive-board';picker.dispatch('change');flush();
 assert.ok(document.getElementById('nm-view-stage').querySelectorAll('.nm-work-column')
  .every(col=>col.style.color==='#f1faf7'));
});

test('Kanban Alt-arrow shortcuts reorder tasks and move status with one Undo each',()=>{
 const {app,state,context,document,flush}=harness();
 state.setNodeWorkMetadata('prepare',{taskStatus:'todo',dueDate:'2026-11-09'});
 state.setNodeWorkMetadata('check',{taskStatus:'todo'});
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const stage=document.getElementById('nm-view-stage');
 const get=id=>stage.querySelectorAll('.nm-work-card').find(c=>c.dataset.nodeId===id);
 const key=(card,value)=>card.dispatch('keydown',{
  target:card,altKey:true,key:value,preventDefault(){},stopPropagation(){}
 });
 const before=state.undos.length;
 assert.ok(get('check').getAttribute('aria-keyshortcuts').includes('Alt+ArrowUp'));
 key(get('check'),'ArrowUp');flush();
 assert.deepEqual(work.project(state.root,'kanban').nodes.map(n=>n.id),['check','prepare']);
 assert.equal(state.undos.length,before+1);
 assert.deepEqual(state.root.children.map(n=>n.id),['prepare','check']);
 key(get('check'),'ArrowRight');flush();
 assert.equal(state.findNode('check').taskStatus,'doing');
 assert.equal(state.undos.length,before+2);
 assert.equal(state.findNode('prepare').dueDate,'2026-11-09');
 assert.deepEqual(work.project(state.root,'kanban').nodes.map(n=>n.id),['prepare','check']);
});

test('Kanban primary native drag provides before-card feedback and commits ordered drop',()=>{
 const {app,state,context,document,flush}=harness();
 state.setNodeWorkMetadata('prepare',{taskStatus:'todo'});
 state.setNodeWorkMetadata('check',{taskStatus:'todo'});
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const stage=document.getElementById('nm-view-stage');
 const cards=stage.querySelectorAll('.nm-work-card');
 const prepare=cards.find(c=>c.dataset.nodeId==='prepare');
 const check=cards.find(c=>c.dataset.nodeId==='check');
 prepare.getBoundingClientRect=()=>({top:102,height:112,left:267,right:474,width:207});
 check.getBoundingClientRect=()=>({top:240,height:112,left:267,right:474,width:207});
 const transfer={setData(){},dropEffect:null};
 const before=state.undos.length;
 check.dispatch('dragstart',{target:check,dataTransfer:transfer,preventDefault(){}});
 stage.dispatch('dragover',{clientX:370,clientY:120,dataTransfer:transfer,preventDefault(){}});
 assert.ok(prepare.className.includes('is-drop-before'));
 stage.dispatch('drop',{clientX:370,clientY:120,dataTransfer:transfer,preventDefault(){}});
 flush();
 assert.deepEqual(work.project(state.root,'kanban').nodes.map(n=>n.id),['check','prepare']);
 assert.equal(state.undos.length,before+1);
 assert.deepEqual(state.root.children.map(n=>n.id),['prepare','check']);
});

test('Kanban primary touch gesture changes columns without duplicate history',()=>{
 const {app,state,context,document,flush}=harness();
 state.setNodeWorkMetadata('prepare',{taskStatus:'todo',startDate:'2026-11-03'});
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const stage=document.getElementById('nm-view-stage');
 const card=stage.querySelectorAll('.nm-work-card').find(c=>c.dataset.nodeId==='prepare');
 const touch=(name,x,y)=>card.dispatch(name,{
  pointerId:4,pointerType:'touch',clientX:x,clientY:y,
  target:card,preventDefault(){}
 });
 const before=state.undos.length;
 touch('pointerdown',370,165);
 touch('pointermove',605,165);
 touch('pointerup',605,165);flush();
 assert.equal(state.findNode('prepare').taskStatus,'doing');
 assert.equal(state.findNode('prepare').startDate,'2026-11-03');
 assert.equal(state.undos.length,before+1);
});

test('Kanban split pane has independent keyboard and touch moves',()=>{
 const {app,state,context,document,flush}=harness();
 state.setNodeWorkMetadata('prepare',{taskStatus:'todo'});
 state.setNodeWorkMetadata('check',{taskStatus:'todo'});
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const stage=document.getElementById('nm-dual-stage');
 const get=id=>stage.querySelectorAll('.nm-work-card').find(c=>c.dataset.nodeId===id);
 assert.ok(get('check'));
 const before=state.undos.length;
 get('check').dispatch('keydown',{
  target:get('check'),key:'ArrowUp',altKey:true,
  preventDefault(){},stopPropagation(){}
 });flush();
 assert.deepEqual(work.project(state.root,'kanban').nodes.map(n=>n.id),['check','prepare']);
 assert.equal(state.undos.length,before+1);
 const moved=get('prepare');
 const pointer=(event,x,y)=>moved.dispatch(event,{
  pointerId:3,pointerType:'touch',target:moved,clientX:x,clientY:y,
  preventDefault(){}
 });
 pointer('pointerdown',370,165);
 pointer('pointermove',605,165);
 pointer('pointerup',605,165);flush();
 assert.equal(state.findNode('prepare').taskStatus,'doing');
 assert.equal(state.undos.length,before+2);
});

test('Kanban announces accessible column positions and cancels aborted touch safely',()=>{
 const {app,state,context,document,flush}=harness();
 state.setNodeWorkMetadata('prepare',{taskStatus:'todo'});
 state.setNodeWorkMetadata('check',{taskStatus:'todo'});
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const stage=document.getElementById('nm-view-stage');
 const card=stage.querySelectorAll('.nm-work-card').find(c=>c.dataset.nodeId==='prepare');
 assert.ok(card.getAttribute('aria-label').includes('Da fare'));
 assert.ok(card.getAttribute('aria-label').includes('Posizione 1'));
 const before=state.undos.length;
 const touch=(name,x,y)=>card.dispatch(name,{
  type:name,pointerId:6,pointerType:'touch',target:card,clientX:x,clientY:y,
  preventDefault(){}
 });
 touch('pointerdown',370,150);
 touch('pointermove',605,150);
 touch('pointercancel',605,150);flush();
 assert.equal(state.undos.length,before);
 assert.equal(state.findNode('prepare').taskStatus,'todo');
 const second=stage.querySelectorAll('.nm-work-card').find(c=>c.dataset.nodeId==='check');
 second.dispatch('keydown',{target:second,key:'ArrowUp',altKey:true,
  preventDefault(){},stopPropagation(){}});
 flush();
 assert.ok(document.getElementById('nm-view-action-status').textContent.includes('riordinata'));
 assert.equal(state.undos.length,before+1);
});

test('Timeline scale switch changes projection and Undo history without editing task dates',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').startDate='2026-11-03';
 state.findNode('check').dueDate='2026-12-12';
 const dates=JSON.stringify(state.root.children.map(n=>[n.id,n.startDate,n.dueDate]));
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 const control=document.getElementById('nm-work-time-scale');
 const group=document.getElementById('nm-work-time-scale-group');
 assert.equal(group.hidden,false);
 assert.equal(control.value,'auto');
 const frame=document.getElementById('nm-view-stage');
 const initialWidth=Number.parseFloat(frame.style.width);
 const before=state.undos.length;
 control.value='days';control.dispatch('change');flush();
 assert.equal(state.root.viewAppearance.modes.timeline.timeScale,'days');
 assert.ok(Number.parseFloat(frame.style.width)>initialWidth);
 assert.equal(state.undos.length,before+1);
 assert.equal(JSON.stringify(state.root.children.map(n=>[n.id,n.startDate,n.dueDate])),dates);
 control.value='weeks';control.dispatch('change');flush();
 assert.equal(state.root.viewAppearance.modes.timeline.timeScale,'weeks');
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 assert.equal(group.hidden,true);
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 assert.equal(control.value,'weeks');
});

test('Timeline split scale controls share saved settings with primary renderer',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').startDate='2026-11-03';
 state.findNode('check').dueDate='2026-12-12';
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');
 picker.value='timeline';picker.dispatch('change');flush();
 const scale=document.getElementById('nm-dual-time-scale');
 assert.equal(scale.value,'auto');
 const stage=document.getElementById('nm-dual-stage');
 const beforeWidth=Number.parseFloat(stage.style.width);
 const before=state.undos.length;
 scale.value='days';scale.dispatch('change');flush();
 assert.equal(state.root.viewAppearance.modes.timeline.timeScale,'days');
 assert.equal(state.undos.length,before+1);
 assert.ok(Number.parseFloat(stage.style.width)>beforeWidth);
 assert.equal(state.findNode('prepare').startDate,'2026-11-03');
});

test('Timeline same-day task labels and SVG use factual 1-of-N group indicators',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').dueDate='2026-11-03';
 state.findNode('check').startDate='2026-11-03';
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 const shown=document.getElementById('nm-view-stage').querySelectorAll('.nm-timeline-concurrent');
 assert.deepEqual(shown.map(n=>n.textContent),['1/2','2/2']);
 assert.equal(state.findNode('prepare').startDate,undefined);
 let svg=null;
 context.XMLSerializer=class{serializeToString(el){svg=el;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const labels=svg.children.filter(n=>n.tagName==='text').map(n=>n.textContent);
 assert.ok(labels.includes('1/2'));
 assert.ok(labels.includes('2/2'));
});

test('Timeline backward dependencies carry readable conflict titles and consistent SVG routing',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').startDate='2026-11-10';
 state.findNode('prepare').dueDate='2026-11-15';
 state.findNode('check').startDate='2026-11-03';
 state.findNode('check').dueDate='2026-11-05';
 state.findNode('check').taskDependsOn=['prepare'];
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 const svg=document.getElementById('nm-view-lines');
 const path=svg.children.find(el=>el.tagName==='path');
 assert.ok(path);
 assert.ok(path.getAttribute('aria-label').includes('Possibile conflitto'));
 assert.equal(path.getAttribute('stroke-dasharray'),'6 4');
 assert.ok((path.getAttribute('d').match(/ H/g)||[]).length>=3);
 assert.equal(path.children[0].tagName,'title');
 let exported=null;
 context.XMLSerializer=class{serializeToString(el){exported=el;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const exportedPath=exported.children.find(el=>el.tagName==='path');
 assert.equal(exportedPath.getAttribute('d'),path.getAttribute('d'));
 assert.equal(exportedPath.getAttribute('aria-label'),path.getAttribute('aria-label'));
});

test('Timeline warns when a ten-year span caps the requested day scale',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').startDate='2025-01-01';
 state.findNode('check').dueDate='2034-12-29';
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 const scale=document.getElementById('nm-work-time-scale');
 const hint=document.getElementById('nm-work-time-scale-hint');
 assert.equal(hint.hidden,true);
 scale.value='days';scale.dispatch('change');flush();
 assert.equal(hint.hidden,false);
 assert.ok(hint.textContent.includes('adattato'));
 assert.equal(state.root.viewAppearance.modes.timeline.timeScale,'days');
 scale.value='months';scale.dispatch('change');flush();
 assert.equal(hint.hidden,true);
});

test('Flow auto start/end forms and explicit shape picker use canonical nodes with one Undo',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const from=document.getElementById('nm-flow-from'),to=document.getElementById('nm-flow-to'),
  kind=document.getElementById('nm-flow-type'),shape=document.getElementById('nm-flow-shape');
 from.value='prepare';from.dispatch('change');to.value='check';kind.value='sequence';
 document.getElementById('nm-flow-connect').dispatch('click');flush();
 const stage=document.getElementById('nm-view-stage');
 let get=id=>stage.querySelectorAll('.nm-view-card').find(n=>n.dataset.nodeId===id);
 assert.equal(get('prepare').dataset.flowShape,'start');
 assert.equal(get('check').dataset.flowShape,'end');
 assert.ok(get('prepare').className.includes('is-flow-terminal'));
 assert.equal(get('prepare').querySelector('.nm-flow-role-label').textContent,'Inizio');
 assert.equal(get('check').querySelector('.nm-flow-role-label').textContent,'Fine');
 assert.equal(shape.value,'auto');
 const baseline=state.undos.length,tree=JSON.stringify(state.root.children.map(n=>n.id));
 shape.value='decision';shape.dispatch('change');flush();
 assert.equal(state.findNode('prepare').flowShape,'decision');
 assert.equal(state.undos.length,baseline+1);
 assert.ok(get('prepare').className.includes('is-decision'));
 assert.equal(get('prepare').className.includes('is-flow-terminal'),false);
 assert.equal(state.relationships.length,1);
 assert.equal(JSON.stringify(state.root.children.map(n=>n.id)),tree);
 shape.value='auto';shape.dispatch('change');flush();
 assert.equal(state.findNode('prepare').flowShape,undefined);
 assert.equal(get('prepare').dataset.flowShape,'start');
});

test('Split flow view edits source node shape and shares document/Undo without duplicating edges',()=>{
 const {app,state,context,document,flush}=harness();
 state.addFlowTransition('prepare','check','sequence');
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');
 picker.value='flowchart';picker.dispatch('change');flush();
 const from=document.getElementById('nm-dual-flow-from'),shape=document.getElementById('nm-dual-flow-shape');
 from.value='check';from.dispatch('change');shape.value='process';shape.dispatch('change');flush();
 assert.equal(state.findNode('check').flowShape,'process');
 assert.equal(state.relationships.length,1);
 const card=document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card')
  .find(n=>n.dataset.nodeId==='check');
 assert.equal(card.dataset.flowShape,'process');
 assert.equal(card.className.includes('is-flow-terminal'),false);
 assert.ok(state.undos.length>=2);
 const fromOther=document.getElementById('nm-flow-from');
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 fromOther.value='check';fromOther.dispatch('change');
 assert.equal(document.getElementById('nm-flow-shape').value,'process');
});

test('Decision ports for Yes/No and SVG export share identical edge path and label positions',()=>{
 const {app,state,context,document,flush}=harness();
 const child=state.addChildNode('root');
 state.addFlowTransition('prepare','check','yes');
 state.addFlowTransition('prepare',child.id,'no');
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const graph=flow.project(state.root,state.relationships);
 const by=id=>graph.nodes.find(n=>n.id===id);
 assert.equal(by('prepare').decision,true);
 assert.ok(flow.ports(by('prepare'),by('check'),'yes').sy<
   flow.ports(by('prepare'),by(child.id),'no').sy);
 const live=document.getElementById('nm-view-lines');
 const paths=live.children.filter(n=>n.tagName==='path');
 assert.equal(paths.length,2);
 assert.equal(paths[0].getAttribute('d'),flow.path(by('prepare'),by('check'),'yes'));
 assert.equal(paths[1].getAttribute('d'),flow.path(by('prepare'),by(child.id),'no'));
 let exported=null;
 context.XMLSerializer=class{serializeToString(node){exported=node;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const svgPaths=exported.children.filter(n=>n.tagName==='path');
 assert.deepEqual(svgPaths.map(n=>n.getAttribute('d')),paths.map(n=>n.getAttribute('d')));
 const labels=exported.children.filter(n=>n.tagName==='text')
  .filter(n=>n.textContent==='Sì'||n.textContent==='No');
 assert.equal(labels.length,2);
 assert.notEqual(labels[0].getAttribute('y'),labels[1].getAttribute('y'));
});

test('Flow capsules stay as rounded terminal SVG shapes with factual Start/End headings',()=>{
 const {app,state,context,flush}=harness();
 state.addFlowTransition('prepare','check','sequence');
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 let exported=null;
 context.XMLSerializer=class{serializeToString(node){exported=node;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const pills=exported.children.filter(n=>n.tagName==='rect'&&n.getAttribute('rx')==='35');
 assert.equal(pills.length,2);
 const headings=exported.children.filter(n=>n.tagName==='text').map(n=>n.textContent);
 assert.ok(headings.includes('Inizio'));
 assert.ok(headings.includes('Fine'));
 assert.equal(state.findNode('prepare').flowShape,undefined,'auto shape is not stored in document');
});

test('Flow manually marked standalone step appears before creating any transition',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 assert.ok(document.getElementById('nm-view-stage').querySelector('.nm-flow-empty'));
 const from=document.getElementById('nm-flow-from');
 from.value='prepare';from.dispatch('change');
 const select=document.getElementById('nm-flow-shape');
 select.value='start';select.dispatch('change');flush();
 const nodes=document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card');
 assert.equal(nodes.length,1);
 assert.equal(nodes[0].dataset.nodeId,'prepare');
 assert.equal(nodes[0].dataset.flowShape,'start');
 assert.equal(state.relationships.length,0);
 assert.equal(state.findNode('check').flowShape,undefined);
});

test('Flow arrowheads match semantically colored Yes/No strokes in live and exported SVG',()=>{
 const {app,state,context,document,flush}=harness();
 const third=state.addChildNode('root');
 state.addFlowTransition('prepare','check','yes');
 state.addFlowTransition('prepare',third.id,'no');
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const live=document.getElementById('nm-view-lines');
 const links=live.children.filter(x=>x.tagName==='path');
 assert.deepEqual(links.map(x=>x.getAttribute('marker-end')),[
  'url(#nm-flow-process-yes)','url(#nm-flow-process-no)'
 ]);
 const markers=live.querySelectorAll('marker').filter(m=>String(m.getAttribute('id')).startsWith('nm-flow-process-'));
 assert.equal(markers.length,3);
 const yes=markers.find(m=>m.getAttribute('id')==='nm-flow-process-yes');
 const no=markers.find(m=>m.getAttribute('id')==='nm-flow-process-no');
 assert.equal(yes.querySelector('path').getAttribute('fill'),'#157354');
 assert.equal(no.querySelector('path').getAttribute('fill'),'#b33058');
 let exported=null;
 context.XMLSerializer=class{serializeToString(el){exported=el;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const output=exported.children.filter(x=>x.tagName==='path');
 assert.deepEqual(output.map(x=>x.getAttribute('marker-end')),[
  'url(#nm-export-process-yes)','url(#nm-export-process-no)'
 ]);
 const svgMarker=exported.querySelectorAll('marker').find(x=>x.getAttribute('id')==='nm-export-process-yes');
 assert.equal(svgMarker.querySelector('path').getAttribute('fill'),'#157354');
});

test('inconsistent manually marked End warns visibly and in standalone SVG without deleting links',()=>{
 const {app,state,context,document,flush}=harness();
 state.addFlowTransition('prepare','check','sequence');
 state.setNodeFlowShape('prepare','end');
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const card=document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card')
  .find(n=>n.dataset.nodeId==='prepare');
 assert.ok(card.className.includes('is-flow-role-conflict'));
 assert.ok(card.getAttribute('aria-label').includes('collegamenti in uscita'));
 assert.equal(card.querySelector('.nm-flow-role-warning').textContent,'!');
 assert.equal(state.relationships.length,1);
 let exported=null;
 context.XMLSerializer=class{serializeToString(node){exported=node;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const warning=exported.children.find(n=>n.tagName==='text'&&n.textContent==='!');
 assert.ok(warning);
 assert.ok(warning.getAttribute('aria-label').includes('Fine con collegamenti in uscita'));
});

test('stale node-only appearance selection cannot accidentally reset or recolor entire view',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const theme=document.getElementById('nm-view-appearance-theme');
 theme.value='corporate';theme.dispatch('change');flush();
 state.selectedNodeId='prepare';context.NeuroMapLinkedViews.refresh(app);flush();
 const scope=document.getElementById('nm-view-appearance-node');
 scope.checked=true;scope.dispatch('change');
 const accent=document.getElementById('nm-view-appearance-accent');
 const reset=document.getElementById('nm-view-appearance-reset');
 const single=document.getElementById('nm-view-appearance-reset-single');
 const property=document.getElementById('nm-view-appearance-reset-property');
 // Simulate deletion/selection clearing before the next queued renderer refresh.
 state.selectedNodeId=null;
 const before=JSON.stringify(state.root.viewAppearance),history=state.undos.length;
 accent.value='#ff0000';accent.dispatch('change');
 reset.dispatch('click');
 property.value='preset';single.dispatch('click');
 assert.equal(JSON.stringify(state.root.viewAppearance),before);
 assert.equal(state.undos.length,history);
 context.NeuroMapLinkedViews.refresh(app);flush();
 assert.equal(scope.checked,false);
 assert.equal(scope.disabled,true);
 assert.equal(state.root.viewAppearance.modes.orgchart.preset,'corporate');
});

test('linked-view controls preserve keyboard focus and reduced-motion preferences',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const styles=document.getElementById('nm-view-styles')?.textContent||'';
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(styles,/#nm-view-overlay \*::before/);
 assert.match(styles,/#nm-view-switch \*::after/);
 assert.match(styles,/transition-duration:0\.01ms!important/);
 assert.match(styles,/scroll-behavior:auto!important/);
 assert.match(styles,/#nm-view-overlay select:focus-visible/);
 assert.match(styles,/#nm-view-appearance summary:focus-visible/);
 assert.match(styles,/#nm-view-overlay \[tabindex\]:focus-visible/);
 // The accessibility override is limited to the views, not the mindmap canvas.
 assert.ok(!styles.includes('body *{animation-duration'));
});

test('advanced appearance controls are scoped, reversible and do not modify canonical nodes',()=>{
 const {app,state,context,document,flush}=harness();
 const canonical=JSON.stringify(state.root.children);
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const control=id=>document.getElementById('nm-view-appearance-'+id);
 const change=(id,value)=>{const el=control(id);assert.ok(el,id);el.value=String(value);el.dispatch('change');flush()};
 change('edge','#123456');
 change('fontSize',16);
 change('radius',18);
 assert.equal(state.root.viewAppearance.modes.orgchart.edge,'#123456');
 assert.equal(state.root.viewAppearance.modes.orgchart.fontSize,16);
 assert.equal(state.root.viewAppearance.modes.orgchart.radius,18);
 assert.equal(control('edge').value,'#123456');
 assert.equal(control('fontSize').value,'16');
 assert.equal(control('radius').value,'18');
 const history=state.undos.length;
 state.selectedNodeId='prepare';context.NeuroMapLinkedViews.refresh(app);flush();
 const scope=control('node');scope.checked=true;scope.dispatch('change');
 assert.equal(control('edge').disabled,true);
 assert.equal(control('fontSize').disabled,true);
 assert.equal(control('radius').disabled,true);
 change('text','#aabbcc');
 assert.equal(state.root.viewAppearance.modes.orgchart.elements.prepare.text,'#aabbcc');
 assert.equal(state.root.viewAppearance.modes.orgchart.text,undefined);
 assert.equal(state.root.viewAppearance.modes.orgchart.edge,'#123456');
 assert.equal(state.undos.length,history+1);
 assert.equal(JSON.stringify(state.root.children),canonical);
 scope.checked=false;scope.dispatch('change');
 const single=control('reset-single'),prop=control('reset-property');
 prop.value='edge';single.dispatch('click');flush();
 assert.equal(state.root.viewAppearance.modes.orgchart.edge,undefined);
 assert.equal(state.root.viewAppearance.modes.orgchart.fontSize,16);
 assert.equal(state.root.viewAppearance.modes.orgchart.elements.prepare.text,'#aabbcc');
 assert.equal(JSON.stringify(state.root.children),canonical);
});

test('SVG export bounds large-font labels and preserves full text for assistive readers',()=>{
 const {app,state,context,flush}=harness();
 const long='An exceptionally detailed scientific node description that cannot fit in a compact card';
 state.root.children[0].text=long;
 state.root.viewAppearance=appearance.update(null,'orgchart',{fontSize:18});
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 let exported=null,downloaded=false;
 context.XMLSerializer=class{serializeToString(node){exported=node;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){downloaded=true;return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 assert.equal(downloaded,true);
 const labels=exported.children.filter(n=>n.tagName==='text'&&n.getAttribute('aria-label')===long);
 assert.equal(labels.length,1);
 const label=labels[0];
 assert.equal(label.getAttribute('font-size'),'18');
 const spans=label.children.filter(n=>n.tagName==='tspan');
 assert.ok(spans.length>=1&&spans.length<=3);
 assert.ok(spans.every(n=>n.textContent.length<long.length));
 assert.ok(spans.some(n=>n.textContent.includes('…')));
 assert.equal(label.children.find(n=>n.tagName==='title')?.textContent,long);
});

test('Timeline SVG title respects a per-node text override and retains complete label',()=>{
  const {app,state,context,flush}=harness();
  const taskId='prepare';
  state.findNode(taskId).startDate='2026-11-10';
  const canonical=JSON.stringify(state.root.children);
  state.root.viewAppearance=appearance.update(null,'timeline',{preset:'roadmap'});
  state.root.viewAppearance=appearance.update(state.root.viewAppearance,'timeline',{text:'#123456'},taskId);
  context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
  let exported=null;
  context.XMLSerializer=class{serializeToString(node){exported=node;return '<svg/>'}};
  context.Blob=class{constructor(){}};
  app.io={triggerDownload(){return true}};
  assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
  const target=state.findNode(taskId);
  const labels=exported.children.filter(n=>n.tagName==='text'&&n.getAttribute('aria-label')===target.text);
  assert.equal(labels.length,1);
  assert.equal(labels[0].getAttribute('fill'),'#123456');
  assert.equal(labels[0].children.find(n=>n.tagName==='title')?.textContent,target.text);
  assert.equal(JSON.stringify(state.root.children),canonical);
});

test('Timeline SVG date and same-day counter inherit the node text override, not the scene palette',()=>{
  const {app,state,context,flush}=harness();
  state.findNode('prepare').startDate='2026-11-10';
  state.findNode('check').startDate='2026-11-10';
  const canonical=JSON.stringify(state.root.children);
  state.root.viewAppearance=appearance.update(null,'timeline',{preset:'roadmap'});
  state.root.viewAppearance=appearance.update(state.root.viewAppearance,'timeline',{text:'#123456'},'prepare');
  context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
  let exported=null;
  context.XMLSerializer=class{serializeToString(node){exported=node;return '<svg/>'}};
  context.Blob=class{constructor(){}};
  app.io={triggerDownload(){return true}};
  assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
  const labels=exported.children.filter(n=>n.tagName==='text');
  const nodeTitle=labels.find(n=>n.getAttribute('aria-label')==='Prepare');
  assert.ok(nodeTitle);
  assert.equal(nodeTitle.getAttribute('fill'),'#123456');
  const nodeDate=labels.find(n=>n.textContent==='2026-11-10'&&n.getAttribute('y')===String(
    Number(nodeTitle.getAttribute('y'))+18));
  assert.ok(nodeDate,'date label must be anchored below the same node title');
  assert.equal(nodeDate.getAttribute('fill'),'#123456');
  const counter=labels.find(n=>n.textContent==='1/2');
  assert.ok(counter,'two tasks share the same explicit start date');
  assert.equal(counter.getAttribute('fill'),'#123456');
  assert.equal(JSON.stringify(state.root.children),canonical);
});

test('Timeline font-size token is honored by external titles and exported SVG without changing task data',()=>{
 const {app,state,context,flush,document}=harness();
 state.findNode('prepare').startDate='2026-11-10';
 const canonical=JSON.stringify(state.root.children);
 state.root.viewAppearance=appearance.update(null,'timeline',{preset:'roadmap',fontSize:18});
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 const timelineTitle=document.querySelector('.nm-timeline-title');
 assert.ok(timelineTitle,'dated task has an external timeline title');
 assert.equal(timelineTitle.style.fontSize,'18px');
 let exported=null;
 context.XMLSerializer=class{serializeToString(node){exported=node;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const task=state.findNode('prepare');
 const svgTitle=exported.children.find(n=>n.tagName==='text'&&n.getAttribute('aria-label')===task.text);
 assert.ok(svgTitle);
 assert.equal(svgTitle.getAttribute('font-size'),'18');
 assert.equal(JSON.stringify(state.root.children),canonical);
});

test('Timeline SVG truncates long titles according to font size without losing accessible text',()=>{
 const {app,state,context,flush}=harness();
 const task=state.findNode('prepare');
 task.startDate='2026-11-10';
 task.text='An extremely long milestone description with many details for a project roadmap';
 const original=JSON.stringify(state.root.children);
 let exported=null;
 context.XMLSerializer=class{serializeToString(node){exported=node;return '<svg/>'}};
 context.Blob=class{constructor(){}};
 app.io={triggerDownload(){return true}};
 const labels=[];
 for(const size of [12,18]){
   state.root.viewAppearance=appearance.update(null,'timeline',{fontSize:size});
   context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
   assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
   const label=exported.children.find(n=>n.tagName==='text'&&n.getAttribute('aria-label')===task.text);
   assert.ok(label);
   assert.equal(label.getAttribute('font-size'),String(size));
   assert.equal(label.children.find(n=>n.tagName==='title').textContent,task.text);
   assert.ok(label.textContent.endsWith('…'));
   labels.push(label.textContent);
 }
 assert.ok(labels[1].length<labels[0].length,'larger font must use a shorter SVG label');
 assert.equal(JSON.stringify(state.root.children),original);
});


test('view appearance explains node-only scope and why view-wide controls are disabled',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const help=document.getElementById('nm-view-appearance-help');
 const scope=document.getElementById('nm-view-appearance-node');
 const field=id=>document.getElementById('nm-view-appearance-'+id);
 assert.ok(help,'accessible scope explanation must be present');
 assert.equal(help.getAttribute('aria-live'),'polite');
 assert.equal(scope.getAttribute('aria-describedby'),help.id);
 assert.match(help.textContent,/presentazione della vista/);
 const before=JSON.stringify(state.root),history=state.undos.length;
 state.selectedNodeId='prepare';
 scope.checked=true;scope.dispatch('change');
 assert.match(help.textContent,/Nodo selezionato: Prepare/);
 assert.match(help.textContent,/solo la presentazione di questo nodo/);
 for(const id of ['theme','edge','radius','fontSize','background','density','orientation']){
  assert.equal(field(id).disabled,true,id+' is view-wide');
  assert.equal(field(id).getAttribute('aria-describedby'),help.id);
  assert.match(field(id).title,/Solo nodo selezionato/);
 }
 for(const id of ['accent','surface','text'])assert.notEqual(field(id).disabled,true,id+' supports node override');
 const presets=document.getElementById('nm-view-appearance-presets');
 assert.ok(presets.children.length>0);
 assert.ok(presets.children.every(button=>button.disabled&&button.getAttribute('aria-describedby')===help.id));
 scope.checked=false;scope.dispatch('change');
 assert.match(help.textContent,/presentazione della vista/);
 assert.equal(field('theme').disabled,false);
 assert.equal(field('edge').title,'');
 assert.equal(JSON.stringify(state.root),before,'explanations are presentation-only');
 assert.equal(state.undos.length,history,'reading help must not create Undo entries');
});

test('node-only appearance help is bilingual, safe for user text and does not modify history',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').text='<img src=x onerror=alert(1)>';
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 const original=JSON.stringify(state.root); // entering a view changes viewMode
 const scope=document.getElementById('nm-view-appearance-node');
 const help=document.getElementById('nm-view-appearance-help');
 state.selectedNodeId='prepare';
 scope.checked=true;scope.dispatch('change');
 assert.match(help.textContent,/Nodo selezionato: <img src=x onerror=alert\(1\)>/);
 assert.equal(help.children.length,0,'node names must be plain text, never HTML');
 const history=state.undos.length;
 document.documentElement.lang='en';
 scope.dispatch('change');
 assert.match(help.textContent,/Selected node: <img src=x onerror=alert\(1\)>/);
 assert.match(help.textContent,/You are changing this node/);
 assert.equal(JSON.stringify(state.root),original);
 assert.equal(state.undos.length,history);
});

test('concept-tree collapse retains canonical children and has accessible expand control',()=>{
 const {app,state,context,document,flush}=harness();
 const node=state.findNode('prepare');
 const grandchild=state.addChildNode(node.id);
 const original=JSON.stringify(node.children);
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 const history=state.undos.length; // view entry is a distinct Undo step
 const cards=document.getElementById('nm-view-stage').querySelectorAll('.nm-view-card');
 const card=cards.find(item=>item.dataset.nodeId==='prepare');
 assert.ok(card,'parent card must be visible');
 const button=card.querySelector('.nm-view-collapse');
 assert.ok(button,'collapse control must exist for a parent node');
 assert.equal(button.getAttribute('aria-expanded'),'true');
 assert.match(button.getAttribute('aria-label'),/Comprimi ramo/);
 button.dispatch('click',{stopPropagation(){}});
 assert.equal(node.collapsed,true);
 assert.equal(state.undos.length,history+1);
 assert.equal(JSON.stringify(node.children),original,'collapse must not delete canonical children');
 assert.equal(view.project(state.root,'concept-tree').nodes.some(n=>n.id===grandchild.id),false);
 // The existing state method is shared by both the mind map and concept tree.
 state.toggleCollapse(node.id);
 assert.equal(node.collapsed,false);
 assert.equal(view.project(state.root,'concept-tree').nodes.some(n=>n.id===grandchild.id),true);
 assert.equal(JSON.stringify(node.children),original);
});


test('node-only appearance announcement bounds imported long Unicode labels without mutating them',()=>{
 const {app,state,context,document,flush}=harness();
 const label='🧠'.repeat(120)+' tail';
 const node=state.findNode('prepare');
 node.text=label;
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 const canonical=JSON.stringify(state.root); // viewMode is intentionally changed
 const scope=document.getElementById('nm-view-appearance-node');
 const help=document.getElementById('nm-view-appearance-help');
 state.selectedNodeId='prepare';
 const history=state.undos.length;
 scope.checked=true;scope.dispatch('change');
 const announced=help.textContent;
 assert.ok(announced.includes('🧠'.repeat(80)+'…'),'announcement is bounded at 80 code points');
 assert.ok(!announced.includes('🧠'.repeat(81)),'full long label is not announced');
 assert.ok(!announced.includes('\uFFFD'),'no broken surrogate characters');
 assert.equal(node.text,label,'the canonical label is never truncated');
 assert.equal(JSON.stringify(state.root),canonical);
 assert.equal(state.undos.length,history);
});


test('preset gallery renders geometries from all six actual projectors, with no model writes',()=>{
 const {app,state,context,document,flush}=harness();
 const snapshot=JSON.stringify(state.root.children);
 const modes=appearance.MODES;
 let totalPreviews=0;
 for(const mode of modes){
   context.NeuroMapLinkedViews.setMode(app,mode);flush();
   const container=document.getElementById('nm-view-appearance-presets');
   const buttons=container.children;
   assert.equal(buttons.length,appearance.presetsFor(mode).length,mode);
   const beforeHistory=state.undos.length;
   for(const button of buttons){
     const preset=button.dataset.preset;
     const theme=appearance.palette(mode,preset);
     const miniature=button.querySelector('.nm-preset-swatch');
     assert.ok(miniature,mode+' '+preset+' sample host');
     const svg=miniature.querySelector('svg');
     assert.ok(svg,mode+' '+preset+' SVG must be drawn, not a color-only chip');
     assert.equal(svg.getAttribute('aria-hidden'),'true');
     assert.match(svg.getAttribute('viewBox'),/^0 0 \d+ \d+$/);
     assert.equal(svg.children[0].tagName,'rect');
     assert.equal(svg.children[0].getAttribute('fill'),theme.background);
     assert.ok(svg.children.some(el=>el.tagName==='text'),'real content label projected');
     assert.ok(svg.children.some(el=>el.tagName==='rect'||el.tagName==='polygon'));
     assert.ok(svg.children.every(el=>el.tagName!=='image'&&el.tagName!=='foreignObject'),'no remote resources');
     if(mode==='concept-network'||mode==='flowchart'||mode==='orgchart'||mode==='concept-tree')
       assert.ok(svg.children.some(el=>el.tagName==='path'),'native projector routes are present');
     if(mode==='flowchart'||mode==='timeline')
       assert.ok(svg.children.some(el=>el.tagName==='polygon'),'native decision/milestone shape');
     if(mode==='kanban')
       assert.ok(svg.children.some(el=>el.tagName==='rect'&&el.getAttribute('fill')==='#fbbf24'),'actual Kanban status band');
     totalPreviews++;
   }
   context.NeuroMapLinkedViews.refresh(app);flush();
   assert.equal(state.undos.length,beforeHistory,'preview must never create Undo entries');
   assert.equal(JSON.stringify(state.root.children),snapshot,'the source document remains unchanged');
 }
 assert.ok(totalPreviews>=45);
});

test('Aurora Tree and Minimal Taxonomy appear as distinct reversible choices in the tree',()=>{
 const {app,state,context,document,flush}=harness();
 const source=JSON.stringify(state.root.children);
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 const gallery=document.getElementById('nm-view-appearance-presets');
 assert.equal(gallery.children.length,9);
 const aurora=gallery.children.find(button=>button.dataset.preset==='aurora-tree');
 const minimal=gallery.children.find(button=>button.dataset.preset==='minimal-taxonomy');
 assert.ok(aurora?.querySelector('svg'));
 assert.ok(minimal?.querySelector('svg'));
 const colorOf=button=>button.querySelector('svg').children[0].getAttribute('fill');
 assert.notEqual(colorOf(aurora),colorOf(minimal));
 const before=state.undos.length;
 aurora.dispatch('click');flush();
 assert.equal(state.root.viewAppearance.modes['concept-tree'].preset,'aurora-tree');
 minimal.dispatch('click');flush();
 assert.equal(state.root.viewAppearance.modes['concept-tree'].preset,'minimal-taxonomy');
 assert.equal(state.undos.length,before+2);
 assert.equal(JSON.stringify(state.root.children),source);
});


test('PNG 1x/2x export rasterizes the same projected SVG without changing canonical data',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 const canonical=JSON.stringify(state.root.children),history=state.undos.length;
 const downloads=[],canvases=[],created=[],revoked=[];
 const create=document.createElement;
 document.createElement=tag=>{
  if(tag!=='canvas')return create(tag);
  const canvas={width:0,height:0};
  canvas.getContext=type=>type==='2d'?{drawImage(...args){canvas.drawArgs=args}}:null;
  canvas.toBlob=(cb,kind)=>cb({type:kind,bytes:8});
  canvases.push(canvas);return canvas;
 };
 context.XMLSerializer=class{serializeToString(node){
   assert.equal(node.tagName,'svg');
   return '<svg xmlns="http://www.w3.org/2000/svg"/>';
 }};
 context.Blob=class{constructor(parts,options){this.parts=parts;this.type=options?.type}};
 context.URL={
  createObjectURL(blob){created.push(blob);return 'blob:glauka-'+created.length},
  revokeObjectURL(url){revoked.push(url)}
 };
 context.Image=class{set src(value){this.source=value;this.onload()}};
 app.io={triggerDownload(blob,name){downloads.push({blob,name});return true}};
 assert.ok(document.getElementById('nm-view-export-png1'));
 assert.ok(document.getElementById('nm-view-export-png2'));
 document.getElementById('nm-view-export-png1').dispatch('click');
 document.getElementById('nm-view-export-png2').dispatch('click');
 assert.equal(downloads.length,2);
 assert.match(downloads[0].name,/concept-tree\.png$/);
 assert.match(downloads[1].name,/concept-tree\.png$/);
 assert.ok(canvases[0].width>0&&canvases[0].height>0);
 assert.equal(canvases[1].width,canvases[0].width*2);
 assert.equal(canvases[1].height,canvases[0].height*2);
 assert.equal(canvases[0].drawArgs[0].source,'blob:glauka-1');
 assert.equal(downloads[0].blob.type,'image/png');
 assert.equal(created.length,2);
 assert.deepEqual(revoked,['blob:glauka-1','blob:glauka-2']);
 assert.equal(JSON.stringify(state.root.children),canonical);
 assert.equal(state.undos.length,history);
});

test('PNG export refuses oversized view before creating images or allocating canvas',()=>{
 const {app,state,context,flush}=harness();
 const task=state.findNode('prepare');
 task.startDate='2026-01-01';task.dueDate='2029-01-01';
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 let urls=0,downloads=0;const notices=[];
 context.URL={createObjectURL(){urls++;return 'blob:unexpected'},revokeObjectURL(){}};
 context.Image=class{constructor(){throw Error('Image must not be created for oversized preview')}};
 context.Blob=class{constructor(){}};
 context.XMLSerializer=class{serializeToString(){return '<svg/>'}};
 app.io={triggerDownload(){downloads++}};
 app.showToast=(msg)=>notices.push(String(msg));
 assert.equal(context.NeuroMapLinkedViews.exportPNG(app,2),false);
 assert.equal(urls,0);
 assert.equal(downloads,0);
 assert.ok(notices.some(msg=>/troppo grande|too large/i.test(msg)));
});


test('appearance controls use six compact native disclosure sections and keep event wiring',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const panel=document.getElementById('nm-view-appearance');
 const sections=panel.querySelectorAll('.nm-appearance-group');
 const names=['theme','colors','nodes','links','spacing','selected'];
 assert.deepEqual(sections.map(s=>s.dataset.group),names);
 assert.equal(sections[0].open,true);
 assert.equal(sections[2].open,false);
 // Release density: only theme previews open; secondary controls remain available.
 assert.equal(sections[1].open,false);
 assert.equal(sections[5].open,false);
 for(const section of sections){
   assert.equal(section.tagName,'details');
   assert.ok(section.querySelector('summary'));
   assert.ok(section.querySelector('.nm-appearance-group-content'));
 }
 const colorGroup=sections[1];
 assert.ok(colorGroup.querySelector('#nm-view-appearance-accent'),'accent remains in colors');
 const lineGroup=sections[3];
 assert.ok(lineGroup.querySelector('#nm-view-appearance-edge'),'edge remains in links');
 const snapshot=JSON.stringify(state.root.children),before=state.undos.length;
 const accent=document.getElementById('nm-view-appearance-accent');
 accent.value='#aa3388';accent.dispatch('change');flush();
 assert.equal(state.root.viewAppearance.modes.orgchart.accent,'#aa3388');
 assert.equal(state.undos.length,before+1);
 assert.equal(JSON.stringify(state.root.children),snapshot);
 sections[2].open=true;
 document.documentElement.lang='en';
 context.NeuroMapLinkedViews.refresh(app);flush();
 assert.equal(sections[1].querySelector('summary').textContent,'Colors');
 assert.equal(sections[5].querySelector('summary').textContent,'Selected');
 assert.equal(sections[2].open,true,'expanded controls survive rerender and locale changes');
});


test('Layout disclosure moves into linked view while active and returns to Disposizione',()=>{
 const {app,context,document,flush}=harness();
 const layout=document.getElementById('nm-project-view-options');
 const switcher=document.getElementById('nm-view-switch');
 assert.equal(layout.parentElement,switcher,'Layout starts in the primary control strip');
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 assert.equal(layout.parentElement.className,'nm-view-header','Layout is in the overlay while linked view is active');
 assert.equal(document.getElementById('nm-view-overlay').contains(layout),true);
 layout.open=true;
 context.NeuroMapLinkedViews.setMode(app,'mindmap');flush();
 assert.equal(layout.parentElement,switcher,'Layout returns to its original host');
 assert.equal(layout.open,false,'returning to mind map closes Layout flyout');
});
test('switching project tabs while editing the dual canvas saves the original tab',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');
 picker.value='concept-tree';picker.dispatch('change');flush();
 const card=document.getElementById('nm-dual-stage').querySelectorAll('.nm-view-card')
   .find(el=>el.dataset.nodeId==='check');
 card.dispatch('dblclick',{target:card,stopPropagation(){}});
 const field=card.querySelector('.nm-view-edit');assert.ok(field);
 field.value='Changed before leaving original tab';
 const before=state.undos.length;
 app.activateTab('another-tab');
 assert.equal(state.findNode('check').text,'Changed before leaving original tab');
 assert.equal(state.undos.length,before+1,'the original tab records exactly one rename');
 assert.equal(card.querySelectorAll('.nm-view-edit').length,0,'dual editor is released before changing tabs');
});
test('switching the primary view commits a secondary edit before the view Undo snapshot',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');
 picker.value='concept-tree';picker.dispatch('change');flush();
 const stage=document.getElementById('nm-dual-stage');
 const card=stage.querySelectorAll('.nm-view-card').find(el=>el.dataset.nodeId==='check');
 card.dispatch('dblclick',{target:card,stopPropagation(){}});
 const field=card.querySelector('.nm-view-edit');assert.ok(field);
 field.value='Edited in secondary before switching primary';
 const before=state.undos.length;
 context.NeuroMapLinkedViews.setMode(app,'timeline');
 assert.equal(state.findNode('check').text,field.value,'edit saves synchronously');
 const modeUndo=JSON.parse(state.undos.at(-1));
 assert.equal(modeUndo.root.viewMode,'orgchart','view-mode Undo returns to the prior view');
 assert.equal(modeUndo.root.children.find(n=>n.id==='check').text,field.value,
  'undoing mode switch must never discard the already typed rename');
 flush();
 assert.equal(state.root.viewMode,'timeline');
 assert.equal(state.undos.length,before+2,'one rename Undo, then one mode Undo');
 assert.equal(stage.querySelectorAll('.nm-view-edit').length,0,'hidden secondary editor is released');
});
test('switching secondary mode does not stall when the primary card is being renamed',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const main=document.getElementById('nm-view-stage');
 const card=main.querySelectorAll('.nm-view-card').find(el=>el.dataset.nodeId==='check');
 card.dispatch('dblclick',{target:card,stopPropagation(){}});
 const field=card.querySelector('.nm-view-edit');assert.ok(field);
 field.value='Primary editor still open';
 const picker=document.getElementById('nm-dual-picker');
 picker.value='concept-tree';picker.dispatch('change');flush();
 assert.ok(main.contains(field),'primary edit remains available while changing secondary only');
 assert.equal(document.getElementById('nm-dual-stage').querySelectorAll('.nm-tree-card').length>0,true,
  'secondary diagram updates immediately instead of showing the prior mode');
 assert.equal(state.findNode('check').text,'Review','unsaved edit stays with primary editor');
 field.dispatch('keydown',{key:'Enter',preventDefault(){},stopPropagation(){}});flush();
 assert.equal(state.findNode('check').text,'Primary editor still open');
});
test('changing secondary view while editing saves text and replaces the old editor',()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');
 picker.value='concept-tree';picker.dispatch('change');flush();
 const stage=document.getElementById('nm-dual-stage');
 const card=stage.querySelectorAll('.nm-view-card').find(el=>el.dataset.nodeId==='check');
 assert.ok(card,'secondary concept tree has an editable card');
 card.dispatch('dblclick',{target:card,stopPropagation(){}});
 const field=card.querySelector('.nm-view-edit');
 assert.ok(field,'secondary editor opens');
 assert.equal(field._nmViewMode,'concept-tree','the editor owns the actual secondary view');
 field.value='Saved before switching the second view';
 const before=state.undos.length;
 picker.value='kanban';picker.dispatch('change');flush();
 assert.equal(state.findNode('check').text,'Saved before switching the second view');
 assert.equal(state.undos.length,before+1,'renaming is the only document history operation');
 assert.equal(stage.querySelectorAll('.nm-view-edit').length,0,'obsolete editor does not linger');
 assert.ok(stage.querySelectorAll('.nm-kanban-card').length>0,'secondary canvas renders the requested mode');
 assert.equal(state.root.viewMode,'orgchart','primary view remains unchanged');
});
test('compact linked-view menus preserve export handlers and close across view changes',()=>{
 const {app,state,context,document,flush}=harness();
 const snapshot=JSON.stringify(state.root.children);
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const appearance=document.getElementById('nm-view-appearance');
 const exports=document.getElementById('nm-view-export-menu');
 const layouts=document.getElementById('nm-project-view-options');
 assert.ok(appearance&&exports&&layouts);
 assert.equal(exports.tagName,'details');
 assert.equal(layouts.tagName,'details');
 assert.equal(appearance.querySelectorAll('.nm-appearance-group').length,6);
 for(const id of ['nm-view-export-svg','nm-view-export-png1','nm-view-export-png2','nm-view-export-pdf']){
   const button=document.getElementById(id);
   assert.ok(button,'existing '+id+' export action remains accessible');
   assert.equal(button.parentElement.id,'nm-view-export-actions');
 }
 exports.open=true;
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 assert.equal(exports.open,false);
 appearance.open=true;
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 assert.equal(appearance.open,false);
 layouts.open=true;
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 assert.equal(layouts.open,false);
 assert.equal(JSON.stringify(state.root.children),snapshot);
});
test('view PDF export embeds a bounded JPEG scene and writes consistent xref offsets',async()=>{
 const {app,state,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const original=JSON.stringify(state.root.children),history=state.undos.length;
 const downloads=[],revoked=[],jpeg=Uint8Array.from([255,216,255,224,1,2,3,4,255,217]);
 const create=document.createElement;
 document.createElement=tag=>{
  if(tag!=='canvas')return create(tag);
  return {width:0,height:0,getContext:()=>({drawImage(){}}),
   toBlob(cb,kind,quality){
    assert.equal(kind,'image/jpeg');
    assert.equal(quality,.92);
    cb({type:kind,arrayBuffer:async()=>jpeg.buffer});
   }};
 };
 context.XMLSerializer=class{serializeToString(){return '<svg xmlns="http://www.w3.org/2000/svg"/>'}};
 context.Blob=class{constructor(parts,options){this.parts=parts;this.type=options.type}};
 context.URL={createObjectURL(){return 'blob:glauka-view-pdf'},revokeObjectURL(value){revoked.push(value)}};
 context.Image=class{set src(_value){this.onload()}};
 app.io={triggerDownload(blob,name){downloads.push({blob,name});return true}};
 assert.ok(document.getElementById('nm-view-export-pdf'));
 document.getElementById('nm-view-export-pdf').dispatch('click');
 await new Promise(setImmediate);
 assert.equal(downloads.length,1);
 assert.match(downloads[0].name,/orgchart\.pdf$/);
 assert.equal(downloads[0].blob.type,'application/pdf');
 const bytes=downloads[0].blob.parts[0];
 assert.ok(require('node:util').types.isUint8Array(bytes));
 const asString=Array.from(bytes,x=>String.fromCharCode(x)).join('');
 assert.ok(asString.startsWith('%PDF-1.4\n'));
 assert.match(asString,/\/Filter \/DCTDecode/);
 assert.match(asString,/\/Count 1/);
 assert.match(asString,/\/MediaBox \[0 0 /);
 const xref=Number(asString.match(/startxref\n(\d+)\n%%EOF/)[1]);
 assert.equal(asString.slice(xref,xref+5),'xref\n');
 const entries=asString.slice(xref).split('\n').slice(3,8);
 for(let id=1;id<=5;id++){
  const offset=Number(entries[id-1].slice(0,10));
  assert.equal(asString.slice(offset,offset+7),id+' 0 obj');
 }
 assert.deepEqual(revoked,['blob:glauka-view-pdf']);
 assert.equal(JSON.stringify(state.root.children),original);
 assert.equal(state.undos.length,history);
});


test('view PDF export rejects non-JPEG bytes without downloading a corrupt document',async()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const notices=[],revoked=[],downloads=[];
 const oldCreate=document.createElement;
 document.createElement=tag=>tag==='canvas'?{
  width:0,height:0,getContext:()=>({drawImage(){}}),
  toBlob(cb,kind){
   assert.equal(kind,'image/jpeg');
   cb({arrayBuffer:async()=>Uint8Array.from([137,80,78,71,1,2]).buffer});
  }
 }:oldCreate(tag);
 context.XMLSerializer=class{serializeToString(){return '<svg/>'}};
 context.Blob=class{constructor(parts,options){this.parts=parts;this.type=options.type}};
 context.Image=class{set src(_url){this.onload()}};
 context.URL={createObjectURL(){return 'blob:invalid-pdf'},revokeObjectURL(url){revoked.push(url)}};
 app.io={triggerDownload(...args){downloads.push(args)}};
 app.showToast=(msg)=>notices.push(String(msg));
 document.getElementById('nm-view-export-pdf').dispatch('click');
 await new Promise(setImmediate);
 assert.equal(downloads.length,0,'invalid JPEG bytes must not create a fake PDF');
 assert.ok(notices.some(msg=>/PDF/.test(msg)));
 assert.deepEqual(revoked,['blob:invalid-pdf']);
});


test('SVG/PNG/PDF share the same self-contained dotted grid and palette',()=>{
 const {app,state,context,document,flush}=harness();
 let exported;
 context.XMLSerializer=class{serializeToString(node){exported=node;return '<svg/>'}};
 context.Blob=class{constructor(parts,options){this.parts=parts;this.type=options.type}};
 app.io={triggerDownload(){return true}};
 const original=JSON.stringify(state.root.children);
 for(const mode of appearance.MODES){
  context.NeuroMapLinkedViews.setMode(app,mode);flush();
  const preset=appearance.presetsFor(mode).at(-1);
  state.root.viewAppearance=appearance.update(state.root.viewAppearance,mode,{preset});
  context.NeuroMapLinkedViews.refresh(app);flush();
  assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
  const grid=exported.children.find(el=>el.tagName==='defs')
   .children.find(el=>el.tagName==='pattern'&&el.getAttribute('id')==='nm-export-grid');
  assert.ok(grid,mode+' must define the local dot grid');
  assert.equal(grid.getAttribute('patternUnits'),'userSpaceOnUse');
  assert.equal(grid.getAttribute('width'),'28');
  assert.equal(grid.getAttribute('height'),'28');
  const dot=grid.children.find(el=>el.tagName==='circle');
  assert.ok(dot);
  assert.equal(dot.getAttribute('fill'),appearance.palette(mode,preset).grid);
  const overlay=exported.children.find(el=>el.tagName==='rect'&&
    el.getAttribute('fill')==='url(#nm-export-grid)');
  assert.ok(overlay,mode+' grid overlay must be exported');
 }
 assert.equal(JSON.stringify(state.root.children),original,'the demo/export must not alter canonical children');
});


test('shared view color tokens render consistently for org/tree/network cards and preset SVG grids',()=>{
 const {app,state,context,document,flush}=harness();
 const original=JSON.stringify(state.root.children);
 for(const [mode,selector,attribute] of [
  ['orgchart','.nm-orgchart-card','--nm-orgchart-band'],
  ['concept-tree','.nm-tree-card','--nm-tree-group'],
  ['concept-network','.nm-network-card','--nm-network-cluster']
 ]){
  context.NeuroMapLinkedViews.setMode(app,mode);flush();
  const cards=document.getElementById('nm-view-stage').querySelectorAll(selector)
   .filter(el=>el.dataset.nodeId==='prepare'||el.dataset.nodeId==='check');
  assert.equal(cards.length,2,mode);
  for(const [index,card] of cards.entries())
   assert.equal(card.style.getPropertyValue(attribute),appearance.groupColor(index),mode+' '+attribute);
  const scroller=document.getElementById('nm-view-scroller');
  assert.equal(scroller.style.backgroundSize,appearance.CANVAS_GRID_SIZE+'px '+appearance.CANVAS_GRID_SIZE+'px');
  const gallery=document.getElementById('nm-view-appearance-presets');
  const allIds=new Set();
  for(const button of gallery.children){
   const svg=button.querySelector('svg'),preset=button.dataset.preset;
   const defs=svg.children.find(e=>e.tagName==='defs');
   const pattern=defs?.children.find(e=>e.tagName==='pattern');
   assert.ok(pattern,mode+' '+preset+' must have a real grid preview');
   const id=pattern.getAttribute('id');
   assert.equal(allIds.has(id),false,'inline SVG patterns must have unique identifiers');
   allIds.add(id);
   assert.equal(pattern.getAttribute('width'),String(appearance.CANVAS_GRID_SIZE));
   assert.equal(pattern.getAttribute('height'),String(appearance.CANVAS_GRID_SIZE));
   assert.equal(pattern.children[0].getAttribute('fill'),appearance.palette(mode,preset).grid);
   assert.ok(svg.children.some(el=>el.getAttribute('fill')==='url(#'+id+')'));
  }
 }
 assert.equal(JSON.stringify(state.root.children),original,'semantic theme tokens must never mutate source nodes');
});


test('Kanban cards and headers share semantic status colors without CSS palette duplicates',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').taskStatus='doing';
 state.findNode('check').taskStatus='done';
 const canonical=JSON.stringify(state.root.children);
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const stage=document.getElementById('nm-view-stage');
 const cards=stage.querySelectorAll('.nm-kanban-card');
 const header=stage.querySelectorAll('.nm-work-column');
 assert.equal(header.length,4);
 for(const lane of header){
  const status=lane.dataset.status;
  assert.equal(lane.style.getPropertyValue('--nm-kanban-status'),
   appearance.kanbanStatusColor(status),'status lane '+status);
 }
 assert.equal(cards.length,2);
 for(const card of cards){
  const status=card.dataset.status;
  assert.equal(card.style.getPropertyValue('--nm-kanban-status'),
   appearance.kanbanStatusColor(status),'task status '+status);
 }
 assert.equal(JSON.stringify(state.root.children),canonical);
});


test('network relation hover and keyboard focus show both endpoints without changing map data',()=>{
 const {app,state,context,document,flush}=harness();
 state.addRelationship('prepare','check','causes');
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const stage=document.getElementById('nm-view-stage');
 const source=stage.querySelectorAll('.nm-network-card').find(el=>el.dataset.nodeId==='prepare');
 const target=stage.querySelectorAll('.nm-network-card').find(el=>el.dataset.nodeId==='check');
 const edge=stage.querySelector('.nm-network-edge');
 const list=document.getElementById('nm-network-list'),chip=list.children[0];
 const original=JSON.stringify(state.root),relations=JSON.stringify(state.relationships),history=state.undos.length;
 assert.ok(source&&target&&edge&&chip);
 assert.equal(chip.tabIndex,0);
 assert.equal(chip.getAttribute('role'),'group');
 assert.match(chip.getAttribute('aria-label'),/Prepare.*Review.*causes/);
 chip.dispatch('mouseenter');
 assert.ok(source.className.includes('is-relation-source'));
 assert.ok(target.className.includes('is-relation-target'));
 assert.ok(edge.className.includes('is-relation-focused'));
 chip.dispatch('mouseleave');
 assert.equal(source.className.includes('is-relation-source'),false);
 assert.equal(target.className.includes('is-relation-target'),false);
 assert.equal(edge.className.includes('is-relation-focused'),false);
 chip.dispatch('focusin');
 assert.ok(source.className.includes('is-relation-source'));
 const remove=chip.querySelector('.nm-network-remove');
 chip.dispatch('focusout',{relatedTarget:remove});
 assert.ok(source.className.includes('is-relation-source'),'focus still inside relationship retains highlight');
 chip.dispatch('focusout',{relatedTarget:null});
 assert.equal(source.className.includes('is-relation-source'),false);
 assert.equal(target.className.includes('is-relation-target'),false);
 assert.equal(JSON.stringify(state.root),original);
 assert.equal(JSON.stringify(state.relationships),relations);
 assert.equal(state.undos.length,history);
});


test('concept tree shares depth-based typography across primary, split, preview and SVG export',()=>{
 const {app,state,context,document,flush}=harness();
 state.root.children[0].children.push({id:'deep',text:'Third depth',children:[]});
 const saved=JSON.stringify(state.root.children);
 state.root.viewAppearance=appearance.update(null,'concept-tree',{preset:'academic',fontSize:16});
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 const primary=document.getElementById('nm-view-stage');
 const fontOf=(stage,id)=>{
  const card=stage.querySelectorAll('.nm-view-card').find(node=>node.dataset.nodeId===id);
  assert.ok(card,'card for '+id);
  const label=card.querySelector('.nm-view-title');
  return {size:Number.parseFloat(label.style.fontSize),weight:Number(label.style.fontWeight)};
 };
 for(const [id,depth]of [['root',0],['prepare',1],['deep',2]]){
  const expected=appearance.treeTypography(depth,16);
  assert.deepEqual(fontOf(primary,id),{size:expected.fontSize,weight:expected.fontWeight});
 }
 // A split pair must have distinct modes: compare with an orgchart primary.
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const picker=document.getElementById('nm-dual-picker');
 picker.value='concept-tree';picker.dispatch('change');flush();
 const secondary=document.getElementById('nm-dual-stage');
 for(const [id,depth]of [['root',0],['prepare',1],['deep',2]]){
  const expected=appearance.treeTypography(depth,16);
  assert.deepEqual(fontOf(secondary,id),{size:expected.fontSize,weight:expected.fontWeight});
 }
 // Show the tree in the primary pane again to expose its preset gallery.
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 // Gallery thumbnails derive from actual projections and the same typography.
 const gallery=document.getElementById('nm-view-appearance-presets');
 const preset=gallery.children.find(button=>button.dataset.preset==='academic');
 const preview=preset?.querySelector('svg');
 assert.ok(preview);
 const previewLabels=preview.querySelectorAll('text');
 assert.ok(previewLabels.some(label=>
  label.getAttribute('font-size')===String(appearance.treeTypography(0,
   appearance.palette('concept-tree','academic').fontSize).fontSize)&&
  label.getAttribute('font-weight')==='750'));
 let exported;
 context.XMLSerializer=class{serializeToString(svg){exported=svg;return '<svg/>'}};
 context.Blob=class{constructor(parts,opt){this.parts=parts;this.type=opt.type}};
 app.io={triggerDownload(){return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const labels=exported.querySelectorAll('text').filter(node=>node.getAttribute('aria-label'));
 for(const [text,depth]of [['Project',0],['Prepare',1],['Third depth',2]]){
  const node=labels.find(label=>label.getAttribute('aria-label')===text);
  assert.ok(node,'SVG label '+text);
  const expected=appearance.treeTypography(depth,16);
  assert.equal(node.getAttribute('font-size'),String(expected.fontSize));
  assert.equal(node.getAttribute('font-weight'),String(expected.fontWeight));
 }
 assert.equal(JSON.stringify(state.root.children),saved,'rendering must leave the canonical map unchanged');
});


test('deep concept-tree badges show 99+ but retain exact depth for assistive names and SVG',()=>{
 const {app,state,context,document,flush}=harness();
 let parent=state.root.children[0];
 for(let i=2;i<=101;i++){
  const next={id:'level-'+i,text:'Level '+i,children:[]};
  parent.children.push(next);parent=next;
 }
 const unchanged=JSON.stringify(state.root.children);
 context.NeuroMapLinkedViews.setMode(app,'concept-tree');flush();
 const stage=document.getElementById('nm-view-stage');
 const card=stage.querySelectorAll('.nm-tree-card').find(node=>node.dataset.nodeId==='level-100');
 assert.ok(card,'100th level should remain represented');
 assert.equal(card.dataset.depth,'99+');
 assert.equal(card.dataset.depthLong,'true');
 assert.match(card.getAttribute('aria-label'),/Livello 100/);
 const before=state.undos.length;
 let exported;
 context.XMLSerializer=class{serializeToString(svg){exported=svg;return '<svg/>'}};
 context.Blob=class{constructor(parts,opts){this.parts=parts;this.type=opts.type}};
 app.io={triggerDownload(){return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const badge=exported.querySelectorAll('text').find(item=>item.getAttribute('aria-label')==='Livello 100');
 assert.ok(badge);
 assert.equal(badge.textContent,'99+');
 assert.equal(badge.getAttribute('font-size'),'8');
 const leafBar=exported.querySelectorAll('rect').find(item=>item.getAttribute('data-tree-accent')==='leaf');
 assert.ok(leafBar);
 assert.equal(leafBar.getAttribute('width'),'3');
 assert.equal(leafBar.getAttribute('opacity'),'.55');
 assert.equal(JSON.stringify(state.root.children),unchanged);
 assert.equal(state.undos.length,before);
});


test('network relationship list abbreviates Unicode safely while preserving complete accessible text',()=>{
 const {app,state,context,document,flush}=harness();
 const emoji='👩🏽‍🔬',source=emoji.repeat(35);
 const relation='🧬'.repeat(50);
 state.root.children[0].text=source;
 state.addRelationship('prepare','check',relation);
 const original=JSON.stringify(state.root.children),edges=JSON.stringify(state.relationships);
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const chip=document.getElementById('nm-network-list').children[0];
 assert.ok(chip);
 const label=chip.querySelector('span');
 assert.ok(label.textContent.startsWith(network.displayLabel(source,28)));
 assert.equal(label.textContent.includes('\ufffd'),false);
 assert.equal(label.title,source+' → Review · '+relation,'full tooltip must survive truncation');
 assert.equal(chip.getAttribute('aria-label'),'Relazione da '+source+' a Review · '+relation);
 assert.equal(JSON.stringify(state.root.children),original);
 assert.equal(JSON.stringify(state.relationships),edges);
});


test('Flow Input/Output selectable in primary and split, saved on canonical nodes with Undo',()=>{
 const {app,state,context,document,flush}=harness();
 state.addFlowTransition('prepare','check','sequence');
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const source=document.getElementById('nm-flow-from'),picker=document.getElementById('nm-flow-shape');
 source.value='prepare';source.dispatch('change');
 const choices=picker.children.map(option=>option.value);
 assert.ok(choices.includes('input')&&choices.includes('output'));
 const firstUndo=state.undos.length;
 picker.value='input';picker.dispatch('change');flush();
 assert.equal(state.findNode('prepare').flowShape,'input');
 assert.equal(state.undos.length,firstUndo+1);
 const primary=document.getElementById('nm-view-stage');
 const get=(stage,id)=>stage.querySelectorAll('.nm-view-card').find(el=>el.dataset.nodeId===id);
 assert.equal(get(primary,'prepare').dataset.flowShape,'input');
 assert.ok(get(primary,'prepare').className.includes('is-flow-io'));
 assert.equal(get(primary,'prepare').querySelector('.nm-flow-role-label').textContent,'Ingresso');
 assert.match(get(primary,'prepare').getAttribute('aria-label'),/Ingresso · Prepare/);
 assert.ok(get(primary,'prepare').style.getPropertyValue('--nm-flow-io-border'));
 const count=state.relationships.length;
 // Use orgchart as primary: a split view must have a distinct mode.
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 document.getElementById('nm-view-split').dispatch('click');flush();
 const side=document.getElementById('nm-dual-picker');
 side.value='flowchart';side.dispatch('change');flush();
 const from=document.getElementById('nm-dual-flow-from'),shape=document.getElementById('nm-dual-flow-shape');
 assert.ok(shape.children.some(option=>option.value==='output'));
 from.value='check';from.dispatch('change');
 const previous=state.undos.length;
 shape.value='output';shape.dispatch('change');flush();
 assert.equal(state.findNode('check').flowShape,'output');
 assert.equal(state.undos.length,previous+1);
 assert.equal(state.relationships.length,count);
 const secondary=document.getElementById('nm-dual-stage');
 assert.ok(get(secondary,'check').className.includes('is-flow-io'));
 assert.equal(get(secondary,'check').querySelector('.nm-flow-role-label').textContent,'Uscita');
 assert.match(get(secondary,'check').getAttribute('aria-label'),/Uscita · Review/);
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 assert.equal(get(document.getElementById('nm-view-stage'),'check').dataset.flowShape,'output');
});

test('Flow Input/Output SVG export uses exactly the same slanted geometry and labels',()=>{
 const {app,state,context,document,flush}=harness();
 state.addFlowTransition('prepare','check','sequence');
 state.setNodeFlowShape('prepare','input');
 state.setNodeFlowShape('check','output');
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const original=JSON.stringify(state.root.children),links=JSON.stringify(state.relationships),undo=state.undos.length;
 let svg;
 context.XMLSerializer=class{serializeToString(value){svg=value;return '<svg xmlns="http://www.w3.org/2000/svg"/>'}};
 context.Blob=class{constructor(parts,options){this.parts=parts;this.type=options.type}};
 app.io={triggerDownload(){return true}};
 assert.equal(context.NeuroMapLinkedViews.exportSVG(app),true);
 const graph=flow.project(state.root,state.relationships),points=id=>{
  const node=graph.nodes.find(x=>x.id===id);
  return flow.ioPoints(node).map(pair=>pair.join(',')).join(' ');
 };
 for(const [id,shape,label]of [['prepare','input','Ingresso'],['check','output','Uscita']]){
  const p=svg.querySelectorAll('polygon').find(el=>el.getAttribute('data-flow-shape')===shape);
  assert.ok(p,'SVG must contain '+shape+' polygon');
  assert.equal(p.getAttribute('points'),points(id));
  const name=svg.querySelectorAll('text').find(el=>el.textContent===label);
  assert.ok(name,'SVG must label the user-chosen '+shape+' role');
 }
 assert.equal(JSON.stringify(state.root.children),original);
 assert.equal(JSON.stringify(state.relationships),links);
 assert.equal(state.undos.length,undo);
});

test('flowchart preset previews contain actual Input/Output parallelogram polygons',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const previews=document.getElementById('nm-view-appearance-presets');
 assert.ok(previews.children.length>1);
 for(const button of previews.children){
  const svg=button.querySelector('svg');
  assert.ok(svg,'real SVG preview required');
  // The fixture has Input / Decision / Output and two explicit branches.
  assert.ok(svg.querySelectorAll('polygon').length>=3);
 }
});

test('view tooltips and microcopy stay paired in Italian and English',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const fit=document.getElementById('nm-view-zoom-fit');
 const reset=document.getElementById('nm-view-zoom-reset');
 const help=document.getElementById('nm-view-help');
 const layout=document.getElementById('nm-project-view-options').querySelector('summary');
 const split=document.getElementById('nm-view-split');
 assert.equal(fit.textContent,'Adatta');
 assert.equal(fit.getAttribute('aria-label'),'Adatta la vista alla finestra');
 assert.equal(fit.title,fit.getAttribute('aria-label'));
 assert.equal(reset.textContent,'100%');
 assert.equal(reset.getAttribute('aria-label'),'Ripristina zoom');
 assert.match(help.textContent,/Annulla/);
 assert.doesNotMatch(help.textContent,/\bUndo\b/);
 assert.equal(layout.textContent,'Spazio di lavoro');
 assert.match(layout.title,/layout salvati/);
 assert.equal(split.getAttribute('aria-label'),'Affianca una seconda vista');
 assert.equal(split.title,split.getAttribute('aria-label'));
 document.documentElement.lang='en';
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 assert.equal(fit.textContent,'Fit');
 assert.equal(fit.getAttribute('aria-label'),'Fit the view to the window');
 assert.equal(reset.getAttribute('aria-label'),'Reset zoom');
 assert.match(help.textContent,/Undo/);
 assert.equal(layout.textContent,'Workspace');
 assert.match(layout.title,/saved layouts/);
 assert.equal(split.getAttribute('aria-label'),'Show a second view');
 context.NeuroMapLinkedViews.setMode(app,'concept-network');flush();
 const link=document.getElementById('nm-network-link');
 assert.equal(link.textContent,'Link two concepts');
 assert.equal(link.title,link.textContent);
 const png=document.getElementById('nm-view-export-png2');
 assert.match(png.getAttribute('aria-label'),/2× scale/);
 assert.equal(png.title,png.getAttribute('aria-label'));
});

test('dragging a branch in the organization chart updates every view and can be undone',()=>{
 const {app,state,context,document,flush}=harness();
 const prepare=state.findNode('prepare'),check=state.findNode('check');
 const leaf={id:'leaf',text:'Dettaglio',parentId:'prepare',children:[],notes:'Nota viva'};
 prepare.children.push(leaf);
 prepare.sourceRefs=[{id:'src_p5vista',kind:'pdf',fileName:'spartito.pdf',page:3,sha256:'ab'.repeat(32)}];
 prepare.notes='Tenere';prepare.dueDate='2026-11-20';prepare.imageId='img-spartito';
 state.relationships.push({id:'rel-p5',fromId:'prepare',toId:'check',label:'prima'});
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const stage=document.getElementById('nm-view-stage');
 const card=id=>[...stage.querySelectorAll('.nm-view-card')].find(el=>el.dataset.nodeId===id);
 const source=card('prepare'),target=card('check');
 source.dispatch('dragstart',{target:source,dataTransfer:{setData(){},effectAllowed:''}});
 target.dispatch('drop',{preventDefault(){},dataTransfer:{getData:()=>'prepare'}});flush();
 assert.equal(prepare.parentId,'check');
 assert.equal(state.root.children.includes(prepare),false);
 assert.equal(check.children.includes(prepare),true);
 assert.equal(prepare.sourceRefs[0].page,3);
 assert.equal(prepare.notes,'Tenere');
 assert.equal(prepare.dueDate,'2026-11-20');
 assert.equal(prepare.imageId,'img-spartito');
 assert.equal(leaf.notes,'Nota viva');
 assert.equal(state.relationships[0].label,'prima');
 const snap=JSON.parse(state.undos.at(-1));
 assert.equal(snap.root.children.find(n=>n.id==='prepare').parentId,'root');
 const blocked=card('leaf');
 blocked.dispatch('dragover',{preventDefault(){}});
 source.dispatch('dragstart',{target:source,dataTransfer:{setData(){}}});
 blocked.dispatch('drop',{preventDefault(){},dataTransfer:{getData:()=>'prepare'}});flush();
 assert.equal(prepare.parentId,'check','a branch cannot move inside itself');
 for(const mode of ['concept-tree','kanban','timeline','flowchart','concept-network','mindmap']){
  context.NeuroMapLinkedViews.setMode(app,mode);flush();
  assert.equal(state.findNode('prepare').parentId,'check',mode);
  assert.equal(state.findNode('prepare').sourceRefs[0].fileName,'spartito.pdf',mode);
  assert.equal(state.findNode('leaf').notes,'Nota viva',mode);
 }
});

test('a flowchart Yes step, a timeline date and a kanban predecessor stay on the same nodes',()=>{
 const {app,state,context,document,flush}=harness();
 const prepare=state.findNode('prepare');
 prepare.taskStatus='todo';prepare.taskDependsOn=['check'];
 prepare.startDate='2026-11-01';prepare.dueDate='2026-11-09';
 prepare.sourceRefs=[{id:'src_p5data',kind:'pdf',fileName:'calendario.pdf',page:1,sha256:'cd'.repeat(32)}];
 state.selectedNodeId='prepare';
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const step=[...document.querySelectorAll('.nm-view-flow-step')].find(el=>el.textContent==='Sì');
 step.dispatch('click',{stopPropagation(){},target:step});flush();
 const edge=state.relationships.at(-1);
 assert.equal(edge.kind,'yes');
 assert.equal(edge.fromId,'prepare');
 assert.equal(state.findNode(edge.toId).parentId,'prepare');
 assert.equal(prepare.sourceRefs[0].fileName,'calendario.pdf');
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 const start=document.querySelector('.nm-timeline-field');
 assert.equal(start.value,'2026-11-01');
 start.value='2026-12-01';start.dispatch('change');flush();
 assert.equal(prepare.startDate,'2026-11-01','a start after the due date is refused');
 start.value='2026-11-02';start.dispatch('change');flush();
 assert.equal(prepare.startDate,'2026-11-02');
 assert.equal(prepare.dueDate,'2026-11-09');
 context.NeuroMapLinkedViews.setMode(app,'kanban');flush();
 const card=[...document.querySelectorAll('.nm-view-card')].find(el=>el.dataset.nodeId==='prepare');
 const deps=card.querySelector('.nm-kanban-deps');
 assert.match(deps.textContent,/Prima: Review|Before: Review/);
 assert.equal(prepare.taskDependsOn[0],'check');
 context.NeuroMapLinkedViews.setMode(app,'mindmap');flush();
 assert.equal(state.findNode('prepare').startDate,'2026-11-02');
 assert.equal(state.findNode('prepare').sourceRefs[0].page,1);
 assert.equal(state.relationships.at(-1).kind,'yes');
});

test('fitting a timeline or an organization chart stays readable',()=>{
 const {app,state,context,document,flush}=harness();
 state.findNode('prepare').startDate='2026-01-01';
 state.findNode('prepare').dueDate='2026-06-01';
 context.NeuroMapLinkedViews.setMode(app,'timeline');flush();
 assert.equal(document.getElementById('nm-view-zoom-status').textContent,'100%');
 assert.equal(document.getElementById('nm-view-scroller').scrollLeft,0);
 const scroller=document.getElementById('nm-view-scroller');
 scroller.clientWidth=220;scroller.clientHeight=140;
 document.getElementById('nm-view-zoom-fit').dispatch('click');flush();
 assert.ok(Number.parseInt(document.getElementById('nm-view-zoom-status').textContent,10)>=100);
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 scroller.clientWidth=220;scroller.clientHeight=140;
 document.getElementById('nm-view-zoom-fit').dispatch('click');flush();
 const orgZoom=Number.parseInt(document.getElementById('nm-view-zoom-status').textContent,10);
 assert.ok(orgZoom>=85&&orgZoom<=115);
});

test('an organization chart opens on the top of the hierarchy',()=>{
 const {app,context,document,flush}=harness();
 context.NeuroMapLinkedViews.setMode(app,'orgchart');flush();
 const scroller=document.getElementById('nm-view-scroller');
 const top=Math.min(...[...document.querySelectorAll('.nm-view-card')].map(card=>Number.parseFloat(card.style.top)||0));
 assert.equal(document.getElementById('nm-view-zoom-status').textContent,'100%');
 assert.ok(scroller.scrollTop<=Math.max(0,top-48)+1);
});

test('yes and no stay on the selected flow step',()=>{
 const {app,state,context,document,flush}=harness();
 state.addFlowTransition('prepare','check','sequence');
 state.selectedNodeId='prepare';
 context.NeuroMapLinkedViews.setMode(app,'flowchart');flush();
 const yes=[...document.querySelectorAll('.nm-view-flow-step')].filter(el=>el.textContent==='Sì');
 assert.equal(yes.length,1);
 assert.equal(yes[0].closest('.nm-view-card').dataset.nodeId,'prepare');
 const check=[...document.querySelectorAll('.nm-view-card')].find(el=>el.dataset.nodeId==='check');
 check.dispatch('click');flush();
 const moved=[...document.querySelectorAll('.nm-view-flow-step')].filter(el=>el.textContent==='Sì');
 assert.equal(moved.length,1);
 assert.equal(moved[0].closest('.nm-view-card').dataset.nodeId,'check');
});
