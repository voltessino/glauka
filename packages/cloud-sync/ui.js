/* Reusable Cloud Sync state presentation; no provider calls or document writes.
 * UI is opt-in and must only mount after native OAuth is configured.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GlaukaCloudStatusUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const labels=Object.freeze({
  local:['Solo locale','Local only'],
  offline:['Offline · in attesa','Offline · waiting'],
  pending:['Modifiche da sincronizzare','Changes waiting'],
  syncing:['Sincronizzazione in corso','Syncing'],
  synced:['Sincronizzato','Synced'],
  conflict:['Conflitto · intervento richiesto','Conflict · action required'],
  error:['Sincronizzazione non riuscita','Sync failed']
 });
 function describe(state,lang='it'){
  const pair=labels[state]||labels.error;
  return pair[lang==='en'?1:0];
 }
 function mount(host,{language=()=>document.documentElement.lang,brand='Glauka'}={}){
  if(!host||!host.ownerDocument)throw Error('Accessible status host required');
  const doc=host.ownerDocument,box=doc.createElement('div');
  box.className='glauka-cloud-status';
  box.setAttribute('role','status');box.setAttribute('aria-live','polite');
  const caption=doc.createElement('strong'),detail=doc.createElement('small');
  box.append(caption,detail);host.append(box);
  let last={status:'local',dirty:false};
  function update(next){
   last={...last,...next};
   box.dataset.syncState=Object.hasOwn(labels,last.status)?last.status:'error';
   caption.textContent=brand+' · '+describe(last.status,language());
   const n=Number.isFinite(last.pending)?Math.max(0,Math.round(last.pending)):Number(last.dirty||0);
   detail.textContent=language()==='en'?'Pending changes: '+n:'Modifiche in attesa: '+n;
   if(last.status==='conflict'){
    box.setAttribute('aria-label',caption.textContent);box.setAttribute('data-attention','true');
   }else{box.removeAttribute('data-attention');box.removeAttribute('aria-label')}
  }
  update(last);
  return Object.freeze({update,refresh:()=>update(last),element:box});
 }
 return Object.freeze({describe,mount,labels});
});
