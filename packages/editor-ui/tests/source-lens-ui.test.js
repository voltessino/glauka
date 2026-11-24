'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Source=require('../../../apps/desktop-shared/editor/source-lens-core.js');
const script=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/source-lens-ui.js'),'utf8');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.style={};this.attributes={};
  this.value='';this.textContent='';this.type='';this.files=[];this.disabled=false;this.hidden=false;
  this.parent=null;}
 append(...children){for(const item of children){if(!item)continue;item.parent=this;this.children.push(item);
   if(this.tag==='select'&&item.tag==='option'&&!this.value)this.value=item.value}}
 replaceChildren(...children){this.children=[];this.append(...children)}
 addEventListener(name,callback){(this.listeners[name]??=[]).push(callback)}
 setAttribute(name,value){this.attributes[name]=value}
 querySelector(name){const queue=[this];while(queue.length){const item=queue.shift();
  if(item.tag===name)return item;queue.push(...item.children)}return null}
 click(){} focus(){}
}
function descendant(root,pred){
 const queue=[root];while(queue.length){const node=queue.shift();if(pred(node))return node;
  queue.push(...node.children)}return null;
}
function fixture(){
 const document={documentElement:{lang:'it'},head:new Element('head'),
  createElement:tag=>new Element(tag),getElementById:()=>null};
 const session={NeuroMapSourceCore:Source,addEventListener(){},open(){}};
 new Function('globalThis','document','URL',script)(session,document,
  {createObjectURL:()=> 'blob:fake',revokeObjectURL(){}});
 const node={id:'node',text:'Kidney',children:[],sourceRefs:[]};
 const state={root:node,selectedNodeId:'node',histories:[],findNode(id){return id==='node'?node:null},
  pushHistory(){this.histories.push(JSON.stringify(node))}};
 const app={state,activeTabId:'tab',tabs:[{id:'tab',state}],layout:{},changes:0,
  markChanged(){this.changes++},selectNode(){},showToast(){}};
 const scroll=new Element('div'),status=new Element('div'),tools=new Element('div');
 let refreshed=0;
 session.NeuroMapSourceUI.draw({app,scroll,status,tools,request(){refreshed++}});
 return {node,state,app,scroll,session,refreshed:()=>refreshed,
  kind:()=>descendant(scroll,n=>n.tag==='select'),
  excerpt:()=>descendant(scroll,n=>n.tag==='textarea'),
  button:name=>descendant(scroll,n=>n.tag==='button'&&n.textContent.includes(name))};
}
async function tick(){for(let i=0;i<15;i++)await Promise.resolve()}
test('1000 Source Lens panels add text citations to only the selected logical node',async()=>{
 for(let user=0;user<1000;user++){
  const f=fixture(),kind=f.kind();kind.value='text';kind.listeners.change[0]();
  f.excerpt().value='Evidence for '+user;
  f.button('Collega').listeners.click[0]();await tick();
  assert.equal(f.node.sourceRefs.length,1);
  assert.equal(f.node.sourceRefs[0].quote,'Evidence for '+user);
  assert.equal(f.state.histories.length,1);
  assert.equal(f.app.changes,1);
 }
});
test('changing tabs before citation confirmation cannot mutate another document',async()=>{
 const f=fixture(),other={id:'node',text:'Different',sourceRefs:[]};
 f.app.tabs.push({id:'new',state:{root:other,findNode:()=>other}});
 f.app.state=f.app.tabs[1].state;f.app.activeTabId='new';
 f.kind().value='text';f.excerpt().value='must not cross';
 f.button('Collega').listeners.click[0]();await tick();
 assert.equal(f.node.sourceRefs.length,0);
 assert.equal(other.sourceRefs.length,0);
});
test('creating a child from an excerpt uses one existing history snapshot',async()=>{
 const f=fixture();
 f.state.addChildNode=function(id){
  if(id!==f.node.id)return null;
  this.pushHistory();const child={id:'created',text:'',notes:'',sourceRefs:[],children:[]};
  this.root.children.push(child);return child;
 };
 f.kind().value='text';f.excerpt().value='Sodium potassium exchanger';
 f.button('Crea figlio').listeners.click[0]();await tick();
 assert.equal(f.node.children.length,1);
 assert.equal(f.node.children[0].sourceRefs.length,1);
 assert.equal(f.node.children[0].text,'Sodium potassium exchanger');
 assert.equal(f.state.histories.length,1);
});
