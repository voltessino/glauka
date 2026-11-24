"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const base=path.resolve(__dirname,"../../..");
const read=p=>fs.readFileSync(path.join(base,p),"utf8");

test("File/Edit/View commands keep their handlers and have meaningful SVG strokes",()=>{
 const code=read("packages/editor-ui/menu-ux.js");
 const ids=["menu-new-tab","menu-save-file","menu-save-all-tabs","nm611-autosave-open",
   "btn-import-file-current","menu-undo","menu-redo","menu-cut","menu-copy",
   "menu-paste","menu-delete-node","menu-center-map","menu-reset-zoom","v6-toggle-layout"];
 for(const id of ids)assert.ok(code.includes("'"+id+"'"),"missing icon mapping: "+id);
 assert.match(code,/document\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg','svg'\)/);
 assert.match(code,/button\.prepend\(svg\)/);
 assert.match(code,/button\.dataset\.nmSemanticIcon='1'/);
 assert.doesNotMatch(code,/button\.replaceWith\(svg\)/);
});

test("image controls live outside style and clicking image does not open style",()=>{
 const src=read("packages/editor-ui/creative-inspector.js");
 const css=read("packages/editor-ui/workspace-layout.css");
 assert.match(src,/document\.body\.append\(imagePanel\)/);
 assert.match(src,/inspector\?\.classList\.add\("collapsed"\)/);
 assert.doesNotMatch(src,/name === "selectImage" &&[\s\S]*?btn-toggle-inspector/);
 assert.match(css,/#image-controls\[data-nm-independent-panel="true"\]/);
 assert.match(css,/#nm-learn-panel > header/);
 assert.match(css, /position:sticky!important/);
 for(const name of ["#nm-knowledge-panel > .nm-kn-header","#nm-ai-studio > header","#nm-insert-panel > header"])
  assert.ok(css.includes(name),name);
});
test("context menu keeps dangerous or advanced commands under an opt-in disclosure",()=>{
 const source=read("apps/desktop-shared/editor/context-menu-refresh.js");
 const css=read("apps/desktop-shared/editor/editor.css");
 assert.match(source,/function compactGroup\(group,kind\)/);
 assert.match(source,/group\.append\(primary,more\)/);
 assert.match(source,/more\.open=false/);
 assert.match(source,/Altre azioni sul ramo/);
 assert.match(source,/Altre azioni sull’immagine/);
 assert.match(source,/ctx-add-child/);
 assert.match(source,/ctx-img-copy/);
 assert.match(css,/#context-menu \.nm-context-other > summary:focus-visible/);
});

test("image PNG conversion works for native PNG, JPEG, unavailable fetch and invalid dimensions",async()=>{
 const code=read("packages/editor-ui/desktop-workflows.js");
 const a=code.indexOf(" async function sourcePNG("),b=code.indexOf(" function writePNG(png)",a);
 assert.ok(a>0&&b>a);
 const source=code.slice(a,b);
 for(const kind of ["png","jpeg","fallback","oversized"]){
  const counters={canvas:0,closed:0};
  const blob={size:kind==="oversized"?40*1024*1024:200,type:kind==="png"||kind==="oversized"?"image/png":"image/jpeg"};
  const context={
   tr:it=>it,
   fetch:async()=>{if(kind==="fallback")throw Error("unsupported scheme");return {ok:true,blob:async()=>blob}},
   createImageBitmap:async()=>({width:75,height:42,close(){counters.closed++}}),
   Image:class {constructor(){this.width=75;this.height=42}async decode(){}},
   URL:{createObjectURL:()=> "blob:example",revokeObjectURL:()=>{}},
   document:{createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:callback=>{
    counters.canvas++;callback({type:"image/png",size:180});
   }})}
  };
  const convert=vm.runInNewContext("(function(){"+source+";return sourcePNG;})()",context);
  if(kind==="oversized"){
   await assert.rejects(convert("data:image/png;base64,AA=="),/troppo grande/);
  }else{
   const result=await convert("data:image/png;base64,AA==");
   assert.equal(result.type,"image/png");
   assert.equal(counters.canvas,kind==="png"?0:1);
  }
 }
});
