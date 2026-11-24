"use strict";
/* F10 orgchart: presentation must use authentic map data, never synthetic
   employees, avatar pictures or editable fake role fields. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const appearance=require("../view-appearance-core");
const core=require("../view-core");
const from=name=>fs.readFileSync(path.join(__dirname,"../"+name),"utf8");
class NodeElement{
 constructor(tag="div"){
  this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.textContent="";
  const names=new Set();
  this.classList={
   add:(...values)=>values.forEach(v=>names.add(v)),
   contains:name=>names.has(name),
   toggle:(name,force)=>{if(force===undefined? !names.has(name):force)names.add(name);else names.delete(name);}
  };
  const styles={};this.style={setProperty:(key,value)=>{styles[key]=value},getPropertyValue:key=>styles[key]};
 }
 setAttribute(key,value){this.attrs[key]=String(value)}
 getAttribute(key){return this.attrs[key]||null}
 append(...items){this.children.push(...items)}
 querySelectorAll(selector){
  if(selector!==".nm-orgchart-card")throw Error("Fixture only accepts orgchart selector");
  return this.children.filter(child=>child.classList.contains("nm-orgchart-card"));
 }
}
function helpers(){
 const ctx={
  document:{createElement:tag=>new NodeElement(tag),createElementNS:(_,tag)=>new NodeElement(tag)},
  appearance,TREE_GROUP_COLORS:appearance.GROUP_COLORS,
  tr:(it,en)=>it
 };
 vm.runInNewContext(from("linked-view-decorations.js")+
  "\nthis.f10={orgCardInitials,orgCardChildCount,orgCardCaption,orgAttachedImages,decorateOrgCard,applyOrgSearch,drawOrgMarkers,hiddenDirectChildCount,formatHiddenBadge,hiddenChildrenCaption,accessibleNetworkLabelColors,contrastRatio};",
  ctx,{filename:"linked-view-decorations.js"});
 return ctx.f10;
}
test("F10 orgchart builds accessible visual identity from real node titles only",()=>{
 const f=helpers(),node={id:"r",text:"Ricerca e Sviluppo",
  depth:1,groupIndex:2,childIds:["child-1","child-2"],hiddenChildren:0};
 const original=JSON.stringify(node),card=new NodeElement();
 card.setAttribute("aria-label",node.text);
 f.decorateOrgCard(card,"orgchart",node);
 assert.equal(card.classList.contains("nm-orgchart-card"),true);
 assert.equal(card.dataset.orgSearchText,"ricerca e sviluppo");
 assert.equal(card.children.find(x=>x.className==="nm-orgchart-mark")?.textContent,"RS");
 assert.ok(card.getAttribute("aria-label").includes("2 rami"));
 assert.equal(card.children.find(x=>x.className==="nm-orgchart-meta")?.textContent,"Liv. 1 · 2 rami");
 assert.ok(card.style.getPropertyValue("--nm-orgchart-band"));
 assert.equal(JSON.stringify(node),original,"rendering must never write map metadata");
 const collapsed={...node,childIds:[],hiddenChildren:2};
 assert.equal(f.orgCardChildCount(collapsed),2);
 assert.equal(Array.from(f.orgCardInitials("🧠 Scienze")).length,2);
 assert.equal(f.orgCardInitials(""),"•");
});
test("F10 live search dims other cards without mutating IDs or hierarchy",()=>{
 const f=helpers(),stage=new NodeElement();
 for(const [id,text] of [["a","Direzione"],["b","Ingegneria"],["c","Ricerca"]]){
  const card=new NodeElement();
  card.dataset.nodeId=id;f.decorateOrgCard(card,"orgchart",
    {id,text,depth:1,groupIndex:0,childIds:[],hiddenChildren:0});
  stage.append(card);
 }
 assert.equal(f.applyOrgSearch(stage,"ric"),1);
 assert.deepEqual(stage.children.map(c=>c.classList.contains("nm-orgchart-dimmed")),[true,true,false]);
 assert.equal(f.applyOrgSearch(stage,""),3);
 assert.deepEqual(stage.children.map(c=>c.dataset.nodeId),["a","b","c"]);
});
test("F10 export markers use the same initial and authentic count in SVG",()=>{
 const f=helpers(),svg=new NodeElement("svg");
 const node={x:135,y:145,w:172,h:72,text:"Team Ricerca",
  groupIndex:3,depth:1,childIds:["a","b"],hiddenChildren:0};
 f.drawOrgMarkers(svg,node,{text:"#ffffff",accent:"#60a5fa"});
 assert.ok(svg.children.length>=4);
 assert.ok(svg.children.some(x=>x.textContent==="TR"));
 assert.ok(svg.children.some(x=>x.textContent.includes("2 rami")));
 assert.ok(svg.children.every(x=>Object.keys(x.attrs).every(k=>!k.startsWith("on"))));
});
test("F10 100-report layout remains stable and keeps real direct report IDs",()=>{
 const root={id:"root",text:"Direzione",children:[]};
 for(let i=0;i<100;i++)root.children.push({id:"report-"+i,
  text:"Area "+i,children:[]});
 const old=JSON.stringify(root);
 for(const orientation of ["vertical","horizontal"]){
  const a=core.project(root,"orgchart",{orientation});
  const b=core.project(root,"orgchart",{orientation});
  assert.deepEqual(a,b);
  assert.equal(a.nodes.length,101);
  assert.ok(a.width<5000&&a.height<5000);
  assert.ok(a.nodes.every(n=>n.w>=172&&n.h>=72));
  assert.ok(a.nodes.slice(1).every(n=>n.parentId==="root"));
 }
 assert.equal(JSON.stringify(root),old);
});
test("F10 primary/split view, search, zoom and export use shared styling",()=>{
 const css=from("linked-view-styles.js"),primary=from("linked-view-runtime-render.js"),
  split=from("linked-view-runtime-dual.js"),chrome=from("linked-view-ensure-chrome.js"),
  zoom=from("linked-view-ensure-zoom.js"),exportFile=from("linked-view-export-view.js");
 for(const expected of ["nm-orgchart-mark","nm-orgchart-meta","nm-orgchart-dimmed",
  "data-org-detail=overview","nm-orgchart-search"])
  assert.ok(css.includes(expected),expected);
 assert.ok(primary.includes("applyOrgSearch(stage"));
 assert.ok(split.includes("applyOrgSearch(stage"));
 assert.ok(primary.includes("stage.dataset.orgDetail="));
 assert.ok(split.includes("stage.dataset.orgDetail="));
 assert.ok(chrome.includes("orgSearch.addEventListener('input'"));
 assert.ok(zoom.includes("header.append(title,viewPicker,hint,orgSearch"));
 assert.ok(exportFile.includes("const orgCard=mode==='orgchart'"));
 assert.ok(exportFile.includes("const textX=orgCard?"));
});

test("F10 uses only actually attached local raster images; no remote photos",()=>{
 const f=helpers();
 const pixel="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9N9tMAAAAASUVORK5CYII=";
 const images=f.orgAttachedImages({images:[
  {mode:"attached",attachedNodeId:"staff",src:pixel},
  {mode:"attached",attachedNodeId:"remote",src:"https://example.com/profile.jpg"},
  {mode:"attached",attachedNodeId:"script",src:"data:image/svg+xml;base64,PHN2Zy8+"},
  {mode:"free",attachedNodeId:"loose",src:pixel}
 ]});
 assert.equal(images.size,1);
 assert.equal(images.get("staff"),pixel);
 const card=new NodeElement();
 f.decorateOrgCard(card,"orgchart",{
  id:"staff",text:"Mario Rossi",depth:2,groupIndex:1,childIds:[]
 },images.get("staff"));
 assert.equal(card.children.find(x=>x.className==="nm-orgchart-mark")?.tag,"img");
 assert.equal(card.dataset.orgMedia,"attached");
 const svg=new NodeElement("svg");
 f.drawOrgMarkers(svg,{id:"staff",x:90,y:80,w:172,h:72,
  text:"Mario Rossi",depth:2,groupIndex:1,childIds:[]},
  {text:"#fff"},pixel);
 assert.ok(svg.children.some(x=>x.tag==="image"));
 assert.ok(svg.children.some(x=>x.tag==="clipPath"));
});

test("premium evolution uses direct hidden-child counts and Unicode monograms",()=>{
 const f=helpers();
 assert.equal(f.hiddenDirectChildCount({hiddenChildren:3}),3);
 assert.equal(f.formatHiddenBadge(3),"+3");
 assert.equal(f.formatHiddenBadge(120),"99+");
 assert.equal(f.hiddenChildrenCaption(1),"1 figlio nascosto");
 assert.equal(f.hiddenChildrenCaption(3),"3 figli nascosti");
 const card=new NodeElement();
 f.decorateOrgCard(card,"orgchart",{id:"x",text:"Équipe Alpha",depth:1,groupIndex:0,childIds:[],hiddenChildren:3});
 assert.equal(card.children.find(x=>x.className==="nm-hierarchy-hidden-badge")?.textContent,"+3");
 assert.ok(card.getAttribute("aria-label").includes("figli nascosti"));
 assert.equal(card.children.find(x=>x.className==="nm-orgchart-mark")?.textContent,"ÉA");
 const original={id:"x",text:"Équipe Alpha",depth:1,groupIndex:0,childIds:[],hiddenChildren:3};
 const snapshot=JSON.stringify(original);
 f.decorateOrgCard(new NodeElement(),"orgchart",original);
 assert.equal(JSON.stringify(original),snapshot);
});
test("network labels keep WCAG AA contrast on light and dark plates",()=>{
 const f=helpers();
 for(const style of [
  {background:"#ffffff",surface:"#f8fafc",edge:"#64748b",text:"#16243d"},
  {background:"#0b1220",surface:"#152033",edge:"#8295b7",text:"#eff6ff"},
  {background:"#111827",surface:"#fef3c7",edge:"#f59e0b",text:"#111827"},
  {background:"#fff7ed",surface:"#7c2d12",edge:"#9a3412",text:"#fff7ed"}
 ]){
  const colors=f.accessibleNetworkLabelColors(style);
  assert.ok(f.contrastRatio(colors.text,colors.plate)>=4.5,JSON.stringify(colors));
 }
});
