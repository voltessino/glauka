/* NeuroMap offline PDF.js adapter.
 * A preverified Mozilla PDF.js distribution is served ONLY by our local app
 * server/WebView asset handler. It never sends documents or requests to a CDN.
 * It does not summarize text or guess concepts. Source pages remain auditable.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapPdfJs=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const MAX_BYTES=512*1024*1024,MAX_PAGES=10000,MAX_PAGE_CHARS=45000;
 const MAX_TOTAL_CHARS=6000000,MAX_OUTLINE=60,MAX_TITLE=160;
 let pending=null;
 // Weak keys: cached text is automatically released when the owning File is gone.
 const recentPlain=new WeakMap(),recentDigest=new WeakMap();
 // Immutable File/Blob identities may be reread for multiple OCR regions.
 // Retain only the SHA-256 promise (32 bytes), never the PDF byte buffer.
 // Failures evict themselves so permission/runtime errors are retryable.
 const fingerprints=new WeakMap();
 function fingerprint(file,bytes){
  const existing=fingerprints.get(file);
  if(existing)return existing;
  const subtle=root.crypto?.subtle;
  if(!subtle?.digest)return Promise.reject(Error('SHA-256 is not available'));
  const request=Promise.resolve().then(async()=>{
   const value=new Uint8Array(await subtle.digest('SHA-256',bytes));
   return Array.from(value,b=>b.toString(16).padStart(2,'0')).join('');
  });
  fingerprints.set(file,request);
  request.catch(()=>{if(fingerprints.get(file)===request)fingerprints.delete(file);});
  return request;
 }
 function paths(){
  const android=/\/app\/index\.html$/i.test(root.location?.pathname||'');
  const base=android?'/assets/pdfjs/' :'/pdfjs/';
  return {module:base+'pdf.mjs',worker:base+'pdf.worker.mjs',wasm:base+'wasm/'};
 }
 async function library(){
  if(pending)return pending;
  const {module,worker}=paths();
  // Paths are constants belonging to NeuroMap; never derived from the PDF.
  pending=import(module).then(lib=>{
   if(typeof lib.getDocument!=='function'||!lib.GlobalWorkerOptions)throw Error('PDF.js display module invalid');
   lib.GlobalWorkerOptions.workerSrc=worker;
   return lib;
  }).catch(error=>{pending=null;throw Error('Local PDF.js 6.4.299 unavailable: '+String(error?.message||error))});
  return pending;
 }
 const clean=s=>String(s??'').replace(/[\u0000-\u0008\u000b-\u001f]/g,' ').replace(/\s+/g,' ').trim();
 function pageText(content){
  if((content?.items||[]).length>60000)throw Error('PDF page contains too many text fragments');
  let value='',lastY=null;
  for(const item of content?.items||[]){
   if(!item||typeof item.str!=='string')continue;
   const y=Array.isArray(item.transform)?Number(item.transform[5]):NaN;
   if(Number.isFinite(y)&&lastY!==null&&Math.abs(lastY-y)>4)
    value+='\n';
   else if(value&&!value.endsWith('\n'))value+=' ';
   value+=clean(item.str);
   if(item.hasEOL)value+='\n';
   if(Number.isFinite(y))lastY=y;
   if(value.length>MAX_PAGE_CHARS)throw Error('PDF.js page exceeds 45,000 text characters: import a smaller section');
  }
  return value.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 }
 async function bookmarks(doc){
  let raw;
  try{raw=await doc.getOutline()}catch{return []}
  const found=[],todo=(Array.isArray(raw)?raw:[]).map(entry=>({entry,depth:0})).slice(0,300).reverse(),seen=new Set();
  let checked=0;
  while(todo.length&&found.length<MAX_OUTLINE&&checked++<300){
   const {entry,depth}=todo.pop();
   if(!entry||typeof entry!=='object'||seen.has(entry))continue;
   seen.add(entry);
   const title=clean(entry.title).slice(0,MAX_TITLE);
   if(title){
    try{
     let dest=entry.dest;
     if(typeof dest==='string')dest=await doc.getDestination(dest);
     const ref=Array.isArray(dest)?dest[0]:null;
     const page=ref&&typeof ref==='object'&&Number.isInteger(ref.num)
      ?1+await doc.getPageIndex(ref):null;
     if(Number.isInteger(page)&&page>=1&&page<=doc.numPages)
      found.push({title,page,depth});
    }catch{/* Unsupported outline destinations are omitted, not guessed. */}
   }
   for(const child of (Array.isArray(entry.items)?entry.items:[]).slice(0,50).reverse())
    todo.push({entry:child,depth:depth+1});
  }
  return found.sort((a,b)=>a.page-b.page||a.depth-b.depth);
 }
 async function inspect(file,options={}){return inspectCached(file,options,library)}
 async function inspectCached(file,options={},loader=library){
  // Only immutable full-document reads without progress/cancellation can share
  // a promise; a failed read is evicted so retry is possible.
  const share=file&&typeof file==='object'&&!options.signal&&
   !options.onProgress&&options.maxPages===undefined;
  if(!share)return inspectWith(await loader(),file,options);
  const cache=options.includeDigest?recentDigest:recentPlain;
  const existing=cache.get(file);
  if(existing)return existing;
  const request=Promise.resolve().then(loader).then(lib=>inspectWith(lib,file,options));
  cache.set(file,request);
  request.catch(()=>{if(cache.get(file)===request)cache.delete(file)});
  return request;
 }
 async function inspectWith(lib,file,options={}){
  if(!file||!Number.isFinite(file.size)||file.size<8||file.size>MAX_BYTES)
   throw Error('PDF.js supports local documents up to 512 MB');
  const first5=new Uint8Array(await file.slice(0,5).arrayBuffer());
  if(String.fromCharCode(...first5)!=='%PDF-')throw Error('Invalid PDF header');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.byteLength!==file.size)throw Error('File size changed during inspection');
  let digest='';
  if(options.includeDigest){
   // Hash before PDF.js may transfer the file's ArrayBuffer to its worker.
   digest=await fingerprint(file,bytes);
  }
  const task=lib.getDocument({
   data:bytes,stopAtErrors:true,enableXfa:false,isEvalSupported:false,
   useWasm:false,useSystemFonts:false,disableFontFace:true,
  });
  // Abort work already running in the worker rather than waiting for another
  // page boundary. This matters for 200-page PDFs and malformed slow pages.
  // Worker termination must happen at most once even when AbortSignal fires
  // during the normal finally cleanup.
  let disposed;
  const dispose=()=>disposed||(disposed=Promise.resolve().then(()=>task.destroy()).catch(()=>{}));
  const stop=()=>{void dispose();};
  options.signal?.addEventListener?.('abort',stop,{once:true});
  let doc;
  try{
   if(options.signal?.aborted)throw Error('PDF read cancelled');
   doc=await task.promise;
   if(doc.numPages<1||doc.numPages>MAX_PAGES)
    throw Error('PDF has more than 10,000 pages: choose a smaller section');
   const pages=[],outline=await bookmarks(doc);
   let total=0,unreadable=0;
   const readLimit=options.maxPages&&Number.isInteger(options.maxPages)
    ?Math.min(doc.numPages,Math.max(1,options.maxPages)):doc.numPages;
   // Two bounded in-flight pages reduce worker roundtrips on long documents.
   // Results are committed in page order; each page is cleaned up immediately.
   // All jobs resolve to a tagged result, avoiding unhandled rejections when
   // cancellation or a malformed page ends the entire read early.
   const readPage=async pageNumber=>{
    if(options.signal?.aborted)throw Error('PDF read cancelled');
    const p=await doc.getPage(pageNumber);
    let text='',warning='';
    try{
     if(options.signal?.aborted)throw Error('PDF read cancelled');
     const result=await p.getTextContent({disableNormalization:false,includeMarkedContent:false});
     if(options.signal?.aborted)throw Error('PDF read cancelled');
     text=pageText(result);
    }catch(err){
     if(options.signal?.aborted)throw Error('PDF read cancelled');
     const errName=String(err?.name||''),message=String(err?.message||err);
     // Resource-limit failures must stop the import, not be downgraded to an
     // unreadable page; otherwise a huge document appears to import intact.
     if(errName==='PasswordException'||errName==='InvalidPDFException'||errName==='FormatError'||
        message.includes('45,000 text characters')||message.includes('too many text fragments'))throw err;
     warning='Page has unsupported or malformed text: '+message.slice(0,160);
    }finally{p.cleanup?.()}
    return {page:pageNumber,text,warning};
   };
   const inFlight=[];
   let nextPage=1;
   const prefetch=()=>{
    while(nextPage<=readLimit&&inFlight.length<2){
     const n=nextPage++;
     inFlight.push(readPage(n).then(value=>({value}),error=>({error})));
    }
   };
   prefetch();
   for(let i=1;i<=readLimit;i++){
    if(options.signal?.aborted)throw Error('PDF read cancelled');
    const settled=await inFlight.shift();
    if(settled.error)throw settled.error;
    const result=settled.value;
    if(!result.text)unreadable++;
    pages.push(result);
    total+=result.text.length;
    if(total>MAX_TOTAL_CHARS)
     throw Error('PDF text exceeds 6 million characters; choose a smaller section');
    if(i%8===0&&typeof options.onProgress==='function')
     options.onProgress({processed:i,total:readLimit});
    prefetch();
   }
   // Shared weakly-cached analysis cannot be modified by a consumer.
   for(const p of pages)Object.freeze(p);
   for(const mark of outline)Object.freeze(mark);
   return Object.freeze({pages:Object.freeze(pages),outline:Object.freeze(outline),totalCharacters:total,unreadablePages:unreadable,
    totalPages:doc.numPages,partial:readLimit<doc.numPages,sha256:digest,engine:'PDF.js 6.4.299',
    warning:'Local text extraction only. Scans without a text layer require OCR; always verify quotes and page numbers.'});
  }finally{
   options.signal?.removeEventListener?.('abort',stop);
   // Kill the worker and release document buffers, including on rejection.
   await dispose();
  }
 }
 // Explicit scoped access for the selective OCR rasterizer. Always release the
 // PDF worker; source fingerprint is computed before transferring its bytes.
 async function withDocument(file,action,{signal}={}){
  if(!file||!Number.isFinite(file.size)||file.size<8||file.size>MAX_BYTES)throw Error('PDF supports files up to 512 MB');
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(bytes.byteLength!==file.size||String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')throw Error('Invalid PDF');
  const sha256=await fingerprint(file,bytes);
  const lib=await library();
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const {wasm}=paths();
  const task=lib.getDocument({data:bytes,enableXfa:false,isEvalSupported:false,useWasm:true,wasmUrl:wasm,useWorkerFetch:true});
  let disposed;
  const dispose=()=>disposed||(disposed=Promise.resolve().then(()=>task.destroy()).catch(()=>{}));
  const stop=()=>{void dispose()};signal?.addEventListener?.('abort',stop,{once:true});
  try{
   const doc=await task.promise;
   if(doc.numPages<1||doc.numPages>MAX_PAGES)throw Error('PDF exceeds 10,000 pages');
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   return await action(doc,{fileName:String(file.name||'Document.pdf').slice(0,255),sha256,totalPages:doc.numPages},lib);
  }finally{signal?.removeEventListener?.('abort',stop);await dispose()}
 }
 async function peek(file,{signal}={}){
  return withDocument(file,async(doc,source)=>{
   const outline=await bookmarks(doc);
   return {...source,size:file.size,outline};
  },{signal});
 }
 async function warmup(){
  try{
   const lib=await library();
   const {worker}=paths(),doc=root.document;
   if(doc?.head&&worker&&!doc.head.querySelector(`link[rel="modulepreload"][href="${worker}"]`)){
    const link=doc.createElement('link');link.rel='modulepreload';link.href=worker;doc.head.append(link);
   }
   return lib;
  }catch(_){return null}
 }
 return Object.freeze({inspect,inspectCached,inspectWith,withDocument,peek,warmup,pageText,MAX_BYTES,MAX_PAGES,MAX_TOTAL_CHARS,paths,version:'6.4.299'});
});
