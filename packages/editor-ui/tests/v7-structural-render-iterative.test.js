'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const rendererSource=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/renderer.js'),'utf8');
const Renderer=new Function('window','imageCache','ColorUtils',
 rendererSource+'\nreturn OrganicCanvasRenderer;')(
 {innerWidth:1200,innerHeight:800,devicePixelRatio:1},new Map(),
 {rgba:(color)=>color});
function fixture(root){
 const titles=[],brackets=[],events=[],views=new Map();
 const stack=[root];let i=0;
 while(stack.length){
  const node=stack.pop(),row=i++;
  views.set(node.id,{x:row*15,y:row*5,width:80,height:30,
   bracketGeom:node.isSummary?{dir:1,baseX:100+row,tipX:130+row,
    minY:row*4,maxY:row*4+40,midY:row*4+20}:null});
  for(let j=(node.children?.length||0)-1;j>=0;j--)stack.push(node.children[j]);
 }
 const ctx=new Proxy({globalAlpha:1,measureText:text=>({width:String(text).length*8}),
  fillText:value=>{if(String(value).startsWith('B:'))titles.push(value);}},
 {get(obj,key){return key in obj?obj[key]:(...args)=>{
    events.push(String(key));if(key==='moveTo')brackets.push(args[1]);
   };},set(obj,key,v){obj[key]=v;return true;}});
 const renderer=Object.create(Renderer.prototype);
 renderer.layout={getLayout:id=>views.get(id),getSubtreeBoundingBox:node=>{
  const m=views.get(node.id);return {minX:m.x-40,minY:m.y-15,
   width:80,height:30,maxX:m.x+40,maxY:m.y+15};
 }};
 renderer.ctx=ctx;renderer.state={strokeScale:1};renderer.camera={zoom:1};
 renderer.navOpacity=()=>1;renderer.roundRectPath=()=>{};
 return {renderer,titles,brackets,events,views};
}
const walkBoundaries=(node,result)=>{
 if(node.boundary?.enabled)result.push('B:'+node.id);
 if(!node.collapsed)for(const child of node.children||[])walkBoundaries(child,result);
};
const walkSummaries=(node,result)=>{
 if(!node||node.collapsed)return;
 for(const child of node.children||[]){
  if(child.isSummary)result.push(child.id);
  walkSummaries(child,result);
 }
};
test('iterative boundary layers reproduce depth-first paint order for normal/summary/collapsed branches',()=>{
 const root={id:'root',boundary:{enabled:true,title:'B:root'},children:[
  {id:'a',boundary:{enabled:true,title:'B:a'},children:[
   {id:'s',isSummary:true,boundary:{enabled:true,title:'B:s'},children:[]},
   {id:'b',boundary:{enabled:true,title:'B:b'},children:[]}]},
  {id:'collapsed',collapsed:true,boundary:{enabled:true,title:'B:collapsed'},
   children:[{id:'hidden',boundary:{enabled:true,title:'B:hidden'},children:[]}]},
  {id:'tail',boundary:{enabled:true,title:'B:tail'},children:[]}
 ]};
 const expected=[];walkBoundaries(root,expected);
 const f=fixture(root);f.renderer.drawBoundariesRecursive(root);
 assert.deepEqual(f.titles,expected);
 assert.equal(f.titles.includes('B:hidden'),false);
});
test('summary brackets preserve exact paint order through nested summaries',()=>{
 const root={id:'root',children:[
  {id:'main',children:[{id:'s1',isSummary:true,children:[
   {id:'s2',isSummary:true,children:[]}]},
   {id:'ordinary',children:[{id:'s3',isSummary:true,children:[]}]}]},
  {id:'folded',collapsed:true,children:[{id:'hidden',isSummary:true,children:[]}]},
  {id:'s4',isSummary:true,collapsed:true,children:[]}
 ]};
 const f=fixture(root),expected=[];walkSummaries(root,expected);
 const ids=[...f.views.entries()].filter(([id,v])=>v.bracketGeom)
   .map(([id,v])=>[v.bracketGeom.minY,id]);
 const visible=f.renderer.drawSummariesRecursive(root);
 const actual=f.brackets.filter((_,i)=>i%2===0).map(y=>ids.find(([n])=>n===y)?.[1]);
 assert.deepEqual(actual,expected);
 assert.equal(f.events.filter(e=>e==='stroke').length,expected.length*2);
});
test('22,000 levels and 44 summary brackets render without recursive stack exhaustion',()=>{
 const root={id:'root',children:[]};let node=root;
 for(let i=0;i<22000;i++){
  const child={id:'deep-'+i,children:[]};
  if(i%500===0){child.isSummary=true;child.color='#10b981';}
  if(i%5000===0)child.boundary={enabled:true,title:'B:'+i};
  node.children=[child];node=child;
 }
 const f=fixture(root);
 f.renderer.drawSummariesRecursive(root);
 assert.equal(f.events.filter(e=>e==='stroke').length,44*2);
 f.renderer.drawBoundariesRecursive(root);
 assert.equal(f.titles.length,5);
});
test('repeated structural draws leave original map and styles untouched',()=>{
 const root={id:'root',text:'神経 · العربية 🧠',children:[
  {id:'a',text:'Árbol',boundary:{enabled:true,title:'B:á'},children:[
   {id:'s',isSummary:true,text:'خلاصة',children:[]}]}]};
 const before=JSON.stringify(root),f=fixture(root);
 for(let i=0;i<30;i++){
  f.renderer.drawBoundariesRecursive(root);
  f.renderer.drawSummariesRecursive(root);
 }
 assert.equal(JSON.stringify(root),before);
});
