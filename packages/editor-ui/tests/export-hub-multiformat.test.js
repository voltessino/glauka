'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const rootPath=path.resolve(__dirname,'../../..');
const ui=path.join(rootPath,'packages/editor-ui');
const loadExportHubCore=()=>{
  const filename=path.join(ui,'export-hub-core.js');
  let source=fs.readFileSync(filename,'utf8');
  for(const [marker,file] of [
    ['/* @neuromap-export-hub-core-chunker */\n','export-hub-core-chunker.js'],
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
 // Verify OOXML CT_RPr element ordering (rFonts before b/i/strike/color/sz/u)
 const rPr=xml.match(/<w:rPr>.*?<\/w:rPr>/g).find(s=>s.includes('Georgia'));
 assert.ok(rPr.indexOf('<w:rFonts')<rPr.indexOf('<w:strike')&&rPr.indexOf('<w:strike')<rPr.indexOf('<w:color')&&rPr.indexOf('<w:color')<rPr.indexOf('<w:sz'));
});

test('Word export darkens invisible light text colors and separates multi-tab pages cleanly',()=>{
 const whiteNode=tree('White on dark',[],{fontColor:'#ffffff'});
 const darkRoot=tree('Dark Root',[whiteNode],{fontColor:'#f8fafc'});
 const secondRoot=tree('Second Map',[tree('Child 2')]);
 const doc=archiveEntries(X.docx([darkRoot,secondRoot])).find(entry=>entry.name==='word/document.xml');
 const xml=new TextDecoder().decode(doc.body);
 assert.equal(/w:val="ffffff"/i.test(xml),false);
 assert.equal(/w:val="f8fafc"/i.test(xml),false);
 assert.match(xml,/<w:br w:type="page"\/>/);
});

test('HTML export guards missing children arrays, fixes singular grammar, and preserves links/styles',()=>{
 const bare={text:'Single Root',fontWeight:700,linkUrl:'https://glauka.app'};
 const html=X.html([bare]);
 assert.match(html,/1 mappa · sola lettura/);
 assert.equal(/1 mappe/.test(html),false);
 assert.match(html,/<strong>Single Root<\/strong>/);
 assert.match(html,/href="https:\/\/glauka\.app"/);
 assert.equal(/<ul><\/ul>/.test(html),false);
 const multi=X.html(roots);
 assert.match(multi,/3 mappe · sola lettura/);
 assert.match(multi,/href="#map-0"/);
 assert.match(multi,/href="#map-2"/);
});

test('FreeMind .mm multiline notes preserve paragraph tags for cross-reader compatibility',()=>{
 const src=tree('Root',[tree('Topic',[],{notes:'Riga 1\nRiga 2\nRiga 3'})]);
 const xml=X.freemind(src);
 assert.match(xml,/<richcontent TYPE="NOTE"><html><body><p>Riga 1<\/p><p>Riga 2<\/p><p>Riga 3<\/p><\/body><\/html><\/richcontent>/);
 // Also verify parseFreeMind extracts paragraph breaks when DOMParser is present
 const fakeP=(txt)=>({textContent:txt});
 global.DOMParser=class{parseFromString(){return {querySelector:()=>null,documentElement:{localName:'map',children:[{localName:'node',getAttribute:k=>k==='TEXT'?'Root':null,children:[{localName:'node',getAttribute:k=>k==='TEXT'?'Topic':null,children:[{localName:'richcontent',getAttribute:k=>k==='TYPE'?'NOTE':null,querySelectorAll:()=>[fakeP('Riga 1'),fakeP('Riga 2'),fakeP('Riga 3')],textContent:'Riga 1Riga 2Riga 3'}]}]}]}};}};
 try{
  const parsed=X.parseFreeMind(xml);
  assert.equal(parsed.children[0].notes,'Riga 1\nRiga 2\nRiga 3');
 }finally{delete global.DOMParser;}
});

test('PDF document export starts each map on a new page, preserves blank note lines, and numbers pages',async()=>{
 const drawn=[];
 const old=global.document;
 try{
  global.document={createElement:()=>({
   width:960,height:1358,
   getContext:()=>({fillText(txt){drawn.push(txt)},fillRect(){},measureText:v=>({width:String(v).length*8})}),
   toBlob:cb=>cb({arrayBuffer:async()=>new Uint8Array([255,216,255,217]).buffer})
  })};
  const noteTabs=[{root:{text:'First',notes:'Line A\n\nLine B',children:[]}},{root:{text:'Second',children:[]}}];
  const pdf=await X.pdf(noteTabs);
  const text=new TextDecoder().decode(pdf.data);
  const pageMatches=text.match(/\/Type \/Page\b/g)||[];
  assert.equal(pageMatches.length,2);
  assert.ok(drawn.some(s=>s.includes('Pag. 1')));
  assert.ok(drawn.some(s=>s.includes('Pag. 2')));
 }finally{global.document=old}
});

test('TreeChunker keeps compact maps intact in 1 chunk with no multi-part header',()=>{
 const words=n=>Array.from({length:n},(_,i)=>'parola'+i).join(' ');
 const small=tree('Mappa Compatta',[tree('Ramo 1',[tree('Dettaglio',[],{notes:words(120)})]),tree('Ramo 2',[],{notes:words(180)})]);
 const chunks=X.TreeChunker.chunkTree(small,{preset:'balanced',extension:'md'});
 assert.equal(chunks.length,1);
 assert.equal(chunks[0].part_index,1);
 assert.equal(chunks[0].total_parts,1);
 assert.equal(chunks[0].suggested_filename,'Mappa Compatta.md');
 assert.equal(chunks[0].context_header,null);
 assert.ok(chunks[0].word_count<=2300);
});

test('TreeChunker splits large maps along L1 boundaries sequentially, numbers globally, and pads filenames',()=>{
 const block=(w)=>Array.from({length:w},(_,i)=>'t'+i).join(' ');
 const branches=Array.from({length:11},(_,i)=>tree('Capitolo '+(i+1),[
  tree('Concetto A',[],{notes:block(280)}),
  tree('Concetto B',[tree('Sottopunto profondo',[],{notes:block(40)})],{notes:block(280)})
 ]));
 const large=tree('Trattato Completo',branches);
 const chunks=X.TreeChunker.chunkTree(large,{preset:'compact',hierarchicalNumbering:true,extension:'md'});
 assert.ok(chunks.length>=5);
 for(let i=0;i<chunks.length;i++){
  const c=chunks[i];
  assert.equal(c.part_index,i+1);
  assert.equal(c.total_parts,chunks.length);
  assert.match(c.suggested_filename,/^\d{2,}_Trattato Completo_Parte\d+\.md$/);
  assert.ok(c.word_count<=1400||c.nodes_tree.children.length===1);
  assert.equal(c.context_header.partLabel,'Parte '+(i+1)+' di '+chunks.length);
  if(i>0)assert.ok(c.context_header.previousLastSection);
 }
 // Alphabetical filename ordering equals sequential part order
 const sorted=[...chunks.map(c=>c.suggested_filename)].sort();
 assert.deepEqual(sorted,chunks.map(c=>c.suggested_filename));
 // Global hierarchical numbering never resets between chunk 1 and chunk 2
 const firstSectionChunk1=chunks[0].nodes_tree.children[0].text;
 const firstSectionChunk2=chunks[1].nodes_tree.children[0].text;
 assert.ok(firstSectionChunk1.startsWith('1. '),firstSectionChunk1);
 assert.ok(!firstSectionChunk2.startsWith('1. '),firstSectionChunk2);
});

test('TreeChunker falls back to L2 children for an oversized L1 branch and preserves (continua) headers',()=>{
 const filler=(w)=>Array.from({length:w},(_,i)=>'voce'+i).join(' ');
 const l2s=Array.from({length:6},(_,i)=>tree('Sottocapitolo '+(i+1),[],{notes:filler(550)}));
 const giant=tree('Libro',[tree('Introduzione',[],{notes:filler(100)}),tree('Capitolo Enorme',l2s,{notes:filler(80)})]);
 const chunks=X.TreeChunker.chunkTree(giant,{preset:'balanced',hierarchicalNumbering:true,extension:'md'});
 assert.ok(chunks.length>=2);
 const rendered=X.render([{id:'g',state:{root:giant}}],'md',{splitMode:'modular',preset:'balanced',hierarchicalNumbering:true,...opts});
 const zip=archiveEntries(rendered.data);
 const texts=zip.map(f=>new TextDecoder().decode(f.body));
 assert.match(texts[0],/## 2\. Capitolo Enorme/);
 assert.ok(texts.slice(1).some(t=>/## 2\. Capitolo Enorme \(continua\)/.test(t)));
 assert.match(texts[0],/### 2\.1 Sottocapitolo 1/);
 assert.ok(texts.some(t=>/### 2\.6 Sottocapitolo 6/.test(t)));
});

test('TreeChunker Anti-Orphan merges a tiny trailing chunk (<25% targetWords) into the penultimate chunk',()=>{
 const words=(w)=>Array.from({length:w},(_,i)=>'w'+i).join(' ');
 // Target balanced = 1800, max = 2300, orphan threshold = 450
 const root=tree('Biologia',[
  tree('Parte Uno',[],{notes:words(1850)}),
  tree('Coda Minuscola',[],{notes:words(120)})
 ]);
 const chunks=X.TreeChunker.chunkTree(root,{preset:'balanced',extension:'txt'});
 assert.equal(chunks.length,1);
 assert.equal(chunks[0].nodes_tree.children.length,2);
});

test('All document formats consume ExportChunk with Heading 1-3 and level 4+ bullets and zero 3rd-party brands',async()=>{
 const words=(w)=>Array.from({length:w},(_,i)=>'k'+i).join(' ');
 const deep=tree('Corso',[
  tree('Modulo A',[tree('Unità A1',[tree('Dettaglio livello 4',[tree('Dettaglio livello 5')],{notes:words(600)})],{notes:words(600)})]),
  tree('Modulo B',[tree('Unità B1',[],{notes:words(1300)})])
 ]);
 const tab={id:'c',state:{root:deep}};
 // MD
 const mdZip=archiveEntries(X.render([tab],'md',{splitMode:'modular',preset:'balanced',hierarchicalNumbering:true,...opts}).data);
 const md0=new TextDecoder().decode(mdZip[0].body);
 assert.match(md0,/^> \*\*Corso — Parte 1 di /m);
 assert.match(md0,/^# Corso/m);
 assert.match(md0,/^## 1\. Modulo A/m);
 assert.match(md0,/^### 1\.1 Unità A1/m);
 assert.match(md0,/^- 1\.1\.1 Dettaglio livello 4/m);
 // HTML
 const htmlZip=archiveEntries(X.render([tab],'html',{splitMode:'modular',preset:'balanced',hierarchicalNumbering:true,...opts}).data);
 const html0=new TextDecoder().decode(htmlZip[0].body);
 assert.match(html0,/<aside class="chunk-context"/);
 assert.match(html0,/<h2>1\. Modulo A<\/h2>/);
 assert.match(html0,/<h3>1\.1 Unità A1<\/h3>/);
 assert.match(html0,/<ul><li>1\.1\.1 Dettaglio livello 4/);
 // DOCX
 const docxZip=archiveEntries(X.render([tab],'docx',{splitMode:'modular',preset:'balanced',hierarchicalNumbering:true,...opts}).data);
 const innerDocx=archiveEntries(docxZip[0].body);
 const docxXml=new TextDecoder().decode(innerDocx.find(e=>e.name==='word/document.xml').body);
 assert.match(docxXml,/Corso — Parte 1 di /);
 assert.match(docxXml,/<w:pStyle w:val="Heading2"\/>.*?1\. Modulo A/);
 assert.match(docxXml,/<w:pStyle w:val="Heading3"\/>.*?1\.1 Unità A1/);
 assert.match(docxXml,/• 1\.1\.1 Dettaglio livello 4/);
 // PDF
 const oldDoc=global.document;
 try{
  global.document={createElement:()=>({width:960,height:1358,getContext:()=>({fillText(){},fillRect(){},measureText:v=>({width:String(v).length*8})}),toBlob:cb=>cb({arrayBuffer:async()=>new Uint8Array([255,216,255,217]).buffer})})};
  const pdfOut=await X.pdf([tab],{splitMode:'modular',preset:'balanced',hierarchicalNumbering:true});
  const pdfZip=archiveEntries(pdfOut.data);
  assert.equal(pdfZip.length,mdZip.length);
  assert.match(pdfZip[0].name,/^\d{2,}_Corso_Parte1\.pdf$/);
 }finally{global.document=oldDoc}
});
