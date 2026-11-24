/* 7.1 Quick Capture — local inbox-like capture into the current map.
 * No browser extension, network fetch, or external persistence.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapCaptureCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_TEXT=20000,MAX_TITLE=180;
 const trim=(x,max)=>String(x==null?'':x).replace(/\0/g,'').trim().slice(0,max);
 const safeURL=value=>{
  if(!value)return '';
  try{
   const parsed=new URL(String(value).trim());
   if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)return '';
   return parsed.href.slice(0,2048);
  }catch{return '';}
 };
 function propose(input){
  const body=trim(input?.text,MAX_TEXT);
  const title=trim(input?.title,MAX_TITLE);
  const rawURL=trim(input?.url,2048),url=safeURL(rawURL);
  if(rawURL&&!url)throw Error('Only valid HTTP(S) links without credentials are accepted');
  if(!body&&!url)throw Error('Enter text or a valid website link');
  const first=body.split(/\r?\n/).map(x=>x.trim()).find(Boolean)||'';
  const label=title||first.slice(0,110)||(url?new URL(url).hostname:'Nuova nota');
  const note=body.slice(0,MAX_TEXT);
  return Object.freeze({title:label,notes:note,linkUrl:url,
   preview:note.slice(0,300),truncated:typeof input?.text==='string'&&input.text.trim().length>MAX_TEXT});
 }
 return Object.freeze({propose,safeURL,MAX_TEXT});
});
