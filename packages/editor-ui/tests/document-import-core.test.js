'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
globalThis.NeuroMapCore=require('../../../packages/map-core/index.js');
const Import=require('../../../apps/desktop-shared/editor/document-import-core.js');
const file=(name,text)=>({name,size:Buffer.byteLength(text),text:async()=>text});
test('TXT import is an explicit detached proposal, not a map mutation',async()=>{
 const source='First paragraph.\n\nSecond paragraph.';
 const p=await Import.preview(file('Notes.txt',source));
 assert.equal(p.kind,'txt');assert.equal(p.count,3);
 assert.equal(p.root.text,'Notes');assert.equal(p.root.children[1].notes,'Second paragraph.');
 assert.deepEqual(p.warnings,[]);
});
test('Markdown import uses the existing map-core parser',async()=>{
 const p=await Import.preview(file('Topics.md','# Main\n- Item A\n- Item B'));
 assert.equal(p.root.text,'Topics');
 assert.ok(p.count>=3);
 assert.ok(p.root.children.length);
});
test('DOCX paragraph extractor keeps heading hierarchy and decodes XML entities',()=>{
 const xml='<w:document><w:body>'+
  '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter</w:t></w:r></w:p>'+
  '<w:p><w:r><w:t>Heart &amp; lungs</w:t></w:r></w:p>'+
  '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Subsection</w:t></w:r></w:p>'+
  '</w:body></w:document>';
 const outline=Import.extractDocxXml(xml);
 assert.equal(outline[0].text,'Chapter');
 assert.equal(outline[0].children[0].text,'Heart & lungs');
 assert.equal(outline[0].children[1].text,'Subsection');
 assert.throws(()=>Import.extractDocxXml('<!DOCTYPE foo>'+xml),/entities/);
});
test('long text does not silently truncate paragraphs',async()=>{
 const over=Array.from({length:Import.MAX_NODES+1},(_,i)=>'Line '+i).join('\n\n');
 await assert.rejects(()=>Import.preview(file('many.txt',over)),/249 paragraphs/);
});
test('rejected formats and empty content do not yield importable proposal',async()=>{
 await assert.rejects(()=>Import.preview(file('script.js','alert(1)')),/Supported formats/);
 await assert.rejects(()=>Import.preview(file('blank.txt',' \n\n ')),/no readable text/);
});


test('paragraphs within supported bounds preserve all content and newlines',async()=>{
 const long='A'.repeat(13000)+'\nline two';
 const p=await Import.preview(file('full.txt',long));
 assert.equal(p.root.children[0].notes,long);
});
test('overlong paragraph fails instead of silently losing document content',async()=>{
 await assert.rejects(()=>Import.preview(file('over.txt','x'.repeat(46000))),/45,000 characters/);
});

test('DOCX ZIP checks reject inconsistent local headers, stored lengths and corrupt XML', async()=>{
 const xml=Buffer.from('<w:document><w:body><w:p><w:r><w:t>Valid</w:t></w:r></w:p></w:body></w:document>');
 const name=Buffer.from('word/document.xml');
 function crc32(buf){
  let crc=0xffffffff;
  for(const b of buf){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}
  return (crc^0xffffffff)>>>0;
 }
 function fixture(descriptor=false){
  const extra=descriptor?16:0,central=30+name.length+xml.length+extra;
  const eocd=central+46+name.length,b=Buffer.alloc(eocd+22);
  b.writeUInt32LE(0x04034b50,0);
  if(descriptor)b.writeUInt16LE(8,6);
  else{
   b.writeUInt32LE(crc32(xml),14);
   b.writeUInt32LE(xml.length,18);b.writeUInt32LE(xml.length,22);
  }
  b.writeUInt16LE(name.length,26);name.copy(b,30);xml.copy(b,30+name.length);
  if(descriptor){
   const p=30+name.length+xml.length;
   b.writeUInt32LE(0x08074b50,p);b.writeUInt32LE(crc32(xml),p+4);
   b.writeUInt32LE(xml.length,p+8);b.writeUInt32LE(xml.length,p+12);
  }
  b.writeUInt32LE(0x02014b50,central);
  if(descriptor)b.writeUInt16LE(8,central+8);
  b.writeUInt32LE(crc32(xml),central+16);
  b.writeUInt32LE(xml.length,central+20);b.writeUInt32LE(xml.length,central+24);
  b.writeUInt16LE(name.length,central+28);name.copy(b,central+46);
  b.writeUInt32LE(0x06054b50,eocd);
  b.writeUInt16LE(1,eocd+8);b.writeUInt16LE(1,eocd+10);
  b.writeUInt32LE(46+name.length,eocd+12);b.writeUInt32LE(central,eocd+16);
  return {b,central};
 }
 const asFile=b=>({name:'valid.docx',size:b.length,
  arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)});
 for(const descriptor of [false,true]){
  const valid=fixture(descriptor);
  const accepted=await Import.preview(asFile(valid.b));
  assert.equal(accepted.root.children[0].text,'Valid');
 }
 const {b:valid,central}=fixture();
 const mutations=[
  b=>b.writeUInt32LE(xml.length+1,central+24), // stored size mismatch
  b=>{b[30]=0x78;},                             // divergent entry name
  b=>b.writeUInt16LE(8,8),                      // divergent method
  b=>b.writeUInt16LE(1,6),                      // encrypted in local header only
  b=>{b[30+name.length]^=1;},                    // XML CRC mismatch
  b=>b.writeUInt16LE(1,central+8),              // encrypted in central header only
 ];
 for(const mutate of mutations){
  const b=Buffer.from(valid);mutate(b);
  await assert.rejects(()=>Import.preview(asFile(b)),/DOCX/);
 }
});
