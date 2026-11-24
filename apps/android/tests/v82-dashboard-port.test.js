const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const D=require('../../desktop-shared/editor/dashboard-core.js');
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.listeners={};this.textContent='';this.disabled=false}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=[...nodes]}
 addEventListener(type,fn){this.listeners[type]=fn}
 setAttribute(name,value){this[name]=value}
 fire(type){this.listeners[type]?.({target:this,stopPropagation(){},preventDefault(){}})}
 focus(){}
}
function fixture(){
 const document={
  documentElement:{lang:'it'},
  head:new Element('head'),
  body:new Element('body'),
  createElement:tag=>new Element(tag),
  getElementById:()=>null
 };
 const context={document,NeuroMapDashboard82:D};
 const src=fs.readFileSync(path.join(__dirname,'../../desktop-shared/editor/dashboard-ui.js'),'utf8');
 vm.runInNewContext(src,context);
 const host=new Element('host');
 const a={id:'a',state:{root:{id:'root',text:'root',children:[
  {id:'p',text:'Progetto <script>alert(1)</script>',taskStatus:'doing',dueDate:'2026-10-20',
   knowledge:{tags:['Progetto']},children:[]}]},findNode(id){return this.root.children.find(n=>n.id===id)||null}}};
 const b={id:'b',state:{root:{id:'other',text:'other',children:[
  {id:'today',text:'Ripasso',dueDate:D.localDay(),children:[]}]},
  findNode(id){return this.root.children.find(n=>n.id===id)||null}}};
 const nav=[];
 const app={tabs:[a,b],activeTabId:'a',activateTab(id){nav.push('tab:'+id);this.activeTabId=id},
  selectNode(id){nav.push('node:'+id)},teleportToNode(id,tab){nav.push('teleport:'+tab+'/'+id)}};
 return {document,context,host,app,nav};
}
function all(node){return [node,...node.children.flatMap(all)]}
test('Android dashboard renders actual open-map counts without mutation',()=>{
 const f=fixture(),before=JSON.stringify(f.app.tabs);
 const session=f.context.NeuroMapDashboardUI82.renderInto(f.host,f.app,{compact:true});
 assert.equal(session.hasUnsaved(),false);
 const cards=all(f.host).filter(x=>x.className==='nm82-card');
 assert.ok(cards.length>=10);
 assert.equal(JSON.stringify(f.app.tabs),before);
 assert.ok(all(f.host).some(x=>x.textContent.includes('<script>')));
});
test('navigation resolves original tab and node, never copies it',()=>{
 const f=fixture();let closed=0;
 f.context.NeuroMapDashboardUI82.renderInto(f.host,f.app,{compact:true,onNavigate:()=>closed++});
 const button=all(f.host).find(x=>x.tagName==='button'&&x.textContent.startsWith('Ripasso'));
 assert.ok(button);button.fire('click');
 assert.deepEqual(f.nav,['tab:b','node:today','teleport:b/today']);
 assert.equal(closed,1);
});
test('refresh uses current live map data',()=>{
 const f=fixture();
 const session=f.context.NeuroMapDashboardUI82.renderInto(f.host,f.app,{compact:true});
 f.app.tabs[0].state.root.children.push({id:'new',text:'Nuovo',dueDate:D.localDay(),children:[]});
 session.refresh();
 const buttons=all(f.host).filter(x=>x.tagName==='button');
 assert.ok(buttons.some(x=>x.textContent.startsWith('Nuovo')));
});
test('malformed reference date is visible and never silently substituted',()=>{
 const f=fixture();
 f.context.NeuroMapDashboardUI82.renderInto(f.host,f.app,{compact:true});
 const input=all(f.host).find(x=>x.tagName==='input');input.value='2026-02-30';input.fire('change');
 assert.ok(all(f.host).some(x=>String(x.textContent).includes('explicit valid local date')));
});
test('Android source registers dashboard and offline packaging',()=>{
 const mobile=fs.readFileSync(path.join(__dirname,'../native/app/src/main/assets/assets/mobile-74.js'),'utf8');
 const prepare=fs.readFileSync(path.join(__dirname,'../../../scripts/release/prepare.py'),'utf8');
 const sources=JSON.parse(fs.readFileSync(path.join(__dirname,'../../desktop-shared/editor/sources.json'),'utf8'));
 assert.match(mobile,/\[\s*['"]dashboard['"],\s*['"]▥['"]/);
 assert.match(mobile,/NeuroMapStudioToolsEnsure/);
 assert.match(mobile,/NeuroMapDashboardUI82\.renderInto\(content,\s*a,\s*\{\s*compact:\s*true/);
 assert.match(prepare,/'dashboard-core'/);
 assert.match(prepare,/'dashboard-ui'/);
 assert.match(prepare,/studio_ui_modules/);
 assert.ok(sources.indexOf('dashboard-core.js')>sources.indexOf('knowledge-db-core.js'));
 assert.ok(sources.indexOf('dashboard-ui.js')>sources.indexOf('dashboard-core.js'));
});