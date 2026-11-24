/* Source Lens 2.0: deliberately bounded, offline text extraction for ordinary
 * text-layer PDFs. No network, OCR, scripts, embedded files, or document writes.
 * Unsupported PDF filters/encodings fail closed; the original manual viewer stays.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapPdfText=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const MAX_BYTES=128*1024*1024,MAX_STREAM=4*1024*1024,MAX_PAGES=10000;
 const MAX_PAGE_CHARS=45000,MAX_TOTAL_CHARS=4000000;
 function binary(bytes){
  const pieces=[];
  for(let i=0;i<bytes.length;i+=32768)
   pieces.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  return pieces.join('');
 }
 function refs(src){return [...src.matchAll(/(\d+)\s+\d+\s+R/g)].map(m=>Number(m[1]));}
 function extractObjects(raw){
  const objects=new Map(),re=/(?:^|[\r\n])(\d+)\s+\d+\s+obj\b([\s\S]*?)\bendobj\b/g;
  let m;while((m=re.exec(raw))!==null){
   const id=Number(m[1]);if(objects.has(id))continue;
   objects.set(id,m[2]);
   if(objects.size>40000)throw Error('PDF object limit exceeded');
  }return objects;
 }
 function orderedPages(objects){
  const catalog=[...objects.values()].find(b=>/\/Type\s*\/Catalog\b/.test(b));
  const id=catalog&&/\/Pages\s+(\d+)\s+\d+\s+R\b/.exec(catalog);
  if(!id)throw Error('PDF page catalog unavailable');
  const pages=[],seen=new Set(),stack=[Number(id[1])];
  while(stack.length){
   const n=stack.pop();
   if(seen.has(n))throw Error('PDF page tree contains a cycle');
   seen.add(n);
   const obj=objects.get(n);if(!obj)throw Error('PDF page tree is incomplete');
   if(/\/Type\s*\/Pages\b/.test(obj)){
    const kids=/\/Kids\s*\[([\s\S]*?)\]/.exec(obj);
    if(!kids)throw Error('PDF page order unavailable');
    const ids=refs(kids[1]);for(let j=ids.length-1;j>=0;j--)stack.push(ids[j]);
   }else if(/\/Type\s*\/Page\b/.test(obj))pages.push({id:n,body:obj});
   else throw Error('Invalid PDF page tree');
   if(pages.length>MAX_PAGES||stack.length>MAX_PAGES)throw Error('PDF page limit exceeded');
  }
  if(!pages.length)throw Error('PDF contains no readable pages');
  return pages;
 }
 async function inflate(bytes){
  if(typeof root.DecompressionStream!=='function'||typeof root.Blob!=='function')
   throw Error('Local compressed-PDF decoding is unavailable');
  const reader=new root.Blob([bytes]).stream()
   .pipeThrough(new root.DecompressionStream('deflate')).getReader();
  const parts=[];let count=0;
  try{
   while(true){
    const {value,done}=await reader.read();if(done)break;
    count+=value.length;
    if(count>MAX_STREAM){await reader.cancel();throw Error('PDF text stream exceeds safety limit');}
    parts.push(value);
   }
  }finally{reader.releaseLock();}
  const result=new Uint8Array(count);let off=0;
  for(const part of parts){result.set(part,off);off+=part.length;}
  return result;
 }
 async function streamText(body){
  const marker=/\bstream(?:\r\n|\n|\r)/.exec(body);if(!marker)return '';
  const start=marker.index+marker[0].length;
  const header=body.slice(0,marker.index);
  // /Length counts binary bytes, excluding the separator before endstream.
  // Passing that separator to strict deflate decoders rejects valid PDFs.
  const length=/\/Length\s+(\d+)\b(?!\s+\d+\s+R)/.exec(header);
  let end=body.indexOf('endstream',start);
  if(end<start)throw Error('Unterminated PDF stream');
  if(length){
   const declared=Number(length[1]);
   if(start+declared>end||!/^\s*$/.test(body.slice(start+declared,end)))
    throw Error('Invalid PDF stream length');
   end=start+declared;
  }else if(body.slice(end-2,end)==='\r\n')end-=2;
  else if(body[end-1]==='\r'||body[end-1]==='\n')end--;
  let bytes=new Uint8Array(end-start);
  for(let i=0;i<bytes.length;i++)bytes[i]=body.charCodeAt(start+i)&255;
  if(/\/Filter\s*(?:\[\s*)?\/FlateDecode\b/.test(body.slice(0,marker.index)))
   bytes=await inflate(bytes);
  else if(/\/Filter\s*\//.test(body.slice(0,marker.index))||
    /\/Filter\s*\[/.test(body.slice(0,marker.index)))
   throw Error('Unsupported PDF text compression');
  if(bytes.length>MAX_STREAM)throw Error('PDF text stream exceeds safety limit');
  return binary(bytes);
 }
 function pdfLiteral(v){
  if(v[0]==='<'){
   const hex=v.slice(1,-1).replace(/\s+/g,'');
   if(!/^[0-9a-f]*$/i.test(hex))return '';
   const units=[];
   for(let i=0;i+1<hex.length;i+=2)units.push(parseInt(hex.slice(i,i+2),16));
   return binary(Uint8Array.from(units));
  }
  let out='';
  for(let i=1;i<v.length-1;i++){
   let c=v[i];
   if(c==='\\'&&i+1<v.length-1){
    const next=v[++i],esc={'n':'\n','r':'\r','t':'\t','b':' ','f':' ','(':'(',')':')','\\':'\\'};
    if(next in esc)c=esc[next];
    else if(/[0-7]/.test(next)){
     let oct=next;
     for(let j=0;j<2&&/[0-7]/.test(v[i+1]||'');j++)oct+=v[++i];
     c=String.fromCharCode(parseInt(oct,8));
    }else if(next==='\r'||next==='\n'){
     if(next==='\r'&&v[i+1]==='\n')i++;
     continue;
    }else c=next;
   }
   out+=c;
  }return out;
 }
 function readable(s){
  // WinAnsi-like fallback only; avoid claiming Unicode accuracy for custom fonts.
  return s.replace(/\x00/g,'').replace(/[\x01-\x08\x0b\x0e-\x1f]/g,'')
   .replace(/[\x7f-\x9f]/g,' ').replace(/\s+/g,' ').trim();
 }
 function textFromOps(decoded){
  const chunks=[];
  const groups=decoded.match(/BT\b[\s\S]*?ET\b/g)||[];
  for(const group of groups){
   // Strings are consumed only when used by Tj, TJ, ' or " operators.
   const tokens=group.match(/\((?:\\[\s\S]|[^\\)])*\)|<[\da-fA-F\s]+>|\[(?:\\[\s\S]|[^\]])*\]|\bTj\b|\bTJ\b|['"]/g)||[];
   let previous='';
   for(const token of tokens){
    if(token==='Tj'||token==='TJ'||token==="'"||token==='"'){
     if(previous[0]==='('||previous[0]==='<')chunks.push(readable(pdfLiteral(previous)));
     else if(previous[0]==='['){
      const parts=previous.match(/\((?:\\[\s\S]|[^\\)])*\)|<[\da-fA-F\s]+>/g)||[];
      chunks.push(readable(parts.map(pdfLiteral).join('')));
     }
     previous='';
    }else previous=token;
   }
  }
  const text=chunks.filter(Boolean).join(' ');
  if(text.length>MAX_PAGE_CHARS)throw Error('PDF page text exceeds 45,000 characters');
  return text;
 }
 function contents(pageBody){
  const match=/\/Contents\s*(\[[\s\S]*?\]|\d+\s+\d+\s+R)/.exec(pageBody);
  if(!match)return [];
  return refs(match[1]);
 }
 async function inspect(file,options={}){
  if(root.NeuroMapPdfJs)return root.NeuroMapPdfJs.inspect(file,options);
  if(!file||!Number.isFinite(file.size)||file.size<8||file.size>MAX_BYTES)
   throw Error('PDF text extraction supports files up to 128 MB');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(binary(bytes.subarray(0,5))!=='%PDF-')throw Error('Invalid PDF header');
  const objects=extractObjects(binary(bytes)),pageObjects=orderedPages(objects);
  let total=0,unreadable=0;
  const pages=[];
  for(let i=0;i<pageObjects.length;i++){
   const pg=pageObjects[i],contentIds=contents(pg.body);
   let text='',failure='';
   if(!contentIds.length)failure='No readable page content';
   for(const id of contentIds){
    try{
     const body=objects.get(id);if(!body)throw Error('Missing page content stream');
     const stream=await streamText(body);
     text+=(text?' ':'')+textFromOps(stream);
     if(text.length>MAX_PAGE_CHARS)throw Error('PDF page text exceeds 45,000 characters');
    }catch(e){failure=String(e.message||e);text='';break;}
   }
   if(!text)unreadable++;
   pages.push(Object.freeze({page:i+1,text,warning:failure}));
   total+=text.length;
   if(total>MAX_TOTAL_CHARS)throw Error('PDF text exceeds extraction limit');
  }
  return Object.freeze({pages,totalCharacters:total,unreadablePages:unreadable,
   warning:'Text-layer PDF only; verify extracted text against the original page. Scans, complex fonts and encrypted PDFs may not be readable.'});
 }
 function search(pages,term,limit=30){
  const q=String(term||'').trim().toLocaleLowerCase();if(!q)return [];
  const out=[];
  for(const item of pages||[]){
   const at=item.text.toLocaleLowerCase().indexOf(q);
   if(at<0)continue;
   out.push({page:item.page,excerpt:item.text.slice(Math.max(0,at-65),Math.min(item.text.length,at+q.length+120))});
   if(out.length>=limit)break;
  }return out;
 }
 return Object.freeze({inspect,search,MAX_BYTES:512*1024*1024,MAX_PAGES});
});
