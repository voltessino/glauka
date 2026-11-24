'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../../../packages/map-core');
const Atlas=require('../../../apps/desktop-shared/editor/atlas-library-core.js');
const colors=['#f43f5e','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899','#3b82f6','#84cc16','#f97316','#14b8a6'];
const stateSrc=composeStateSource('desktop-shared');
const State=new Function('NeuroMapCore','localStorage','nm70PreferredGap',
 'ColorUtils','HARMONIC_PALETTE','THEME_PALETTES',stateSrc+'\nreturn MindMapStateMachine;')(
 Core,{getItem:()=>null,setItem(){}},()=>150,{lighten:c=>c},colors,{default:colors});
const shell=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/shell-home.js'),'utf8');
const start=shell.indexOf(' const HOME_EXAMPLES=');
const end=shell.indexOf(' const finish=()=>',start);
assert.ok(start>=0&&end>start,'real templates/recent handling source exists');
const window={NeuroMapAtlasLibrary:Atlas,neuromapDesktop:{openProject:async()=>({cancelled:true})},neuroMapApp:null};
let lang='it',closeCount=0;
const svgDocument={createElementNS(_namespace,tag){
 return {tag,attributes:{},textContent:'',setAttribute(key,value){this.attributes[key]=value}};
}};
const home=new Function('window','nmLocale','finish','document',shell.slice(start,end)+
  '\nreturn {populateHomeExample,recentClosed,reopenHomeRecent,homePreviewScene,homeSvg};')(
 window,()=>lang,()=>{closeCount++},svgDocument);
const modes=['mindmap','orgchart','concept-tree','concept-network','flowchart','kanban','timeline'];
const nodes=root=>{const result=[],stack=[root];while(stack.length){const n=stack.pop();result.push(n);stack.push(...n.children)}return result};
test('all seven Italian and English templates have well-formed state, valid IDs and preserved view metadata',()=>{
 for(lang of ['it','en'])for(const mode of modes){
  const state=new State();state.initStarterTree('Sample');state.root.children=[];state.root.viewMode=mode;
  home.populateHomeExample(state,mode);
  const rows=nodes(state.root),ids=new Set(rows.map(n=>n.id));
  assert.ok(rows.length>=4,mode);assert.equal(rows.length,ids.size,mode);
  for(const node of rows)for(const child of node.children)assert.equal(child.parentId,node.id);
  assert.equal(state.isDirty,true);assert.equal(state.undoStack.length,0);
  const snapshot=State.cloneTree(state.root);
  assert.equal(snapshot.viewMode,mode==='mindmap'?undefined:mode);
  assert.equal(nodes(snapshot).length,rows.length);
  if(mode==='flowchart'){
   assert.equal(state.relationships.length,5);
   for(const edge of state.relationships){assert.ok(ids.has(edge.fromId));assert.ok(ids.has(edge.toId))}
  }
  if(mode==='kanban')assert.ok(rows.some(n=>n.taskStatus==='done'));
  if(mode==='timeline')assert.ok(rows.filter(n=>n.startDate&&n.dueDate).length>=3);
 }
});
function record(filename,title,updatedAt){return {filePath:filename,originSheetIndex:0,title,
 updatedAt,tabId:title,nodes:[{id:title,text:title,depth:0}]}}
test('recent files list deduplicates file paths, skips already open files and does not show on web',()=>{
 const first='C:\\Maps\\Alfa.neuromap',second='C:\\Maps\\Beta.xmind',third='/Users/me/Gamma.neuromap';
 const app={tabs:[{filePath:second}],_nmAtlasArchive:[
  record(first,'Alfa old',1),record(first,'Alfa new',5),record(second,'Beta',4),record(third,'Gamma',3)
 ]};
 assert.deepEqual(home.recentClosed(app).map(x=>x.title),['Alfa new','Gamma']);
 app._desktopRecoveryPending=true;assert.deepEqual(home.recentClosed(app),[]);
 app._desktopRecoveryPending=false;window.neuromapDesktop=null;
 assert.deepEqual(home.recentClosed(app),[]);
 window.neuromapDesktop={openProject:async()=>({cancelled:true})};
});
test('recent reopening requires manual matching path and never imports a different selected file',async()=>{
 lang='en';closeCount=0;
 let imported=0,errors=[],askCount=0;
 const expected='C:\\Maps\\Alfa.neuromap',recent=record(expected,'Alfa',10);
 const app={tabs:[],_desktopRecoveryPending:false,
  async nmAsk(){askCount++;return 'open'},
  async v6ImportNative(payload){imported++;this.tabs.push({id:'reopened-'+imported,filePath:payload.path})},
  showToast(message){errors.push(message)}
 };
 window.neuroMapApp=app;
 window.neuromapDesktop={openProject:async()=>({path:'C:\\Maps\\Other.neuromap',bytes:[1],filename:'Other.neuromap'})};
 await home.reopenHomeRecent(recent);
 assert.equal(askCount,1);assert.equal(imported,0);assert.equal(closeCount,0);
 assert.ok(errors.some(x=>x.includes('does not match')));
 window.neuromapDesktop={openProject:async()=>({cancelled:true})};
 await home.reopenHomeRecent(recent);
 assert.equal(imported,0);
 window.neuromapDesktop={openProject:async()=>({path:expected,bytes:[1],filename:'Alfa.neuromap'})};
 await home.reopenHomeRecent(recent);
 assert.equal(imported,1);assert.equal(closeCount,1);
});


test('double click cannot open two recent-file choosers at once',async()=>{
 lang='it';
 let release,asks=0;
 const pending=new Promise(resolve=>{release=resolve});
 window.neuroMapApp={tabs:[],_desktopRecoveryPending:false,nmAsk:async()=>{asks++;return pending},
  v6ImportNative:async()=>{throw Error('unexpected import')},showToast:()=>{}};
 window.neuromapDesktop={openProject:async()=>{throw Error('unexpected picker')}};
 const entry=record('C:\\Maps\\Single.neuromap','Single',7);
 const first=home.reopenHomeRecent(entry);
 const second=home.reopenHomeRecent(entry);
 assert.equal(asks,1);
 release('cancel');
 await Promise.all([first,second]);
 assert.equal(asks,1);
});


test('seven Home previews reflect guided examples in Italian and English without modifying state',()=>{
 for(const locale of ['it','en']){
  lang=locale;
  for(const mode of modes){
   const blank=home.homePreviewScene(mode,'blank',locale==='en');
   const guided=home.homePreviewScene(mode,'guided',locale==='en');
   assert.equal(blank.mode,mode);
   assert.equal(guided.mode,mode);
   assert.equal(blank.guided,false);
   assert.equal(guided.guided,true);
   assert.ok(blank.nodes.length>=3,mode);
   assert.ok(blank.nodes.length<=guided.nodes.length,'guided mode may add example cards');
   assert.ok(blank.nodes.every(x=>!x.text||x.kind==='column'),
     'blank views may label empty Kanban columns but never invent content cards');
   assert.ok(guided.nodes.some(x=>x.text.length),'editable example labels are visible');
   assert.ok(guided.nodes.every(x=>x.x>=0&&x.y>=0&&x.w>0&&x.h>0&&x.x+x.w<=360));
  }
 }
});
test('guided flow, network, Kanban and Timeline previews represent actual source models',()=>{
 const flow=home.homePreviewScene('flowchart','guided',false);
 assert.equal(flow.nodes.length,5);
 assert.equal(flow.lines.length,5,'match explicit five sample transitions');
 const network=home.homePreviewScene('concept-network','guided',false);
 assert.equal(network.lines.length,0,'no invented source relationships');
 const kanban=home.homePreviewScene('kanban','guided',false);
 assert.equal(kanban.nodes.length,8,'four columns and four example cards');
 const timeline=home.homePreviewScene('timeline','guided',false);
 assert.equal(timeline.nodes.length,3,'three dated example activities');
 const blankFlow=home.homePreviewScene('flowchart','blank',false);
 assert.equal(blankFlow.lines.length,0,'an empty flow has no inferred transitions');
 const english=home.homePreviewScene('kanban','guided',true);
 assert.ok(english.nodes.some(x=>x.text==='Define tasks'));
 assert.ok(!english.nodes.some(x=>x.text==='Definire attività'));
});
test('a Home preview is non-mutating and does not create a project until confirmed',()=>{
 const state=new State();state.initStarterTree('Untouched');
 const before=JSON.stringify(state.root);
 const beforeCount=state.undoStack.length;
 for(const mode of modes){
  home.homePreviewScene(mode,'blank',false);
  home.homePreviewScene(mode,'guided',true);
 }
 assert.equal(JSON.stringify(state.root),before);
 assert.equal(state.undoStack.length,beforeCount);
});


test('preview SVG renderer uses safe textContent and emits exactly the scene elements',()=>{
 const svg={children:[],attributes:{},
  replaceChildren(){this.children=[]},
  setAttribute(key,value){this.attributes[key]=value},
  append(item){this.children.push(item);return item}
 };
 const scene=home.homePreviewScene('flowchart','guided',true);
 home.homeSvg(svg,scene);
 const rects=svg.children.filter(c=>c.tag==='rect');
 const lines=svg.children.filter(c=>c.tag==='line');
 const titles=svg.children.filter(c=>c.tag==='text');
 assert.equal(rects.length,scene.nodes.length);
 assert.equal(lines.length,scene.lines.length);
 assert.equal(titles.length,scene.nodes.filter(n=>n.text).length);
 assert.equal(svg.attributes.viewBox,'0 0 360 180');
 const xss={mode:'orgchart',guided:true,lines:[],nodes:[{
  x:10,y:10,w:90,h:30,text:'<script>alert(1)</script>',color:'#445577',kind:'box'
 }]};
 home.homeSvg(svg,xss);
 assert.equal(svg.children.filter(c=>c.tag==='script').length,0);
 assert.equal(svg.children.filter(c=>c.tag==='text').length,1);
 assert.ok(svg.children.some(c=>c.tag==='text'&&c.textContent.includes('<script>')));
});
