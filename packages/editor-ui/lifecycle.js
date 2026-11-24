/* Close warnings and recovery are shared; native hosts wait for completion. */
(function(root){'use strict';
 const pendingAndroid=new Map();
 const RECENT_ANDROID_KEY='glauka.android.recentFiles.v1';
 let pendingAndroidOpen=null;
 const nativeFileTimeout=10*60*1000; // Also covers abandoned Android document pickers.
 function decodeBase64Bytes(encoded){
  const bin=atob(String(encoded||'')),out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
 }
 function recentAndroidFiles(){
  try{
   const list=JSON.parse(root.localStorage?.getItem(RECENT_ANDROID_KEY)||'[]');
   return Array.isArray(list)?list.filter(x=>x&&typeof x.name==='string').slice(0,10):[];
  }catch{return [];}
 }
 function recordAndroidRecent(entry){
  if(!entry||!entry.name)return;
  try{
   const current=recentAndroidFiles().filter(item=>
    entry.docId?(item.docId!==entry.docId&&item.name!==entry.name):item.name!==entry.name
   );
   current.unshift({
    name:String(entry.name).slice(0,140),
    docId:entry.docId||null,
    writable:!!entry.writable,
    persistent:!!entry.persistent,
    updatedAt:Date.now()
   });
   root.localStorage?.setItem(RECENT_ANDROID_KEY,JSON.stringify(current.slice(0,10)));
  }catch{}
 }
 function nativeFileWrite(filename,data,docId=null){
  const id="save_"+(root.NeuroMapRecovery?.requestId()||crypto.randomUUID());
  return new Promise(resolve=>{
   const timer=setTimeout(()=>{
    pendingAndroid.delete(id);
    resolve({ok:false,timeout:true});
   },nativeFileTimeout);
   pendingAndroid.set(id,result=>{clearTimeout(timer);resolve(result||{ok:false});});
   try{
    if(docId&&typeof root.NMAndroid?.overwriteProject==='function')root.NMAndroid.overwriteProject(docId,String(data),filename,id);
    else root.NMAndroid.saveProject(filename,String(data),id);
   }catch(error){const done=pendingAndroid.get(id);pendingAndroid.delete(id);done({ok:false,error});}
  });
 }
 const drafts=new Set();
 function registerDraft(guard){drafts.add(guard);return ()=>drafts.delete(guard)}
 function hasDraft(){return [...drafts].some(guard=>guard.hasPending())}
 function app(){return root.neuroMapApp;}
 function text(it,en){return globalThis.GlaukaI18n?.pair(it,en)??(document.documentElement.lang==='en'?en:it);}
 function dirty(a=app()){
  if(!a)return false;
  const draft=a.editorNodeId&&document.getElementById('inline-editor-input')?.value.trim();
  return a.tabs.some(t=>t.state.isDirty)||!!(draft&&draft!==a.state.findNode(a.editorNodeId)?.text);
 }
 async function flush(){const a=app();if(!a)return true;if(a._desktopRecoveryReady)await a._desktopRecoveryReady;clearTimeout(a.saveTimer);a.closeEditor(true);const revision=a._nmRecoveryRevision;const ok=await a.persistWorkspace();return ok===true&&revision===a._nmRecoveryRevision;}
 let closing,approvedNativeExit=false,discardedNativeExit=false;
 async function discardRecovery(a){
  // Do not let an in-flight checkpoint recreate an intentionally discarded
  // workspace after the native backend removes it.
  clearTimeout(a.saveTimer);
  await a._nativeWorkspaceWrites?.whenIdle?.();
  const recoveryBridge=root.neuromapDesktop || root.NeuroMapRecovery?.bridge;
  if(recoveryBridge){
   if(typeof recoveryBridge.discardWorkspace!=='function')
    throw Error('Questa versione desktop non supporta ancora lo scarto del recupero.');
   await recoveryBridge.discardWorkspace();
  }
  // Desktop uses a native checkpoint, but previous versions can also leave
  // an origin-local fallback. Neither should restore discarded content.
  localStorage.removeItem('neuromap.workspace.v2');
 }
 function requestClose(){
  if(closing)return closing;
  closing=(async()=>{
   const a=app();if(!a){approvedNativeExit=true;return true;}
   if(a._desktopRecoveryReady)await a._desktopRecoveryReady;
   a.closeEditor(true);
   for(const guard of drafts)if(guard.hasPending()&&!await guard.confirmClose())return false;
   if(dirty(a)){
    // Native close asks inside NeuroMap, never through a browser confirm().
    const answer=await a.nmAsk({
     title:text('Salvare le modifiche prima di uscire?','Save changes before quitting?'),
     message:text('Ci sono modifiche non salvate. «Non salvare» scarta le modifiche non esportate senza toccare i file originali; «Annulla» mantiene la finestra aperta.','There are unsaved changes. “Don’t Save” discards unsaved changes without touching original files; “Cancel” keeps the app open.'),
     choices:[
      {value:'save',text:text('Salva','Save'),primary:true},
      {value:'discard',text:text('Non salvare','Don’t Save'),danger:true},
      {value:'cancel',text:text('Annulla','Cancel')}
     ]
    });
    // A cancelled Save dialog, a write failure, or edits during the save
    // all keep the original app window open.
    if(answer==='save'){
     if(typeof a.saveAllTabs!=='function'||!(await a.saveAllTabs())||dirty(a))return false;
    }else if(answer==='discard'){
     try{await discardRecovery(a);}
     catch(error){
      a.showToast?.(text('Chiusura annullata: ','Could not discard recovery: ')+String(error?.message||error),'ERRORE');
      return false;
     }
     discardedNativeExit=true;
     approvedNativeExit=true;
     return true;
    }else return false;
   }
   if(!await flush()){
    const value=await a.nmAsk({
     title:text('Copia di recupero non riuscita','Recovery copy failed'),
     message:text('Le ultime modifiche non sono al sicuro. Resta ed esporta una copia prima di uscire.','Your latest changes are not safe. Stay and export a copy before quitting.'),
     choices:[
      {value:'cancel',text:text('Annulla','Cancel'),primary:true},
      {value:'exit',text:text('Esci comunque','Quit anyway'),danger:true}
     ]
    });
    if(value!=='exit')return false;
   }
   approvedNativeExit=true;
   return true;
  })().finally(()=>{closing=null;});
  return closing;
 }
 function fingerprint(tab,a){
  const s=tab.state,stringify=root.NeuroMapSafeJSON?.stringify||JSON.stringify;
  return stringify([s.root,s.images,s.relationships,s.thresholdY,s.balanceBias,s.compactness,s.branchGapX,s.wrapCustom,s.strokeScale,s.activeThemeId,s.typographyPreset,s.typographyScale,s.branchStyle,s.defaultLabelWrapChars,
   a?.getStudyCardsForTab?.(tab.id)||[],(a?.learningAttempts||[]).filter(x=>x.tabId===tab.id),(a?.learningPlans||[]).filter(x=>x.tabId===tab.id)]);
 }
 async function androidSave(io,opts={}){
  const a=io.app;a.closeEditor(true);a.saveActiveTabSnapshot();
  const tab=a.tabs.find(t=>t.id===a.activeTabId),before=fingerprint(tab,a);
  const payload=io.buildSerializedProjectPayload();
  const blob=new Blob([(root.NeuroMapSafeJSON?.stringify||JSON.stringify)(payload)],{type:'application/json'});
  if(blob.size>32*1024*1024){a.showToast('Progetto oltre 32 MB: esporta le mappe separatamente.','SALVATAGGIO');return false;}
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Impossibile preparare il progetto.'));reader.readAsDataURL(blob);});
  const baseName=tab?.fileName&&/\.(?:gk|glk|neuromap|json)$/i.test(tab.fileName)?tab.fileName:io.sanitizeFilename(tab.state.root.text)+'.gk';
  const targetDocId=(!opts?.saveAs&&tab?.androidDocId&&tab?.androidDocWritable&&typeof root.NMAndroid?.overwriteProject==='function')?tab.androidDocId:null;
  const result=await nativeFileWrite(baseName,data,targetDocId);
  if(result.ok&&fingerprint(tab,a)===before){tab.state.isDirty=false;tab._nmFileSaveConfirmed=true;}
  if(result.ok&&tab){
   if(result.docId){tab.androidDocId=result.docId;tab.androidDocWritable=true;}
   if(result.filename)tab.fileName=result.filename;
   recordAndroidRecent({name:tab.fileName||baseName,docId:tab.androidDocId||null,writable:!!tab.androidDocWritable,persistent:true});
  }
  a.renderTabBar();a.scheduleSave();return !!result.ok;
 }
 async function androidOpenProject(docId=null){
  const a=app();
  if(!root.NMAndroid?.pickProjectDocument){
   document.getElementById('btn-import-files-new-tabs')?.click();
   return false;
  }
  return new Promise(resolve=>{
   if(pendingAndroidOpen?.timer)clearTimeout(pendingAndroidOpen.timer);
   const timer=setTimeout(()=>{if(pendingAndroidOpen?.resolve===resolve){pendingAndroidOpen=null;resolve(false);}},nativeFileTimeout);
   pendingAndroidOpen={resolve,timer,docId};
   try{
    if(docId&&typeof root.NMAndroid?.reopenDocument==='function')root.NMAndroid.reopenDocument(docId);
    else root.NMAndroid.pickProjectDocument();
   }catch(err){
    clearTimeout(timer);pendingAndroidOpen=null;
    a?.showToast?.(err?.message||text('Impossibile aprire il file','Unable to open file'),'ERRORE');
    resolve(false);
   }
  });
 }
 async function androidOpenedProject(payload){
  const pending=pendingAndroidOpen;
  if(pending?.timer)clearTimeout(pending.timer);
  pendingAndroidOpen=null;
  const finish=v=>{pending?.resolve?.(v);return v;};
  const a=app();
  if(!payload||payload.cancelled)return finish(false);
  if(!payload.ok){
   if(payload.unavailable&&pending?.docId&&root.NMAndroid?.pickProjectDocument){
    a?.showToast?.(text('Permesso scaduto sul file: selezionalo di nuovo da Drive o Dispositivo','File access expired: pick it again from Drive or Device'),'DRIVE / FILE');
    return finish(await androidOpenProject(null));
   }
   return finish(false);
  }
  if(!a)return finish(false);
  try{
   const bytes=decodeBase64Bytes(payload.base64);
   const filename=String(payload.filename||'mappa.gk');
   const file=new File([bytes],filename,{type:'application/json'});
   const count=await a.importFile(file,{newTab:true});
   const tab=a.tabs.find(t=>t.id===a.activeTabId);
   if(tab&&count>0){
    tab.fileName=filename;
    tab.androidDocId=payload.docId||null;
    tab.androidDocWritable=Boolean(payload.writable);
    tab.androidDocPersistent=Boolean(payload.persistent);
    tab.state.isDirty=false;
    recordAndroidRecent({name:filename,docId:tab.androidDocId,writable:tab.androidDocWritable,persistent:tab.androidDocPersistent});
    a.renderTabBar();a.scheduleSave();
    a.showToast?.(tab.androidDocWritable?text('Collegato a: ','Linked to: ')+filename:text('Importato: ','Imported: ')+filename,'DRIVE / FILE');
   }
   return finish(true);
  }catch(error){
   a.showToast?.((error?.message||text('File non valido','Invalid file')),'ERRORE');
   return finish(false);
  }
 }
 async function androidExport(blob,filename){
  if(!blob||blob.size>32*1024*1024)throw Error('Esportazione oltre il limite di 32 MB.');
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Impossibile preparare il file.'));reader.readAsDataURL(blob);});
  const result=await nativeFileWrite(filename,data);
  if(result.timeout)throw Error('Tempo massimo per il salvataggio superato. Riprova.');
  if(result.error)throw result.error;
  return result.ok===true;
 }
 function install(App,IO){
  // Form controls retain the same palette when macOS/Android changes appearance.
  document.documentElement.style.colorScheme='dark';
  const schedule=App.prototype.scheduleSave;
  App.prototype.scheduleSave=function(...args){this._nmRecoveryRevision=(this._nmRecoveryRevision||0)+1;return schedule.apply(this,args);};
  const bind=App.prototype.bindUI;
  App.prototype.bindUI=function(...args){const result=bind.apply(this,args);
   window.addEventListener('beforeunload',e=>{
    // macOS native close already received explicit user approval. Do not
    // present a second browser-owned beforeunload confirmation.
    if(approvedNativeExit)return;
    this.closeEditor(true);this.persistWorkspace();
    if(dirty(this)||hasDraft()){e.preventDefault();e.returnValue='';}
   });
   window.addEventListener('pagehide',()=>{if(!discardedNativeExit)flush();});
   document.addEventListener('visibilitychange',()=>{if(document.hidden&&!discardedNativeExit)flush();});
   document.getElementById('inline-editor-input')?.addEventListener('input',()=>this.scheduleSave());
   return result;
  };
  const save=IO.prototype.saveProjectFile,exportJSON=IO.prototype.exportJSON;
  IO.prototype.saveProjectFile=function(...args){return root.NMAndroid?.saveProject?androidSave(this,{saveAs:!!args[0]}):save.apply(this,args);};
  IO.prototype.exportJSON=function(...args){return exportJSON.apply(this,args);};
  root.NeuroMapSaveStatus?.install(App,IO);
 }
 function handleBack(){
  if(document.getElementById('gl-settings-center')){root.NeuroMapSettingsCenter?.close?.();return 'closed';}
  if(root.GlaukaMobileShell?.back())return 'closed';
  // One source of truth for Android's native back gesture and button.
  const share=document.getElementById('nm-map-share');
  if(share&&!share.hidden){share.querySelector('.nm-share-close')?.click();return 'closed';}
  const ocr=document.getElementById('nm-ocr');
  if(ocr&&!ocr.hidden){root.neuroMapApp?._nmOCR?.close();return 'closed';}
  const tools=document.getElementById('nm74-overlay');
  if(tools&&!tools.hidden){root.NeuroMapAndroid74?.close();return 'closed';}
  const commands=document.getElementById('nm-android-command-overlay');
  if(commands&&!commands.classList.contains('hidden')){
   document.getElementById('nm-android-command-close')?.click();return 'closed';
  }
  for(const id of ['nm62-assets','nm54-illustration-modal','ai-settings-modal','flash-modal']){
   const element=document.getElementById(id);
   if(element&&!element.classList.contains('hidden')){
    element.classList.add('hidden');return 'closed';
   }
  }
  return 'none';
 }
 root.NeuroMapLifecycle={handleBack,install,androidExport,androidSave,androidOpenProject,androidOpenedProject,recentAndroidFiles,recordAndroidRecent,fingerprint,dirty,flush,requestClose,registerDraft,androidSaved(id,result){const resolve=pendingAndroid.get(id);if(resolve){pendingAndroid.delete(id);resolve(result);}}};
})(globalThis);
