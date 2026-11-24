"use strict";
const composeUiSource=require('./helpers/compose-ui-source.cjs');

const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const ROOT=path.resolve(__dirname,"../../.."),read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const Core=require("../map-style-core.js");

test("500 synthetic users: switching 13 map styles preserves every branch ID and side",()=>{
 const names=["nuovo utente","studente","persona anziana","professionista","utente esperto"];
 let nodeCount=0;
 for(let profile=0;profile<500;profile++){
  const count=1+(profile%90);
  const children=Array.from({length:count},(_,i)=>({
   id:"n"+profile+"-"+i,text:names[profile%names.length]+" #"+i,
   side:i%2?"left":"right",customOrder:i,children:[],nodeShape:"plain"
  }));
  const state={root:{id:"r",text:"Mappa",children},selectedNodeId:children[0].id,
   selectedNodeIds:[children[0].id],undo:[],pushHistory(){this.undo.push(JSON.stringify(this.root))}};
  const before=children.map(c=>[c.id,c.side,c.customOrder,c.text]);
  const choice=Core.PRESETS[profile%Core.PRESETS.length];
  assert.ok(Core.apply(state,choice,"map",{prisma:["#6655dc"],default:["#6655dc"]}));
  assert.equal(state.undo.length,1);
  assert.deepEqual(children.map(c=>[c.id,c.side,c.customOrder,c.text]),before);
  nodeCount+=count;
 }
 assert.ok(nodeCount>20000);
});
test("background and node style galleries stay collapsed until requested",()=>{
 const styles=read("packages/editor-ui/map-style-gallery.js"),
  theme=read("packages/editor-ui/theme-picker.js"),
  mobile=read("apps/android/native/app/src/main/assets/assets/mobile-map-polish.js");
 for(const [source,id] of [[styles,"nm-map-style-picker"],[theme,"nm-map-background-picker"],
  [mobile,"gl-android-map-style-picker"]]){
  assert.ok(source.includes(id));
  assert.match(source,/createElement\('details'\)|el\('details'/);
  assert.match(source,/summary/);
 }
 assert.match(styles,/disclosure\.open=false/);
 assert.match(theme,/disclosure\.open=false/);
 assert.match(styles,/NeuroMapRefinements\?\.cancelPreview/);
});
test("highlight swatches show actual word samples and use Undo",()=>{
 const js=composeUiSource('workspace-layout');
 const css=read("packages/editor-ui/workspace-layout.css");
 assert.match(js,/id='nm-text-highlight-picker'/);
 assert.match(js,/sample\.textContent='Aa'/);
 assert.match(js,/app\.state\.pushHistory\(\)/);
 assert.match(css,/\.nm-highlighter-sample/);
 assert.match(css,/background-color:var\(--nm-highlighter-color/);
});
test("new vector library is offline, keyword-searchable and lazy-paginated",()=>{
 const js=composeUiSource('creative-tools');
 const pack=read("packages/editor-ui/object-gallery-healthicons.js");
 const build=read("scripts/release/prepare.py");
 assert.match(js,/Nuovi SVG ✦/);
 assert.match(js,/asset\.keywords\|\|''/);
 assert.match(js,/img\.loading='lazy'/);
 assert.match(js,/visibleLimit=24/);
 assert.match(js,/source\?\.startsWith\('glauka\/'\)/);
 assert.match(pack,/catalogue\.has\(item\.id\)/);
 assert.match(build,/'work','glauka'/);
 assert.doesNotMatch(js,/fetch\(['"]https?:\/\/[^'"]*svg/i);
});
