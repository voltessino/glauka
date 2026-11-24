"use strict";
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const C=require("./helpers/compose-rich-caption.cjs")(),Media=require("../media-core");
const MapStyles=require("../map-style-core");
const base=path.resolve(__dirname,"../../..");
const read=p=>fs.readFileSync(path.join(base,p),"utf8");

function paint(align,size){
 const calls=[];
 const ctx={font:"",save(){},restore(){},
  measureText(text){const px=Number(/(\d+)px/.exec(this.font)?.[1]||11);return {width:text.length*px*.55}},
  fillText(text,x,y){calls.push({text,x,y,font:this.font})},
  beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 const doc=C.sanitize("Didascalia leggibile",[]);
 C.paint(ctx,doc,{x:0,y:0,w:360,h:120},{align,fontSize:size});
 return {x:calls[0].x,font:calls[0].font,height:C.height(ctx,doc,360,{align,fontSize:size})};
}
test("image caption paragraph alignment is visibly different and size affects rendering",()=>{
 const left=paint("left",20),center=paint("center",20),right=paint("right",20);
 assert.ok(left.x<center.x&&center.x<right.x);
 assert.match(right.font,/20px/);
 assert.ok(paint("left",36).height>paint("left",11).height);
 assert.equal(paint("left",11).height,27);
});
test("invalid caption formatting defaults safely without injecting arbitrary CSS",()=>{
 const ok=Media.imageProps({caption:"x",captionAlign:"right",captionFontSize:30});
 assert.equal(ok.captionAlign,"right");assert.equal(ok.captionFontSize,30);
 for(const bad of [{captionAlign:"justify",captionFontSize:1e6},
   {captionAlign:"<script>",captionFontSize:11.5},{}]){
  const clean=Media.imageProps(bad);
  assert.equal(clean.captionAlign,"left");
  assert.equal(clean.captionFontSize,11);
 }
});
for(const platform of ["desktop-shared","android"])
 test(platform+" snapshots preserve image caption alignment and size",()=>{
  const sandbox={NeuroMapCaption:C};
  vm.createContext(sandbox);
  vm.runInContext(composeStateSource(platform)+"\nglobalThis.ImageTestState=MindMapStateMachine;",sandbox);
  const image={id:"image-1",src:"data:image/png;base64,AA==",caption:"Testo",
   captionAlign:"center",captionFontSize:27};
  const cloned=sandbox.ImageTestState.cloneImages([image])[0];
  assert.equal(cloned.captionAlign,"center");
  assert.equal(cloned.captionFontSize,27);
  assert.equal(cloned.caption,"Testo");
 });
test("Geometrico is clean and consistent across editor and bundled Android preset",()=>{
 const preset=MapStyles.PRESETS.find(p=>p.id==="geometric");
 assert.ok(preset);
 assert.equal(preset.branchStyle,"simple");
 assert.equal(preset.nodeShape,"card");
 assert.equal(preset.palette,"ocean");
 assert.ok(read("apps/android/native/app/src/main/assets/assets/map-style-core.js")
  .includes("['geometric','Geometrico','Geometric','simple','card','ocean',1.1,500]"));
});
test("image selection owns the inspector; all dock buttons receive focus/hover accent",()=>{
 const css=read("packages/editor-ui/interface-theme.css");
 assert.match(css,/#inspector-sidebar\[data-nm-selection="image"\] > :not\(#image-controls\)/);
 assert.match(css,/#nm614-right-dock > button:hover:not\(:disabled\)/);
 assert.match(css,/#nm614-right-dock > button:focus-visible/);
});
test("recall consumes dragging and reveals hidden labels only on pointerup",()=>{
 const code=read("apps/desktop-shared/editor/learn-ui.js").replace("/* @neuromap-learn-ui-session */\n",read("apps/desktop-shared/editor/learn-ui-session.js"));
 assert.match(code,/pointermove','pointerup','pointercancel'/);
 assert.match(code,/Math\.hypot\(dx,dy\)>6/);
 assert.match(code,/name==='pointerup'&&!drag\.moved/);
 assert.match(code,/camera\.x=recallDrag\.cameraX\+dx/);
 assert.match(code,/stopImmediatePropagation\(\)/);
});
test("external image copy requests a real PNG using the desktop clipboard bridge",()=>{
 const compose=require("./helpers/compose-app-source.cjs");
 const code=compose("desktop-shared");
 const bridge=read("packages/editor-ui/desktop-workflows.js");
 assert.match(code,/api\.sourcePNG\(source\)/);
 assert.match(code,/api\.writePNG\(png\)/);
 assert.match(bridge,/new ClipboardItem\(\{'image\/png':png\}\)/);
 assert.match(bridge,/navigator\.clipboard\.write\(/);
 assert.match(code,/this\.internalClipboard=data/);
 assert.doesNotMatch(code,/clipboard\.writeText\(plain\).*data\.kind==='image'/);
});
