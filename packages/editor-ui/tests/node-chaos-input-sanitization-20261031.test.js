'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
// Fault injection: UI and plugins may pass a transient invalid numeric input.
// Neither font geometry nor zoom camera may become NaN or create ghost Undo.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Core=require('../../map-core');
const ROOT=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
for(const platform of ['desktop-shared','android']){
 test(platform+' rejects invalid font sizes and redundant history',()=>{
  const palette=['#abcdef'];
  const State=new Function('NeuroMapCore','nm70PreferredGap','localStorage','HARMONIC_PALETTE',
   'ColorUtils','THEME_PALETTES','globalThis',
   composeStateSource(platform)+'\nreturn MindMapStateMachine;')(
   Core,()=>150,{getItem:()=>null},palette,{lighten:hex=>hex},{},{});
  const s=new State();
  s.root={id:'root',side:'root',text:'Root',children:[
   {id:'child',text:'Label',parentId:'root',side:'right',children:[]}
  ]};
  for(const invalid of [NaN,Infinity,-Infinity,'','  ','invalid',undefined,null]){
   const before=s.undoStack.length,old=s.findNode('child').fontSize;
   assert.equal(s.updateNodeFontSize('child',invalid,true),false);
   assert.equal(s.undoStack.length,before);
   assert.equal(s.findNode('child').fontSize,old);
  }
  assert.equal(s.updateNodeFontSize('child',22,true),true);
  const after=s.undoStack.length;
  assert.equal(s.updateNodeFontSize('child',22,true),false);
  assert.equal(s.undoStack.length,after);
  assert.equal(s.undo(),true);
  assert.notEqual(s.findNode('child').fontSize,22);
  assert.equal(s.redo(),true);
  assert.equal(s.findNode('child').fontSize,22);
 });
 test(platform+' ignores invalid zoom factors without poisoning canvas coordinates',()=>{
  const composeAppSource=require('./helpers/compose-app-source.cjs');
  const src=composeAppSource(platform);
  const start=src.indexOf('      zoomAt(');
  const end=src.indexOf('\n      imageHandleHit(',start);
  assert.ok(start>=0&&end>start);
  const zoom=new Function('return ({'+src.slice(start,end)+'}).zoomAt')();
  const camera={zoom:1,x:300,y:200},app={
   renderer:{camera},updateStatus(){},requestRender(){},positionEditor(){}
  };
  for(const factor of [NaN,Infinity,-Infinity,0,-1,undefined,'invalid']){
   const before=JSON.stringify(camera);
   zoom.call(app,factor,500,250);
   assert.equal(JSON.stringify(camera),before);
  }
  const before=JSON.stringify(camera);
  zoom.call(app,1.1,NaN,250);
  assert.equal(JSON.stringify(camera),before);
  zoom.call(app,1.16,500,250);
  assert.ok(Number.isFinite(camera.x)&&Number.isFinite(camera.y)&&camera.zoom>1);
 });
}
