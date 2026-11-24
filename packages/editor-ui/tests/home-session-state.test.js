'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/shell-home.js'),'utf8');
const start=source.indexOf(' const isPlaceholder=app=>');
const end=source.indexOf(' function renderHome(){',start);
assert.ok(start>=0&&end>start,'Home state handling is present');
const HOME_VIEWS=[
 ['mindmap','Mappa mentale','Mind map'],['orgchart','Organigramma','Organization chart'],
 ['concept-tree','Albero concettuale','Concept tree'],['concept-network','Rete concettuale','Concept network'],
 ['flowchart','Flusso di lavoro','Workflow'],['kanban','Bacheca Kanban','Kanban board'],
 ['timeline','Linea del tempo','Timeline']
];
const window={neuroMapApp:null,NeuroMapViewCore:{mode:m=>HOME_VIEWS.some(x=>x[0]===m)?m:'mindmap'}};
let finished=0;
const factory=new Function('window','HOME_VIEWS','nmLocale','finish',
  source.slice(start,end)+'\nreturn {isPlaceholder,createFromHome};');
const {createFromHome}=factory(window,HOME_VIEWS,()=> 'it',()=>{finished++});
const initial=(title='Mappa Centrale',dirty=false)=>({root:{text:title,children:[{id:'existing-data'}]},isDirty:dirty});
function app(state,opts={}){
 return {state,tabs:[{id:'tab1',state,title:state.root.text}],renderer:{state},_desktopRecoveryPending:false,
 _nmInitialWorkspaceRestored:false,_desktopUserEdited:false,_nmHomePlaceholder:true,...opts,
 newState:title=>({root:{text:title,viewMode:'mindmap',children:[]},isDirty:false}),
 closeEditor(){},saveActiveTabSnapshot(){},addTab(next,title){
  this.tabs.push({id:'tab'+(this.tabs.length+1),state:next,title});this.state=next;this.renderer.state=next;
 },recalculateAndRender(){},fitToScreen(){},renderTabBar(){},scheduleSave(){}};
}
test('first-run new organigram replaces only the pristine starter',()=>{
 window.neuroMapApp=app(initial());
 createFromHome('orgchart');
 assert.equal(window.neuroMapApp.tabs.length,1);
 assert.equal(window.neuroMapApp.state.root.viewMode,'orgchart');
 assert.equal(window.neuroMapApp.renderer.state,window.neuroMapApp.state);
});
test('restored and edited tabs cannot be replaced by the project chooser',()=>{
 for(const opts of [{_nmInitialWorkspaceRestored:true},{_desktopUserEdited:true}]){
  const original=initial('Mappa Centrale');
  window.neuroMapApp=app(original,{_nmHomePlaceholder:false,...opts});
  createFromHome('timeline');
  assert.equal(window.neuroMapApp.tabs.length,2);
  assert.equal(window.neuroMapApp.tabs[0].state,original);
  assert.equal(window.neuroMapApp.tabs[0].state.root.children[0].id,'existing-data');
 }
});
test('native recovery pending blocks destructive project creation',()=>{
 const original=initial('Recovering');
 window.neuroMapApp=app(original,{_desktopRecoveryPending:true});
 createFromHome('kanban');
 assert.equal(window.neuroMapApp.tabs.length,1);
 assert.equal(window.neuroMapApp.state,original);
});
test('intentional empty placeholder after final-tab close is reused',()=>{
 window.neuroMapApp=app({root:{text:'Nuova Mappa',children:[]},isDirty:false},{_nmHomePlaceholder:true});
 createFromHome('concept-tree');
 assert.equal(window.neuroMapApp.tabs.length,1);
 assert.equal(window.neuroMapApp.state.root.viewMode,'concept-tree');
});

test('a saved project named Mappa Centrale is never mistaken for the starter tab',()=>{
 const existing=initial('Mappa Centrale');
 window.neuroMapApp=app(existing,{_nmHomePlaceholder:false,
  _nmInitialWorkspaceRestored:true});
 createFromHome('kanban');
 assert.equal(window.neuroMapApp.tabs.length,2);
 assert.equal(window.neuroMapApp.tabs[0].state,existing);
});
test('a file-backed tab cannot be recycled even if flagged provisionally',()=>{
 const existing=initial('Mappa Centrale');
 window.neuroMapApp=app(existing,{_nmHomePlaceholder:true});
 window.neuroMapApp.tabs[0].filePath='C:/Users/Project.neuromap';
 createFromHome('timeline');
 assert.equal(window.neuroMapApp.tabs.length,2);
 assert.equal(window.neuroMapApp.tabs[0].state,existing);
});
