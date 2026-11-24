/* Validated, offline-only chrome appearances. Document/map styles never reach this storage. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.NeuroMapUISkinCore=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const STORAGE_KEY='nm_ui_skin_v1';
 const THEMES=Object.freeze([
  Object.freeze({id:'prisma',it:'White — Prisma Vivo',en:'White — Prisma Vivo'}),
  Object.freeze({id:'slate',it:'Dark — Deep Slate',en:'Dark — Deep Slate'}),
  Object.freeze({id:'orbit',it:'Orbit',en:'Orbit'}),
  Object.freeze({id:'aurora',it:'Aurora',en:'Aurora'}),
  Object.freeze({id:'glass',it:'Glass',en:'Glass'}),
  Object.freeze({id:'cyber',it:'Cyber',en:'Cyber'}),
  Object.freeze({id:'minimal',it:'Minimal',en:'Minimal'}),
  Object.freeze({id:'graphite',it:'Graphite',en:'Graphite'}),
  Object.freeze({id:'neon',it:'Neon',en:'Neon'}),
  Object.freeze({id:'purple',it:'Viola',en:'Purple'})
 ]);
 const CONTRASTS=Object.freeze(['normal','high']);
 // Global chrome readability, separate from the map's font/geometry preferences.
 const READABILITY=Object.freeze(['standard','comfortable']);
 const valid=new Set(THEMES.map(x=>x.id));
 function read(raw){
  let data=raw;
  if(typeof data==='string'){try{data=JSON.parse(data)}catch{data=null}}
  if(!data||typeof data!=='object'||Array.isArray(data))data={};
  return {theme:data.theme==='classic'?'orbit':valid.has(data.theme)?data.theme:'prisma',
   contrast:CONTRASTS.includes(data.contrast)?data.contrast:'normal',
   readability:READABILITY.includes(data.readability)?data.readability:'standard'};
 }
 function visible(config,orbitEnabled){
  const state=read(config);
  return orbitEnabled ? state.theme : 'prisma';
 }
 return Object.freeze({STORAGE_KEY,THEMES,CONTRASTS,READABILITY,read,visible});
});
