'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/io.js'),'utf8');
const Core=require('../../map-core');
const Exporter=new Function('NeuroMapCore',code+'\nreturn MindMapIOManager;')(Core);
async function exportTree(root){
 let blob=null,name='',toast='';
 const io=new Exporter();
 io.app={state:{root},showToast(message){toast=message;}};
 io.triggerDownload=(result,filename)=>{blob=result;name=filename;};
 io.sanitizeFilename=()=> 'test';
 io.exportOPML();
 return {xml:await blob.text(),name,toast,type:blob.type};
}
function outlineTexts(xml){
 const tags=[...xml.matchAll(/<\/?outline\b[^>]*>/g)].map(x=>x[0]);
 let count=0,maxDepth=0;
 for(const tag of tags){if(tag.startsWith('</'))count--;else if(!tag.endsWith('/>'))count++;
   assert.ok(count>=0,'balanced outlines');
   maxDepth=Math.max(maxDepth,count);
 }
 assert.equal(count,0,'all outlines are closed');
 return {tags:tags.length,maxDepth};
}
test('OPML 2.0 contains only outline descendants in body, no DOM overlay markup',async()=>{
 const root={text:'Root',children:[{text:'One',children:[]},{text:'Two',children:[{text:'Three',children:[]}]}]};
 const {xml,name,type}=await exportTree(root);
 assert.equal(name,'test.opml');assert.match(type,/opml/);
 assert.match(xml,/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
 assert.match(xml,/<opml version="2\.0">/);
 assert.match(xml,/<body>\s*<outline text="Root">/);
 assert.equal((xml.match(/<outline\b/g)||[]).length,4);
 assert.doesNotMatch(xml,/<div|nm612-drop-indicator/);
 assert.equal((xml.match(/<body>/g)||[]).length,1);
 outlineTexts(xml);
});
test('OPML escapes quotes and XML meta-characters',async()=>{
 const {xml}=await exportTree({text:'A & <B> "C" \'D\'',children:[]});
 assert.match(xml,/A &amp; &lt;B&gt; &quot;C&quot; &apos;D&apos;/);
 assert.doesNotMatch(xml,/<div/);
});
test('OPML export handles 4000 nested levels iteratively',async()=>{
 const root={text:'root',children:[]};let current=root;
 for(let i=0;i<4000;i++){let child={text:String(i),children:[]};current.children=[child];current=child;}
 const {xml}=await exportTree(root);
 assert.equal((xml.match(/<outline\b/g)||[]).length,4001);
 assert.ok(outlineTexts(xml).maxDepth>=4000);
});
test('cycle causes controlled error instead of infinite traversal',()=>{
 const root={text:'cycle',children:[]};root.children=[root];
 const io=new Exporter();io.app={state:{root},showToast(){}};io.sanitizeFilename=()=> 'test';
 assert.throws(()=>io.exportOPML(),/ciclica/);
});
