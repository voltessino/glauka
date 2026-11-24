/* Offline PDF→bounded raster→Italian OCR. One owner/child worker per batch. */
(function(root){
'use strict';
const C=root.NeuroMapOCRCore,Q=root.NeuroMapOCRQuality,I=root.NeuroMapOCRImage,S=root.NeuroMapOCRStructure;
const base=()=>/\/app\/index\.html$/i.test(location.pathname)?'/assets/ocr/':'/ocr/';
function aborted(){return new DOMException('Cancelled','AbortError')}
function check(signal){if(signal?.aborted)throw aborted()}
function race(p,signal){return new Promise((resolve,reject)=>{
 const stop=()=>reject(aborted());
 Promise.resolve(p).then(resolve,reject).finally(()=>signal?.removeEventListener('abort',stop));
 if(signal?.aborted){stop();return}signal?.addEventListener('abort',stop,{once:true});
})}
function owner(signal,onProgress){
 const worker=new Worker(base()+'host-worker.js'),pending=new Map();let seq=0;
 const rejectAll=error=>{for(const p of pending.values())p.reject(error);pending.clear()};
 const stop=()=>{worker.terminate();rejectAll(aborted())};
 signal?.addEventListener('abort',stop,{once:true});
 worker.onerror=event=>{event.preventDefault();rejectAll(Error('OCR runtime unavailable: '+event.message))};
 worker.onmessage=({data})=>{if(data.type==='progress'){onProgress?.(data);return}const p=pending.get(data.id);if(p){pending.delete(data.id);data.ok?p.resolve(data):p.reject(Error(data.message||'OCR error'))}};
 return {request(type,image,options={}){check(signal);return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});worker.postMessage({...options,id,type,image})})},close(){signal?.removeEventListener('abort',stop);worker.terminate();rejectAll(aborted())}};
}
async function raster(page,signal,{dpi=180,crop=[0,0,1,1],enhance=false,previewOnly=false}={}){
 check(signal);Q.region(crop);const initial=page.getViewport({scale:dpi/72}),limit=6000000;
 const fraction=Math.min(1,Math.sqrt(limit/(initial.width*initial.height*crop[2]*crop[3])),4000/(initial.width*crop[2]),4000/(initial.height*crop[3]));
 if(!Number.isFinite(fraction)||fraction<=0)throw Error('Invalid PDF dimensions');
 const viewport=page.getViewport({scale:dpi/72*fraction}),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.floor(viewport.width*crop[2]));canvas.height=Math.max(1,Math.floor(viewport.height*crop[3]));
 const ctx=canvas.getContext('2d',{alpha:false});
 if(ctx){ctx.fillStyle='#ffffff';ctx.fillRect?.(0,0,canvas.width,canvas.height);}
 const renderOpts={canvasContext:ctx,viewport,background:'#ffffff'};
 if(crop[0]>0||crop[1]>0)renderOpts.transform=[1,0,0,1,-crop[0]*viewport.width,-crop[1]*viewport.height];
 const task=page.render(renderOpts),stop=()=>task.cancel();
 signal?.addEventListener('abort',stop,{once:true});
 try{
  check(signal);await task.promise;check(signal);
  // Always show the original page preview for human review, but avoid the
  // expensive full-size PNG encode when the selectable text is sufficient.
  const width=canvas.width,height=canvas.height;
  const thumbnail=document.createElement('canvas'),ratio=Math.min(1,1600/width,2100/height);
  thumbnail.width=Math.max(1,Math.floor(width*ratio));thumbnail.height=Math.max(1,Math.floor(height*ratio));
  let preview,blank=false;
  try{
   const tctx=thumbnail.getContext('2d',{willReadFrequently:true});
   if(tctx){
    tctx.fillStyle='#ffffff';tctx.fillRect?.(0,0,thumbnail.width,thumbnail.height);
    tctx.drawImage(canvas,0,0,thumbnail.width,thumbnail.height);
   }
   preview=thumbnail.toDataURL('image/jpeg',.82);
   if(preview.length>1500000)preview=thumbnail.toDataURL('image/jpeg',.68);
   if(typeof tctx?.getImageData==='function'){
    try{
     const px=tctx.getImageData(0,0,thumbnail.width,thumbnail.height).data;
     let ink=0,samples=0;const step=Math.max(4,Math.floor(px.length/4000))*4;
     for(let i=0;i<px.length;i+=step){samples++;if(px[i]<242||px[i+1]<242||px[i+2]<242)ink++;}
     blank=samples>0&&ink===0;
    }catch(_){}
   }
  }finally{thumbnail.width=thumbnail.height=0}
  check(signal);if(preview.length>1500000)throw Error('Preview exceeds limit');
  if(previewOnly)return {png:null,preview,width,height,blank,processing:{angle:0,contrast:false},crop};
  const orientationHint=!enhance&&I.orientationOf?await I.orientationOf(canvas,{signal}):null;
  const optimized=enhance?await I.improve(canvas,{signal}):null;
  // An optimized PNG already exists: do not encode a discarded full-size original.
  const png=optimized?.png||await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG failed')),'image/png'));
  check(signal);if(png.size>20*1024*1024)throw Error('OCR image exceeds limit');
  return {png,preview,width:optimized?.width||width,height:optimized?.height||height,blank,processing:{...(optimized?.processing||{angle:0,contrast:false}),orientationHint:optimized?.processing?.orientationHint||orientationHint},transform:optimized?.transform,crop};
 }finally{signal?.removeEventListener('abort',stop);canvas.width=canvas.height=0;page.cleanup?.()}
}
async function analyze(file,selection,{signal,force=false,enhance=false,order='auto',onProgress,onPage,cache=new Map()}={}){
 const MAX_SESSION_PREVIEWS=256*1024*1024,MAX_CACHE=100;
 let engine,previewBytes=0,progressContext;
 const countPreview=item=>{previewBytes+=item.preview.length;if(previewBytes>MAX_SESSION_PREVIEWS)throw Error('OCR previews exceed session limit')};
 try{return await root.NeuroMapPdfJs.withDocument(file,async(doc,source,lib)=>{
  const selected=C.pages(selection,doc.numPages),results=[];
  // Compute the stable PDF.js operator IDs once per document, not per page.
  const imageOps=new Set([lib.OPS.paintImageXObject,lib.OPS.paintInlineImageXObject,
   lib.OPS.paintImageMaskXObject,lib.OPS.paintImageXObjectRepeat,
   lib.OPS.paintInlineImageXObjectGroup,lib.OPS.paintImageMaskXObjectGroup,
   lib.OPS.paintImageMaskXObjectRepeat].filter(x=>x!==undefined));
  for(let i=0;i<selected.length;i++){
   check(signal);const n=selected[i],key=source.sha256+':'+n+':structure1:ita-best-wasm6:180:'+force+':'+enhance+':'+order;
   progressContext={page:n,index:i+1,total:selected.length};onProgress?.({...progressContext,phase:'page'});
   if(cache.has(key)){const item={...cache.get(key)};countPreview(item);results.push(item);onPage?.(item,source);continue}
   const page=await race(doc.getPage(n),signal);
   try{
    const content=await race(page.getTextContent(),signal),text=root.NeuroMapPdfJs.pageText(content);
    const ops=await race(page.getOperatorList(),signal);
    const hasImages=ops.fnArray.some(x=>imageOps.has(x));
    const coverage=C.imageCoverage(ops,lib.OPS,page.view),letters=(text.match(/[\p{L}\p{N}]/gu)||[]).length;
    const native=!force&&((!hasImages&&letters>=20)||(letters>=160&&coverage!==null&&coverage<.2));
    const bitmap=await raster(page,signal,{enhance:enhance&&!native,previewOnly:native});
    let recognized,method;
    if(native){recognized={text,lines:S.nativeLines(content,page.getViewport({scale:1}))};method='native'}
    else{
     if(!engine){engine=owner(signal,p=>onProgress?.({...progressContext,phase:'ocr',progress:p.progress}));await race(engine.request('init'),signal)}
     const raw=await race(engine.request('recognize',bitmap.png),signal);recognized=decode(raw.tsv,bitmap);method='ocr';
    }
    check(signal);countPreview(bitmap);
    const comparable=method==='ocr'||recognized.lines.map(l=>l.text).join(' ').replace(/\s+/g,' ').trim()===recognized.text.replace(/\s+/g,' ').trim();
    let ordered=comparable&&recognized.lines.length?Q.readingOrder(recognized.lines,{mode:order}):{text:recognized.text,lines:[],mode:'engine',partial:true};
    if(method==='native'&&ordered.mode==='engine'){ordered={...ordered,text:recognized.text,lines:recognized.lines}}
    const item={page:n,nativeText:text,text:ordered?.text??recognized.text,rawText:recognized.text,lines:recognized.lines,orderedLines:ordered.lines,structure:S.analyze(ordered.text,ordered.lines),orderMode:ordered?.mode||'engine',orderAmbiguous:!!ordered?.ambiguous,orderPartial:!!ordered?.partial,processing:bitmap.processing,method,hasImages,blank:!!bitmap.blank,preview:bitmap.preview};
    const frozen=Object.freeze({...item});cache.set(key,frozen);while(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value);
    results.push(item);onPage?.(item,source);
   }finally{page.cleanup?.()}
  }
  return {results,source};
 },{signal})}finally{engine?.close()}
}
function decode(tsv,bitmap){
 const raw=C.tsv(tsv,bitmap.width,bitmap.height);
 const lines=raw.lines.map(line=>{
  const local=bitmap.transform?I.sourceBox(line.box,bitmap.transform):line.box;const [x,y,w,h]=bitmap.crop;
  return {...line,layoutBox:line.box,box:[x+local[0]*w,y+local[1]*h,local[2]*w,local[3]*h],words:line.words?.map(word=>{
   const b=bitmap.transform?I.sourceBox(word.box,bitmap.transform):word.box;return {...word,layoutBox:word.box,box:[x+b[0]*w,y+b[1]*h,b[2]*w,b[3]*h]};
  })};
 });return {text:raw.text,lines};
}
async function reread(file,pageNumber,crop,{signal,enhance=true,onProgress}={}){
 Q.region(crop);let engine;
 try{return await root.NeuroMapPdfJs.withDocument(file,async(doc,source)=>{
  if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>doc.numPages)throw Error('Invalid PDF page');
  const page=await race(doc.getPage(pageNumber),signal);
  try{
   const bitmap=await raster(page,signal,{dpi:300,crop,enhance});
   engine=owner(signal,onProgress);await race(engine.request('init'),signal);
   const raw=await race(engine.request('recognize',bitmap.png,{psm:6}),signal);check(signal);
   return {...decode(raw.tsv,bitmap),source,page:pageNumber,preview:bitmap.preview,processing:bitmap.processing,crop};
  }finally{page.cleanup?.()}
 },{signal})}finally{engine?.close()}
}
root.NeuroMapOCR=Object.freeze({analyze,reread,base});
})(globalThis);
