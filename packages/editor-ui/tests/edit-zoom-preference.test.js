const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Execute the actual desktop editor methods, not a reimplementation.
const composeAppSource=require('./helpers/compose-app-source.cjs');
const source=composeAppSource('desktop-shared');
const begin=source.indexOf('      positionEditor() {');
const end=source.indexOf('      addChild() {',begin);
assert.ok(begin>0&&end>begin);
const methods=source.slice(begin,end);
function harness(enabled){
 const field={
  value:'',style:{setProperty(){}},focus(){this.focused=true},select(){},
  blur(){this.focused=false}
 };
 const container={style:{},classList:{remove(){},add(){}}};
 const document={activeElement:null,getElementById(id){
  return id==='inline-editor-input'?field:id==='inline-editor-container'?container:null;
 }};
 const window={GlaukaMobile:false,visualViewport:null};
 const localStorage={getItem:key=>key==='glauka.edit.autofocus.v1'&&enabled?'1':null};
 const context={document,window,localStorage,innerWidth:1200,innerHeight:750};
 const Probe=vm.runInNewContext('class Probe{'+methods+'};Probe',context);
 const node={id:'n',text:'Example',side:'right'};
 const layout={editingLabel:null,getLayout:()=>({
  x:-1000,y:90,width:160,height:40,fontSize:16,lineHeight:20,lines:['Example']
 })};
 const camera={zoom:.25,x:40,y:50};
 const renderer={
  camera,ctx:{},inlineEditingNodeId:null,inlineEditingContext:null,
  worldToScreen(x,y){return {x:x*camera.zoom+camera.x,y:y*camera.zoom+camera.y}}
 };
 const app=new Probe();app.state={root:node,selectedNodeId:'n',findNode:()=>node};
 app.layout=layout;app.renderer=renderer;
 app.requestRender=()=>{};app.recalculateAndRender=()=>app.positionEditor();
 app.closeEditor=()=>{};
 return {app,camera,field,container};
}
test('desktop double-click editing preserves zoom and camera position by default',()=>{
 const {app,camera,field,container}=harness(false);
 const old={...camera};
 app.editSelected();
 assert.deepEqual(camera,old);
 assert.equal(app.editorNodeId,'n');
 assert.equal(field.focused,true);
 assert.ok(Number.parseFloat(container.style.left)>=0,'editor stays visible');
 assert.equal(app.layout.editingLabel.id,'n');
});
test('user opt-in restores readability zoom and allows following the node',()=>{
 const {app,camera}=harness(true);
 app.editSelected();
 assert.ok(camera.zoom>=14/16);
 assert.notEqual(camera.x,40);
});
