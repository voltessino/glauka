"use strict";
/* Cycle 4C: exported drawings must carry the same meaning as the live view.
   A started PNG conversion is not a finished save. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const from=name=>fs.readFileSync(path.join(__dirname,"../"+name),"utf8");
const appearance=require("../view-appearance-core");

class NodeElement{
  constructor(tag="svg"){
    this.tag=tag;this.tagName=tag;this.children=[];this.attrs={};this.textContent="";
  }
  setAttribute(key,value){this.attrs[key]=String(value)}
  getAttribute(key){return this.attrs[key]}
  append(...items){this.children.push(...items)}
}

function decorations(){
  const ctx={
    document:{createElementNS:(_,tag)=>new NodeElement(tag)},
    appearance,TREE_GROUP_COLORS:appearance.GROUP_COLORS,
    kanbanStatusColor:appearance.kanbanStatusColor,
    kanbanDateCaption:node=>node.dueDate||"",
    tr:(it)=>it
  };
  vm.runInNewContext(from("linked-view-decorations.js")+
    "\nthis.api={drawOrgMarkers,drawTreeMarkers,drawKanbanDecorations,orgCardInitials};",
    ctx,{filename:"linked-view-decorations.js"});
  return ctx.api;
}

test("org, tree and kanban export marks follow the live reading",()=>{
  const api=decorations();
  const org=new NodeElement();
  api.drawOrgMarkers(org,{x:200,y:80,w:172,h:72,text:"Direzione",depth:0,groupIndex:-1,childIds:["a"]},
    {text:"#ffffff",accent:"#60a5fa"});
  const rootBand=org.children.find(node=>node.attrs["data-org-band"]==="root");
  assert.equal(rootBand.attrs.height,"4");
  const report=new NodeElement();
  api.drawOrgMarkers(report,{x:200,y:240,w:172,h:72,text:"Città Ricerca",depth:2,groupIndex:1,childIds:[]},
    {text:"#ffffff",accent:"#60a5fa"});
  const reportBand=report.children.find(node=>node.attrs["data-org-band"]==="report");
  assert.equal(reportBand.attrs.height,"3");
  assert.equal(report.children.find(node=>node.tag==="text"&&node.textContent.includes("Liv")).attrs.opacity,".82");
  assert.equal(api.orgCardInitials("Équipe 🌟"),"É🌟");

  const tree=new NodeElement();
  api.drawTreeMarkers(tree,{x:400,y:120,w:188,h:58,text:"Architettura",depth:1,groupIndex:0,childIds:["leaf"]},
    {text:"#ffffff",accent:"#34d399"});
  const branch=tree.children.find(node=>node.attrs["data-tree-accent"]==="branch");
  assert.equal(branch.attrs.width,"3");
  assert.equal(branch.attrs.opacity,"1");
  const leafSvg=new NodeElement();
  api.drawTreeMarkers(leafSvg,{x:630,y:120,w:188,h:58,text:"Dettaglio",depth:3,groupIndex:0,childIds:[]},
    {text:"#ffffff",accent:"#34d399"});
  assert.equal(leafSvg.children.find(node=>node.attrs["data-tree-accent"]==="leaf").attrs.opacity,".55");

  const kanban=new NodeElement();
  api.drawKanbanDecorations(kanban,{x:135,y:159,w:207,h:100,status:"doing",dueDate:"2026-11-08"},
    {text:"#eff6ff"});
  const ribbon=kanban.children.find(node=>node.attrs["data-kanban-ribbon"]==="doing");
  assert.equal(ribbon.attrs.height,"3");
  assert.equal(ribbon.attrs.fill,appearance.kanbanStatusColor("doing"));
});

test("user text stays in the drawing and does not become an action",()=>{
  const api=decorations();
  const svg=new NodeElement();
  const hostile="<img onerror=alert(1)>";
  api.drawOrgMarkers(svg,{x:100,y:80,w:172,h:72,text:hostile,depth:1,groupIndex:0,childIds:[]},
    {text:"#fff",accent:"#60a5fa"});
  assert.equal(svg.children.some(node=>node.tag==="image"||node.tag==="script"),false);
  assert.ok(svg.children.every(node=>Object.keys(node.attrs).every(key=>!key.startsWith("on"))));
});

test("mindmap vector export keeps the root gradient and adds no blur filter",()=>{
  for(const file of ["../../../apps/desktop-shared/editor/io.js","../../../apps/android/editor/io.js"]){
    const source=fs.readFileSync(path.join(__dirname,file),"utf8");
    assert.match(source,/stop-color="#4f46e5"/);
    assert.match(source,/stop-color="#7c3aed"/);
    assert.match(source,/stop-color="#db2777"/);
    assert.equal(source.includes("feGaussianBlur"),false);
    assert.match(source,/fill="url\(#nodeRootGradient\)"/);
  }
});

function rasterizer(){
  const downloads=[];
  const toasts=[];
  const ctx={
    downloads,toasts,
    tr:(it)=>it,
    XMLSerializer:class{serializeToString(){return '<svg xmlns="http://www.w3.org/2000/svg"><title>Città</title></svg>'}},
    Blob:class{constructor(parts,options){this.parts=parts;this.type=options&&options.type}},
    viewPdfFromJpeg:()=>new Uint8Array([1]),
    document:{createElement:()=>ctx.canvas}
  };
  ctx.root=ctx;
  ctx.URL={
    createObjectURL(){return "blob:map"},
    revokeObjectURL(){ctx.revoked=(ctx.revoked||0)+1}
  };
  ctx.Image=class{set src(_){queueMicrotask(()=>this.onload&&this.onload())}};
  ctx.canvas={
    width:0,height:0,
    getContext(){return {drawImage(){}}},
    toBlob(callback){ctx.blobCallback=callback}
  };
  vm.runInNewContext(from("linked-view-export-raster.js")+"\nthis.rasterize=rasterizeViewRaster;",
    ctx,{filename:"linked-view-export-raster.js"});
  const app={
    showToast(message){toasts.push(message)},
    io:{triggerDownload(){downloads.push(true);return true}}
  };
  return {ctx,app};
}

test("an oversized picture is refused instead of cropped",()=>{
  const {ctx,app}=rasterizer();
  assert.equal(ctx.rasterize(app,{},5000,4000,"mappa",2,"png"),false);
  assert.match(ctx.toasts[0],/troppo grande/);
  assert.equal(ctx.downloads.length,0);
  assert.equal(ctx.rasterize(app,{},Number.NaN,100,"mappa",1,"png"),false);
});

test("starting a picture conversion is not the same as saving it",async()=>{
  const {ctx,app}=rasterizer();
  assert.equal(ctx.rasterize(app,{},120,80,"mappa",1,"png"),true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ctx.canvas.width,120);
  assert.equal(ctx.canvas.height,80);
  assert.equal(ctx.downloads.length,0);
  assert.equal(ctx.revoked,1);
  ctx.blobCallback(null);
  assert.match(ctx.toasts.at(-1),/non riuscita/);
  assert.equal(ctx.downloads.length,0);
});

test("a double-size picture uses twice the pixels on each side",async()=>{
  const {ctx,app}=rasterizer();
  assert.equal(ctx.rasterize(app,{},120,80,"mappa",2,"png"),true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ctx.canvas.width,240);
  assert.equal(ctx.canvas.height,160);
  await ctx.blobCallback(new Uint8Array([1,2,3]));
  assert.equal(ctx.downloads.length,1);
});
