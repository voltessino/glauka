"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const pack=require("../object-gallery-healthicons.js");
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const loadCreativeCore=()=>{
  const dir=path.join(__dirname,'..');
  const filename=path.join(dir,'creative-core.js');
  const source=fs.readFileSync(filename,'utf8').replace(
    '/* @neuromap-creative-core-objects */\n',
    fs.readFileSync(path.join(dir,'creative-core-objects.js'),'utf8'));
  const mod=new Module(filename);
  mod.filename=filename;
  mod.paths=Module._nodeModulePaths(dir);
  mod._compile(source,filename);
  return mod.exports;
};
const core=loadCreativeCore();
const expected={anatomy:20,medical:14,objects:12,food:7,movement:6,ideas:11,places:4};
test("catalogue has 628 curated/original additions plus eight legacy assets without duplicate IDs",()=>{
 assert.equal(pack.ITEMS.length,628);
 assert.equal(core.OBJECTS.length,636);
 const ids=core.OBJECTS.map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const [category,count] of Object.entries(expected)){
   assert.ok(pack.ITEMS.filter(x=>x.category===category).length>=count,category+' legacy category coverage');
 }
 for(const id of ["scroll","amphora","frame","heart","lungs","brain","kidney","liver"])
   assert.ok(ids.includes(id),"legacy object missing: "+id);
});
test("all added SVG assets are offline vectors with CC0 MIT or original Glauka provenance",()=>{
 for(const asset of pack.ITEMS){
   assert.match(asset.source,/^[a-z0-9_-]+\/[A-Za-z0-9_-]+$/);
   assert.ok(asset.it&&asset.en&&asset.id);
   const svg=core.objectSVG(asset.id);
   assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
   assert.match(svg,/viewBox="0 0 240 240"/);
   assert.match(svg,/<(?:path|rect|circle|polygon|ellipse)\b/);
   assert.doesNotMatch(svg,/<script|<foreignObject|<image|onload=|javascript:/i);
   assert.ok(core.objectURL(asset.id).startsWith("data:image/svg+xml;charset=utf-8,"));
 }
});
test("new assets remain bounded simple project metadata (no inlined SVG in saves)",()=>{
 for(const asset of pack.ITEMS){
   const art=core.objectArt({id:asset.id,size:9999});
   assert.deepEqual(art,{id:asset.id,size:220});
   const saved=JSON.stringify({objectArt:art});
   assert.ok(saved.length<75);
   assert.ok(!saved.includes("<svg"));
 }
 assert.equal(core.objectArt({id:"unknown",size:110}),null);
});
test("reused embedded SVG definitions shrink a 1000-node vector export",()=>{
 const node={text:"Anatomia",objectArt:{id:"skeleton",size:175}};
 const layout={x:0,y:0,width:215,height:250,textWidth:95,fontSize:16,lineHeight:20,lines:["Anatomia"]};
 const before=core.svgObject(node,layout,false);
 const after=core.svgObject(node,layout,true);
 const def=core.svgObjectDef("skeleton");
 assert.match(after,/<use href="#nm-art-asset-skeleton"/);
 assert.match(def,/<image id="nm-art-asset-skeleton"/);
 assert.ok((after.length*1000+def.length)<(before.length*1000)*.4);
});
