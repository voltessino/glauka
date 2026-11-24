'use strict';
// These are classic scripts in ONE shared lexical scope: splitting files must
// not introduce modules or change when the app hooks become active.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../../..');
const E=path.join(ROOT,'apps/desktop-shared/editor');
const get=name=>fs.readFileSync(path.join(E,name),'utf8');
const names=['layout-text-controls.js','layout-navigation.js','layout-tab-order.js'];

test('desktop layout responsibilities are isolated in 3 ordered classic scripts',()=>{
 const manifest=JSON.parse(get('sources.json'));
 const i=manifest.indexOf(names[0]);
 assert.ok(i>0);
 assert.deepEqual(manifest.slice(i,i+3),names);
 assert.equal(new Set(manifest).size,manifest.length);
 const android=JSON.parse(fs.readFileSync(path.join(ROOT,'apps/android/editor/sources.json'),'utf8'));
 for(const name of ['layout-text-controls.js','layout-tab-order.js'])
   assert.ok(!android.includes(name),'desktop-specific file leaked into Android: '+name);
 for(const name of names)
   assert.doesNotThrow(()=>new vm.Script(get(name)),'invalid independent classic script: '+name);
 assert.doesNotThrow(()=>new vm.Script(names.map(get).join('')),'bad combined lexical scope');
});
test('each module has the declared responsibility and preserves its DOM hooks',()=>{
 const [text,nav,tabs]=names.map(get);
 for(const method of ['nm68SelectedNodes','nm68SetTextAlign','nm68SetTextIndent','nm68ToggleBullets','nm68SetBranchGap']){
   assert.ok(text.includes('prototype.'+method),'missing text method '+method);
   assert.ok(!nav.includes('prototype.'+method)&&!tabs.includes('prototype.'+method));
 }
 for(const method of ['nm69NavigationLevel','nm69NodesAtLevel','nm67NavigateMain','nm69SwapSibling']){
   assert.ok(nav.includes('prototype.'+method),'missing navigation method '+method);
 }
 assert.ok(tabs.includes('prototype.nm69MoveTab'));
 assert.ok(tabs.includes('prototype.renderTabBar'));
 assert.ok(tabs.includes('prototype.v6SetOrigin'));
 assert.ok(tabs.includes('const nm69OldBindUI'));
});
function createRuntime(){
 class App{
   bindUI(){return 9}
   renderTabBar(){return 'rendered'}
   v6SetOrigin(){}
   closeEditor(){}
   markChanged(){this.changed=(this.changed||0)+1}
   showToast(){}
   selectNode(id){this.state.selectedNodeId=id}
   teleportToNode(id){(this.teleported||=[]).push(id)}
   saveActiveTabSnapshot(){}
   scheduleSave(){this.scheduled=(this.scheduled||0)+1}
 }
 const document={querySelectorAll:()=>[],getElementById:()=>null};
 const storage={getItem:()=>null,setItem(){}};
 const load=new Function('NeuroMapApp','document','localStorage','nm68ClampGap',
  names.map(get).join('')+'\nreturn NeuroMapApp;');
 return load(App,document,storage,value=>Number.isFinite(+value)?Math.max(30,Math.min(220,+value)):150);
}
function fixture(App){
 const root={id:'root',children:[]};
 const a={id:'a',parentId:'root',text:'alpha\nbeta',children:[]};
 const b={id:'b',parentId:'root',text:'beta',children:[]};
 const c={id:'c',parentId:'root',text:'gamma',children:[]};
 root.children=[a,b,c];
 const lookup=new Map([root,a,b,c].map(x=>[x.id,x]));
 const app=new App();
 app.state={root,selectedNodeId:'a',selectedNodeIds:['a','b'],branchGapX:100,
   findNode:id=>lookup.get(id),pushHistory(){app.history=(app.history||0)+1},
   normalizeChildrenOrder(){}};
 app.layout={getLayout:id=>id==='root'?{x:0,y:0}:({a:{x:100,y:1},b:{x:100,y:2},c:{x:100,y:3}}[id])};
 app.tabs=[{id:'one',state:{isDirty:true}},{id:'two',state:{isDirty:false}},{id:'three',state:{isDirty:true}}];
 return {app,root,a,b,c};
}
test('1,000 deterministic text, branch navigation and tab-order operations retain undo/dirty semantics',()=>{
 const App=createRuntime();
 for(let iteration=0;iteration<250;iteration++){
   const {app,root,a,b,c}=fixture(App);
   app.nm68SetTextAlign('left');
   app.nm68SetTextIndent(100);
   app.nm68ToggleBullets();
   assert.equal(a.labelAlign,'left');
   assert.equal(b.labelIndent,45);
   assert.ok(a.text.startsWith('• '));
   app.nm68ToggleBullets();
   assert.equal(a.text,'alpha\nbeta');
   app.nm68SetBranchGap(1000);
   assert.equal(app.state.branchGapX,220);
   assert.equal(app.history,5);
   app.state.selectedNodeIds=[];
   app.state.selectedNodeId='root';
   app._nm69NavLevel=1;
   assert.equal(app.nm67NavigateMain(1),true);
   assert.equal(app.nm67NavigateMain(1),true);
   assert.deepEqual(app.teleported,['a','b']);
   app.state.selectedNodeId='b';
   assert.equal(app.nm69SwapSibling(1),true);
   assert.deepEqual(root.children.map(n=>n.id),['a','c','b']);
   assert.equal(app.nm69MoveTab('one','three',false),true);
   assert.deepEqual(app.tabs.map(t=>t.id),['two','one','three']);
   assert.deepEqual(app.tabs.map(t=>t.state.isDirty),[false,true,true]);
   assert.equal(app.scheduled,1);
 }
});
