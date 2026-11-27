// Injected into the trusted localhost document. Session token is per launch.
(() => {
  'use strict';
  const token='{{TOKEN}}';
  window.GlaukaBootMessages=/* @glauka-boot-messages */ {};
  const uiText=message=>window.GlaukaI18n?.translate(message)||message;
  const headers={'X-NeuroMap-Session':token,'Content-Type':'application/json'};
  async function api(route,payload={}){
    let response;
    const body=JSON.stringify(payload);
    try { response=await fetch('/__desktop/'+route,{method:'POST',headers,body,cache:'no-store',keepalive:route==='window/closed'||route==='heartbeat'||(route==='workspace/write'&&new TextEncoder().encode(body).length<60000)}); }
    catch(err) { throw new Error('Servizio desktop non raggiungibile. Le modifiche sono ancora in memoria: esporta un backup, chiudi Glauka e riaprilo con la versione aggiornata. ('+err.message+')'); }
    const data=await response.json().catch(()=>({message:'Risposta desktop non valida'}));
    if(!response.ok)throw new Error(uiText(data.message||'Errore desktop '+response.status));
    return data;
  }
  function decodeBase64(input){
    const s=atob(input);const data=new Uint8Array(s.length);
    for(let i=0;i<s.length;i++)data[i]=s.charCodeAt(i);
    return data;
  }
  function fromHeader(str){
    if(!str)return '';
    const padded=str.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-str.length%4)%4);
    return new TextDecoder().decode(decodeBase64(padded));
  }
  let queuedWorkspace=Promise.resolve();
  function saveWorkspaceOrdered(json){
    const write=()=>api('workspace/write',{json});
    const pending=queuedWorkspace.then(write,write);
    queuedWorkspace=pending.catch(()=>{});
    return pending;
  }
  // Convert byte arrays in 12-KiB aligned pieces. Bounded temporary
  // strings avoid copying a second full-size binary string for large exports.
  function encodeExportBytes(bytes){
    if(!(bytes instanceof Uint8Array))throw Error('Export bytes must be Uint8Array');
    if(bytes.length>80*1024*1024)throw Error('Export exceeds 80 MB');
    const encoded=[];
    for(let i=0;i<bytes.length;i+=12288){
      encoded.push(btoa(String.fromCharCode(...bytes.subarray(i,i+12288))));
    }
    return encoded.join('');
  }
  window.neuromapDesktop=Object.freeze({
    developerEdition: {{DEV_EDITION}},
    writeClipboardPNG:data=>api('clipboard/png',{data}),
    initialLocale: /* @glauka-initial-locale */ "it",
    writeInterfaceLocale:locale=>api('interface-locale/write',{locale}),
    productStatus:()=>api('product/status'),
    distributionStatus:()=>api('distribution/status'),
    readEditorPreferences:async()=>(await api('editor-preferences/read')).json||null,
    writeEditorPreferences:json=>api('editor-preferences/write',{json}),
    readAISecret:()=>api('secret/read'),
    saveAISecret:({key,remember})=>api('secret/write',{key,remember}),
    // Optional offline-first cloud local cache. This bridge never exposes any
    // OAuth token or generic network proxy to the editor JavaScript.
    cloudAuth: Object.freeze({
      status:()=>api('cloud/auth/status'),
      start:provider=>api('cloud/auth/start',{provider}),
      getPublicConfig:()=>api('cloud/auth/public-config'),
      configure:({provider,clientID,clientSecret='',redirectURI=''})=>api('cloud/auth/public-config/write',{provider,clientID,clientSecret,redirectURI}),
      disconnect:provider=>api('cloud/auth/disconnect',{provider})
    }),
    // Never expose OAuth tokens to editor JS. Encode only the file bytes being
    // sent over the authenticated desktop-only API. Native Go sets Bearer.
    cloudTransport: Object.freeze({
      async send({provider,method,url,headers={},body=null,format='json'}){
        if(!['google','dropbox','onedrive'].includes(provider))throw Error('Unsupported provider');
        let bytes;
        if(body==null)bytes=new Uint8Array();
        else if(typeof body==='string')bytes=new TextEncoder().encode(body);
        else if(body instanceof Blob)bytes=new Uint8Array(await body.arrayBuffer());
        else if(body instanceof Uint8Array)bytes=body;
        else throw Error('Invalid cloud request body');
        if(bytes.length>12*1024*1024)throw Error('Cloud upload exceeds 12 MiB');
        const base64=encodeExportBytes(bytes);
        const answer=await api('cloud/request',{
          provider,method,url,headers,base64,format
        });
        if(!Number.isInteger(answer.status))throw Error('Invalid native cloud reply');
        const output={status:answer.status,json:answer.json||null};
        if(format==='bytes'&&typeof answer.bytesBase64==='string'){
          const raw=decodeBase64(answer.bytesBase64);
          output.bytes=new TextDecoder('utf-8',{fatal:true}).decode(raw);
        }
        return output;
      }
    }),
    cloudLocal: Object.freeze({
      readIndex:async()=>(await api('cloud/index/read')).json||null,
      writeIndex:async json=>api('cloud/index/write',{json}),
      listDocuments:async()=>(await api('cloud/documents/list')).ids||[],
      readDocument:async id=>(await api('cloud/document/read',{id})).json||null,
      writeDocument:async(id,json)=>api('cloud/document/write',{id,json}),
      providerStatus:()=>api('cloud/provider/status'),
      protectWorkspace:expectedHash=>api('cloud/workspace/protect',{expectedHash})
    }),
    readWorkspace:async()=>{const value=await api('workspace/read');if(window.NeuroMapRecovery)window.NeuroMapRecovery.lastReadUsedPrevious=value.recoveredPrevious===true;return value.json||null;},
    writeWorkspace:saveWorkspaceOrdered,
    // A queued write must never resurrect an intentionally discarded session.
    // Serialize the delete behind every write already accepted by the bridge.
    discardWorkspace:()=>{
      const remove=()=>api('workspace/discard');
      const pending=queuedWorkspace.then(remove,remove);
      queuedWorkspace=pending.catch(()=>{});
      return pending;
    },
    lanPair:Object.freeze({
      start:payload=>api('lan/start',payload),
      poll:sessionId=>api('lan/poll',{sessionId}),
      push:(sessionId,chunks,decision)=>api('lan/push',{sessionId,chunks,decision}),
      pull:sessionId=>api('lan/pull',{sessionId}),
      stop:()=>api('lan/stop',{})
    }),
    openProjects: async()=>{
      const result=await api('file/open-many');
      return result?.files?.map(file=>{
        // Accept legacy replies too; current backends send only bounded metadata.
        if(typeof file.base64==='string')return {...file,bytes:decodeBase64(file.base64)};
        return {...file,read:async()=>{
          const response=await fetch('/__desktop/file/read-selected',{method:'POST',headers,body:JSON.stringify({id:file.id}),cache:'no-store'});
          if(!response.ok){const error=await response.json().catch(()=>({}));throw Object.assign(Error(uiText(error.message||'Apertura file non riuscita')),{code:error.code||'unreadable'});}
          return {...file,bytes:new Uint8Array(await response.arrayBuffer()),pathWarning:file.pathWarning||response.headers.get('X-Glauka-Path-Warning')==='1'};
        }};
      })||[];
    },
    illustration: async params=>(await api('illustration',params)).payload,
    openProject:async()=>{
      let response;
      try { response=await fetch('/__desktop/file/open',{method:'POST',headers,body:'{}',cache:'no-store'}); }
      catch(err) { throw Error('Impossibile aprire: servizio desktop non raggiungibile. Riavvia Glauka.'); }
      if(response.status===204)return {cancelled:true};
      if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.message||'Apertura file non riuscita');}
      if(response.headers.get('X-Glauka-Path-Warning')==='1')
        window.neuroMapApp?.showToast?.('File aperto, ma il percorso non è memorizzabile: potrà essere necessario Salva con nome.','ATTENZIONE');
      return {filename:fromHeader(response.headers.get('X-NeuroMap-Filename')),
        path:fromHeader(response.headers.get('X-NeuroMap-Path')),
        bytes:new Uint8Array(await response.arrayBuffer())};
    },
    listRecentProjects:async()=>(await api('file/recent/list')).files||[],
    openRecentProject:async filePath=>{
      let response;
      try{response=await fetch('/__desktop/file/recent/open',{method:'POST',headers,body:JSON.stringify({path:filePath}),cache:'no-store'});}
      catch(err){throw Error(uiText('Impossibile aprire il file recente: servizio desktop non raggiungibile.'));}
      if(!response.ok){
        const error=await response.json().catch(()=>({}));
        throw Object.assign(Error(uiText(error.message||'Apertura file recente non riuscita')),{status:response.status});
      }
      return {
        filename:fromHeader(response.headers.get('X-NeuroMap-Filename')),
        path:fromHeader(response.headers.get('X-NeuroMap-Path')),
        bytes:new Uint8Array(await response.arrayBuffer())
      };
    },
    saveProject:request=>api('file/save',request),
    pickLinkFile:()=>api('file/pick-link',{}),
    openLinkedTarget:request=>api('file/open-link',request),
    // Read-only version discovery and explicit copy-only recovery; no project overwrite.
    listProjectHistory:filePath=>api('file/history/list',{filePath}),
    describeProjectHistory:(filePath,id)=>api('file/history/diff',{filePath,id}),
    pinProjectHistory:(filePath,id,pinned)=>api('file/history/pin',{filePath,id,pinned}),
    recoverProjectHistory:(filePath,id)=>api('file/history/recover',{filePath,id}),
    saveExport:async({filename,bytes})=>
      api('file/export',{filename:filename||'Glauka-export.json',
       base64:encodeExportBytes(bytes)}),
    saveExportFolder:async({subdir,files})=>
      api('file/export-folder',{subdir:subdir||'Glauka_Export',
       files:(files||[]).map(f=>({name:f.name,base64:encodeExportBytes(f.bytes)}))}),
    onExternalFile:callback=>{
      if(typeof callback!=='function')return()=>{};
      let stopped=false,busy=false,pendingAck=null,snoozeUntil=0;
      const key='glauka:last-external-import-id';
      const notify=message=>{
        const text=uiText(message);
        try{window.neuroMapApp?.showToast?.(text,'APERTURA FILE');}catch{}
        console.warn('Apertura file esterno:',text);
      };
      const acknowledge=async()=>{
        if(!pendingAck)return;
        await api('external/confirm',pendingAck);
        pendingAck=null;
      };
      const deferred=new Map();
      const poll=async()=>{
        if(stopped||busy||Date.now()<snoozeUntil)return;
        busy=true;
        const report=window.GlaukaNativeOpen?.report?.('external'),unreadable=[],seen=new Set();
        try{
          if(pendingAck){await acknowledge();return;}
          // Drain a bounded burst immediately; 900 ms is an idle-arrival poll,
          // never a mandatory delay between files already queued by the OS.
          for(let attempt=0;attempt<30&&!stopped;attempt++){
            for(const [id,until]of deferred)if(until<=Date.now())deferred.delete(id);
            const response=await fetch('/__desktop/external/pending',{
              method:'POST',headers,body:JSON.stringify({exclude:[...deferred.keys()]}),cache:'no-store'});
            if(response.status===204)break;
            const id=response.headers.get('X-Glauka-Delivery-ID')||'';
            if(!/^[A-Za-z0-9_-]{43}$/.test(id))throw Error('Conferma apertura file non valida');
            if(seen.has(id))break;seen.add(id);
            if(!response.ok){
              const details=await response.json().catch(()=>({}));
              const name=fromHeader(response.headers.get('X-NeuroMap-Filename'));
              const message=details.message||'File esterno non accessibile';notify((name?name+': ':'')+message);
              deferred.set(id,Date.now()+15000);unreadable.push({id,message});
              if(report)window.GlaukaNativeOpen.record(report,{filename:name,deliveryId:id},{status:'failed',message});
              continue;
            }
            const payload={deliveryId:id,filename:fromHeader(response.headers.get('X-NeuroMap-Filename')),path:fromHeader(response.headers.get('X-NeuroMap-Path')),pathWarning:response.headers.get('X-Glauka-Path-Warning')==='1'};
            try{
              let alreadyImported=false;try{alreadyImported=window.sessionStorage?.getItem(key)===id;}catch{}
              if(!alreadyImported){
                if(payload.pathWarning)notify('File aperto, ma il percorso non è memorizzabile: potrà essere necessario Salva con nome.');
                payload.bytes=new Uint8Array(await response.arrayBuffer());if(stopped)return;
                const result=await callback(payload);
                if(result===false)throw Error('Importazione non completata');
                if(report)window.GlaukaNativeOpen.record(report,payload,result?.status?result:{status:'opened'});
                if(result?.code!=='cancelled')try{window.sessionStorage?.setItem(key,id);}catch{}
                if(result?.code==='cancelled'){pendingAck={id,action:'skip'};await acknowledge();continue;}
                try{window.focus()}catch{}
              }
              pendingAck={id,action:'imported'};await acknowledge();
            }catch(error){
              if(pendingAck)throw error; // Retry a lost ACK without re-importing.
              notify(payload.filename+': '+(error?.message||String(error)));
              deferred.set(id,Date.now()+15000);
              if(report)window.GlaukaNativeOpen.record(report,payload,{status:'failed',message:error?.message||String(error)});
            }
            await new Promise(resolve=>setTimeout(resolve,0));
          }
          // Offer explicit Skip only AFTER other readable files have progressed.
          // Cancelling preserves the failed file and retries later; no silent drop.
          for(const failed of unreadable){
            if(window.confirm(uiText(failed.message)+'\n'+uiText('Vuoi saltare il file non accessibile? Scegli Annulla per riprovare.'))){
              pendingAck={id:failed.id,action:'skip'};await acknowledge();deferred.delete(failed.id);
            }
          }
          if(report?.entries.length)window.neuroMapApp?.v6ReportNativeOpen?.(report);
        }catch(error){
          if(!stopped){notify(error?.message||String(error));snoozeUntil=Date.now()+5000;}
        }finally{busy=false}
      };
      const interval=setInterval(poll,900);
      void poll();
      return()=>{stopped=true;clearInterval(interval)};
    }
  });
  const windowId=crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');let closed=false,timer,sequence=0,streamPending=false,streamController;
  const heartbeat=(state='alive')=>{if(!closed)api('heartbeat',{windowId,state,hidden:document.hidden,sequence:++sequence}).catch(()=>{});};
  const connect=async()=>{
    if(closed||streamPending)return;streamPending=true;
    const control=typeof AbortController==='function'?new AbortController():null;streamController=control;
    try{const response=await fetch('/__desktop/window/live',{method:'POST',headers,cache:'no-store',signal:control?.signal,body:JSON.stringify({windowId,sequence:++sequence,hidden:document.hidden})});
      const reader=response.ok&&response.body?.getReader?.();if(!reader)return;
      try{while(!closed){const chunk=await reader.read();if(chunk.done)break}}finally{reader.releaseLock()}
    }catch{}finally{streamPending=false;if(streamController===control)streamController=null}
  };
  const start=()=>{closed=false;clearInterval(timer);heartbeat('open');connect();timer=setInterval(()=>{heartbeat();connect()},15000);};
  start();
  window.addEventListener('pagehide',event=>{closed=true;clearInterval(timer);streamController?.abort();const cached=!!event?.persisted;api(cached?'heartbeat':'window/closed',cached?{windowId,sequence:++sequence,state:'alive',hidden:true}:{windowId,sequence:++sequence}).catch(()=>{});});
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  document.addEventListener('visibilitychange',()=>heartbeat());
})();
