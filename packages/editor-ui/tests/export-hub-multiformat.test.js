'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const rootPath=path.resolve(__dirname,'../../..');
const ui=path.join(rootPath,'packages/editor-ui');
const loadExportHubCore=()=>{
  const filename=path.join(ui,'export-hub-core.js');
  let source=fs.readFileSync(filename,'utf8');
  for(const [marker,file] of [
    ['/* @neuromap-export-hub-core-writers */\n','export-hub-core-writers.js'],
    ['/* @neuromap-export-hub-core-parsers */\n','export-hub-core-parsers.js'],
    ['/* @neuromap-export-hub-core-render */\n','export-hub-core-render.js'],
    ['/* @neuromap-export-hub-core-pdf */\n','export-hub-core-pdf.js'],
  ]) source=source.replace(marker,fs.readFileSync(path.join(ui,file),'utf8'));
  const mod=new Module(filename);
  mod.filename=filename;
  mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod._compile(source,filename);
  return mod.exports;
};
const X=loadExportHubCore(),Map=require('../../map-core/index.js');
const tree=(text,children=[],extra={})=>({text,children,...extra});
const roots=[
 tree('Ghiandole α & <epiteli>',[tree('Semplici',[tree('a) tubolari\nb) alveolari')],{fontWeight:700,notes:'Esocrine\nApocrine'})]),
 tree('Capillari',[tree('Continui'),tree('Fenestrati')]),
 tree('Capillari',[tree('Discontinui',[],{fontItalic:true})])
];
const tabs=roots.map((root,i)=>({id:'tab'+i,title:root.text,state:{root,images:[],relationships:[],balanceBias:50}}));
const opts={serializeMarkdown:Map.serializeMarkdown,serializeJSON:t=>({
 schema:'NeuroMapArchitect-SingleTab-v6',root:t.state.root,images:[],relationships:[]
})};
function archiveEntries(u8){
 const d=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),dec=new TextDecoder();
 let at=0;const files=[];
 while(at+30<=u8.length&&d.getUint32(at,true)===0x04034b50){
  const size=d.getUint32(at+18,true),namesize=d.getUint16(at+26,true),extra=d.getUint16(at+28,true);
  const name=dec.decode(u8.slice(at+30,at+30+namesize));
  const from=at+30+namesize+extra;
  files.push({name,body:u8.slice(from,from+size),crc:d.getUint32(at+14,true)});
  at=from+size;
 }
 assert.equal(d.getUint32(at,true),0x02014b50,'central ZIP directory must exist');
 return files;
}
test('three selection scopes retain original tab order and never edit selection',()=>{
 assert.deepEqual(X.selected(tabs,'current',[],'tab1').map(t=>t.id),['tab1']);
 assert.deepEqual(X.selected(tabs,'selected',['tab2','tab0'],'tab1').map(t=>t.id),['tab0','tab2']);
 assert.deepEqual(X.selected(tabs,'all',[],'tab0').map(t=>t.id),['tab0','tab1','tab2']);
 assert.throws(()=>X.selected(tabs,'selected',[],'tab0'),/Seleziona/);
 assert.throws(()=>X.selected(tabs,'unexpected',[],'tab0'),/sconosciuta/);
});
test('Markdown roundtrips three tabs with notes, multiline labels and styling',()=>{
 const out=X.render(tabs,'md',opts),parsed=Map.parseMarkdownExport(out.data);
 assert.equal(out.name,'neuromap_3_schede.md');assert.equal(parsed.length,3);
 assert.equal(parsed[0].children[0].notes,roots[0].children[0].notes);
 assert.equal(parsed[0].children[0].fontWeight,700);
 assert.equal(parsed[0].children[0].children[0].text,'a) tubolari\nb) alveolari');
});
test('single-map and multi-map TXT have deterministic tree structure',()=>{
 const single=X.render([tabs[0]],'txt',opts);
 assert.match(single.data,/Ghiandole α & <epiteli>/);
 const batch=X.render(tabs,'txt',opts);
 assert.match(batch.data,/^NEUROMAP-TXT-MULTI-2/);
 assert.deepEqual(X.parseTxtBatch(batch.data).map(t=>t.text),roots.map(t=>t.text));
 assert.equal(X.parseTxtBatch('Ordinary text\n  Child'),null);
});
test('OPML exports one root per sheet and XML-escapes markup/newlines',()=>{
 const out=X.render(tabs,'opml',opts);
 assert.equal((out.data.match(/<outline text=/g)||[]).length,8);
 assert.match(out.data,/\&lt;epiteli\&gt;/);
 assert.match(out.data,/\&amp;/);
 assert.match(out.data,/&#10;/);
 assert.match(out.data,/<opml version="2.0">/);
});
test('FreeMind .mm multi-map output forces ZIP instead of invalid multi-root XML',()=>{
 assert.throws(()=>X.render(tabs,'mm',opts),/una sola radice/);
 const out=X.render(tabs,'mm',{...opts,separate:true});
 const files=archiveEntries(out.data);
 assert.equal(files.length,3);
 for(const f of files){const body=new TextDecoder().decode(f.body);assert.match(body,/<map version="1.0.1">/);assert.match(body,/<node TEXT=/);}
});
test('HTML export is offline, escapes untrusted labels, and includes notes',()=>{
 const out=X.render(tabs,'html',opts);
 assert.match(out.data,/\&lt;epiteli\&gt;/);
 assert.ok(!out.data.includes('<script'));
 assert.match(out.data,/<details open>/);
 assert.match(out.data,/Esocrine/);
});
test('DOCX is a valid ZIP container with UTF-8 OOXML, bold, italic and line breaks',()=>{
 const out=X.render(tabs,'docx',opts);
 assert.match(out.mime,/wordprocessingml/);
 const list=archiveEntries(out.data),doc=list.find(e=>e.name==='word/document.xml');
 assert.ok(doc);assert.ok(list.find(e=>e.name==='[Content_Types].xml'));assert.ok(list.find(e=>e.name==='_rels/.rels'));
 const xml=new TextDecoder().decode(doc.body);
 assert.ok(list.find(e=>e.name==='word/styles.xml'));
 const styles=new TextDecoder().decode(list.find(e=>e.name==='word/styles.xml').body);
 assert.match(styles,/Heading1/);assert.match(styles,/Heading2/);
 assert.match(xml,/<w:pStyle w:val="Heading1"/);
 assert.match(xml,/<w:document/);assert.match(xml,/<w:b\/>/);assert.match(xml,/<w:i\/>/);
 assert.match(xml,/<w:br\/>/);assert.match(xml,/&lt;epiteli&gt;/);
});
test('JSON workspace has correct schema; separate project files are independent',()=>{
 const combined=JSON.parse(X.render(tabs,'json',opts).data);
 assert.equal(combined.schema,'NeuroMapArchitect-WorkspaceBatch-v6');
 assert.deepEqual(combined.tabs.map(t=>t.root.text),roots.map(t=>t.text));
 const zip=archiveEntries(X.render(tabs,'neuromap',{...opts,separate:true}).data);
 assert.equal(zip.length,3);
 assert.ok(zip.every(f=>JSON.parse(new TextDecoder().decode(f.body)).schema==='NeuroMapArchitect-SingleTab-v6'));
});
test('deduplicated names are predictable, safe and preserve Unicode in ZIP',()=>{
 const files=archiveEntries(X.render(tabs,'txt',{...opts,separate:true}).data);
 assert.deepEqual(files.map(f=>f.name),['Ghiandole α & _epiteli_.txt','Capillari.txt','Capillari_2.txt']);
 assert.ok(files.every(f=>!f.name.includes('../')));
});
test('combined lossless import limits reject oversized MD, TXT, OPML, JSON; ZIP succeeds',()=>{
 const big=Array.from({length:2},(_,i)=>({
  id:'large'+i,state:{root:tree('Large '+i,Array.from({length:1999},(_,j)=>tree('Node '+j)))}}
 ));
 for(const fmt of ['md','txt','opml','json','neuromap']){
  assert.throws(()=>X.render(big,fmt,opts),/3500/);
  assert.equal(archiveEntries(X.render(big,fmt,{...opts,separate:true}).data).length,2);
 }
});
test('1000 seeded different tab selections are deterministic',()=>{
 let seed=87651;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let k=0;k<1000;k++){
  const n=1+Math.floor(random()*20),open=Array.from({length:n},(_,i)=>({id:'id'+i,root:tree('Map '+i)}));
  const subset=open.filter(()=>random()<.5).map(t=>t.id);
  const chosen=X.selected(open,subset.length?'selected':'all',subset,open[0].id);
  assert.ok(chosen.length>0);
  assert.ok(chosen.every((t,i)=>i===0||open.indexOf(chosen[i-1])<open.indexOf(t)));
 }
});
test('PDF outline produces a PDF or ZIP with correct magic using a stand-in canvas',async()=>{
 const old=global.document;
 try{
  global.document={createElement:()=>({
   width:960,height:1358,
   getContext:()=>({fillText(){},fillRect(){},measureText:v=>({width:String(v).length*8})}),
   toBlob:cb=>cb({arrayBuffer:async()=>new Uint8Array([255,216,255,217]).buffer})
  })};
  const pdf=await X.pdf(tabs);assert.match(new TextDecoder().decode(pdf.data.slice(0,10)),/^%PDF-1.4/);
  assert.ok(new TextDecoder().decode(pdf.data.slice(-30)).includes('%%EOF'));
  const parts=archiveEntries((await X.pdf(tabs,{separate:true})).data);assert.equal(parts.length,3);
 }finally{global.document=old}
});
test('bundle preparation installs core and UI in common Windows/macOS/Android assets',()=>{
 const code=fs.readFileSync(path.join(rootPath,'scripts/release/prepare.py'),'utf8');
 const ui=fs.readFileSync(path.join(rootPath,'packages/editor-ui/export-hub-ui.js'),'utf8');
 assert.match(code,/export-hub-core\.js/);assert.match(code,/export-hub-ui\.js/);
 assert.match(code,/export-hub\.css/);assert.match(ui,/setTimeout\(install,\s*0\)/);
 for(const p of ['apps/desktop-shared/src/resources/index.html','apps/android/native/app/src/main/assets/app/index.html']){
  assert.match(fs.readFileSync(path.join(rootPath,p),'utf8'),/\.neuromap,(?:\.glk,)?\.mm/);
 }
});
test('TXT reimport keeps multiline labels, literal escapes, leading spaces and separator-like titles',()=>{
 const roots=[{text:'=== NEUROMAP TAB ===',children:[{text:'  A\nB\\nC\tα',children:[]}]},{text:'Second',children:[]}],tabs=roots.map(root=>({root}));
 for(const selection of [tabs.slice(0,1),tabs])assert.deepEqual(X.parseTxtBatch(X.render(selection,'txt',opts).data),selection.map(t=>t.root));
});
test('document exports retain the central topic notes and underlining',()=>{
 const root={text:'Title',notes:'Root note α <important>',fontUnderline:true,children:[]};
 assert.match(X.html([root]),/Root note α &lt;important&gt;/);
 const doc=archiveEntries(X.docx([root])).find(entry=>entry.name==='word/document.xml');const xml=new TextDecoder().decode(doc.body);assert.match(xml,/Root note α &lt;important&gt;/);assert.match(xml,/<w:u w:val="single"\/>/);
});

test('Word export preserves the selected local font, size, text color and strikethrough',()=>{
 const doc=archiveEntries(X.docx([tree('Titolo',[tree('Stile leggibile',[],{fontFamily:'Georgia',fontSize:24,fontColor:'#8b2355',fontStrike:true})])])).find(entry=>entry.name==='word/document.xml');
 const xml=new TextDecoder().decode(doc.body);
 assert.match(xml,/<w:rFonts w:ascii="Georgia"/);assert.match(xml,/<w:color w:val="8b2355"\/>/);assert.match(xml,/<w:sz w:val="48"\/>/);assert.match(xml,/<w:strike\/>/);
});
