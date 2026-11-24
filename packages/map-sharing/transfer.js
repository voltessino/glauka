/* F11.1–F11.2 — one-map copy, inbox and local pairing.
 * No account, no cloud and no listening socket in this file.
 * Accepting a copy never replaces an open document.
 */
(function(root,factory){
  const core=root.GlaukaMapSharingCore||(typeof require==='function'?require('./core'):null);
  const api=factory(core);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GlaukaMapTransfer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Core){
 'use strict';
 if(!Core)throw Error('Glauka sharing core missing');
 const FILE_SCHEMA='GlaukaMapFile-v1';
 const QR_VERSION=1;
 const CHUNK=32*1024;
 const DEFAULT_TTL=120000;
 const subtle=()=>{
  const crypto=globalThis.crypto;
  if(!crypto?.subtle||typeof crypto.getRandomValues!=='function')
    throw Error('WebCrypto unavailable');
  return crypto;
 };
 const nowMs=clock=>typeof clock==='function'?clock():Date.now();
 const iso=ms=>new Date(ms).toISOString();
 const bytesOf=str=>new TextEncoder().encode(str);
 const textOf=bytes=>new TextDecoder().decode(bytes);
 const b64=bytes=>{
  const u=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  let out='';
  for(let i=0;i<u.length;i++)out+=String.fromCharCode(u[i]);
  return btoa(out);
 };
 const unb64=s=>{
  const raw=atob(s),out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
 };
 const same=(a,b)=>{
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
 };
 const uuid=()=>{
  const crypto=subtle();
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));
  b[6]=b[6]&0x0f|0x40;b[8]=b[8]&0x3f|0x80;
  const h=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
 };
 const token=()=>b64(subtle().getRandomValues(new Uint8Array(16))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 function previewOf(summary,manifest){
  return Object.freeze({
   title:summary.title,nodes:summary.nodes,images:summary.images,
   bytes:manifest.byteLength,mapId:manifest.mapId,revision:manifest.revision,
   fingerprint:manifest.sha256.slice(0,8)
  });
 }
 async function prepareCopy(project,{mapId,deviceId,revision=1,parentHash=null,sha256,createdAt}={}){
  const before=JSON.stringify(project);
  const handoff=await Core.makeHandoff(project,{mapId,deviceId,revision,parentHash,sha256,createdAt});
  if(JSON.stringify(project)!==before)throw Error('Preparing a copy changed the open map');
  return Object.freeze({handoff,preview:previewOf(handoff.summary,handoff.manifest)});
 }
 function sealFile(handoff){
  if(!handoff?.manifest||typeof handoff.bytes!=='string')throw Error('Missing Glauka copy');
  return JSON.stringify({schema:FILE_SCHEMA,manifest:handoff.manifest,bytes:handoff.bytes});
 }
 async function openFile(raw,sha256){
  const env=typeof raw==='string'?JSON.parse(raw):raw;
  if(!env||env.schema!==FILE_SCHEMA||!env.manifest||typeof env.bytes!=='string')
    throw Error('Not a Glauka map copy');
  return Core.verifyHandoff({manifest:env.manifest,bytes:env.bytes,sha256});
 }
 const ENC_FILE_SCHEMA='GlaukaEncryptedFile-v1';
 function isPasswordFile(raw){
  try{
   const env=typeof raw==='string'?JSON.parse(raw):raw;
   return Boolean(env&&env.schema===ENC_FILE_SCHEMA&&typeof env.salt==='string'&&typeof env.iv==='string'&&typeof env.data==='string');
  }catch{return false;}
 }
 async function derivePasswordKey(password,saltBytes,usage){
  const pass=String(password||'');
  if(pass.length<4)throw Error('La password deve avere almeno 4 caratteri');
  const base=await subtle().subtle.importKey('raw',bytesOf(pass),{name:'PBKDF2'},false,['deriveKey']);
  return subtle().subtle.deriveKey(
   {name:'PBKDF2',salt:saltBytes,iterations:150000,hash:'SHA-256'},
   base,{name:'AES-GCM',length:256},false,[usage]
  );
 }
 async function sealPasswordFile(handoff,password){
  const plain=sealFile(handoff);
  const salt=subtle().getRandomValues(new Uint8Array(16));
  const iv=subtle().getRandomValues(new Uint8Array(12));
  const key=await derivePasswordKey(password,salt,'encrypt');
  const ct=await subtle().subtle.encrypt({name:'AES-GCM',iv,additionalData:bytesOf(ENC_FILE_SCHEMA)},key,bytesOf(plain));
  return JSON.stringify({schema:ENC_FILE_SCHEMA,v:1,salt:b64(salt),iv:b64(iv),data:b64(ct)});
 }
 async function openPasswordFile(raw,password,sha256){
  const env=typeof raw==='string'?JSON.parse(raw):raw;
  if(!isPasswordFile(env))throw Error('File cifrato Glauka non valido');
  const key=await derivePasswordKey(password,unb64(env.salt),'decrypt');
  let plainBytes;
  try{
   plainBytes=await subtle().subtle.decrypt({name:'AES-GCM',iv:unb64(env.iv),additionalData:bytesOf(ENC_FILE_SCHEMA)},key,unb64(env.data));
  }catch{
   throw Error('Password errata o file danneggiato');
  }
  return openFile(textOf(new Uint8Array(plainBytes)),sha256);
 }
 function createInbox(){
  const items=[];
  const find=id=>{
   const item=items.find(row=>row.id===id&&row.status!=='deleted');
   if(!item)throw Error('Received map not found');
   return item;
  };
  const pub=item=>Object.freeze({
   id:item.id,status:item.status,displayName:item.displayName,duplicate:item.duplicate,
   preview:item.preview,mapId:item.manifest.mapId
  });
  return Object.freeze({
   receive(verified,{displayName}={}){
    if(!verified?.project||!verified.manifest||!verified.summary)
     throw Error('Unverified map cannot enter the inbox');
    const duplicate=items.some(row=>row.status!=='deleted'&&row.manifest.sha256===verified.manifest.sha256);
    const item={
     id:uuid(),status:'pending',
     displayName:String(displayName||verified.summary.title).slice(0,120),
     duplicate,project:verified.project,manifest:verified.manifest,
     summary:verified.summary,preview:previewOf(verified.summary,verified.manifest)
    };
    items.push(item);
    return pub(item);
   },
   list(){return items.filter(row=>row.status!=='deleted').map(pub);},
   rename(id,name){
    const item=find(id);
    if(item.status!=='pending')throw Error('Only a pending copy can be renamed');
    const next=String(name||'').trim().slice(0,120);
    if(!next)throw Error('Name required');
    item.displayName=next;
    if(item.project.root.text!==item.summary.title)
     throw Error('Rename touched the map');
    return pub(item);
   },
   reject(id){
    const item=find(id);
    if(item.status!=='pending')throw Error('Only a pending copy can be refused');
    item.status='rejected';item.project=null;
    return pub(item);
   },
   remove(id){
    const item=find(id);
    item.status='deleted';item.project=null;
    return Object.freeze({id,status:'deleted'});
   },
   accept(id,local){
    const item=find(id);
    if(item.status!=='pending'||!item.project)throw Error('Only a pending copy can be opened');
    const review=Core.reviewRevision(local||null,item.manifest,{localDirty:false});
    if(review.mayReplace!==false)throw Error('Refusing an automatic replace');
    item.status='accepted';
    return Object.freeze({
     action:'open-new',mayReplace:false,review:review.status,
     displayName:item.displayName,project:item.project,manifest:item.manifest
    });
   }
  });
 }
 async function pairKeys(){
  const crypto=subtle();
  const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
  return {privateKey:pair.privateKey,publicJwk:{kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y}};
 }
 async function importPeer(jwk){
  if(!jwk||jwk.kty!=='EC'||jwk.crv!=='P-256'||typeof jwk.x!=='string'||typeof jwk.y!=='string')
    throw Error('Invalid pairing key');
  return subtle().subtle.importKey('jwk',{...jwk,ext:true},
    {name:'ECDH',namedCurve:'P-256'},true,[]);
 }
 async function sharedBits(privateKey,publicJwk){
  const peer=await importPeer(publicJwk);
  return subtle().subtle.deriveBits({name:'ECDH',public:peer},privateKey,256);
 }
 async function codeFromBits(bits){
  const digest=await subtle().subtle.digest('SHA-256',bits);
  const n=new DataView(digest).getUint32(0)%1000000;
  return String(n).padStart(6,'0');
 }
 async function aesFromBits(bits){
  return subtle().subtle.importKey('raw',bits,{name:'AES-GCM'},false,['encrypt','decrypt']);
 }
 async function sealChunk(key,bytes,index,sessionId){
  const iv=subtle().getRandomValues(new Uint8Array(12));
  const aad=bytesOf(sessionId+':'+index);
  const ct=await subtle().subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,bytes);
  return {index,iv:b64(iv),data:b64(ct)};
 }
 async function openChunk(key,chunk,sessionId){
  const iv=unb64(chunk.iv),data=unb64(chunk.data);
  const aad=bytesOf(sessionId+':'+chunk.index);
  const plain=await subtle().subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},key,data);
  return new Uint8Array(plain);
 }
 function assertFresh(session,now){
  if(now>Date.parse(session.expiresAt)){
   session.state='expired';
   throw Error('Pairing expired');
  }
 }
 async function createSender({project,mapId,deviceId,sha256,now,ttlMs=DEFAULT_TTL,revision=1,parentHash=null}={}){
  const clock=nowMs(now);
  const prepared=await prepareCopy(project,{mapId,deviceId,sha256,revision,parentHash,createdAt:iso(clock)});
  const keys=await pairKeys();
  const plain=bytesOf(prepared.handoff.bytes);
  const session={
   role:'sender',state:'offering',sessionId:uuid(),token:token(),
   expiresAt:iso(clock+ttlMs),publicJwk:keys.publicJwk,privateKey:keys.privateKey,
   handoff:prepared.handoff,preview:prepared.preview,peerJwk:null,bits:null,
   aes:null,code:null,approved:false,helloUsed:false,chunks:[],decision:null
  };
  for(let i=0;i<plain.length;i+=CHUNK)session.chunks.push(plain.subarray(i,i+CHUNK));
  return Object.freeze({
   get state(){return session.state;},
   get confirmCode(){return session.code;},
   get preview(){return session.preview;},
   get approved(){return session.approved;},
   qr(address){
    const body={v:QR_VERSION,s:session.sessionId,t:session.token,k:session.publicJwk,e:session.expiresAt};
    if(address&&Number.isInteger(address.port))body.n={h:String(address.host||'127.0.0.1'),p:address.port};
    return JSON.stringify(body);
   },
   async hello(body,at){
    assertFresh(session,nowMs(at||now));
    if(session.helloUsed||session.state!=='offering')throw Error('Pairing already used');
    if(!body||!same(body.token,session.token))throw Error('Pairing token rejected');
    session.bits=await sharedBits(session.privateKey,body.publicJwk);
    session.aes=await aesFromBits(session.bits);
    session.code=await codeFromBits(session.bits);
    session.peerJwk=body.publicJwk;
    session.helloUsed=true;
    session.state='paired';
    return Object.freeze({ok:true,sessionId:session.sessionId});
   },
   async approve(typed){
    if(session.state!=='paired'||!session.code)throw Error('Pairing is not ready');
    if(!same(String(typed||''),session.code))throw Error('Codes do not match');
    session.approved=true;session.state='approved';
    return true;
   },
   async chunk(index,typed){
    if(!session.approved||session.state==='cancelled'||session.state==='expired')
     throw Error('Transfer is not approved');
    if(!same(String(typed||''),session.code))throw Error('Codes do not match');
    if(!Number.isInteger(index)||index<0||index>=session.chunks.length)
     throw Error('Unknown chunk');
    session.state='sending';
    const sealed=await sealChunk(session.aes,session.chunks[index],index,session.sessionId);
    return Object.freeze({
     ...sealed,total:session.chunks.length,
     manifest:index===0?session.handoff.manifest:undefined
    });
   },
   decide(decision){
    if(decision!=='accept'&&decision!=='reject'&&decision!=='cancel')
     throw Error('Unknown decision');
    session.decision=decision;
    session.state=decision==='cancel'?'cancelled':decision==='reject'?'rejected':'accepted';
    if(decision!=='accept')session.chunks=[];
    return session.state;
   },
   cancel(){return this.decide('cancel');}
  });
 }
 function parseQr(raw){
  const qr=typeof raw==='string'?JSON.parse(raw):raw;
  if(!qr||qr.v!==QR_VERSION||typeof qr.s!=='string'||typeof qr.t!=='string'||
     typeof qr.e!=='string'||!qr.k)throw Error('Invalid pairing QR');
  return qr;
 }
 async function createReceiver(){
  const keys=await pairKeys();
  const session={state:'idle',qr:null,privateKey:keys.privateKey,publicJwk:keys.publicJwk,
   bits:null,aes:null,code:null,approved:false,parts:[],total:0,manifest:null};
  return Object.freeze({
   get state(){return session.state;},
   get confirmCode(){return session.code;},
   get publicJwk(){return session.publicJwk;},
   async takeQr(raw,now){
    const qr=parseQr(raw);
    if(nowMs(now)>Date.parse(qr.e))throw Error('Pairing expired');
    session.qr=qr;
    session.bits=await sharedBits(session.privateKey,qr.k);
    session.aes=await aesFromBits(session.bits);
    session.code=await codeFromBits(session.bits);
    session.state='paired';
    return Object.freeze({sessionId:qr.s,expiresAt:qr.e,address:qr.n||null});
   },
   helloBody(){
    if(!session.qr)throw Error('Scan a pairing QR first');
    return {token:session.qr.t,publicJwk:session.publicJwk};
   },
   async approve(typed){
    if(session.state!=='paired'||!session.code)throw Error('Pairing is not ready');
    if(!same(String(typed||''),session.code))throw Error('Codes do not match');
    session.approved=true;session.state='approved';
    return true;
   },
   async takeChunk(chunk){
    if(!session.approved)throw Error('Receiver has not confirmed the code');
    if(chunk.index!==session.parts.length)throw Error('Unexpected chunk');
    if(chunk.index===0)session.manifest=chunk.manifest;
    session.parts.push(await openChunk(session.aes,chunk,session.qr.s));
    session.total=chunk.total;
    session.state='receiving';
    return Object.freeze({received:session.parts.length,total:chunk.total});
   },
   async finish(sha256){
    if(!session.total||session.parts.length!==session.total||!session.manifest)
     throw Error('Incomplete transfer');
    let size=0;for(const part of session.parts)size+=part.length;
    const all=new Uint8Array(size);let offset=0;
    for(const part of session.parts){all.set(part,offset);offset+=part.length;}
    const verified=await Core.verifyHandoff({manifest:session.manifest,bytes:textOf(all),sha256});
    session.state='verified';
    return verified;
   }
  });
 }
 async function deriveLanChannel(privateKey,peerJwk,certPin,sessionId){
  const bits=await sharedBits(privateKey,peerJwk);
  const aes=await aesFromBits(bits);
  const pinInput=certPin?new Uint8Array([...new Uint8Array(bits),...bytesOf(':'+String(certPin).toLowerCase())]):bits;
  const confirmCode=await codeFromBits(pinInput);
  return Object.freeze({
   confirmCode,
   async encryptProject(handoff){
    const plain=bytesOf(handoff.bytes),out=[];
    for(let i=0;i<plain.length;i+=CHUNK){
     const index=out.length;
     const sealed=await sealChunk(aes,plain.subarray(i,i+CHUNK),index,sessionId);
     out.push({...sealed,total:Math.ceil(plain.length/CHUNK)||1,manifest:index===0?handoff.manifest:undefined});
    }
    if(out.length===0){
     const sealed=await sealChunk(aes,new Uint8Array(0),0,sessionId);
     out.push({...sealed,total:1,manifest:handoff.manifest});
    }
    return out;
   },
   async decryptChunks(chunks,sha256){
    if(!Array.isArray(chunks)||!chunks.length)throw Error('Nessun dato ricevuto');
    const ordered=[...chunks].sort((a,b)=>a.index-b.index);
    const manifest=ordered[0]?.manifest;
    if(!manifest)throw Error('Manifesto mancante');
    const parts=[];let totalLen=0;
    for(let i=0;i<ordered.length;i++){
     if(ordered[i].index!==i)throw Error('Blocco mancante o fuori ordine');
     const p=await openChunk(aes,ordered[i],sessionId);
     parts.push(p);totalLen+=p.length;
    }
    const all=new Uint8Array(totalLen);let off=0;
    for(const p of parts){all.set(p,off);off+=p.length;}
    return Core.verifyHandoff({manifest,bytes:textOf(all),sha256});
   }
  });
 }
 return Object.freeze({
  FILE_SCHEMA,ENC_FILE_SCHEMA,DEFAULT_TTL,prepareCopy,sealFile,openFile,
  isPasswordFile,sealPasswordFile,openPasswordFile,createInbox,
  createSender,createReceiver,parseQr,pairKeys,deriveLanChannel
 });
});
