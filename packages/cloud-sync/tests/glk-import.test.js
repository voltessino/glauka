'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function importer(target){
 const code=read(target);
 const start=code.indexOf('      parseTextHierarchy(text, ext) {');
 const stop=code.indexOf('      async importFile(',start);
 assert.ok(start>=0&&stop>start,'Cannot find actual editor import method');
 return new Function('return ({'+code.slice(start,stop).trim()+'})')();
}
const targets=[
 ['apps/desktop-shared/editor/app-import.js','apps/desktop-shared/src/resources/index.html'],
 ['apps/android/editor/app-import.js','apps/android/native/app/src/main/assets/app/index.html']
];
for(const [editor,html] of targets){
 test('native .glk cloud maps import as JSON on '+editor,()=>{
  const module=importer(editor),doc={
   schema:'NeuroMapArchitect-SingleTab-v6',
   root:{id:'abc',text:'Cuore',children:[{id:'xyz',text:'Atrio',children:[]}]},
   images:[]};
  const output=module.parseTextHierarchy(JSON.stringify(doc),'glk');
  assert.equal(output.root.text,'Cuore');
  assert.equal(output.root.children[0].text,'Atrio');
  assert.equal(output.meta.schema,doc.schema);
  assert.match(read(html),/accept="[^"]*\.glk/);
 });
 test('native .glk workspace backup retains all tabs instead of parsing Markdown on '+editor,()=>{
  const doc={schema:'NeuroMapArchitect-WorkspaceBatch-v6',tabs:[
    {root:{text:'Sistema cardiovascolare',children:[]}},
    {root:{text:'Sistema nervoso',children:[]}}
  ]};
  const parsed=importer(editor).parseTextHierarchy(JSON.stringify(doc),'glk');
  assert.equal(parsed.workspace.length,2);
  assert.equal(parsed.workspace[1].root.text,'Sistema nervoso');
  assert.throws(()=>importer(editor).parseTextHierarchy('{invalid','glk'),/JSON/);
 });
}
