"use strict";
const composeStateSource=require('./helpers/compose-state-source.cjs');
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const C=require('./helpers/compose-creative-core.cjs')();
const root=path.resolve(__dirname,"../../..");
const source=file=>fs.readFileSync(path.join(root,file),"utf8");
function measurement(platform,node){
 const script=source("apps/"+platform+"/editor/layout.js");
 const start=script.indexOf("      measureNode(node, depth = 0) {");
 const end=script.indexOf("      computeSubtreeHeight(",start);
 assert.ok(start>=0&&end>start);
 const fn=new Function("globalThis","return ({"+script.slice(start,end)+"}).measureNode")({NeuroMapCreativeCore:C});
 return fn.call({getNodeTypography:()=>({fontSize:18,fontWeight:500}),
   measureCtx:{font:"",measureText:text=>({width:String(text).length*10})},
   wrapNodeText:text=>[text],defaultLabelWrapChars:18,typographyScale:1},node);
}
test("only curated offline vector artwork IDs are recognized",()=>{
 assert.deepEqual(C.OBJECTS.slice(0,8).map(x=>x.id),["scroll","amphora","frame","heart","lungs","brain","kidney","liver"]);
 assert.equal(C.OBJECTS.length,636);
 for(const item of C.OBJECTS){
  const svg=C.objectSVG(item.id);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('viewBox="0 0 240 240"'));
  assert.ok(svg.endsWith("</svg>"));
  assert.doesNotMatch(svg,/<script|onload=|foreignObject|<image[^>]*href="https?:/);
  assert.ok(C.objectURL(item.id).startsWith("data:image/svg+xml;charset=utf-8,"));
 }
 assert.equal(C.objectSVG("unknown"),"");
 assert.equal(C.objectURL("unknown"),"");
});
test("user-supplied map data cannot add arbitrary SVG or oversize objects",()=>{
 assert.deepEqual(C.objectArt({id:"scroll",size:999}),{id:"scroll",size:220});
 assert.deepEqual(C.objectArt({id:"frame",size:-100}),{id:"frame",size:64});
 assert.equal(C.objectArt({id:"random",size:180,svg:"<script/>"}),null);
 assert.equal(C.objectArt({id:"__proto__",size:180}),null);
});
for(const platform of ["desktop-shared","android"]){
 test(platform+" layout reserves artwork footprint without affecting ordinary nodes",()=>{
  const classic=measurement(platform,{side:"root",text:"ANATOMIA"});
  const rootArt=measurement(platform,{side:"root",text:"ANATOMIA",objectArt:{id:"scroll",size:200}});
  const branch=measurement(platform,{side:"right",text:"Sviluppo",objectArt:{id:"frame",size:94}});
  assert.ok(rootArt.height>classic.height+170);
  assert.ok(rootArt.width>=218);
  assert.ok(branch.height>100);
  assert.equal(classic.objectArtSize,0);
  assert.equal(branch.objectArtSize,94);
 });
 test(platform+" snapshot roundtrip preserves artwork ID/size and strips unknown IDs",()=>{
  const sandbox={NeuroMapCreativeCore:C};
  vm.createContext(sandbox);
  vm.runInContext(composeStateSource(platform)+"\nglobalThis.QaState=MindMapStateMachine;",sandbox);
  const src={id:"root",text:"Centro",side:"root",objectArt:{id:"scroll",size:183},
   children:[{id:"a",text:"Ramo",side:"right",objectArt:{id:"frame",size:93},children:[]},
     {id:"b",text:"Altro",side:"left",objectArt:{id:"illegal",size:99},children:[]}]};
  const clone=sandbox.QaState.cloneTree(src);
  assert.equal(clone.objectArt.id,"scroll");assert.equal(clone.objectArt.size,183);
  assert.equal(clone.children[0].objectArt.id,"frame");
  assert.equal(clone.children[1].objectArt,null);
 });
}
test("renderer paints same object and original editable label, masking only study answers",()=>{
 const calls={images:0,words:[]};
 const ctx={save(){},restore(){},fill(){},stroke(){},drawImage(){calls.images++},
  fillText(word){calls.words.push(word)}};
 const state={};
 const renderer={ctx,state,getOrLoadImage:()=>({complete:true,naturalWidth:240}),roundRectPath(){}};
 const n={id:"study-item",text:"Fotosintesi",objectArt:{id:"scroll",size:120}};
 const m={x:0,y:0,width:160,height:168,lineHeight:19,textWidth:110,fontSize:15,fontWeight:500,lines:["Fotosintesi"]};
 assert.equal(C.paintObject(renderer,n,m,true),true);
 assert.ok(calls.words.includes("Fotosintesi"));
 renderer._nmLearnRecall={state,hiddenIds:new Set(["study-item"])};
 C.paintObject(renderer,n,m,false);
 assert.ok(calls.words.includes("••••"));
 assert.equal(calls.images,2);
});
test("SVG export includes the same vector illustration and safely escaped label",()=>{
 const n={id:"r",text:"<b>&",objectArt:{id:"frame",size:190}};
 const m={x:20,y:30,width:220,height:237,lineHeight:20,lines:["<b>&"],fontSize:17,fontWeight:500,textWidth:60};
 const svg=C.svgObject(n,m);
 assert.match(svg,/data:image\/svg\+xml/);
 assert.match(svg,/&lt;b&gt;&amp;/);
 assert.doesNotMatch(svg,/<text[^>]*>\s*<b>/);
});

test("anatomy group retains five organs and adds twenty schematic icons",()=>{
 const med=C.OBJECTS.filter(x=>x.category==="anatomy"&&!x.id.startsWith("lc-"));
 assert.equal(med.length,25);
 for(const organ of med){
  const svg=C.objectSVG(organ.id);
  assert.match(svg,/<g transform="translate\(15 15\) scale\(4\.375\)">/);
  assert.match(svg,/radialGradient id="nm-med-halo"/);
  assert.ok((svg.match(/<path /g)||[]).length>=1,organ.id);
  assert.doesNotMatch(svg,/foreignObject|<script|<image[^>]+https?:/);
 }
});
test("medical asset geometry and safe labels work at all bounded sizes",()=>{
 for(const name of ["heart","lungs","brain","kidney","liver"]){
   for(let size=64;size<=220;size+=2){
     const node={text:"Anatomia & salute",objectArt:{id:name,size}};
     for(const platform of ["desktop-shared","android"]){
       const m=measurement(platform,{side:"root",...node});
       const g=C.objectGeometry(node,{...m,x:0,y:0});
       assert.ok(g.imageX>=-m.width/2);
       assert.ok(g.imageX+size<=m.width/2);
       assert.ok(g.labelY+g.labelHeight<=m.height/2);
       assert.match(C.svgObject(node,{...m,x:0,y:0}),/Anatomia &amp; salute/);
     }
   }
 }
});
