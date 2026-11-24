'use strict';
// I/O is a single class per platform. Before any class extraction, protect the
// critical import/export behavior with real method execution (no browser UI).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const sources=['apps/desktop-shared/editor/io.js','apps/android/editor/io.js']
 .map(p=>fs.readFileSync(path.join(root,p),'utf8'));
const Core=require('../../map-core');
const classes=sources.map(s=>new Function('NeuroMapCore',s+'\nreturn MindMapIOManager;')(Core));
const method=src=>{
 const begin=src.indexOf('      exportOPML() {');
 const end=src.indexOf('      buildSerializedProjectPayload() {',begin);
 assert.ok(begin>=0&&end>begin,'OPML must stay part of the public I/O interface');
 return src.slice(begin,end);
};
const fixture=(Class,root)=>{
 const messages=[],uploads=[];
 const io=new Class({state:{root},showToast:(...args)=>messages.push(args)});
 io.triggerDownload=(blob,filename)=>{uploads.push({blob,filename});return true};
 return {io,messages,uploads};
};
const chain=depth=>{
 const root={text:'Root <&>',children:[]};
 let at=root;
 for(let i=0;i<depth;i++){
  const child={text:'N'+i,children:[]};at.children.push(child);at=child;
 }
 return root;
};
test('desktop and Android use the same iterative, bounded-depth OPML serializer',()=>{
 assert.equal(method(sources[0]),method(sources[1]),
  'Cross-platform OPML must never silently revert to Android recursion');
 assert.doesNotMatch(method(sources[1]),/walkOutline\(c,/);
});
test('15,000 nested nodes export on both platforms without recursion or dropped concepts',async()=>{
 const root=chain(15000);
 const out=[];
 for(const Class of classes){
  const f=fixture(Class,root);
  assert.equal(f.io.exportOPML(),true);
  assert.equal(f.uploads.length,1);
  assert.match(f.uploads[0].filename,/\.opml$/);
  const xml=await f.uploads[0].blob.text();
  assert.ok(xml.includes('N14999'));
  assert.equal((xml.match(/<outline text=/g)||[]).length,15001);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.endsWith('</opml>'));
  out.push(xml);
 }
 assert.equal(out[0],out[1],'Same tree -> same bytes across desktop and Android');
});
test('invalid cycles and shared child aliases are rejected BEFORE downloading',()=>{
 const scenarios=[
  ()=>{const n={text:'self',children:[]};n.children=[n];return n;},
  ()=>{const repeated={text:'shared',children:[]};return {text:'root',children:[repeated,repeated]};}
 ];
 for(const Class of classes)for(const setup of scenarios){
  const f=fixture(Class,setup());
  assert.throws(()=>f.io.exportOPML(),/ciclica o condivisa/);
  assert.equal(f.uploads.length,0,'corrupt OPML cannot be marked exported');
 }
});
test('both platforms escape unsafe XML and preserve sibling order',async()=>{
 const root={text:'A <&> "quoted" \'apostrophe\' \u0001',
  children:[{text:'First & one',children:[]},{text:'Second <two>',children:[]}]};
 for(const Class of classes){
  const f=fixture(Class,root);
  assert.equal(f.io.exportOPML(),true);
  const xml=await f.uploads[0].blob.text();
  assert.ok(xml.includes('A &lt;&amp;&gt; &quot;quoted&quot; &apos;apostrophe&apos;'));
  assert.ok(!xml.includes('\u0001'));
  assert.ok(xml.indexOf('First &amp; one')<xml.indexOf('Second &lt;two&gt;'));
 }
});
test('1,000 deterministic resource/filename/MIME checks preserve I/O parity',()=>{
 const samples=['mappa con spazi','Ramo: cuore & polmone','  ','Example_23','.PNG','üñíçøðë'];
 const types=['.PNG','.jpg','.jpeg','.webp','.gif','.svg','.bin'];
 const resource=new Map([['images/a.png','data:image/png;base64,AAA'],['a.png','data:image/png;base64,AAA']]);
 for(let i=0;i<1000;i++){
  const a=fixture(classes[0],{text:'map',children:[]}).io;
  const b=fixture(classes[1],{text:'map',children:[]}).io;
  const sample=samples[i%samples.length]+i;
  assert.equal(a.sanitizeFilename(sample),b.sanitizeFilename(sample));
  assert.equal(a.guessMimeType('a'+types[i%types.length]),b.guessMimeType('a'+types[i%types.length]));
  const ref=i%2?'xap:/images/a.png':'images/a.png';
  assert.equal(a.resolveXMindResourceRef(ref,resource),b.resolveXMindResourceRef(ref,resource));
 }
});
