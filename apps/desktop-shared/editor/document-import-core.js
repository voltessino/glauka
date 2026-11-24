/* NeuroMap Document Import — offline, deterministic, preview-first.
 * PDF text is not a verified fact: users must compare it with the original.
 * Never execute macros, fetch external links, upload content or edit maps here.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapDocumentImport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const MAX_NODES=250,MAX_TEXT=3*1024*1024,MAX_DOCX=15*1024*1024,MAX_XML=3*1024*1024,MAX_NOTES=45000;
 const decoder=()=>new root.TextDecoder('utf-8',{fatal:false});
 const rawName=name=>String(name||'Document').split(/[\\/]/).pop().replace(/\.(pdf|docx|txt|md|markdown)$/i,'').slice(0,120)||'Document';
 const ext=name=>String(name||'').split('.').pop().toLowerCase();
 const safeText=text=>String(text||'').replace(/\0/g,'').trim();
 const node=(text,children=[],notes='')=>{
  const fullNotes=safeText(notes);
  if(fullNotes.length>MAX_NOTES)throw Error('Paragraph exceeds 45,000 characters: import a smaller section');
  return {text:safeText(text).slice(0,350)||'Contenuto',children,notes:fullNotes};
 };
 function countNodes(rootNode){
  let count=0;const stack=[rootNode],seen=new Set();
  while(stack.length){
   const item=stack.pop();if(!item||typeof item!=='object'||seen.has(item))throw Error('Invalid document outline');
   seen.add(item);if(++count>MAX_NODES)throw Error('Preview exceeds 250 nodes: import a smaller section');
   for(const child of item.children||[])stack.push(child);
  }return count;
 }
 function plainToForest(text){
  const lines=String(text||'').replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length)throw Error('Document contains no readable text');
  if(lines.length>MAX_NODES-1)throw Error('Text has more than 249 paragraphs: import a smaller section');
  return lines.map(s=>node(s.slice(0,110),[],s));
 }
 function xmlDecode(s){
  return String(s).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(raw,entity)=>{
   const base=entity[0]==='#'?(entity[1]?.toLowerCase()==='x'?16:10):0;
   if(base){const n=parseInt(entity.slice(base===16?2:1),base);
    return Number.isSafeInteger(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}
   return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity.toLowerCase()]||raw;
  });
 }
 const crcTable=Array.from({length:256},(_,i)=>{
  for(let n=0;n<8;n++)i=(i>>>1)^(0xedb88320&-(i&1));return i>>>0;
 });
 function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
 }
 function zipEntry(bytes,target){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16=i=>view.getUint16(i,true),u32=i=>view.getUint32(i,true);
  let eocd=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)
   if(u32(i)===0x06054b50&&i+22+u16(i+20)===bytes.length){eocd=i;break;}
  if(eocd<0)throw Error('DOCX central directory is missing or truncated');
  const entries=u16(eocd+10),dirSize=u32(eocd+12),offset=u32(eocd+16);
  if(u16(eocd+4)||u16(eocd+6)||u16(eocd+8)!==entries||
     entries>3000||offset>=bytes.length||offset+dirSize>eocd)
    throw Error('DOCX archive exceeds safe bounds');
  let found=null,p=offset;
  const dirEnd=offset+dirSize;
  for(let n=0;n<entries;n++){
   if(p+46>dirEnd||u32(p)!==0x02014b50)throw Error('Invalid DOCX archive entry');
   const flags=u16(p+8),method=u16(p+10),crc=u32(p+16),
    csize=u32(p+20),usize=u32(p+24),
    nameLen=u16(p+28),extra=u16(p+30),comment=u16(p+32),local=u32(p+42);
   const next=p+46+nameLen+extra+comment;
   if(next>dirEnd)throw Error('Truncated DOCX archive');
   const nameBytes=bytes.subarray(p+46,p+46+nameLen);
   const name=decoder().decode(nameBytes);
   p=next;
   if(name!==target)continue;
   if(found)throw Error('Duplicate DOCX document.xml entry');
   if((flags&0x2041)||usize>MAX_XML||csize>MAX_XML||![0,8].includes(method))
    throw Error('Unsupported or oversized DOCX document.xml');
   if(local+30>offset||u32(local)!==0x04034b50)throw Error('Invalid DOCX local header');
   const lf=u16(local+6),lm=u16(local+8),lc=u32(local+14),ls=u32(local+18),
    lu=u32(local+22),ln=u16(local+26),le=u16(local+28);
   if(lf!==flags||lm!==method)throw Error('DOCX local/central flags or method mismatch');
   if(ln!==nameLen||local+30+ln+le>offset)
    throw Error('DOCX local/central name mismatch');
   for(let i=0;i<nameLen;i++)
    if(bytes[local+30+i]!==nameBytes[i])throw Error('DOCX local/central name mismatch');
   // Flag 8 permits zero sizes and checksum in local headers.
   const descriptor=(flags&8)!==0;
   if(((!descriptor||lc!==0)&&lc!==crc)||
      ((!descriptor||ls!==0)&&ls!==csize)||
      ((!descriptor||lu!==0)&&lu!==usize))
    throw Error('DOCX local/central size or CRC mismatch');
   if(method===0&&csize!==usize)throw Error('DOCX stored XML length mismatch');
   const begin=local+30+ln+le;
   if(begin+csize>offset)throw Error('Truncated DOCX text');
   found={compressed:bytes.subarray(begin,begin+csize),method,expected:usize,crc};
  }
  if(p!==dirEnd)throw Error('DOCX central directory length mismatch');
  if(!found)throw Error('DOCX document.xml not found');
  return found;
 }
 async function expandZip(entry){
  if(entry.method===0){
   if(entry.compressed.length!==entry.expected)throw Error('DOCX XML length mismatch');
   if(crc32(entry.compressed)!==entry.crc)throw Error('DOCX XML CRC mismatch');
   return entry.compressed;
  }
  if(typeof root.DecompressionStream!=='function'||typeof root.Blob!=='function')
   throw Error('DOCX decompression is unavailable on this browser');
  const reader=new root.Blob([entry.compressed]).stream()
   .pipeThrough(new root.DecompressionStream('deflate-raw')).getReader();
  let size=0;const chunks=[];
  try{
   while(true){
    const {done,value}=await reader.read();if(done)break;
    size+=value.length;if(size>MAX_XML){await reader.cancel();throw Error('DOCX XML exceeds 3 MB');}
    chunks.push(value);
   }
  }finally{reader.releaseLock();}
  if(size!==entry.expected)throw Error('DOCX XML length mismatch');
  const result=new Uint8Array(size);let begin=0;
  for(const c of chunks){result.set(c,begin);begin+=c.length;}
  if(crc32(result)!==entry.crc)throw Error('DOCX XML CRC mismatch');
  return result;
 }
 function extractDocxXml(xml){
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('DOCX XML entities are not accepted');
  const paragraphs=[],re=/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let match;
  while((match=re.exec(xml))!==null){
   const body=match[1],style=/\<w:pStyle\b[^>]*\bw:val="([^"]+)"/.exec(body)?.[1]||'';
   const level=/^(?:Heading|Titolo)([1-6])$/i.exec(style);
   const content=body.replace(/<w:tab\b[^>]*\/>/g,' ').replace(/<w:br\b[^>]*\/>/g,'\n');
   const words=[...content.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map(x=>xmlDecode(x[1])).join('').replace(/\s+/g,' ').trim();
   if(words)paragraphs.push({text:words,level:level?Number(level[1]):0});
   if(paragraphs.length>MAX_NODES)throw Error('DOCX exceeds 250 paragraphs');
  }
  if(!paragraphs.length)throw Error('DOCX contains no readable paragraphs');
  const top=[],stack=[];
  for(const p of paragraphs){
   const entry=node(p.text.slice(0,p.level?150:110),[],p.level?'':p.text);
   if(p.level){
    while(stack.length&&stack[stack.length-1].level>=p.level)stack.pop();
    if(stack.length)stack[stack.length-1].value.children.push(entry);
    else top.push(entry);
    stack.push({level:p.level,value:entry});
   }else if(stack.length)stack[stack.length-1].value.children.push(entry);
   else top.push(entry);
  }return top;
 }
 async function docxForest(file){
  if(file.size>MAX_DOCX||file.size<22)throw Error('DOCX must be smaller than 15 MB');
  const bytes=new Uint8Array(await file.arrayBuffer());
  return extractDocxXml(decoder().decode(await expandZip(zipEntry(bytes,'word/document.xml'))));
 }
 function pdfForest(data,file,digest){
  const pages=data.pages.filter(p=>p.text);
  if(pages.length>245)throw Error('PDF exceeds 245 readable pages: import selected sections');
  if(!pages.length)throw Error('PDF has no extractable text; use manual citation');
  const selected=pages.map(p=>{
   const name='Pagina '+p.page;
   const notes=p.text;
   const ref=root.NeuroMapSourceCore.normalize({
    kind:'pdf',id:root.NeuroMapSourceCore.newId(),title:rawName(file.name),
    fileName:file.name,sha256:digest,page:p.page,quote:p.text.slice(0,root.NeuroMapSourceCore.MAX_QUOTE),
    createdAt:new Date().toISOString()
   });
   const entry=node(name,[],notes);
   if(ref)entry.sourceRefs=[ref];
   return entry;
  });
  // PDF.js bookmarks provide explicit chapter boundaries; never synthesize
  // section names or facts. Avoid exceeding the 250-node preview limit.
  const outline=Array.isArray(data.outline)?data.outline:[];
  const headings=outline.filter((h,i)=>Number.isInteger(h.page)&&h.page>=pages[0].page&&
    h.page<=pages[pages.length-1].page&&
    (i===0||h.page!==outline[i-1]?.page)).slice(0,30);
  if(headings.length>=2&&headings.length+selected.length+1<=MAX_NODES){
   const groups=[];let current=null,at=0;
   for(const page of selected){
    const number=pages[at++].page;
    while(headings.length&&headings[0].page<=number){
     const label=headings.shift();
     current=node(label.title.slice(0,140));
     groups.push(current);
    }
    if(!current)groups.push(page);
    else current.children.push(page);
   }
   return groups;
  }
  return selected;
 }
 async function preview(file){
  if(!file||typeof file.name!=='string'||!Number.isFinite(file.size))
   throw Error('Choose a supported local document');
  const suffix=ext(file.name);
  let forest=[],warnings=[],kind=suffix;
  if(suffix==='pdf'){
   const source=root.NeuroMapSourceCore,engine=root.NeuroMapPdfText;
   if(!source||!engine)throw Error('Source Lens 2.0 is required for PDF import');
   // Ask PDF.js for the SHA-256 of its already-read buffer: avoid reading
   // a second full copy of the same PDF just to attach citations.
   const pdf=await engine.inspect(file,{includeDigest:true});
   const hash=pdf.sha256||await source.fingerprint(file);
   forest=pdfForest(pdf,file,hash);
   warnings.push('Verify every extracted PDF page against the original: scans, custom fonts and protected PDFs may not be interpreted correctly.');
   if(pdf.unreadablePages)warnings.push(pdf.unreadablePages+' PDF page(s) had no extractable text.');
   if(pdf.engine)warnings.push('Text engine: '+pdf.engine+'; chapter groups use real PDF bookmarks only. No AI summarization.');
  }else if(suffix==='docx')forest=await docxForest(file);
  else if(['md','markdown'].includes(suffix)){
   if(file.size>MAX_TEXT)throw Error('Markdown exceeds 3 MB');
   if(!root.NeuroMapCore?.parseMarkdownOutline)throw Error('Markdown parser unavailable');
   forest=root.NeuroMapCore.parseMarkdownOutline(await file.text());
  }else if(suffix==='txt'){
   if(file.size>MAX_TEXT)throw Error('Text document exceeds 3 MB');
   forest=plainToForest(await file.text());
  }else throw Error('Supported formats: PDF, DOCX, Markdown, TXT');
  const result=node(rawName(file.name),forest);
  const count=countNodes(result);
  return Object.freeze({root:result,kind,count,warnings,title:result.text});
 }
 return Object.freeze({preview,extractDocxXml,xmlDecode,countNodes,MAX_NODES});
});
