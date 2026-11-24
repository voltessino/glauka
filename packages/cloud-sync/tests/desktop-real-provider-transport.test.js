'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Providers=require('../providers');
const id='glg_abcdef1234567890',dropboxID='gld_abcdef1234567890';
const workspaceA=JSON.stringify({version:3,tabs:[{id:'a',root:{text:'A',children:[]}}]});
const workspaceB=JSON.stringify({version:3,tabs:[{id:'a',root:{text:'B',children:[]}}]});

test('Google Drive: app folder, immutable revisions, verified download',async()=>{
 let folder=null,sequence=0;const files=new Map(),operations=[];
 const transport={send:async({method,url,body,format})=>{
  operations.push({method,url,format});
  if(method==='GET'&&decodeURIComponent(url).includes("application/vnd.google-apps.folder"))return {status:200,json:{files:folder?[{id:folder,name:'Glauka'}]:[]}};
  if(method==='POST'&&url.endsWith('/drive/v3/files?fields=id')){folder='folder1';return {status:200,json:{id:folder}};}
  if(method==='POST'&&url.includes('uploadType=multipart')){
   assert.ok(body instanceof Blob,'production transport sends a real multipart Blob');
   const boundary=body.type.split('boundary=')[1];
   assert.ok(boundary);
   const parts=(await body.text()).split('--'+boundary);
   const content=part=>part.slice(part.indexOf('\r\n\r\n')+4).replace(/\r\n$/,'');
   const metadata=JSON.parse(content(parts[1])),bytes=content(parts[2]);
   const file={id:'remote'+(++sequence),name:metadata.name,createdTime:'2026-10-30T00:00:0'+sequence+'Z',
    md5Checksum:'etag'+sequence,appProperties:metadata.appProperties,bytes};
   files.set(file.id,file);return {status:200,json:file};
  }
  if(method==='GET'&&url.includes('alt=media')){
   const key=url.split('/files/')[1].split('?')[0];return {status:200,bytes:files.get(key)?.bytes};
  }
  if(method==='GET'&&url.includes('/drive/v3/files?')){
   return {status:200,json:{files:[...files.values()].sort((a,b)=>b.createdTime.localeCompare(a.createdTime))}};
  }
  throw Error('Unmocked Google route: '+method+' '+url);
 }};
 const g=Providers.google({transport});
 const first=await g.create({id,bytes:workspaceA,hash:'a'.repeat(64)});
 assert.ok(folder);assert.equal(files.size,1);
 const meta=await g.getMeta({id});
 assert.equal(meta.id,first.id);assert.equal(meta.hash,'a'.repeat(64));
 const copy=await g.download({id});
 assert.equal(copy.bytes,workspaceA);
 await g.update({id,bytes:workspaceB,hash:'b'.repeat(64)});
 const latest=await g.getMeta({id});
 assert.notEqual(latest.version,first.version);
 assert.equal(latest.hash,'b'.repeat(64));
 assert.equal(files.size,2,'earlier revision must remain recoverable');
 assert.ok(operations.some(x=>x.format==='multipart'));
});
test('Dropbox: app folder, compare-and-swap updates and recovery',async()=>{
 let folder=false,version=0;const files=new Map(),operations=[];
 const transport={send:async({method,url,headers={},body})=>{
  operations.push(url);
  if(url.endsWith('/create_folder_v2')){if(folder)return {status:409,json:{error_summary:'path/conflict/folder'}};folder=true;return {status:200,json:{metadata:{'.tag':'folder'}}};}
  if(url.endsWith('/get_metadata')){
   const path=JSON.parse(body).path.toLowerCase();
   if(path==='/glauka')return {status:200,json:{'.tag':'folder'}};
   const f=files.get(path);return f?{status:200,json:{'.tag':'file',path_lower:path,rev:f.rev,content_hash:'blockhash'}}:
    {status:409,json:{error_summary:'path/not_found/'}};
  }
  if(url.endsWith('/upload')){
   const a=JSON.parse(headers['Dropbox-API-Arg']),path=a.path.toLowerCase(),old=files.get(path);
   if(a.mode==='add'&&old)return {status:409,json:{error_summary:'path/conflict/file'}};
   if(a.mode?.['.tag']==='update'&&a.mode.update!==old?.rev)return {status:409,json:{error_summary:'path/conflict/file'}};
   const rev='v'+(++version);files.set(path,{rev,bytes:body});
   return {status:200,json:{path_lower:path,rev,content_hash:'blockhash'}};
  }
  if(url.endsWith('/download')){
   const path=JSON.parse(headers['Dropbox-API-Arg']).path.toLowerCase();
   return {status:200,bytes:files.get(path)?.bytes};
  }
  if(url.endsWith('/list_folder')){
   return {status:200,json:{entries:[...files].map(([path,f])=>({'.tag':'file',path_lower:path,
    name:path.split('/').pop(),rev:f.rev,content_hash:'blockhash'})),has_more:false}};
  }
  throw Error('Unmocked Dropbox route '+url);
 }};
 const d=Providers.dropbox({transport});
 const first=await d.create({id:dropboxID,bytes:workspaceA});
 const meta=await d.getMeta({id:dropboxID});
 assert.equal(meta.version,first.version);
 const changed=await d.update({id:dropboxID,remoteId:meta.id,expectedVersion:meta.version,bytes:workspaceB});
 assert.notEqual(changed.version,meta.version);
 const downloaded=await d.download({id:dropboxID,remoteId:changed.id});
 assert.equal(downloaded.bytes,workspaceB);
 const list=await d.listRemote();assert.equal(list.length,1);
 assert.equal(list[0].id,dropboxID);
 await assert.rejects(d.update({id:dropboxID,remoteId:changed.id,
   expectedVersion:meta.version,bytes:workspaceA}),e=>e.conflict===true);
 assert.ok(operations.every(u=>u.includes('dropboxapi.com')));
});
