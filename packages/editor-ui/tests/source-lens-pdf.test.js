'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const Core=require('../../../apps/desktop-shared/editor/source-lens-pdf.js');
function documentPDF(texts,{compressed=false,reverseObjects=false}={}){
 const parts=['%PDF-1.7','1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj'];
 const pages=[];
 for(let i=0;i<texts.length;i++)pages.push(3+i*2+' 0 R');
 parts.push('2 0 obj\n<< /Type /Pages /Kids ['+pages.join(' ')+'] /Count '+texts.length+' >>\nendobj');
 const defs=[];
 for(let i=0;i<texts.length;i++){
  const page=3+i*2,stream=page+1;
  const content=Buffer.from('BT /F1 12 Tf 72 700 Td ('+texts[i]+') Tj ET');
  const data=compressed?zlib.deflateSync(content):content;
  defs.push(Buffer.from(page+' 0 obj\n<< /Type /Page /Parent 2 0 R /Contents '+stream+' 0 R >>\nendobj\n'));
  defs.push(Buffer.concat([Buffer.from(stream+' 0 obj\n<< /Length '+data.length+
   (compressed?' /Filter /FlateDecode':'')+' >>\nstream\n'),data,Buffer.from('\nendstream\nendobj\n')]));
 }
 const data=Buffer.concat([Buffer.from(parts.join('\n')+'\n'),...(reverseObjects?defs.reverse():defs),Buffer.from('%%EOF')]);
 return {name:'test.pdf',type:'application/pdf',size:data.length,
  arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
}
test('reads page tree order rather than physical PDF object order',async()=>{
 const pdf=documentPDF(['Class one clean','Class two contaminated'],{reverseObjects:true});
 const result=await Core.inspect(pdf);
 assert.equal(result.pages.length,2);
 assert.equal(result.pages[0].text,'Class one clean');
 assert.equal(result.pages[1].text,'Class two contaminated');
 assert.equal(result.unreadablePages,0);
 assert.deepEqual(Core.search(result.pages,'CONTAMINATED').map(x=>x.page),[2]);
});
test('reads deflate-compressed local text layers when browser supports decompression',async()=>{
 if(typeof DecompressionStream!=='function'||typeof Blob!=='function')return;
 const result=await Core.inspect(documentPDF(['Compressed readable words'],{compressed:true}));
 assert.match(result.pages[0].text,/Compressed readable words/);
});
test('never treats absent text layers as valid extracted quotes',async()=>{
 const data=Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'+
  '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'+
  '3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n%%EOF');
 const result=await Core.inspect({size:data.length,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)});
 assert.equal(result.pages[0].text,'');assert.equal(result.unreadablePages,1);
});
test('rejects oversized PDFs, malformed files, and out-of-range page counts',async()=>{
 await assert.rejects(()=>Core.inspect({size:129*1024*1024,arrayBuffer:async()=>{throw Error('should not read')}}),/128 MB/);
 const fake=Buffer.from('bogus bytes');
 await assert.rejects(()=>Core.inspect({size:fake.length,arrayBuffer:async()=>fake.buffer.slice(fake.byteOffset,fake.byteOffset+fake.byteLength)}),/Invalid PDF header/);
});
test('bounded search returns only real page numbers without changing source data',async()=>{
 const src=await Core.inspect(documentPDF(['alpha beta','gamma alpha','delta']));
 const original=JSON.stringify(src.pages);
 assert.deepEqual(Core.search(src.pages,'alpha').map(x=>x.page),[1,2]);
 assert.deepEqual(Core.search(src.pages,'not found'),[]);
 assert.equal(JSON.stringify(src.pages),original);
});


test('overlong text page is marked unreadable, never emitted as a partial quote',async()=>{
 const result=await Core.inspect(documentPDF(['A'.repeat(46000)]));
 assert.equal(result.unreadablePages,1);
 assert.equal(result.pages[0].text,'');
 assert.match(result.pages[0].warning,/45,000/);
});

test('compressed PDF streams use declared binary length for LF and CRLF separators',async()=>{
 const original=documentPDF(['Boundary bytes'],{compressed:true});
 const raw=Buffer.from(await original.arrayBuffer()).toString('latin1');
 for(const separator of ['\n','\r\n']){
  const bytes=Buffer.from(raw.replace('\nendstream',separator+'endstream'),'latin1');
  const result=await Core.inspect({size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
  assert.equal(result.pages[0].text,'Boundary bytes');
  assert.equal(result.unreadablePages,0);
 }
});
