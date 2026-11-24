/* Glauka native cloud queue storage adapters. The underlying OS service
 * commits local data BEFORE these promises resolve. No browser localStorage,
 * no refresh/access tokens, no fallback to volatile memory.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GlaukaCloudNativeStorage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function desktop(bridge){
  const b=bridge?.cloudLocal;
  if(!b||!['readIndex','writeIndex','listDocuments','readDocument','writeDocument'].every(
   name=>typeof b[name]==='function'))throw Error('Glauka desktop native storage unavailable');
  return Object.freeze({
   readIndex:()=>b.readIndex(),
   async writeIndex(value){const r=await b.writeIndex(value);if(!r?.saved)throw Error('Native queue write failed')},
   listDocuments:()=>b.listDocuments(),
   readDocument:id=>b.readDocument(id),
   async writeDocument(id,value){const r=await b.writeDocument(id,value);if(!r?.saved)throw Error('Native document write failed')}
  });
 }
 function android(bridge){
  if(!bridge||!['readIndex','writeIndex','listDocuments','readDocument','writeDocument'].every(
   name=>typeof bridge[name]==='function'))throw Error('Glauka Android native storage unavailable');
  return Object.freeze({
   async readIndex(){return bridge.readIndex()},
   async writeIndex(value){if(bridge.writeIndex(value)!==true)throw Error('Android queue write failed')},
   async listDocuments(){
    const items=JSON.parse(bridge.listDocuments()||'[]');
    if(!Array.isArray(items))throw Error('Invalid Android native document list');
    return items;
   },
   async readDocument(id){return bridge.readDocument(id)},
   async writeDocument(id,value){if(bridge.writeDocument(id,value)!==true)throw Error('Android document write failed')}
  });
 }
 return Object.freeze({desktop,android});
});
