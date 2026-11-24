/* Explicit UI translations only: never walk or translate user-authored map text. */
(function(root){
 'use strict';
 const bindings=new Map(),listeners=new Set();
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 function bind(element,it,en,attribute){
  element.classList.add('nm6-skiptranslate');
  let entries=bindings.get(element);
  if(!entries)bindings.set(element,entries=new Map());
  entries.set(attribute||'textContent',{it,en,attribute});
  write(element,{it,en,attribute});
 }
 function write(element,{it,en,attribute}){
  const value=tr(it,en);
  if(attribute)element.setAttribute(attribute,value);else element.textContent=value;
 }
 function refresh(){
  for(const [element,entries] of bindings){
   if(element.isConnected===false){bindings.delete(element);continue;}
   for(const entry of entries.values())write(element,entry);
  }
  for(const fn of listeners)fn();
 }
 if(typeof root.MutationObserver==='function')new root.MutationObserver(refresh)
  .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 root.NeuroMapWorkspaceLocale=Object.freeze({bind,watch:fn=>listeners.add(fn)});
})(globalThis);
