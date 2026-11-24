'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../providers');
function googleTransport(){
 const calls=[];let folder=null;
 return {calls,async send(request){
  calls.push(request);
  if(request.url.includes('q=')&&request.url.includes('drive/v3/files'))
   return {status:200,json:{files:request.url.includes('mimeType')&&folder?[{id:folder}]:[]}};
  if(request.method==='POST'&&request.url.includes('drive/v3/files?fields=id')){
   folder='folder_123';return {status:200,json:{id:folder}};
  }
  if(request.url.includes('uploadType=multipart'))
   return {status:200,json:{id:'file_'+calls.length,md5Checksum:'abc'}};
  throw Error('Unexpected URL '+request.url);
 }};
}
test('Google Drive limits file search to app-owned document metadata and folder',async()=>{
 const tr=googleTransport(),a=P.google({transport:tr});
 const remote=await a.getMeta({id:'doc_12345678'});
 assert.equal(remote,null);
 assert.ok(tr.calls.some(x=>x.url.includes('appProperties')));
 assert.ok(tr.calls.some(x=>x.url.includes('Glauka')&&x.url.includes('q=')));
 assert.equal(tr.calls.every(x=>x.provider==='google'),true);
});
test('Google upload creates immutable revision for every changed map',async()=>{
 const tr=googleTransport(),a=P.google({transport:tr});
 const first=await a.create({id:'doc_12345678',name:'Study.glk',bytes:'{"root":{}}',hash:'sha-a'});
 const second=await a.update({id:'doc_12345678',name:'Study.glk',bytes:'{"root":{}}',hash:'sha-b'});
 assert.notEqual(first.id,second.id);
 assert.equal(tr.calls.filter(x=>x.url.includes('uploadType=multipart')).length,2);
});
test('Google larger than 5 MiB rejects when native resumable transport missing',async()=>{
 const tr=googleTransport(),a=P.google({transport:tr});
 await assert.rejects(a.create({id:'doc_12345678',name:'Book.glk',bytes:'a'.repeat(6*1024*1024),hash:'a'}),/resumable/);
});
test('Dropbox update uses remote rev compare-and-swap, not overwrite mode',async()=>{
 const calls=[];const t={async send(x){
  calls.push(x);
  if(x.url.endsWith('/upload'))return {status:200,json:{path_lower:'/glauka/doc_12345678.glk',rev:'revision-2'}};
  return {status:200,json:{}};
 }};
 const a=P.dropbox({transport:t});
 const result=await a.update({id:'doc_12345678',remoteId:'/glauka/doc_12345678.glk',
  expectedVersion:'revision-1',bytes:'{"root":{}}'});
 assert.equal(result.version,'revision-2');
 const args=JSON.parse(calls[0].headers['Dropbox-API-Arg']);
 assert.equal(args.mode.update,'revision-1');
 assert.equal(args.autorename,false);
});
test('Dropbox 409 revision conflict cannot be classified as successful sync',async()=>{
 const t={send:async()=>({status:409,json:{error_summary:'path/conflict'}})};
 const a=P.dropbox({transport:t});
 await assert.rejects(a.update({id:'doc_12345678',expectedVersion:'old',bytes:'abc'}),
  error=>error.status===409&&error.conflict===true);
});
test('provider transports are mandatory; untrusted document IDs denied',async()=>{
 assert.throws(()=>P.google(),/Native authorized/);
 assert.throws(()=>P.dropbox(),/Native authorized/);
 const t={send:async()=>({status:200,json:{files:[]}})};
 await assert.rejects(P.google({transport:t}).getMeta({id:'../oops'}),/Invalid Glauka/);
});

test('two Google Glauka folders cannot be selected nondeterministically',async()=>{
 const calls=[];const transport={send:async req=>{
  calls.push(req);
  return {status:200,json:{files:[{id:'glauka_A'},{id:'glauka_B'}]}};
 }};
 const driver=P.google({transport});
 await assert.rejects(driver.getMeta({id:'doc_12345678'}),/Multiple or unverified/);
 assert.equal(calls.length,1);
});
test('Google folder creation race is detected before any user file upload',async()=>{
 let seen=0;
 const driver=P.google({transport:{send:async r=>{
  if(r.url.includes('q=')){
   seen++;return {status:200,json:{files:seen===1?[]:[{id:'created_me'},{id:'created_other'}]}};
  }
  if(r.method==='POST')return {status:200,json:{id:'created_me'}};
  throw Error('unexpected');
 }}});
 await assert.rejects(driver.create({id:'doc_12345678',bytes:'{"root":{}}',hash:'abc'}),/raced/);
});
test('Google incomplete listing must not be trusted as the canonical document',async()=>{
 const driver=P.google({transport:{send:async req=>{
  if(req.url.includes('mimeType'))return {status:200,json:{files:[{id:'folder_A'}]}};
  return {status:200,json:{incompleteSearch:true,files:[]}};
 }}});
 await assert.rejects(driver.getMeta({id:'doc_12345678'}),/Incomplete/);
});
test('Dropbox content_hash is never mislabeled as a direct SHA-256 of local map',async()=>{
 const tr={send:async()=>({status:200,json:{
  '.tag':'file',path_lower:'/glauka/doc_12345678.glk',rev:'revision_1',content_hash:'dropbox-block-hash'
 }})};
 const meta=await P.dropbox({transport:tr}).getMeta({id:'doc_12345678'});
 assert.equal(meta.hash,null);
 assert.equal(meta.contentHash,'dropbox-block-hash');
 assert.equal(meta.hashAlgorithm,'dropbox-content-hash');
});
test('Dropbox errors other than path/not_found cannot be mistaken for missing file',async()=>{
 const driver=P.dropbox({transport:{send:async()=>({status:409,json:{error_summary:'path/malformed_path/...'}})}});
 await assert.rejects(driver.getMeta({id:'doc_12345678'}),e=>e.status===409);
 const missing=P.dropbox({transport:{send:async()=>({status:409,json:{error_summary:'path/not_found/'}})}});
 assert.equal(await missing.getMeta({id:'doc_12345678'}),null);
});

test('Google malformed metadata cannot be interpreted as a missing remote document',async()=>{
 const t={send:async req=>({status:200,json:req.url.includes('mimeType')
  ?{files:[{id:'folder_good'}]}:{nextPageToken:null}})};
 await assert.rejects(P.google({transport:t}).getMeta({id:'doc_12345678'}),/Invalid Google revision listing/);
});
test('provider rejects prototype-special logical IDs instead of serializing them into folder metadata',async()=>{
 const t={send:async()=>({status:200,json:{files:[]}})};
 for(const id of ['__proto__','constructor','prototype'])
  await assert.rejects(P.google({transport:t}).getMeta({id}),/Invalid Glauka/);
});

test('Google paginated discovery finds distinct maps while retaining latest known revision',async()=>{
 const calls=[];
 const t={send:async req=>{
  calls.push(req);
  const u=new URL(req.url),q=u.searchParams.get('q')||'';
  if(q.includes("mimeType = 'application/vnd.google-apps.folder'"))
   return {status:200,json:{files:[{id:'folder_1'}]}};
  if(q.includes("mimeType = 'application/json'")){
   const next=u.searchParams.get('pageToken');
   return {status:200,json:next==='P2'
    ?{files:[{id:'v2',createdTime:'2026-10-27T15:01:00Z',name:'Map.glk',
      appProperties:{glaukaId:'doc_12345678',glaukaHash:'sha-new'}},
     {id:'c1',createdTime:'2026-10-27T15:01:00Z',name:'Second.glk',
      appProperties:{glaukaId:'doc_99999999',glaukaHash:'sha-second'}}]}
    :{nextPageToken:'P2',files:[{id:'v1',createdTime:'2026-10-26T15:00:00Z',
      appProperties:{glaukaId:'doc_12345678',glaukaHash:'sha-old'}}]}};
  }
  throw Error('Unexpected Google API URL '+req.url);
 }};
 const results=await P.google({transport:t}).listRemote();
 assert.equal(results.length,2);
 assert.equal(results.find(x=>x.id==='doc_12345678').remoteId,'v2');
 assert.equal(results.find(x=>x.id==='doc_99999999').remoteId,'c1');
 assert.equal(calls.filter(x=>x.url.includes('pageToken=')).length,1);
});
test('Google discovery fails closed on looping cursor or ambiguous equal-time revisions',async()=>{
 const folder={status:200,json:{files:[{id:'folder_1'}]}};
 const looping=P.google({transport:{send:async req=>{
  const q=new URL(req.url).searchParams.get('q')||'';
  return q.includes("application/vnd.google-apps.folder")?folder:{status:200,json:{files:[],nextPageToken:'C1'}};
 }}});
 await assert.rejects(looping.listRemote(),/looping/);
 const fork=P.google({transport:{send:async req=>{
  const q=new URL(req.url).searchParams.get('q')||'';
  return q.includes("application/vnd.google-apps.folder")?folder:{status:200,json:{files:[
   {id:'A',createdTime:'2026-10-27T12:00:00Z',appProperties:{glaukaId:'doc_12345678',glaukaHash:'a'}},
   {id:'B',createdTime:'2026-10-27T12:00:00Z',appProperties:{glaukaId:'doc_12345678',glaukaHash:'b'}}
  ]}};
 }}});
 await assert.rejects(fork.listRemote(),/Ambiguous concurrent/);
});
test('Dropbox paginated discovery is limited to Glauka direct .glk files',async()=>{
 const calls=[],t={send:async req=>{
  calls.push(req);
  if(req.url.endsWith('/create_folder_v2'))return {status:409};
  if(req.url.endsWith('/get_metadata'))return {status:200,json:{'.tag':'folder'}};
  if(req.url.endsWith('/list_folder'))return {status:200,json:{
   cursor:'safe-cursor',has_more:true,entries:[
    {'.tag':'file',path_lower:'/glauka/doc_12345678.glk',
     name:'First.glk',rev:'rev1',content_hash:'dropbox1'},
    {'.tag':'file',path_lower:'/another/doc_77777777.glk',rev:'unsafe'},
    {'.tag':'folder',path_lower:'/glauka/notes'}]}};
  if(req.url.endsWith('/list_folder/continue'))return {status:200,json:{
   has_more:false,cursor:'final',entries:[
    {'.tag':'file',path_lower:'/glauka/doc_99999999.glk',rev:'rev2',name:'Second.glk'}]}};
  throw Error('Unexpected Dropbox RPC');
 }};
 const items=await P.dropbox({transport:t}).listRemote();
 assert.equal(items.length,2);
 assert.equal(items[0].hash,null);
 assert.equal(items[0].remoteId,'/glauka/doc_12345678.glk');
 assert.equal(calls.some(x=>x.url.endsWith('/list_folder/continue')),true);
 assert.equal(JSON.parse(calls.find(x=>x.url.endsWith('/list_folder')).body).path,'/Glauka');
});
test('Dropbox discovery rejects reused cursor and excessive/invalid page data',async()=>{
 const t={send:async req=>{
  if(req.url.endsWith('/create_folder_v2'))return {status:200,json:{}};
  return {status:200,json:{cursor:'loop',has_more:true,entries:[]}};
 }};
 await assert.rejects(P.dropbox({transport:t}).listRemote(),/looping/);
});
