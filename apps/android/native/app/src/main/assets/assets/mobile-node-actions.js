/* Glauka Android: contextual, accessible node actions after selecting a branch.
 * Selection never deletes by itself. Confirmation + Undo remain mandatory.
 */
(function(root){
 'use strict';
 const tr=(it,en)=>{
  if(root.GlaukaI18n)return root.GlaukaI18n.pair(it,en);
  try{return root.localStorage.getItem('nm6_locale')==='en'?en:it;}
  catch(_){return root.document.documentElement.lang==='en'?en:it;}
 };
 function install(){
  if(root.GlaukaAppReady&&!root.neuroMapApp){root.GlaukaAppReady.then(value=>{if(value)install()});return;}
  const app=root.neuroMapApp;
  if(!app||!app.state||root.document.getElementById('gl-mobile-node-actions'))return;
  const doc=root.document,canvas=doc.getElementById('mindmap-canvas');
  if(!canvas)return;
  const bar=doc.createElement('aside');
  bar.id='gl-mobile-node-actions';
  bar.hidden=true;
  bar.setAttribute('role','toolbar');
  bar.setAttribute('aria-label',tr('Azioni del ramo selezionato','Selected branch actions'));
  const name=doc.createElement('span');name.className='gl-node-name';name.setAttribute('data-glauka-user-content','');
  const make=(cls,path)=>{const b=doc.createElement('button');b.type='button';b.className=cls;
   b.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg><span></span>';return b;};
  const add=make('gl-node-add','M5 3v18M5 9h8M13 5v8M9 9h8');
  const edit=make('gl-node-edit','m5 16 11-11 3 3-11 11H5zM14 7l3 3');
  const style=make('gl-node-style','M5 5h14M12 5v14M8 19h8');
  const remove=make('gl-node-delete','M4 7h16M9 7V4h6v3M7 7v13h10V7M10 10v7M14 10v7');
  bar.append(name,add,edit,style,remove);doc.body.append(bar);
  let activeId='',activeState=null,activeTab='',armed=false;
  const selection=()=>{
   const a=root.neuroMapApp;if(!a||!armed)return null;
   const state=a.state,id=state?.selectedNodeId,node=state?.findNode?.(id);
   if(!node||node.id===state.root?.id||state.selectedImageId||!a.activeTabId)return null;
   return {app:a,state,tab:a.activeTabId,node};
  };
  const update=()=>{
   const chosen=selection();
   const editor=doc.getElementById('inline-editor-container');
   const editing=editor&&!editor.classList.contains('hidden');
   if(!chosen||editing){
    bar.hidden=true;activeId='';activeState=null;activeTab='';return;
   }
   activeId=chosen.node.id;activeState=chosen.state;activeTab=chosen.tab;
   name.textContent=chosen.node.text.slice(0,125);
   name.title=chosen.node.text;
   add.setAttribute('aria-label',tr('Aggiungi un sotto-ramo a ','Add child branch to ')+chosen.node.text);
   add.title=tr('Aggiungi sotto-ramo','Add child branch');
   edit.setAttribute('aria-label',tr('Modifica ','Edit ')+chosen.node.text);
   edit.title=tr('Modifica il testo','Edit text');
   style.setAttribute('aria-label',tr('Formato del concetto o del ramo','Concept or branch formatting'));
   style.title=tr('Formato del concetto o del ramo','Concept or branch formatting');
   for(const [button,it,en] of [[add,'Figlio','Child'],[edit,'Modifica','Edit'],[style,'Formato','Format'],[remove,'Elimina','Delete']])button.querySelector('span').textContent=tr(it,en);
   remove.setAttribute('aria-label',tr('Elimina ','Delete ')+chosen.node.text);
   remove.title=tr('Elimina ramo (con conferma)','Delete branch (confirmation)');
   bar.setAttribute('aria-label',tr('Azioni per ','Actions for ')+chosen.node.text);
   bar.hidden=false;
  };
  let queued=false;
  const schedule=()=>{if(queued)return;queued=true;root.requestAnimationFrame(()=>{
   queued=false;update();
  })};
  function guard(){
   const c=selection();
   return c&&c.node.id===activeId&&c.state===activeState&&c.tab===activeTab?c:null;
  }
  add.addEventListener('click',()=>{
   const c=guard();if(!c)return;
   c.app.selectNode(c.node.id);
   c.app.addChild();
   schedule();
  });
  edit.addEventListener('click',()=>{
   const c=guard();if(!c)return;
   c.app.selectNode(c.node.id);
   c.app.editSelected();
   schedule();
  });
  style.addEventListener('click',()=>{
   const c=guard();if(!c)return;
   c.app.selectNode(c.node.id);
   root.GlaukaAndroidStylePanel?.openNode();
   schedule();
  });
  remove.addEventListener('click',async()=>{
   const c=guard();if(!c)return;
   // Count descendants for a meaningful confirmation. Root cannot be removed.
   let size=0,stack=[...(c.node.children||[])],seen=new Set();
   while(stack.length&&size<3500){
    const child=stack.pop();
    if(!child||seen.has(child))continue;
    seen.add(child);size++;stack.push(...(child.children||[]));
   }
   const label=tr('Eliminare «','Delete “')+c.node.text+
    tr('» e i suoi ','” and its ')+size+tr(' sotto-rami? Puoi usare Annulla.',' child branches? Undo is available.');
   let accepted=false;
   if(typeof c.app.nmAsk==='function'){
    const answer=await c.app.nmAsk({
     title:tr('Elimina ramo','Delete branch'),message:label,
     choices:[
      {value:'cancel',text:tr('Annulla','Cancel')},
      {value:'delete',text:tr('Elimina','Delete'),danger:true}
     ]});
    accepted=answer==='delete';
   }else accepted=root.confirm(label);
   if(!accepted)return;
   if(root.neuroMapApp!==c.app||c.app.state!==c.state||
      c.app.activeTabId!==c.tab||!c.state.findNode(c.node.id))return;
   c.app.selectNode(c.node.id);
   c.app.deleteSelected();
   c.app.scheduleSave?.();
   armed=false;schedule();
  });
  for(const method of ['selectNode','clearSelection','activateTab','deleteSelected']){
   if(typeof app[method]!=='function')continue;
   const original=app[method];
   app[method]=function(...args){
    const result=original.apply(this,args);
    if(method==='selectNode')armed=true;
    if(method==='clearSelection'||method==='activateTab'||method==='deleteSelected')armed=false;
    schedule();
    return result;
   };
  }
  canvas.addEventListener('pointerup',()=>root.requestAnimationFrame(schedule),{passive:true});
  canvas.addEventListener('click',()=>root.requestAnimationFrame(schedule),{passive:true});
  doc.addEventListener('nm:language-change',schedule);
  root.addEventListener('glauka:language-change',schedule);
  const locale=doc.getElementById('nm6-locale-button');
  locale?.addEventListener('click',()=>root.requestAnimationFrame(schedule));
  root.GlaukaAndroidNodeActions=Object.freeze({refresh:schedule});
 }
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
})(globalThis);
