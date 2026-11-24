'use strict';
/* 2026-11-01: conservative cross-platform OPML regression gate.
 * This executes the actual I/O classes with a fake download bridge.
 * It does NOT claim to test APK, EXE, DMG or native dialogs.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const platforms=['desktop-shared','android'];
const sources=platforms.map(p=>fs.readFileSync(
 path.join(root,'apps',p,'editor','io.js'),'utf8'));
const Core=require('../../map-core');
const classes=sources.map(s=>new Function('NeuroMapCore',s+'\nreturn MindMapIOManager;')(Core));
const messages=[];
function freshIO(K,tree,download){
 const events=[];
 const io=new K({state:{root:tree},showToast:(msg,label)=>events.push({msg,label})});
 io.triggerDownload=download;
 return {io,events};
}
function decode(value){
 const map={lt:'<',gt:'>',quot:'"',apos:"'",amp:'&'};
 return value.replace(/&(lt|gt|quot|apos|amp);/g,(_,key)=>map[key]);
}
function parseOutline(xml){
 assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
 assert.ok(xml.includes('<opml version="2.0">'));
 assert.ok(xml.trimEnd().endsWith('</opml>'));
 const tokens=xml.match(/<\/?outline\b[^>]*>/g)||[];
 const roots=[],stack=[];
 for(const token of tokens){
  if(token==='</outline>'){
   assert.ok(stack.length>0,'unexpected closing outline');
   stack.pop();
   continue;
  }
  const m=/^<outline text="([^"]*)"\s*(\/?)>$/.exec(token);
  assert.ok(m,'unsupported outline structure: '+token.slice(0,100));
  const value={text:decode(m[1]),children:[]};
  if(stack.length)stack[stack.length-1].children.push(value);
  else roots.push(value);
  if(!m[2])stack.push(value);
 }
 assert.equal(stack.length,0,'unclosed outlines');
 assert.equal(roots.length,1,'exactly one root outline required');
 return roots[0];
}
function canonical(node){
 return {text:String(node.text),children:(node.children||[]).map(canonical)};
}
const samples=['Root <A>','A & B','\'Quote\'','"Double"','Cuore ♥',
 'Neurone 🧠','è à ù','', '<> & ""', 'Albero'];
let seed=0x1462ca1;
function rnd(){
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 return seed/4294967296;
}
function treeForRound(round){
 const name=n=>samples[Math.floor(rnd()*samples.length)]+String(n);
 const root={text:name(round),children:[]};
 const stack=[{node:root,depth:0}];
 let created=0;
 while(stack.length&&created<55){
  const {node,depth}=stack.pop();
  const branches=depth>=9?0:Math.floor(rnd()*4);
  for(let j=0;j<branches&&created<55;j++){
   const child={text:name(created++),children:[]};
   node.children.push(child);
   stack.push({node:child,depth:depth+1});
  }
 }
 return root;
}
test('600 deterministic map variations preserve every concept, parent and order',async()=>{
 for(let i=0;i<600;i++){
  const tree=treeForRound(i),expected=canonical(tree),xml=[];
  for(const K of classes){
   let blob,filename;
   const {io}=freshIO(K,tree,(b,name)=>{blob=b;filename=name;return true;});
   assert.equal(io.exportOPML(),true);
   assert.ok(blob,'export must produce a file');
   assert.match(filename,/\.opml$/);
   const content=await blob.text();
   assert.deepEqual(parseOutline(content),expected,'structure changed at map '+i);
   xml.push(content);
  }
  assert.equal(xml[0],xml[1],'cross-platform OPML differs at map '+i);
 }
});
test('both platforms remove XML-forbidden control characters',async()=>{
 const tree={text:'X\u0001Y\u0002Z',children:[]};
 for(const K of classes){
  let blob;const {io}=freshIO(K,tree,b=>{blob=b;return true;});
  assert.equal(io.exportOPML(),true);
  const xml=await blob.text();
  assert.ok(!xml.includes('\u0001')&&!xml.includes('\u0002'));
  assert.equal(parseOutline(xml).text,'XYZ');
 }
});
test('cancel and asynchronous storage rejection never claim a completed export',async()=>{
 const tree={text:'Map',children:[]};
 for(const K of classes){
  for(const [download,expected] of [
    [()=>false,false],
    [()=>Promise.resolve(false),false],
    [()=>Promise.reject(Error('storage full')),false],
    [()=>Promise.resolve(true),true],
  ]){
   const {io,events}=freshIO(K,tree,download);
   assert.equal(await io.exportOPML(),expected);
   const hasSuccess=events.some(e=>e.label==='EXPORT OPML');
   assert.equal(hasSuccess,expected,'false success notification');
  }
 }
});
test('a corrupt root must not be exported or marked as saved',()=>{
 for(const K of classes){
  const {io,events}=freshIO(K,null,()=>{throw Error('must not download');});
  assert.throws(()=>io.exportOPML(),/Nessuna mappa da esportare/);
  assert.equal(events.length,0);
 }
});

test('shared serializer retains the original pre-extraction bytes and never mutates documents',async()=>{
 const fixtures=require('./fixtures/opml-original-20261102.json');
 for(const {tree,xml} of fixtures){
  const before=JSON.stringify(tree);
  assert.equal(Core.serializeOPML(tree),xml);
  for(const K of classes){
   let blob;const {io}=freshIO(K,tree,b=>{blob=b;return true});
   assert.equal(io.exportOPML(),true);assert.equal(await blob.text(),xml);
  }
  assert.equal(JSON.stringify(tree),before);
 }
});
