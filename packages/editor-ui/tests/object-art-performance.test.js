"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const C=require('./helpers/compose-creative-core.cjs')();
const root=path.resolve(__dirname,"../../..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

test("changing object ID or size invalidates measurement cache, unchanged nodes still hit",()=>{
 const env={NeuroMapCreativeCore:C};
 vm.createContext(env);
 vm.runInContext(require('./helpers/compose-graphics.cjs')(),env);
 let measures=0;
 class Layout{
  constructor(){this.defaultLabelWrapChars=18}
  getNodeTypography(){return {fontSize:16,fontWeight:500}}
  measureNode(node){measures++;return {width:100+(node.objectArt?.size||0),
    height:50+(node.objectArt?.size||0),lines:["Test"]}}
 }
 env.NeuroMapGraphics.installMeasurements(Layout);
 const l=new Layout(),n={id:"root",text:"Test",side:"root",objectArt:null};
 assert.equal(l.measureNode(n).width,100);
 assert.equal(l.measureNode(n).width,100);
 assert.equal(measures,1);
 n.objectArt={id:"heart",size:110};
 assert.equal(l.measureNode(n).width,210);
 n.objectArt.size=190;
 assert.equal(l.measureNode(n).width,290);
 n.objectArt.id="lungs";
 assert.equal(l.measureNode(n).width,290);
 assert.equal(measures,4,"new ID must also invalidate the measurement signature");
 assert.equal(l.measureNode(n).width,290);
 assert.equal(measures,4);
});
test("each repeated vector object uses one local SVG definition, no new raster files",()=>{
 const node={id:"b",text:"Cuore",objectArt:{id:"heart",size:180}};
 const m={x:50,y:20,width:222,height:230,textWidth:80,lines:["Cuore"],lineHeight:20,fontSize:17};
 const ref=C.svgObject(node,m,true);
 const definition=C.svgObjectDef("heart");
 assert.match(definition,/id="nm-art-asset-heart"/);
 assert.match(definition,/data:image\/svg\+xml/);
 assert.match(ref,/<use href="#nm-art-asset-heart" transform=/);
 assert.doesNotMatch(ref,/data:image\/svg\+xml/);
 assert.match(C.svgObject(node,m),/<image [^>]*data:image\/svg\+xml/);
 assert.equal(C.svgObjectDef("made-up-id"),"");
 const old=Array(1000).fill(C.svgObject(node,m)).join("");
 const reused=definition+Array(1000).fill(ref).join("");
 assert.ok(reused.length<old.length*.1,
   "1000 repeated organs should produce less than one tenth of old SVG bytes");
});
test("both export paths deduplicate by used artwork IDs",()=>{
 for(const platform of ["desktop-shared","android"]){
  const io=read("apps/"+platform+"/editor/io.js");
  assert.match(io,/const usedObjectArtIds = new Set\(\)/);
  assert.match(io,/svgObject\(node,m,true\)/);
  assert.match(io,/for\(const id of usedObjectArtIds\)/);
  assert.match(io,/defs\.push\(def\)/);
 }
});
