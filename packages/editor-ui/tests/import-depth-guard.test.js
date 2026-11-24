'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=['layout-audit-import.js','layout-menu-import.js'].map(name=>
  fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor',name),'utf8')).join('\n');
function extract(name){
  const start=source.indexOf('const '+name+' = {');
  assert.ok(start>=0,name+' missing');
  const end=source.indexOf('\n};',start);
  assert.ok(end>start,name+' incomplete');
  return source.slice(start,end+3);
}
const {NM611,NM613}=new Function(extract('NM611')+'\n'+extract('NM613')+'\nreturn {NM611,NM613};')();
function chain(length){
  const root={text:'root',children:[]};let node=root;
  for(let i=1;i<length;i++){const child={text:'n'+i,children:[]};node.children.push(child);node=child;}
  return root;
}
function countIterative(root){let total=0;const stack=[root];while(stack.length){const node=stack.pop();total++;stack.push(...(node.children||[]));}return total;}
test('deep outline count does not overflow JavaScript stack',()=>{
  assert.equal(NM611.count(chain(15000)),15000);
});
test('import pagination respects capacity and rejects unrepresentable depth',()=>{
  const exact=NM613.split(chain(125),125);
  assert.equal(exact.length,1);
  assert.equal(countIterative(exact[0]),125);
  assert.throws(()=>NM613.split(chain(126),125),/Gerarchia troppo profonda/);
});
test('cyclic trees fail with controlled errors',()=>{
  const root={text:'cycle',children:[]};root.children.push(root);
  assert.throws(()=>NM611.count(root),/circolare/);
  assert.throws(()=>NM613.split(root,125),/circolare/);
});
test('wide imported outline remains paginated and ordered',()=>{
  const root={text:'root',children:Array.from({length:5000},(_,i)=>({text:'n'+i,children:[]}))};
  const pages=NM613.split(root,125);
  assert.ok(pages.length>1);
  const labels=pages.flatMap(p=>p.children.map(c=>c.text));
  assert.deepEqual(labels,root.children.map(c=>c.text));
  for(const page of pages)assert.ok(countIterative(page)<=125);
});
