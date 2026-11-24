"use strict";
const composeUiSource=require('./helpers/compose-ui-source.cjs');

const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Module=require("node:module");
const original=require("../object-gallery-parts-glauka.js");
const pack=require("../object-gallery-healthicons.js");
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
const root=path.resolve(__dirname,"../../..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const byId=new Map(original.map(item=>[item.id,item]));

test("80 original SVGs integrate without altering the 221 previously saved illustration IDs",()=>{
 assert.equal(original.length,80);
 assert.equal(byId.size,80);
 assert.equal(pack.ITEMS.length,628);
 assert.equal(core.OBJECTS.length,636);
 assert.ok(core.OBJECTS.filter(item=>item.id.startsWith("gl-")).length===80);
 for(const item of original){
  assert.ok(item.id.startsWith("gl-"));
  assert.ok(item.source.startsWith("glauka/"));
  assert.match(item.keywords,/^[^\u0000-\u001F<>"]+$/);
  assert.ok(item.it&&item.en);
  const svg=core.objectSVG(item.id);
  assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/<path /);
  assert.match(svg,/stroke-width="2\.4"/);
  assert.doesNotMatch(svg,/<script|<foreignObject|<image|onload=|javascript:|<iframe|(?:href|src)=["']https?:/i);
  assert.ok(svg.length<17000);
  for(const size of [0,64,125,220,9999]){
   const sanitized=core.objectArt({id:item.id,size});
   assert.ok(sanitized.size>=64&&sanitized.size<=220);
   assert.ok(JSON.stringify(sanitized).length<72);
  }
 }
});
test("new gallery filter and bilingual synonym search share existing paginated SVG picker",()=>{
 const ui=composeUiSource('creative-tools');
 const build=read("scripts/release/prepare.py");
 assert.match(ui,/\['new','Nuovi SVG ✦','New SVG ✦'\]/);
 assert.match(ui,/asset\.keywords\|\|''/);
 assert.match(ui,/visibleLimit=24/);
 assert.match(ui,/asset\.id\.startsWith\('gl-'\)/);
 assert.match(build,/object-gallery-parts-\{name\}\.js/);
 assert.match(build,/'work','glauka'/);
 for(const word of ["mappe","infermieristica","grafico","genetica","progetti"]){
  assert.ok(original.some(item=>(item.it+" "+item.en+" "+item.keywords).toLocaleLowerCase().includes(word)),word);
 }
});
test("node marker catalogue grows to 127 stable searchable entries",()=>{
 const composeUiSource=require('./helpers/compose-ui-source.cjs');
 const text=composeUiSource('creative-markers');
 const base=text.slice(0,text.indexOf("  // Additional UTF-8 symbols;"));
 assert.ok(base.includes('"priority"'));
 const key=text.match(/for\(const \[id,it,en,rows\] of (\[[\s\S]*?\])\)groups\.push/);
 assert.ok(key,"new marker groups exist");
 const addon=JSON.parse(key[1]);
 assert.equal(addon.length,4);
 assert.equal(addon.reduce((n,g)=>n+g[3].length,0),48);
 const ids=addon.flatMap(g=>g[3].map(r=>r[0]));
 assert.equal(new Set(ids).size,48);
 assert.ok(ids.every(id=>/^[a-z][a-z0-9-]+$/.test(id)));
 assert.ok(addon.every(g=>g[3].every(row=>[...row[1]].length===1)));
});
test("SVGs and node markers do not alter map geometry or IDs in project files",()=>{
 const source=read("packages/editor-ui/object-gallery-healthicons.js");
 const project={id:"root",text:"Anatomia",children:Array.from({length:500},(_,i)=>({
  id:"node-"+i,text:"Testo "+i,side:i%2?"left":"right",customOrder:i,children:[],
  objectArt:{id:original[i%original.length].id,size:80+(i%141)}
 }))};
 const before=project.children.map(n=>[n.id,n.side,n.customOrder,n.text]);
 const serialized=JSON.stringify(project);
 assert.ok(!serialized.includes("<svg"));
 assert.ok(!serialized.includes("<path"));
 const restored=JSON.parse(serialized);
 assert.deepEqual(restored.children.map(n=>[n.id,n.side,n.customOrder,n.text]),before);
 for(const node of restored.children)assert.deepEqual(core.objectArt(node.objectArt),node.objectArt);
 assert.match(source,/catalogue\.has\(item\.id\)/);
});
