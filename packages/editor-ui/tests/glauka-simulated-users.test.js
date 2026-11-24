'use strict';
const composeUiSource=require('./helpers/compose-ui-source.cjs');

// Model-based people simulation. It is NOT a substitute for usability studies.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const core=require('./helpers/compose-creative-core.cjs')();
const drawingSource=composeUiSource('creative-drawing');
class Element{
 constructor(tag='div'){
  this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.style={};this.listeners={};
  this.className='';this.classList={add:()=>{},remove:()=>{}};
  this.hidden=false;this.value='';this.id='';this.type='';this.checked=false;this.textContent='';
 }
 append(...items){for(const el of items)if(el)this.children.push(el)}
 prepend(...items){for(const el of items)if(el)this.children.unshift(el)}
 replaceChildren(...items){this.children=[];this.append(...items)}
 setAttribute(key,value){this.attrs[key]=String(value)}
 addEventListener(key,fn){(this.listeners[key]??=[]).push(fn)}
 click(){this.onclick?.();for(const fn of this.listeners.click||[])fn()}
 input(value){this.value=value;this.oninput?.();for(const fn of this.listeners.input||[])fn()}
 focus(){}
 querySelectorAll(selector){
  const result=[],walk=el=>{for(const child of el.children){
   if(selector==='[data-chart-type]'&&child.dataset.chartType
      ||selector==='[data-wordart-style]'&&child.dataset.wordartStyle)result.push(child);
   walk(child);
  }};
  walk(this);return result;
 }
}
function harness(){
 let panel=null;
 const document={
  createElement:type=>new Element(type),
  createTextNode:text=>{const e=new Element('text');e.textContent=text;return e},
  getElementById:()=>null
 };
 const coords={root:{x:0,y:0},a:{x:210,y:110},b:{x:-180,y:-190}};
 const state={
  root:{id:'root'},selectedNodeId:'a',selectedNodeIds:[],selectedImageId:null,images:[],history:0,
  pushHistory(){this.history++},
  findNode:id=>id?{id,text:id}:null,
  findImage(id){return this.images.find(x=>x.id===id)}
 };
 const app={
  state,layout:{getLayout:id=>coords[id]||null},changed:0,
  renderer:{resolveImageWorldRect(im){
   const node=coords[im.attachedNodeId];
   if(im.mode==='attached'&&!node)return null;
   const cx=im.mode==='attached'?node.x+im.offset.dx:im.worldPos.x;
   const cy=im.mode==='attached'?node.y+im.offset.dy:im.worldPos.y;
   return {cx,cy,x:cx-im.width/2,y:cy-im.height/2,w:im.width,h:im.height};
  }},markChanged(){this.changed++}
 };
 const ui={
  core,tr:(it)=>it,data:svg=>'data:image/svg+xml,'+encodeURIComponent(svg),
  button:(id,it,en,callback)=>{const b=new Element('button');b.id=id;b.textContent=it;b.onclick=callback;return b},
  field:(id,it,en,type)=>{const label=new Element('label'),input=new Element(type||'input');input.id=id;label.append(input);return {label,input}},
  dialog:()=>{panel=new Element('panel');return {panel,valid:()=>true,close:()=>{panel.closed=true}}},
  addGraphic:(app,svg,width,height,meta)=>{
   app.state.pushHistory();
   const item={id:'img'+app.state.images.length,src:ui.data(svg),width,height,worldPos:{x:100,y:-80},
    mode:'free',attachedNodeId:null,offset:{dx:0,dy:-84},graphic:core.graphic(meta)};
   app.state.images.push(item);app.state.selectedImageId=item.id;app.markChanged();return item;
  }
 };
 const sandbox=vm.createContext({document,NeuroMapCreativeModules:{ui,formulas:{formulaDialog(){}},drawing:{}},
  NeuroMapWorkspaceLayout:{claim:()=>true}});
 vm.runInContext(drawingSource,sandbox);
 const drawing=sandbox.NeuroMapCreativeModules.drawing;
 const get=id=>{
  const stack=[panel];while(stack.length){
   const e=stack.pop();if(e.id===id)return e;
   for(const c of e.children)stack.push(c);
  }
  throw Error('Control not found: '+id);
 };
 const pos=item=>app.renderer.resolveImageWorldRect(item);
 return {app,drawing,get,pos};
}
test('240 chart insertions: color edit, original anchor and stable detach',()=>{
 const {app,drawing,get,pos}=harness();
 for(let i=0;i<240;i++){
  app.state.selectedNodeId='a';drawing.chartDialog(app);
  get('nm-chart-type-'+core.CHART_TYPES[i%12]).click();
  get('nm-chart-title').input('Chart '+i);
  get('nm-chart-palette-accessible').click();
  const header=get('nm-chart-table').children[0].children[0].children[1];
  header.children[0].children[1].input('#8af3c0');
  get('nm-chart-attach').checked=true;get('nm-chart-save').click();
  const im=app.state.images.at(-1);
  assert.equal(im.mode,'attached');assert.equal(im.attachedNodeId,'a');
  assert.equal(im.graphic.series[0].color,'#8af3c0');
  app.state.selectedNodeId='root';drawing.chartDialog(app,im);
  get('nm-chart-title').input('Updated '+i);get('nm-chart-save').click();
  assert.equal(im.attachedNodeId,'a','editing must not silently retarget the graphic to root');
  const before=pos(im);drawing.chartDialog(app,im);
  get('nm-chart-attach').checked=false;get('nm-chart-save').click();
  const after=pos(im);
  assert.equal(im.mode,'free');
  assert.ok(Math.hypot(before.cx-after.cx,before.cy-after.cy)<1e-6,'detached object jumped');
 }
});
test('160 WordArt insertions: styles, editable colors, original anchor, stable detach',()=>{
 const {app,drawing,get,pos}=harness();
 for(let i=0;i<160;i++){
  app.state.selectedNodeId='b';drawing.wordArtDialog(app);
  get('nm-wordart-text').input('Title '+i);
  get('nm-wordart-'+core.WORDART_TYPES[i%8]).click();
  get('nm-wordart-color').input('#cabadd');
  get('nm-wordart-outline').input('#543210');
  get('nm-wordart-attach').checked=true;get('nm-wordart-save').click();
  const im=app.state.images.at(-1);
  assert.equal(im.mode,'attached');assert.equal(im.attachedNodeId,'b');
  assert.equal(im.graphic.color,'#cabadd');assert.equal(im.graphic.text,'Title '+i);
  app.state.selectedNodeId='root';drawing.wordArtDialog(app,im);
  get('nm-wordart-text').input('Updated '+i);get('nm-wordart-save').click();
  assert.equal(im.attachedNodeId,'b');
  const before=pos(im);drawing.wordArtDialog(app,im);
  get('nm-wordart-attach').checked=false;get('nm-wordart-save').click();
  const after=pos(im);assert.ok(Math.hypot(before.cx-after.cx,before.cy-after.cy)<1e-6);
 }
});
test('100 clipboard attempts reject bad data without silently changing a chart',()=>{
 const {app,drawing,get}=harness();
 for(let i=0;i<100;i++){
  drawing.chartDialog(app);
  get('nm-chart-toggle-paste').click();
  const input=get('nm-chart-paste-text');
  input.value=i%2===0?'Categoria;Serie 1\nGen;not a number':'Categoria;Serie 1\nGen;1,23\nFeb;2,50';
  get('nm-chart-import-data').click();
  const feedback=get('nm-chart-feedback').textContent;
  get('nm-chart-save').click();
  const item=app.state.images.at(-1);
  if(i%2===0){
   assert.equal(item.graphic.series[0].values[0],5);
   assert.match(feedback,/non valido/);
  }else{
   assert.deepEqual(item.graphic.categories,['Gen','Feb']);
   assert.equal(item.graphic.series[0].values[0],1.23);
  }
 }
});
test('WordArt requires a nonempty title rather than silently restoring an example',()=>{
 const {app,drawing,get}=harness();
 drawing.wordArtDialog(app);get('nm-wordart-text').input('');
 get('nm-wordart-save').click();
 assert.equal(app.state.images.length,0);
 assert.equal(app.state.images.length,0);
});


test('manual decimal input is localized and invalid values cannot overwrite data',()=>{
 const {app,drawing,get}=harness();
 drawing.chartDialog(app);
 const cell=get('nm-chart-table').children[1].children[0].children[1].children[0];
 cell.input('non un numero');
 get('nm-chart-save').click();
 assert.equal(app.state.images.length,0);
 assert.equal(cell.attrs['aria-invalid'],'true');
 cell.input('1,75');
 get('nm-chart-save').click();
 assert.equal(app.state.images.length,1);
 assert.equal(app.state.images[0].graphic.series[0].values[0],1.75);
});
test('bubble chart has a third editable dimension, not just a category and Y',()=>{
 const {app,drawing,get}=harness();
 drawing.chartDialog(app);
 get('nm-chart-type-bubble').click();
 const table=get('nm-chart-table');
 const sizeCell=table.children[1].children[0].children[2].children[0];
 sizeCell.input('27,5');
 get('nm-chart-save').click();
 assert.equal(app.state.images.length,1);
 assert.equal(app.state.images[0].graphic.type,'bubble');
 assert.equal(app.state.images[0].graphic.series[0].sizes[0],27.5);
});
