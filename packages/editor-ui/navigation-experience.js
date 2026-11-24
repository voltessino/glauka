/* Desktop knowledge navigation: semantic overview, mini-map and reversible focus.
 * A transient presentation layer; no autosave, mutations or user data duplication.
 */
(function(root){
 'use strict';
 const core=root.NeuroMapNavigationCore;
 if(!core)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const label=root.NeuroMapWorkspaceLocale?.bind||((element,it,en,attribute)=>{if(attribute)element.setAttribute(attribute,tr(it,en));else element.textContent=tr(it,en)});
 const settingsKey='nm616-navigation-preferences';
 const initial=()=>{
   try{const data=JSON.parse(localStorage.getItem(settingsKey)||'{}');
     return {version:3,semantic:false,minimap:data.minimap!==false,detail:data.detail===true,expanded:data.expanded===true};}
   catch{return {version:3,semantic:false,minimap:true,detail:false,expanded:false};}
 };
 const preferences=initial(),active=new WeakMap(),frames=new WeakMap(),cache=new WeakMap(),trailCache=new WeakMap();
 function persist(){try{localStorage.setItem(settingsKey,JSON.stringify(preferences))}catch{}}
/* @neuromap-navigation-experience-styles */
/* @neuromap-navigation-experience-ui */
/* @neuromap-navigation-experience-focus */
/* @neuromap-navigation-experience-render */
 function install(App){
   if(!App?.prototype)return;
   const bind=App.prototype.bindUI;
   App.prototype.bindUI=function(...args){
     const result=bind.apply(this,args);
     ui(this);root.NeuroMapWorkspaceLocale?.watch(()=>schedule(this,true));this.renderer.semanticZoomEnabled=preferences.semantic;schedule(this,true);
     return result;
   };
   const recalc=App.prototype.recalculateAndRender;
   App.prototype.recalculateAndRender=function(...args){
     const result=recalc.apply(this,args);schedule(this,true);return result;
   };
   const request=App.prototype.requestRender;
   App.prototype.requestRender=function(...args){
     const result=request.apply(this,args);schedule(this);return result;
   };
   const activate=App.prototype.activateTab;
   App.prototype.activateTab=function(...args){
     if(this.activeTabId!==args[0])exitFocus(this,{silent:true});
     const result=activate.apply(this,args);schedule(this,true);return result;
   };
   root.NeuroMapNavigation=Object.freeze({enterFocus,exitFocus,refresh:schedule});
 }
 function navigationPrefs(partial){
  if(partial&&typeof partial==='object'){
   if(typeof partial.minimap==='boolean')preferences.minimap=partial.minimap;
   if(typeof partial.semantic==='boolean')preferences.semantic=partial.semantic;
   persist();
  }
  return {semantic:preferences.semantic,minimap:preferences.minimap,detail:preferences.detail};
 }
 root.NeuroMapNavigationPrefs=Object.freeze({get:()=>navigationPrefs(),set:navigationPrefs});
 root.NeuroMapNavigationInstall=install;
})(globalThis);
