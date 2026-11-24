const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function rendererHarness(){
  const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/renderer.js'),'utf8');
  const math={addColorStop(){}};
  const ctx={save(){},restore(){},beginPath(){},closePath(){},fill(){},stroke(){},
    moveTo(){},lineTo(){},arc(){},arcTo(){},bezierCurveTo(){},rect(){},
    fillText(){},setLineDash(){},scale(){},translate(){},setTransform(){},clearRect(){},
    createLinearGradient(){return math},measureText(){return {width:60}}};
  const env={window:{innerWidth:1300,innerHeight:900,devicePixelRatio:1},
    imageCache:new Map(),ColorUtils:{rgba:()=> 'rgba(90,90,120,.35)'},
    NeuroMapGraphics:{light:()=>false},console,globalThis:null};
  env.globalThis=env;
  vm.runInNewContext(source+'\nglobalThis.NeuroMapTestRenderer=OrganicCanvasRenderer;',env);
  const metrics={id:'detail',x:200,y:100,width:120,height:36,depth:4,
    fontSize:12,textWidth:90,lineHeight:16,lines:['Detail']};
  const state={root:{id:'root',text:'Root',side:'root',children:[]},
    images:[],relationships:[],selectedNodeIds:[],selectedNodeId:'root',branchStyle:'neon'};
  const layout={getLayout:()=>metrics};
  const canvas={width:0,height:0,getContext:()=>ctx};
  const renderer=new env.NeuroMapTestRenderer(canvas,layout,state);
  const node={id:'detail',text:'Detail',side:'right',color:'#7755ff',children:[]};
  const logs={labels:0};
  renderer.roundRectPath=()=>{};
  renderer.drawIllustratedLabel=()=>{logs.labels++};
  return {renderer,node,state,metrics,logs,ctx,env};
}
test('semantic zoom hides only deep text at overview scale; hit targets stay intact',()=>{
  const {renderer,node,logs}=rendererHarness();
  renderer.camera.zoom=.35;
  renderer.drawNode(node);
  assert.equal(logs.labels,0);
  renderer.semanticZoomEnabled=false;
  renderer.drawNode(node);
  assert.equal(logs.labels,1);
  renderer.semanticZoomEnabled=true;
  renderer.camera.zoom=.85;
  renderer.drawNode(node);
  assert.equal(logs.labels,2);
});
test('focused and selected node text remains available even during zoom-out',()=>{
  const {renderer,node,logs,state}=rendererHarness();
  renderer.camera.zoom=.15;
  state.selectedNodeId=node.id;
  renderer.drawNode(node);
  assert.equal(logs.labels,1);
  state.selectedNodeId='root';
  state.hoveredNodeId=node.id;
  renderer.drawNode(node);
  assert.equal(logs.labels,2);
});
test('focus opacity is presentation-only and export restores normal state',()=>{
  const {renderer,node,logs,state,ctx}=rendererHarness();
  renderer.visualFocusIds=new Set(['root','selected']);
  assert.equal(renderer.navOpacity(node.id),.11);
  assert.equal(renderer.navOpacity('selected'),1);
  const before=JSON.stringify(state.root);
  renderer._nmNavExport=true;
  renderer.camera.zoom=.10;
  renderer.drawNode(node);
  assert.equal(logs.labels,1);
  assert.equal(renderer.navOpacity(node.id),1);
  renderer._nmNavExport=false;
  assert.equal(JSON.stringify(state.root),before);
  assert.equal(renderer.semanticZoomEnabled,true);
});
