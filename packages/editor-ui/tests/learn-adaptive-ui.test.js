'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const L=require('../../../apps/desktop-shared/editor/learn-core');
const A=require('../../../apps/desktop-shared/editor/learn-adaptive-core');
const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/learn-adaptive-ui.js'),'utf8');
class E {
 constructor(tag='div',text=''){this.tag=tag;this.children=[];this.handlers={};this.textContent=text;
  this.attributes={};this.value='';this.hidden=false;this.disabled=false;this.type='';this.parent=null;}
 append(...xs){for(const x of xs){x.parent=this;this.children.push(x)}}
 replaceChildren(...xs){this.children=[];this.append(...xs)}
 setAttribute(a,b){this.attributes[a]=b}
 addEventListener(event,cb){(this.handlers[event]??=[]).push(cb)}
 click(){for(const cb of this.handlers.click||[])cb()}
 focus(){}
}
const create=(tag,cls,text)=>{const e=new E(tag,text||'');e.className=cls||'';return e};
const button=(name,callback,parent)=>{const e=create('button','',name);e.addEventListener('click',callback);parent.append(e);return e};
const find=(root,term)=>{const nodes=[root];while(nodes.length){const n=nodes.shift();if(n.tag==='button'&&n.textContent===term)return n;nodes.push(...n.children)}return null};
function fixture(){
 const root={id:'r',text:'Study',children:[
  {id:'a',text:'Heart',notes:'Pumps',children:[]},
  {id:'b',text:'Liver',children:[]},
  {id:'c',text:'Kidney',children:[]}]};
 const global={NeuroMapAdaptiveCore:A};new Function('globalThis',source)(global);
 const attempts=[L.addAttempt([],{tabId:'t',nodeId:'a',itemId:'q',format:'open',
  correct:false,sourceSignature:'Heart'},1730000000000)[0]];
 const status=create('p'),intro=create('p'),body=create('div'),controls=create('div');
 const app={activeTabId:'t',learningAttempts:attempts,learningPlans:[],
  studyCards:[],state:{root,isDirty:false},renderer:{_nmAdaptiveBadges:null},
  requested:0,saved:0,rendered:0,
  requestRender(){this.requested++},scheduleSave(){this.saved++},
  renderTabBar(){this.rendered++},v5Signature:n=>n.text,
  v5Staleness:()=> 'fresh',teleportToNode(){return true}};
 const params={app,body,controls,intro,status,button:(name,fn,parent=controls)=>button(name,fn,parent),
  tr:(it,en)=>it,el:create,scopeId:()=>root.id};
 return {params,app,global,body,controls,status,root};
}
test('Radar shows only recorded mistakes and user can toggle visual overlays',()=>{
 const {params,app,global,body,controls,root}=fixture();
 const original=JSON.stringify(root);
 global.NeuroMapAdaptiveUI.render({...params,mode:'radar'});
 assert.ok(params.status.textContent.includes('1 errori'));
 assert.ok(find(body,'Vai al nodo'));
 find(controls,'Evidenzia errori sulla mappa').click();
 assert.equal(app.renderer._nmAdaptiveBadges.get('a').mistakes,1);
 assert.equal(app.renderer._nmAdaptiveBadges.has('b'),false);
 find(controls,'Nascondi indicatori').click();
 assert.equal(app.renderer._nmAdaptiveBadges,null);
 assert.equal(JSON.stringify(root),original);
 assert.equal(app.saved,0);
});
test('Exam planner saves one scoped plan, leaves quiz and map data unchanged',()=>{
 const {params,app,global,controls,body,root}=fixture();
 const original=JSON.stringify([root,app.learningAttempts]);
 global.NeuroMapAdaptiveUI.render({...params,mode:'planner'});
 const labels=body.children[0].children;
 const date=labels[0].children[0],minutes=labels[1].children[0];
 date.value='2027-06-21';minutes.value='40';
 find(controls,'Salva piano').click();
 assert.equal(app.learningPlans.length,1);
 assert.equal(app.learningPlans[0].examDate,'2027-06-21');
 assert.equal(app.learningPlans[0].minutesPerDay,40);
 assert.equal(app.saved,1);
 assert.equal(app.state.isDirty,true);
 assert.equal(JSON.stringify([root,app.learningAttempts]),original);
});
test('invalid planner input never overwrites saved valid plan',()=>{
 const {params,app,global,controls,body,status}=fixture();
 app.learningPlans=A.setPlan([],{
  tabId:'t',examDate:'2027-01-22',minutesPerDay:35},1730000000000);
 const previous=JSON.stringify(app.learningPlans);
 global.NeuroMapAdaptiveUI.render({...params,mode:'planner'});
 const fields=body.children[0].children;
 fields[0].children[0].value='2026-02-30';
 find(controls,'Salva piano').click();
 assert.equal(JSON.stringify(app.learningPlans),previous);
 assert.equal(app.saved,0);
 assert.ok(status.textContent.length>4);
});
test('adaptive draw wrapper paints temporary error badges and skips exports',()=>{
 const {params,app,global}=fixture();
 const report=A.radar(app.state.root,{tabId:'t',attempts:app.learningAttempts,
  signatureFor:n=>n.text});
 let n=0;
 class Renderer{
  drawNode(){n++}
  constructor(){
   this.layout={getLayout:()=>({x:10,y:20,width:60,height:30})};
   this.ctx={save(){},restore(){},beginPath(){},arc(){},fill(){},stroke(){},fillText(){n++}};
   this._nmAdaptiveBadges=new Map(report.nodes.filter(x=>x.mistakes).map(x=>[x.nodeId,x]));
  }
 }
 global.NeuroMapAdaptiveUI.install(function App(){},Renderer);
 const renderer=new Renderer();
 renderer.drawNode(app.state.root.children[0]);
 assert.equal(n,2);
 renderer._nmNavExport=true;
 renderer.drawNode(app.state.root.children[0]);
 assert.equal(n,3);
 global.NeuroMapAdaptiveUI.clearBadges({renderer,requestRender(){}});
 assert.equal(renderer._nmAdaptiveBadges,null);
});
