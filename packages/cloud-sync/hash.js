/* SHA-256 for exact UTF-8 Glauka JSON snapshots.
 * Rejects runtimes without a cryptographic digest; NEVER falls back to
 * a non-cryptographic checksum for cloud revision decisions.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GlaukaCloudHash=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 async function sha256(utf8,{subtle}={}){
  const digest=subtle||globalThis.crypto?.subtle;
  if(typeof digest?.digest!=='function'||typeof TextEncoder!=='function')
   throw Error('Cryptographic SHA-256 unavailable');
  if(typeof utf8!=='string')throw Error('SHA input must be a UTF-8 string');
  const raw=new Uint8Array(await digest.digest('SHA-256',new TextEncoder().encode(utf8)));
  if(raw.length!==32)throw Error('Invalid SHA-256 digest size');
  return Array.from(raw,byte=>byte.toString(16).padStart(2,'0')).join('');
 }
 return Object.freeze({sha256});
});
