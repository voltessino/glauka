'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Core=require('../../map-core');
const base=path.join(__dirname,'../../../apps/desktop-shared/editor'),colors=['#f43f5e','#8b5cf6','#06b6d4'];
const State=new Function('NeuroMapCore','localStorage','nm70PreferredGap','ColorUtils','HARMONIC_PALETTE','THEME_PALETTES',fs.readFileSync(path.join(base,'state.js'),'utf8')+'\nreturn MindMapStateMachine;')(Core,{getItem:()=>null,setItem(){}},()=>150,{lighten:v=>v},colors,{default:colors});
class App{
 constructor(mode='clockwise'){
  this.state=new State();this.state.initStarterTree('Root');const root=this.state.root,template=root.children[0];root.layoutMode=mode;root.layoutDistribution=Core.continuationSettings({enabled:false});
  root.children=['A','B','C','D'].map((id,i)=>({...State.cloneTree(template),id:'branch_'+id,text:id,parentId:root.id,customOrder:i,side:i?'left':'right',notes:'Notes '+id,children:[{...State.cloneTree(template.children[0]),id:'leaf_'+id,parentId:'branch_'+id,children:[]}]}));
  this.state.images=[{id:'image_B',src:'data:image/png;base64,AA==',mode:'attached',attachedNodeId:'branch_B',width:80,height:60}];this.state.relationships=[{id:'link_B_C',fromId:'branch_B',toId:'branch_C',label:'Keep'}];this.selectNode('branch_B');
  this.layout={getLayout:id=>id===root.id?{x:0,y:0}:{x:id==='branch_A'?100:-100,y:{branch_A:0,branch_B:300,branch_C:100,branch_D:-100}[id]||0}};
 }
 closeEditor(){}showToast(){}markChanged(){this.state.isDirty=true}selectNode(id){this.state.selectedNodeId=id;this.state.selectedNodeIds=[id]}
}
new Function('NeuroMapApp',fs.readFileSync(path.join(base,'layout-navigation.js'),'utf8'))(App);
for(const mode of ['clockwise','balanced',undefined])test('clockwise keyboard order crosses the cut and preserves complete history: '+mode,()=>{
 const app=new App(mode);if(mode===undefined)app.state.root.layoutMode=undefined;const before=app.state.createSnapshot();
 assert.equal(app.nm69SwapSibling(-1),true);assert.deepEqual(app.state.root.children.map(n=>n.id),['branch_B','branch_A','branch_C','branch_D']);assert.equal(app.state.undoStack.length,1);
 const after=app.state.createSnapshot();assert.equal(app.state.undo(),true);assert.deepEqual(app.state.createSnapshot(),before);assert.equal(app.state.redo(),true);assert.deepEqual(app.state.createSnapshot(),after);
 assert.equal(app.nm69SwapSibling(1),true);assert.deepEqual(app.state.root.children.map(n=>n.id),['branch_A','branch_B','branch_C','branch_D']);assert.deepEqual(app.state.images,before.images);assert.deepEqual(app.state.relationships,before.relationships);
});
test('clockwise left-side movement follows logical clockwise order instead of vertical direction',()=>{const app=new App();assert.equal(app.nm69SwapSibling(1),true);assert.deepEqual(app.state.root.children.map(n=>n.id),['branch_A','branch_C','branch_B','branch_D']);assert.equal(app.state.findNode('leaf_B').parentId,'branch_B');});
test('geometry-balanced ordering keeps its existing per-side vertical semantics',()=>{const app=new App('balanced');app.state.root.layoutBalanceMode='geometry';assert.equal(app.nm69SwapSibling(-1),true);assert.deepEqual(app.state.root.children.map(n=>n.id),['branch_A','branch_C','branch_B','branch_D']);});
test('clockwise boundaries create no history and keep explicit side pins',()=>{const app=new App();app.state.root.children[0].sidePinned='right';app.selectNode('branch_A');const before=app.state.createSnapshot();assert.equal(app.nm69SwapSibling(-1),false);assert.equal(app.state.undoStack.length,0);assert.deepEqual(app.state.createSnapshot(),before);});
