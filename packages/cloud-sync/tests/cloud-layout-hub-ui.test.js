'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const repo=path.join(__dirname,'../../..');
const source=file=>fs.readFileSync(path.join(repo,file),'utf8');

class FakeElement {
 constructor(tag='div'){
  this.tag=tag;this.id='';this.className='';this.children=[];this.listeners={};
  this.dataset={};this.attrs={};this.textContent='';this.hidden=false;
  this.disabled=false;this.parent=null;this.value='';this.style={};
  this.namespaceURI='http://www.w3.org/2000/svg';
  this.classList={
   add:name=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),name])].join(' ')},
   toggle:(name,on)=>{const classes=new Set(this.className.split(' ').filter(Boolean));
    if(on)classes.add(name);else classes.delete(name);
    this.className=[...classes].join(' ');},
   contains:name=>this.className.split(' ').includes(name),
   remove:name=>{this.className=this.className.split(' ').filter(x=>x&&x!==name).join(' ')}
  };
 }
 append(...items){for(const item of items){item.parent=this;this.children.push(item)}}
 replaceChildren(...items){this.children=[];this.append(...items)}
 setAttribute(key,value){this.attrs[key]=value}
 addEventListener(key,handler){(this.listeners[key]??=[]).push(handler)}
 getClientRects(){return [{}]}
 get isConnected(){let p=this;while(p){if(p===this._root)return true;p=p.parent}return !!this.parent}
 focus(){if(this._document)this._document.activeElement=this}
 remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null}}
}
function visit(base,fn){const list=[base];while(list.length){const el=list.pop();if(fn(el))return el;list.push(...el.children)}return null}
async function settle(){for(let i=0;i<30;i++)await Promise.resolve()}

test('Cloud Hub opens with real provider state, never syncs on open and keeps three providers',async()=>{
 const body=new FakeElement('body'),file=new FakeElement('div'),tab=new FakeElement('div');
 file.id='dropdown-file';tab.className='tab-bar';body.append(file,tab);
 const document={body,readyState:'complete',documentElement:{lang:'it'},
  activeElement:null,createElement:t=>new FakeElement(t),
  createElementNS:(ns,t)=>new FakeElement(t),
  getElementById:id=>visit(body,el=>el.id===id),
  querySelector:q=>q==='.tab-bar'?tab:null,
  addEventListener(){}};
 let syncCount=0,checks=0;
 const win={
  GlaukaI18n:{pair:(it,en)=>it},
  neuromapDesktop:{cloudAuth:{status:async()=>{
   checks++;return {supported:true,google:{configured:true,connected:true},
    dropbox:{configured:true,connected:false},onedrive:{configured:true,connected:false}};
  }}},
  GlaukaCloudSync:{enabled:id=>id==='google',
   summary:async()=>({lastSuccess:'2026-10-30T20:22:00Z',dirty:false,status:'idle'}),
   syncNow:async()=>{syncCount++;throw Error('Unexpected sync')}},
  GlaukaCloudLibrary:{reset(){}}
 };
 vm.runInNewContext(source('apps/desktop-shared/src/cloud_panel.js'),{
  window:win,document,localStorage:{getItem:()=>null},setTimeout:()=>0,clearTimeout(){}});
 const open=document.getElementById('gl-cloud-open');
 assert.ok(open,'menu launcher exists');
 open.listeners.click[0]();await settle();
 const overview=visit(body,el=>el.className==='gl-cloud-overview');
 assert.ok(overview,'cloud overview exists');
 const strings=[];
 const recurse=el=>{if(el.textContent)strings.push(el.textContent);el.children.forEach(recurse)};
 recurse(body);
 for(const name of ['Google Drive','Dropbox','Microsoft OneDrive'])
  assert.ok(strings.includes(name),'provider is listed: '+name);
 assert.ok(strings.some(x=>x.includes('Destinazione attiva: Google Drive')));
 assert.ok(strings.some(x=>x.includes('Ultima sincronizzazione:')));
 assert.equal(document.getElementById('gl-cloud-quick').dataset.cloudState,'active');
 assert.equal(syncCount,0,'opening settings never sends a file');
 assert.equal(checks,1);
 assert.equal(document.getElementById('gl-cloud-dialog').hidden,false);
});

test('Connected Cloud uses a coordinated nonmodal drawer on wide desktops',async()=>{
 const body=new FakeElement('body'),file=new FakeElement('div'),tab=new FakeElement('div');
 file.id='dropdown-file';tab.className='tab-bar';body.append(file,tab);
 const document={body,readyState:'complete',documentElement:{lang:'it'},
  activeElement:null,createElement:t=>new FakeElement(t),
  createElementNS:(ns,t)=>new FakeElement(t),
  getElementById:id=>visit(body,el=>el.id===id),
  querySelector:q=>q==='.tab-bar'?tab:null,
  addEventListener(){}};
 let registered=null,claims=0;
 const app={};
 const win={
  innerWidth:1200,neuroMapApp:app,addEventListener(){},
  NeuroMapWorkspaceLayout:{
   registerPanel:(obj,id,adapter)=>{assert.equal(obj,app);assert.equal(id,'cloud');registered=adapter;return true},
   claim:()=>{claims++;return true}},
  GlaukaI18n:{pair:(it,en)=>it},
  neuromapDesktop:{cloudAuth:{status:async()=>({
   supported:true,google:{configured:true,connected:true},
   dropbox:{configured:true,connected:false},onedrive:{configured:true,connected:false}
  })}},
  GlaukaCloudSync:{enabled:id=>id==='google',summary:async()=>({status:'idle',lastSuccess:null,dirty:false})},
  GlaukaCloudLibrary:{reset(){}}
 };
 vm.runInNewContext(source('apps/desktop-shared/src/cloud_panel.js'),{
  window:win,document,localStorage:{getItem:()=>null},setTimeout:()=>0,clearTimeout(){}});
 document.getElementById('gl-cloud-open').listeners.click[0]();
 await settle();
 const curtain=document.getElementById('gl-cloud-dialog');
 assert.ok(curtain.classList.contains('gl-cloud-docked'));
 assert.equal(curtain.attrs['aria-modal'],'false');
 assert.ok(registered&&claims>0,'workspace coordinator claimed the drawer');
 registered.close();assert.equal(curtain.hidden,true);
 assert.equal(curtain.attrs['aria-modal'],'true');
});

test('Cloud keeps modal setup if a workspace draft blocks a side-panel switch',async()=>{
 const body=new FakeElement('body'),file=new FakeElement('div'),tab=new FakeElement('div');
 file.id='dropdown-file';tab.className='tab-bar';body.append(file,tab);
 const document={body,readyState:'complete',documentElement:{lang:'it'},
  createElement:t=>new FakeElement(t),createElementNS:(ns,t)=>new FakeElement(t),
  getElementById:id=>visit(body,el=>el.id===id),
  querySelector:q=>q==='.tab-bar'?tab:null,
  addEventListener(){}};
 let claims=0;
 const win={innerWidth:1200,neuroMapApp:{},addEventListener(){},
  NeuroMapWorkspaceLayout:{registerPanel:()=>true,claim:()=>{claims++;return false}},
  GlaukaI18n:{pair:(it,en)=>it},
  neuromapDesktop:{cloudAuth:{status:async()=>({
   supported:true,google:{configured:true,connected:true},
   dropbox:{configured:true,connected:false},onedrive:{configured:true,connected:false}
  })}},
  GlaukaCloudSync:{enabled:id=>id==='google',summary:async()=>({status:'idle'})},
  GlaukaCloudLibrary:{reset(){}}
 };
 vm.runInNewContext(source('apps/desktop-shared/src/cloud_panel.js'),{
  window:win,document,localStorage:{getItem:()=>null},setTimeout:()=>0,clearTimeout(){}});
 document.getElementById('gl-cloud-open').listeners.click[0]();
 await settle();
 const curtain=document.getElementById('gl-cloud-dialog');
 assert.ok(claims>0);
 assert.ok(!curtain.classList.contains('gl-cloud-docked'),'draft remains untouched');
 assert.equal(curtain.attrs['aria-modal'],'true');
});

test('Cloud recovery progressively lists beyond the first 80 maps without technical IDs',async()=>{
 const win={
  GlaukaI18n:{pair:(it,en)=>it},
  GlaukaCloudReader:{createReader:()=>({
   discover:async()=>Array.from({length:173},(_,i)=>({
    id:'abcdefghi'+i,name:'Mappa '+String(i).padStart(3,'0'),version:'v',remoteId:'r'}))
  })},
  GlaukaCloudProviders:{google(){},dropbox(){},onedrive(){}},
  GlaukaCloudCore:{},GlaukaCloudHash:{},neuromapDesktop:{cloudTransport:{}}
 };
 const document={createElement:t=>new FakeElement(t),documentElement:{lang:'it'}};
 vm.runInNewContext(source('apps/desktop-shared/src/cloud_library_ui.js'),{
  window:win,document,localStorage:{getItem:()=>null}});
 const container=new FakeElement('div'),feedback=new FakeElement('p');
 await win.GlaukaCloudLibrary.open('google',container,feedback);
 const items=visit(container,el=>el.className==='gl-cloud-library-items');
 const rows=()=>items.children.filter(el=>el.className.includes('gl-cloud-map-row'));
 const more=()=>items.children.find(el=>el.className==='gl-cloud-library-more');
 assert.equal(rows().length,80);assert.ok(more());
 assert.ok(!rows()[0].children[0].children[1].textContent.includes('abcdefghi'));
 more().listeners.click[0]();assert.equal(rows().length,160);
 more().listeners.click[0]();assert.equal(rows().length,173);
 assert.equal(more(),undefined);
 const search=visit(container,el=>el.className==='gl-cloud-library-search');
 search.value='Mappa 170';search.listeners.input[0]();
 assert.equal(rows().length,1,'search filters and resets list size');
});

test('Actual layout thumbnail renders all 5 branches with children and caps 10,001-node trees',()=>{
 const src=source('packages/editor-ui/creative-tools-sync.js');
 const start=src.indexOf('  function updateMiniPreview(app) {');
 const stop=src.indexOf('  function chooseMode(app, mode) {',start);
 assert.ok(start>0&&stop>start,'thumbnail implementation is present');
 const host=new FakeElement('section'),svg=new FakeElement('svg'),note=new FakeElement('small');
 host.id='nm-layout-mini-preview';host.append(svg,note);
 const doc={getElementById:id=>id===host.id?host:null,
  createElementNS:(ns,tag)=>new FakeElement(tag)};
 host.querySelector=selector=>selector==='svg'?svg:(selector==='small'?note:null);
 const render=new Function('document','tr',
  src.slice(start,stop)+'\nreturn updateMiniPreview;')(doc,it=>it);

 // First verify the 5-branch 17-node tree draws every child including branch 5.
 const demo={id:'root',children:[
  {id:'b1',children:[{id:'c11',children:[]},{id:'c12',children:[]},{id:'c13',children:[]}]},
  {id:'b2',children:[{id:'c21',children:[]},{id:'c22',children:[]}]},
  {id:'b3',children:[{id:'c31',children:[]},{id:'c32',children:[]}]},
  {id:'b4',children:[{id:'c41',children:[]},{id:'c42',children:[]}]},
  {id:'b5',children:[{id:'c51',children:[]},{id:'c52',children:[]}]}
 ]};
 const demoCoords=new Map([['root',{x:0,y:0}]]);
 demo.children.forEach((b,bi)=>{
  const by=(bi-2)*90;demoCoords.set(b.id,{x:180,y:by});
  b.children.forEach((c,ci)=>demoCoords.set(c.id,{x:360,y:by+(ci-0.5)*34}));
 });
 render({state:{root:demo},layout:{getLayout:id=>demoCoords.get(id)}});
 const rects=svg.children.filter(e=>e.tag==='rect');
 assert.equal(rects.length,17);
 assert.ok(rects.some(r=>r.attrs['data-logical-id']==='c52'),'5th branch children are rendered');

 // Next verify bounded scan on a 10,001-node tree without mutations.
 const root={id:'root',children:[]};
 for(let i=0;i<10000;i++)root.children.push({id:'n'+i,children:[]});
 let lookups=0;
 const app={state:{root},layout:{getLayout(id){
  lookups++;
  const n=id==='root'?0:Number(id.slice(1))+1;
  if(n===6)throw Error('No geometry');
  return {x:(n%2?-1:1)*n*70,y:n*16};
 }}};
 const before=JSON.stringify(root);
 for(let i=0;i<250;i++)render(app);
 assert.equal(host.hidden,false);
 assert.ok(svg.children.filter(e=>e.tag==='rect').length<=48);
 assert.ok(svg.children.filter(e=>e.tag==='rect').length>=20);
 assert.ok(lookups<=250*140,'bounded geometry lookups');
 assert.equal(JSON.stringify(root),before,'preview cannot edit saved map');
});

test('Layout refinements preserve original mode IDs, height controls and thematic styling',()=>{
 const modes=source('packages/editor-ui/creative-tools-mount-panel.js');
 const settings=source('packages/editor-ui/creative-settings-organize.js');
 const height=source('packages/editor-ui/continuation-layout-mount.js')+
  source('packages/editor-ui/continuation-layout.js');
 const cloud=source('apps/desktop-shared/src/cloud_panel.css');
 const css=source('packages/editor-ui/creative-formatting.css');
 assert.match(modes,/nm-layout-other/);
 assert.match(modes,/moreGrid/);
 assert.match(modes,/nm-layout-modes/);
 assert.match(settings,/nm-layout-text-more/);
 for(const key of ['nm-distribution-height','nm-distribution-advanced',
   'nm-distribution-less','nm-distribution-more','nm-distribution-exact',
   'nm620-layout-forecast'])assert.ok(height.includes(key),'preserve control '+key);
 assert.match(css,/--nm-ui-surface/);
 assert.match(cloud,/--nm-ui-surface/);
 assert.match(cloud,/backdrop-filter:none/);
 assert.match(cloud,/prefers-reduced-motion/);
});
