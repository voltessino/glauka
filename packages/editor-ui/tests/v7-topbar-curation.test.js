'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../topbar-curation.js'),'utf8');
function harness(){
 const byId=new Map();
 class Node {
  constructor(tag='div'){this.tag=tag;this.children=[];this.parentElement=null;
   this._id='';this.className='';this.dataset={};this.attributes={};this.events={};
   this.textContent='';this.title='';this.style={};this.hidden=false;}
  get id(){return this._id}
  set id(value){this._id=value;if(value)byId.set(value,this)}
  get classList(){const self=this;return {
   contains:v=>self.className.split(' ').includes(v),
   add:(...names)=>{self.className=[...new Set([...self.className.split(' ').filter(Boolean),...names])].join(' ')},
   remove:(...names)=>{self.className=self.className.split(' ').filter(x=>x&&!names.includes(x)).join(' ')}
  }}
  append(...items){for(const item of items){item.parentElement?.removeChild(item);
   this.children.push(item);item.parentElement=this;}}
  removeChild(item){const i=this.children.indexOf(item);if(i>=0)this.children.splice(i,1);item.parentElement=null;}
  prepend(item){item.parentElement?.removeChild(item);this.children.unshift(item);item.parentElement=this;}
  insertBefore(item,before){item.parentElement?.removeChild(item);const i=this.children.indexOf(before);
   this.children.splice(i<0?this.children.length:i,0,item);item.parentElement=this;}
  after(item){const host=this.parentElement;if(!host)throw Error('missing parent');
   item.parentElement?.removeChild(item);const at=host.children.indexOf(this);host.children.splice(at+1,0,item);item.parentElement=host;}
  get previousElementSibling(){const list=this.parentElement?.children||[];return list[list.indexOf(this)-1]||null;}
  get nextElementSibling(){const list=this.parentElement?.children||[];return list[list.indexOf(this)+1]||null;}
  querySelector(selector){
   const queue=[...this.children];while(queue.length){const current=queue.shift();
    if(selector.startsWith('.')&&current.classList.contains(selector.slice(1)))return current;
    if(selector.startsWith('#')&&current.id===selector.slice(1))return current;
    queue.push(...current.children);
   }return null;
  }
  setAttribute(key,value){this.attributes[key]=String(value)}
  getAttribute(key){return this.attributes[key]??null}
  addEventListener(event,cb){(this.events[event]??=[]).push(cb)}
  click(){for(const cb of this.events.click||[])cb()}
 }
 const document={body:new Node('body'),head:new Node('head'),
  documentElement:{lang:'it'},addEventListener(){},createElement:tag=>new Node(tag),
  getElementById:id=>byId.get(id)||null,
  querySelector:selector=>document.body.querySelector(selector)};
 const chrome=new Node('div');chrome.className='top-chrome';document.body.append(chrome);
 const bar=new Node('div');bar.className='tab-bar';chrome.append(bar);
 const tabs=new Node('div');tabs.id='tabs-list';bar.append(tabs);
 const make=(id,parent=bar,tag='button')=>{const x=new Node(tag);x.id=id;parent.append(x);return x};
 for(const id of ['btn-new-tab','btn-duplicate-tab','btn-shortcuts','nm7-guide-open','btn-fullscreen','nm-orbit-command-trigger','nm616-zen-switch'])make(id);
 const ribbon=new Node('div');ribbon.className='topbar';chrome.append(ribbon);
 const toolbar=new Node('div');toolbar.className='toolbar-group';ribbon.append(toolbar);
 for(const name of ['file','edit','insert','view','tools','help']){
  const menu=make('dropdown-'+name,toolbar,'div');
  menu.className='dropdown-panel';
  make('menu-'+name+'-placeholder',menu);
 }
 const file=document.getElementById('dropdown-file'),view=document.getElementById('dropdown-view'),
   help=document.getElementById('dropdown-help');
 make('menu-new-tab',file);make('menu-save-file',file);
 make('menu-center-map',view);make('menu-reset-zoom',view);
 const title=make('help-title',help,'div');title.className='dropdown-section-title';
 make('btn-menu-tools',toolbar);make('btn-menu-help',toolbar);
 const separator=make('left-sep',toolbar,'div');separator.className='divider-v';
 const clipboard=make('clipboard-tools',toolbar,'div');clipboard.className='clipboard-tools';
 const separator2=make('right-sep',toolbar,'div');separator2.className='divider-v';
 for(const id of ['quick-icon-child','quick-icon-sibling','quick-icon-invert','quick-icon-center'])
  make(id,toolbar);
 const strip=make('v4-toolstrip',ribbon,'div');strip.className='v4-toolstrip';
 for(const id of ['btn-spotlight','btn-flashcards','nm62-toolbar-assets','btn-illustrate','btn-ai-settings'])
  make(id,strip);
 const nav=make('nm616-nav-disclosure',document.body,'details');
 const navPanel=make('nav-panel',nav,'div');navPanel.className='nm616-nav-card';
 for(const id of ['nm67-prev-main','nm67-next-main','nm69-nav-level','nm612-nav-order'])
  make(id,toolbar);
 const calls={};
 for(const id of ['btn-duplicate-tab','btn-shortcuts','nm7-guide-open','btn-fullscreen','nm616-zen-switch']){
  document.getElementById(id).addEventListener('click',()=>{calls[id]=(calls[id]||0)+1});
 }
 const root={document,neuroMapApp:{hideMenus(){calls.hide=(calls.hide||0)+1}}};
 root.globalThis=root;
 vm.runInNewContext(source,root);
 class App{bindUI(){this.bound=true}}
 root.NeuroMapTopbarCuration.install(App);
 const app=new App();app.bindUI();
 return {app,root,document,bar,toolbar,navPanel,help,file,view,calls};
}
test('only one original control per command; actions remain clickable after relocation',()=>{
 const f=harness(),get=id=>f.document.getElementById(id);
 assert.equal(get('btn-duplicate-tab').parentElement,f.file);
 assert.equal(get('btn-shortcuts').parentElement,f.help);
 for(const id of ['btn-flashcards'])
  assert.equal(get(id).parentElement.id,'dropdown-tools',id);
 for(const id of ['nm62-toolbar-assets','btn-illustrate'])assert.equal(get(id).parentElement.id,'v4-toolstrip','graphics are placed by the Insert panel, not the topbar curator');
 assert.equal(get('btn-ai-settings').parentElement.id,'v4-toolstrip');
 assert.equal(get('btn-spotlight').parentElement.id,'v4-toolstrip');
 assert.equal(get('nm7-guide-open').parentElement,f.help);
 assert.equal(get('nm616-zen-switch').parentElement,f.view);
 assert.equal(get('btn-fullscreen').parentElement,f.view);
 for(const id of ['btn-duplicate-tab','btn-shortcuts','nm7-guide-open','nm616-zen-switch','btn-fullscreen']){
  get(id).click();assert.equal(f.calls[id],1,id);
 }
 assert.equal(f.calls.hide,5);
 assert.equal(f.bar.children.filter(n=>n.id==='nm-orbit-command-trigger').length,0);
 assert.equal(f.document.getElementById('nm-orbit-command-trigger').parentElement.id,'gl-chrome-utilities');
});
test('advanced navigation moves into Explore without changing node or keyboard handlers',()=>{
 const f=harness();
 for(const id of ['nm67-prev-main','nm67-next-main','nm69-nav-level','nm612-nav-order'])
  assert.equal(f.document.getElementById(id).parentElement.id,'nm7-advanced-navigation');
 assert.equal(f.document.getElementById('quick-icon-child').parentElement,f.toolbar);
 assert.equal(f.document.getElementById('quick-icon-sibling').parentElement,f.toolbar);
});
test('duplicate clipboard/center/reverse actions are hidden but DOM buttons remain intact',()=>{
 const f=harness();
 for(const id of ['clipboard-tools','left-sep','right-sep','quick-icon-invert','quick-icon-center'])
  assert.equal(f.document.getElementById(id).classList.contains('nm7-duplicate-action'),true,id);
 assert.ok(f.document.getElementById('menu-save-file'));
 assert.ok(f.document.getElementById('menu-center-map'));
});
test('repeat bind is idempotent; moving a button never accumulates click handlers',()=>{
 const f=harness();f.app.bindUI();f.app.bindUI();
 for(const id of ['btn-fullscreen','nm616-zen-switch','btn-shortcuts','btn-duplicate-tab'])
  assert.equal(f.document.getElementById(id).events.click.length,2,id);
 assert.equal(f.help.children.filter(c=>c.id==='nm7-guide-open').length,1);
 assert.equal(f.navPanel.children.filter(c=>c.id==='nm7-advanced-navigation').length,1);
});
test('English labels update without changing IDs, active map or action handlers',()=>{
 const f=harness();f.document.documentElement.lang='en';f.root.NeuroMapTopbarCuration.curate();
 assert.equal(f.document.getElementById('btn-menu-help').textContent,'Help');
 assert.equal(f.document.getElementById('btn-menu-tools').textContent,'Tools');
 assert.equal(f.document.getElementById('btn-fullscreen').textContent,'Full screen');
 assert.equal(f.document.getElementById('nm616-zen-switch').textContent,'◈ Zen mode');
 assert.equal(f.document.getElementById('btn-duplicate-tab').textContent,'Duplicate tab');
});

test('narrow display dropdowns stay above wrapped status and use opaque backgrounds',()=>{
 assert.match(source,/\.toolbar-group\{[^}]*position:relative;z-index:75/);
 assert.match(source,/\.nm-status-actions\{position:relative;z-index:1/);
 assert.match(source,/\.toolbar-group \.dropdown-panel\{[^}]*background:var\(--nm-skin-surface,#[0-9a-f]{6}\)/);
 assert.match(source,/#status-selected-node\{[^}]*text-overflow:ellipsis;white-space:nowrap/);
 assert.match(source,/\.status-pill>span:last-child\{display:none\}/);
 assert.match(source,/#status-selected-side\{display:none\}/);
});

test('browser-style action grouping remains stable after repeated UI mounting',()=>{
 const f=harness(),get=id=>f.document.getElementById(id);
 assert.ok(get('gl-chrome-utilities'));
 assert.ok(get('gl-chrome-more'));
 assert.equal(get('nm-orbit-command-trigger').parentElement.id,'gl-chrome-utilities');
 const count=f.bar.children.filter(node=>node.id==='gl-chrome-utilities').length;
 f.app.bindUI();f.app.bindUI();
 assert.equal(f.bar.children.filter(node=>node.id==='gl-chrome-utilities').length,count);
 assert.equal(get('nm-orbit-command-trigger').parentElement.id,'gl-chrome-utilities');
});

test('late cloud, clock and recovery controls move intact beside the tab strip',()=>{
 const f=harness(),get=id=>f.document.getElementById(id);
 const controls=[];
 for(const id of ['gl-cloud-quick','gl-history-quick','glauka-save-indicator','gl-settings-quick']){
  const node=f.document.createElement('button');node.id=id;
  node.addEventListener('click',()=>controls.push(id));
  f.bar.append(node);
 }
 f.root.NeuroMapTopbarCuration.curate();
 const utilities=get('gl-chrome-utilities');
 const live=utilities.children.filter(node=>['nm-orbit-command-trigger','gl-history-quick','gl-cloud-quick','gl-settings-quick','glauka-save-indicator','gl-chrome-more'].includes(node.id)).map(n=>n.id);
 assert.deepEqual(live,['nm-orbit-command-trigger','gl-history-quick','gl-cloud-quick','gl-settings-quick','glauka-save-indicator','gl-chrome-more']);
 get('gl-cloud-quick').click();get('gl-history-quick').click();get('glauka-save-indicator').click();
 assert.deepEqual(controls,['gl-cloud-quick','gl-history-quick','glauka-save-indicator']);
 f.root.NeuroMapTopbarCuration.curate();
 assert.equal(f.bar.children.filter(x=>x.id==='gl-chrome-utilities').length,1);
});
