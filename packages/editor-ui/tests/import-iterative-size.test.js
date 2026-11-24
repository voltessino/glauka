'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/layout-menu-import.js'),'utf8');
const start=src.indexOf('const NM613 = {'),end=src.indexOf('\n};',start);
assert.ok(start>=0&&end>start);
const NM613=new Function(src.slice(start,end+3)+'\nreturn NM613;')();
function count(root){let n=0,stack=[root];while(stack.length){const x=stack.pop();n++;stack.push(...(x.children||[]));}return n;}
test('wide 5000-node import respects cap and preserves order',()=>{
 const root={text:'root',children:Array.from({length:5000},(_,i)=>({text:String(i),children:[]}))};
 const pages=NM613.split(root,125);
 assert.deepEqual(pages.flatMap(p=>p.children.map(c=>c.text)),root.children.map(c=>c.text));
 for(const page of pages)assert.ok(count(page)<=125);
});
test('branching subtree sizes preserve all nodes without unexpected duplication',()=>{
 const root={text:'root',children:Array.from({length:20},(_,i)=>({text:'branch'+i,children:Array.from({length:20},(_,j)=>({text:i+':'+j,children:[]}))}))};
 const pages=NM613.split(root,125);
 const values=new Set();
 for(const p of pages){
   assert.ok(count(p)<=125);
   for(const b of p.children)for(const leaf of b.children)values.add(leaf.text);
 }
 assert.equal(values.size,400);
});
