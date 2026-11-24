// Glauka desktop cloud-account settings. This panel never receives tokens.
// Two-way native sync is opt-in and requires registered provider OAuth clients.
(()=>{
'use strict';
const bridge=()=>window.neuromapDesktop?.cloudAuth;
const lang=()=>{try{return localStorage.getItem('nm6_locale')==='en'?'en':'it'}
 catch(_){return document.documentElement.lang==='en'?'en':'it'}};
const t=(it,en)=>window.GlaukaI18n?.pair(it,en)??(lang()==='en'?en:it);
const create=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;
 if(text!==undefined)e.textContent=text;return e};
function cloudLogo(id){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('width','31');svg.setAttribute('height','31');
 svg.setAttribute('aria-hidden','true');
 svg.classList.add('gl-cloud-provider-logo');
 if(id==='onedrive'){
  const cloud=document.createElementNS(svg.namespaceURI,'path');
  cloud.setAttribute('d','M7 24c-3 0-5-2-5-5s2-5 5-5c2-5 6-8 11-7 5 1 8 4 9 9 2 1 3 3 3 5 0 2-2 3-5 3z');
  cloud.setAttribute('fill','#0078d4');svg.append(cloud);return svg;
 }
 const polygons=id==='google'?[
  ['5,23 11,12 16,21 11,30','#00875a'],
  ['11,3 20,3 31,23 22,23','#ffba00'],
  ['5,23 11,12 20,12 14,23','#34a853'],
  ['14,23 31,23 26,30 10,30','#4285f4'],
  ['11,3 20,3 14,13 5,23 0,23','#0f9d58']
 ]:[
  ['8,2 15,7 8,12 1,7','#0061ff'],
  ['23,2 30,7 23,12 16,7','#0061ff'],
  ['8,14 15,19 8,24 1,19','#0061ff'],
  ['23,14 30,19 23,24 16,19','#0061ff'],
  ['16,20 23,25 16,30 9,25','#0061ff']
 ];
 for(const [points,color]of polygons){
  const p=document.createElementNS(svg.namespaceURI,'polygon');p.setAttribute('points',points);p.setAttribute('fill',color);svg.append(p);
 }
 return svg;
}
function syncStateLabel(value){
 const status=value&&value.status;
 if(status==='conflict'||status==='needs-review'||status==='review')return t('Conflitto','Conflict');
 if(status==='error'||status==='unsupported-size')return t('Errore','Error');
 if(status==='synced'&&!value.dirty)return t('Sincronizzato','Synced');
 if(value&&(value.dirty||status==='stale-local'||status==='offline'||status==='incoming'))return t('Da sincronizzare','Waiting to sync');
 return t('Salvato in locale','Saved on this device');
}

function mount(){
 const file=document.getElementById('dropdown-file');
 if(!file||!bridge()||document.getElementById('gl-cloud-open'))return;
 const opener=create('button','dropdown-item');
 const openerLabel=create('span','gl-cloud-menu-label',t('Cloud e sincronizzazione…','Cloud and synchronization…'));
 opener.append(openerLabel);
 opener.id='gl-cloud-open';opener.type='button';
 const anchor=document.getElementById('nm-save-status')||document.getElementById('nm611-autosave-open');
 if(anchor&&anchor.parentElement===file)anchor.after(opener);else file.append(opener);
 const curtain=create('div','gl-cloud-curtain');curtain.id='gl-cloud-dialog';curtain.hidden=true;
 curtain.setAttribute('role','dialog');curtain.setAttribute('aria-modal','true');
 curtain.setAttribute('aria-labelledby','gl-cloud-title');
 const panel=create('section','gl-cloud-card');
 const heading=create('div','gl-cloud-heading');
 const title=create('h2','',t('Cloud e sincronizzazione','Cloud and synchronization'));
 title.id='gl-cloud-title';
 const close=create('button','gl-cloud-close','✕');close.type='button';
 close.setAttribute('aria-label',t('Chiudi finestra','Close dialog'));
 heading.append(title,close);
 const description=create('p','gl-cloud-note');
 const notice=create('details','gl-cloud-guide');
 const noticeHeading=create('summary');
 const noticeCopy=create('p');
 notice.append(noticeHeading,noticeCopy);
 const overview=create('section','gl-cloud-overview');
 overview.setAttribute('aria-live','polite');
 const providers=create('div','gl-cloud-providers');
 const feedback=create('p','gl-cloud-feedback');
 feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 const refresh=create('button','gl-cloud-refresh',t('Aggiorna stato','Refresh status'));
 refresh.type='button';
 description.id='gl-cloud-intro';curtain.setAttribute('aria-describedby',description.id);
 panel.append(heading,description,overview,providers,notice,feedback,refresh);
 curtain.append(panel);document.body.append(curtain);
 const names={google:'Google Drive',dropbox:'Dropbox',onedrive:'Microsoft OneDrive'};
 let openerToRestore=opener;
 const top=document.querySelector('.tab-bar');
 if(top&&!document.getElementById('gl-cloud-quick')){
   const quick=create('button','gl-toolbar-utility','☁');quick.id='gl-cloud-quick';
   quick.type='button';quick.setAttribute('aria-label',t('Apri Cloud','Open cloud'));
   quick.title=t('Cloud: collega account e trova mappe','Cloud: connect accounts and find maps');
   top.append(quick);
   quick.addEventListener('click',()=>{
     openerToRestore=quick;opener.click();
   });
   if(!document.getElementById('gl-google-account-quick')){
    const AVATAR_KEY='glauka.google.avatar.v1';
    const NAME_KEY='glauka.google.name.v1';
    const gBtn=create('button','gl-toolbar-utility gl-google-pill');gBtn.id='gl-google-account-quick';
    gBtn.type='button';
    const avatarWrap=create('span','gl-google-avatar-ring');
    const avatarInner=create('span','gl-google-avatar-core');
    const gImg=document.createElement('img');gImg.className='gl-google-avatar-img';gImg.alt='';gImg.hidden=true;
    const gLetter=create('span','gl-google-avatar-letter');gLetter.hidden=true;
    const gSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    gSvg.setAttribute('viewBox','0 0 24 24');gSvg.setAttribute('width','16');gSvg.setAttribute('height','16');
    gSvg.setAttribute('aria-hidden','true');
    for(const [dPath,fill]of[
      ['M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5c-.2 1.2-1 2.3-2 3v2.5h3.2c1.9-1.7 3.1-4.3 3.1-7.3z','#4285F4'],
      ['M12 22c2.7 0 5-.9 6.7-2.5l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.7 0-4.9-1.8-5.7-4.2H3v2.6C4.7 19.7 8.1 22 12 22z','#34A853'],
      ['M6.3 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H3C2.4 8.9 2 10.4 2 12s.4 3.1 1 4.4l3.3-2.6z','#FBBC05'],
      ['M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17 3.1 14.7 2 12 2 8.1 2 4.7 4.3 3 7.6l3.3 2.6C7.1 7.8 9.3 6 12 6z','#EA4335']
    ]){const p=document.createElementNS(gSvg.namespaceURI,'path');p.setAttribute('d',dPath);p.setAttribute('fill',fill);gSvg.append(p);}
    avatarInner.append(gImg,gLetter,gSvg);
    avatarWrap.append(avatarInner);
    const proBadge=create('span','gl-google-pro-badge','PRO');
    proBadge.hidden=true;
    gBtn.append(avatarWrap,proBadge);
    gBtn.setAttribute('aria-label',t('Account Google','Google Account'));
    gBtn.title=t('Account Google · Accedi o gestisci foto profilo','Google Account · Sign in or manage profile');
    top.append(gBtn);

    const gMenu=create('div','gl-google-menu');gMenu.id='gl-google-account-menu';gMenu.hidden=true;
    const gMenuHead=create('div','gl-google-menu-head');
    const gMenuPlan=create('span','gl-google-menu-plan',t('Glauka Free','Glauka Free'));
    const gMenuSign=create('button','gl-google-menu-btn gl-google-menu-primary',t('Accedi / Gestisci Account Google','Sign in / Manage Google Account'));
    gMenuSign.type='button';
    const gMenuPhotoBtn=create('button','gl-google-menu-btn',t('Imposta immagine profilo…','Set profile picture…'));
    gMenuPhotoBtn.type='button';
    const gMenuInitialBtn=create('button','gl-google-menu-btn',t('Imposta iniziali / nome…','Set initials / name…'));
    gMenuInitialBtn.type='button';
    const gMenuClearBtn=create('button','gl-google-menu-btn',t('Ripristina icona Google','Reset to Google icon'));
    gMenuClearBtn.type='button';
    const gFileInput=document.createElement('input');gFileInput.type='file';gFileInput.accept='image/*';gFileInput.hidden=true;
    gMenuHead.append(gMenuPlan);
    gMenu.append(gMenuHead,gMenuSign,gMenuPhotoBtn,gMenuInitialBtn,gMenuClearBtn,gFileInput);
    document.body.append(gMenu);

    let isPro=false,googleLinked=false;
    function renderGoogleAvatar(){
      let savedImg='',savedName='';
      try{savedImg=localStorage.getItem(AVATAR_KEY)||'';savedName=localStorage.getItem(NAME_KEY)||'';}catch(_){}
      const validImg=/^data:image\/(png|jpeg|webp);base64,/i.test(savedImg)&&savedImg.length<120000;
      gBtn.classList.toggle('is-pro',isPro);
      gBtn.classList.toggle('is-connected',googleLinked||validImg||!!savedName);
      proBadge.hidden=!isPro;
      gMenuPlan.textContent=(isPro?t('Account PRO','PRO Account'):t('Account Free','Free Account'))+(savedName?' · '+savedName:'');
      if(validImg){
        gImg.src=savedImg;gImg.hidden=false;gLetter.hidden=true;gSvg.style.display='none';
      }else if(savedName){
        gLetter.textContent=savedName.trim().slice(0,2).toUpperCase();
        gLetter.hidden=false;gImg.hidden=true;gSvg.style.display='none';
      }else{
        gImg.hidden=true;gLetter.hidden=true;gSvg.style.display='';
      }
      gMenuClearBtn.hidden=!validImg&&!savedName;
    }
    var syncGoogleAvatarState=(connected)=>{googleLinked=!!connected;renderGoogleAvatar();};
    renderGoogleAvatar();
    void window.neuromapDesktop?.productStatus?.().then(ps=>{
      isPro=ps?.plan==='pro';renderGoogleAvatar();
    }).catch(()=>{});

    gBtn.addEventListener('click',e=>{
      e.stopPropagation();
      const willOpen=gMenu.hidden;
      gMenu.hidden=!willOpen;
    });
    document.addEventListener('click',e=>{
      if(!gMenu.hidden&&!gMenu.contains(e.target)&&e.target!==gBtn&&!gBtn.contains(e.target))gMenu.hidden=true;
    });
    gMenuSign.addEventListener('click',()=>{
      gMenu.hidden=true;
      window.open('https://accounts.google.com/','_blank','noopener,noreferrer');
    });
    gMenuPhotoBtn.addEventListener('click',()=>gFileInput.click());
    gFileInput.addEventListener('change',()=>{
      const file=gFileInput.files?.[0];gFileInput.value='';
      if(!file||file.size>10*1024*1024)return;
      const reader=new FileReader();
      reader.onload=()=>{
        const img=new Image();
        img.onload=()=>{
          const c=document.createElement('canvas');c.width=96;c.height=96;
          const ctx=c.getContext('2d');if(!ctx)return;
          const side=Math.min(img.width,img.height);
          const sx=Math.max(0,(img.width-side)/2),sy=Math.max(0,(img.height-side)/2);
          ctx.drawImage(img,sx,sy,side,side,0,0,96,96);
          try{localStorage.setItem(AVATAR_KEY,c.toDataURL('image/png'));}catch(_){}
          renderGoogleAvatar();
        };
        img.src=String(reader.result||'');
      };
      reader.readAsDataURL(file);
    });
    gMenuInitialBtn.addEventListener('click',()=>{
      const cur=(()=>{try{return localStorage.getItem(NAME_KEY)||''}catch(_){return ''}})();
      const val=window.prompt(t('Inserisci il tuo nome o le iniziali (max 24 caratteri):','Enter your name or initials (max 24 chars):'),cur);
      if(val===null)return;
      try{
        const clean=val.trim().slice(0,24);
        if(clean)localStorage.setItem(NAME_KEY,clean);else localStorage.removeItem(NAME_KEY);
      }catch(_){}
      renderGoogleAvatar();
    });
    gMenuClearBtn.addEventListener('click',()=>{
      try{localStorage.removeItem(AVATAR_KEY);localStorage.removeItem(NAME_KEY);}catch(_){}
      renderGoogleAvatar();
    });
   }
 }
 let busy=false,authWatch=null,cloudHasAccount=false,cloudRegistered=false;
 function registerWithWorkspace(){
  if(cloudRegistered)return true;
  const workspace=window.NeuroMapWorkspaceLayout,app=window.neuroMapApp;
  if(!app||!workspace?.registerPanel)return false;
  cloudRegistered=workspace.registerPanel(app,'cloud',{
   isOpen:()=>!curtain.hidden&&curtain.classList.contains('gl-cloud-docked'),
   close:()=>hide(false),
   canLeave:()=>!busy,
   focus:()=>close.focus()
  })===true;
  return cloudRegistered;
 }
 function presentCloud(){
  const workspace=window.NeuroMapWorkspaceLayout,app=window.neuroMapApp;
  const canDock=cloudHasAccount&&(window.innerWidth||0)>=850&&registerWithWorkspace();
  // The coordinator checks unfinished drafts before switching panels.
  const docked=!!(canDock&&!curtain.hidden&&
   (curtain.classList.contains('gl-cloud-docked')||
    workspace.claim(app,'cloud')!==false));
  curtain.classList.toggle('gl-cloud-docked',docked);
  curtain.setAttribute('aria-modal',String(!docked));
 }
 function stopAuthWatch(){if(authWatch!==null){clearTimeout(authWatch);authWatch=null}}
 async function watchAuthorization(provider,attempts=0){
  if(curtain.hidden)return;
  if(attempts>=45){
   feedback.textContent=t('Il collegamento non risulta completato. Controlla la finestra del browser e premi Aggiorna stato.',
    'Connection is not confirmed. Check the browser window and refresh status.');
   return;
  }
  try{
   const current=await bridge().status();
   if(current?.[provider]?.connected){
    stopAuthWatch();await reload();
    feedback.textContent=t('Account collegato! Attiva la sincronizzazione o scegli Trova mappe.',
     'Account connected! Enable synchronization or choose Find maps.');
    return;
   }
  }catch(_){}
  authWatch=setTimeout(()=>void watchAuthorization(provider,attempts+1),2000);
 }
 function updateText(){
  openerLabel.textContent=t('Cloud e sincronizzazione…','Cloud and synchronization…');
  title.textContent=t('Cloud e sincronizzazione','Cloud and synchronization');
  close.setAttribute('aria-label',t('Chiudi finestra','Close dialog'));
  description.textContent=t('Scegli dove tenere una copia delle mappe. Il salvataggio sul dispositivo rimane disponibile.',
   'Choose where to keep a copy of your maps. Local saving remains available.');
  noticeHeading.textContent=t('Come funziona la sincronizzazione?', 'How does synchronization work?');
  noticeCopy.textContent=t('Collega un servizio nel browser ufficiale, attiva la sincronizzazione e premi «Salva e sincronizza ora» per creare la prima copia. Puoi collegare più account, ma solo una destinazione è attiva alla volta. Se le copie differiscono, potrai scegliere come recuperarle senza sovrascritture silenziose.',
   'Connect in the provider’s official browser, enable sync and choose “Save and sync now” to create the first copy. You may connect multiple accounts, but only one destination is active at a time. Conflicting copies require your choice; they are not silently overwritten.');
  refresh.textContent=t('Aggiorna stato','Refresh status');
 }
 async function reload(){
  if(busy)return;
  updateText();providers.replaceChildren();window.GlaukaCloudLibrary?.reset();feedback.textContent='';
  let status;
  try{status=await bridge().status()}catch(_){
   feedback.textContent=t('Stato cloud non disponibile.','Cloud status unavailable.');return
  }
  syncGoogleAvatarState?.(status?.google?.connected);
  const configured=!!status.supported&&['google','dropbox','onedrive'].some(id=>status[id]?.configured);
  description.hidden=!configured;notice.hidden=!configured;
  const connectedIds=['google','dropbox','onedrive'].filter(id=>status.supported&&status[id]?.configured&&status[id]?.connected);
  overview.dataset.cloudState=!status.supported?'unsupported':!configured?'unconfigured':'ready';
  cloudHasAccount=connectedIds.length>0;
  presentCloud();
  const activeId=connectedIds.find(id=>window.GlaukaCloudSync?.enabled(id))||'';
  const selectedId=activeId||connectedIds[0]||'';
  if(selectedId)overview.dataset.cloudState=activeId?'active':'connected';
  overview.dataset.provider=selectedId;
  overview.classList.toggle('gl-cloud-overview-idle',!selectedId);
  const overviewIcon=create('span','gl-cloud-overview-icon',activeId?'☁':selectedId?'✓':'☁');
  overviewIcon.setAttribute('aria-hidden','true');
  const overviewText=create('div','gl-cloud-overview-text');
  const overviewTitle=create('strong','',activeId
    ?t('Destinazione attiva: ','Active destination: ')+names[activeId]
    :selectedId?t('Account collegato: ','Connected account: ')+names[selectedId]
    :!status.supported?t('OAuth non disponibile su questo dispositivo.','OAuth is not available on this device.')
    :configured?t('Cloud pronto per il collegamento','Cloud ready to connect')
    :t('Cloud non disponibile: configurazione mancante','Cloud unavailable: setup missing'));
  const overviewDetail=create('small','',activeId
    ?t('Controllo sincronizzazione…','Checking synchronization…')
    :selectedId?t('Sincronizzazione disattivata · le mappe locali sono conservate','Sync is off · local maps are preserved')
    :configured?t('Collega un account nel browser ufficiale. La sincronizzazione resta disattivata finché non la abiliti.','Connect an account in the official browser. Sync stays off until you enable it.')
    :t('Il collegamento non è ancora disponibile in questa installazione. I progetti restano in locale; la configurazione OAuth spetta all’editore di Glauka.','Account connection is not yet available in this installation. Projects stay local; OAuth setup is the responsibility of the Glauka publisher.'));
  const stateChip=create('span','gl-cloud-state',syncStateLabel(null));
  overviewText.append(overviewTitle,stateChip,overviewDetail);
  overview.replaceChildren(overviewIcon,overviewText);
  const quick=document.getElementById('gl-cloud-quick');
  if(quick){quick.dataset.cloudState=activeId?'active':selectedId?'connected':overview.dataset.cloudState;quick.title=overviewTitle.textContent;}
  if(activeId&&window.GlaukaCloudSync?.summary){
    void window.GlaukaCloudSync.summary(activeId).then(value=>{
      if(overview.dataset.provider!==activeId||!overviewDetail.isConnected)return;
      stateChip.textContent=syncStateLabel(value);
      overviewDetail.textContent=value?.status==='conflict'
       ?t('Conflitto da risolvere · nessuna sostituzione automatica','Conflict needs review · no automatic replacement')
       :value?.status==='incoming'
       ?t('Nuova copia cloud da esaminare','New cloud copy to review')
       :value?.status==='error'
       ?t('Errore di sincronizzazione · copia locale conservata','Sync error · local copy preserved')
       :value?.dirty
       ?t('Modifiche in attesa di sincronizzazione','Changes waiting to sync')
       :value?.lastSuccess
       ?t('Ultima sincronizzazione: ','Last synchronized: ')+new Date(value.lastSuccess).toLocaleString()
       :t('Attiva · in attesa della prima sincronizzazione','Enabled · waiting for first synchronization');
    }).catch(()=>{if(overviewDetail.isConnected)overviewDetail.textContent=t('Stato non disponibile','Status unavailable')});
  }
  for(const id of ['google','dropbox','onedrive']){
   const row=create('div','gl-cloud-row'),meta=create('div');
   const strong=create('strong','',names[id]);
   const info=status[id]||{},enabled=!!status.supported&&!!info.configured;
   const connected=enabled&&!!info.connected;
   row.classList.toggle('gl-cloud-active-provider',connected&&id===activeId);
   row.classList.toggle('gl-cloud-connected-provider',connected);
   const detail=create('small','',connected
    ?(window.GlaukaCloudSync?.enabled(id)
      ?t('Account collegato · Sync attiva','Account connected · Sync enabled')
      :t('Account collegato · Sync non attiva','Account connected · Sync inactive'))
    :enabled?t('Non collegato','Not connected')
    :t('Servizio non configurato dall’editore','Service not configured by the publisher'));
   const action=create('button',connected?'gl-cloud-disconnect':'',
    connected?t('Disconnetti','Disconnect'):enabled?t('Collega','Connect'):t('Dettagli','Details'));
   action.type='button';action.disabled=!status.supported;
   detail.hidden=false;
   meta.append(strong,detail);
   if(connected){
    meta.append(create('small','gl-cloud-destination',id==='google'
     ?t('Dove salvo: Google Drive → Glauka','Destination: Google Drive → Glauka')
     :id==='onedrive'
     ?t('Dove salvo: OneDrive → App → Glauka','Destination: OneDrive → Apps → Glauka')
     :t('Dove salvo: spazio app Dropbox → Glauka','Destination: Dropbox app space → Glauka')));
   }
   const branding=create('div','gl-cloud-brand');branding.append(cloudLogo(id),meta);
   row.append(branding,action);
   if(connected||window.GlaukaCloudSync?.enabled(id)){
     const sync=create('div','gl-cloud-sync-controls');
     const label=create('label','gl-cloud-sync-toggle'),check=create('input');
     check.type='checkbox';check.className='gl-cloud-sync-switch';check.dataset.provider=id;
     check.checked=!!window.GlaukaCloudSync?.enabled(id);
     const labelText=create('span','',t('Sincronizzazione automatica','Automatic synchronization'));
     label.append(check,labelText);sync.append(label);
     const explanation=create('small','gl-cloud-sync-help',t(
      'Disattivata inizialmente. Carica e riceve aggiornamenti; una sola destinazione cloud alla volta. I conflitti richiedono una scelta.',
      'Off by default. Sends and receives updates; one cloud destination at a time. Conflicts require review.'));
     sync.append(explanation);
     const statusLine=create('div','gl-cloud-sync-status');
     statusLine.setAttribute('role','status');statusLine.setAttribute('aria-live','polite');
     sync.append(statusLine);
     const inboxTools=create('div','gl-cloud-incoming-actions');
     inboxTools.hidden=true;
     const applyIncoming=create('button','gl-cloud-accept-incoming',t('Applica versione cloud','Apply cloud version'));
     const openCopy=create('button','gl-cloud-open-copy',t('Apri come nuove schede','Open as new tabs'));
     applyIncoming.type=openCopy.type='button';
     inboxTools.append(applyIncoming,openCopy);sync.append(inboxTools);
     const revealIncoming=state=>{inboxTools.hidden=!state;
       applyIncoming.hidden=state==='conflict'||state==='needs-review';};
     openCopy.addEventListener('click',()=>{void window.GlaukaCloudLibrary?.open(id,panel,feedback)});
     applyIncoming.addEventListener('click',async()=>{
       applyIncoming.disabled=true;
       try{
         let result=await window.GlaukaCloudSync.acceptIncoming(id);
         if(result?.status==='review'){
           const ok=window.confirm(t(
             'ATTENZIONE: il workspace su questo dispositivo è diverso. Vuoi sostituirlo con la versione cloud? Glauka conserverà prima un backup locale recuperabile. Per non sostituirlo, premi Annulla e usa «Apri come nuove schede».',
             'WARNING: your local workspace differs. Replace it with the cloud version? Glauka will first keep a recoverable local backup. Choose Cancel and “Open as new tabs” to preserve both.'));
           if(!ok){statusLine.textContent=t('Nessuna mappa modificata','No map changed');return}
           result=await window.GlaukaCloudSync.acceptIncoming(id,{replaceLocal:true});
         }
         if(result?.status==='synced'){
           statusLine.textContent=t('Versione cloud applicata e salvata sul dispositivo','Cloud version applied and saved locally');
           revealIncoming(null);
         }else statusLine.textContent=result?.error||t('Aggiornamento non applicato','Update not applied');
       }catch(error){statusLine.textContent=t('Impossibile applicare la copia cloud: ','Cannot apply cloud copy: ')+String(error?.message||error).slice(0,130)}
       finally{applyIncoming.disabled=false}
     });
     window.GlaukaCloudSync?.summary(id).then(value=>{
       if(!statusLine.isConnected)return;
       revealIncoming(value.incoming?'incoming':value.status==='conflict'?'conflict':null);
       statusLine.textContent=value.status==='incoming'
         ?t('Aggiornamento cloud disponibile · scegli come aprirlo','Cloud update available · choose how to open it')
         :value.status==='conflict'
         ?t('Conflitto: controlla le versioni prima di procedere','Conflict: review versions before proceeding')
         :value.status==='error'
         ?t('Errore di sincronizzazione · copia locale conservata','Sync error · local copy retained')
         :value.dirty
         ?t('Modifiche in attesa di sincronizzazione','Changes waiting to sync')
         :value.lastSuccess
         ?t('Ultima sincronizzazione: ','Last sync: ')+new Date(value.lastSuccess).toLocaleString()
         :value.enabled?t('In attesa del primo salvataggio','Waiting for first save')
         :t('Non attiva','Not active');
     }).catch(()=>{statusLine.textContent=t('Stato non disponibile','Status unavailable')});
     const syncNow=create('button','gl-cloud-sync-now',t('Salva e sincronizza ora','Save and sync now'));
     syncNow.disabled=!check.checked||!connected;syncNow.type='button';
     check.addEventListener('change',async()=>{
       check.disabled=true;syncNow.disabled=true;
       try{
         const newValue=check.checked;
         await window.GlaukaCloudSync.setEnabled(id,newValue);
         // Rebuild both rows: the other account may still be connected but
         // its automatic sync is now disabled for safety.
         await reload();
         feedback.textContent=newValue
           ?t('Destinazione attiva: '+names[id]+'. Premi «Salva e sincronizza ora» per creare la prima copia.',
              'Active destination: '+names[id]+'. Select Save and sync now to make your first copy.')
           :t('Sincronizzazione disattivata; i file locali sono conservati.',
              'Synchronization disabled; local files are retained.');
       }catch(error){
         check.checked=false;
         feedback.textContent=t('Impossibile attivare la sincronizzazione: ','Cannot enable sync: ')+String(error?.message||error).slice(0,180);
       }finally{check.disabled=false;syncNow.disabled=!check.checked||!connected}
     });
     syncNow.addEventListener('click',async()=>{
       syncNow.disabled=true;statusLine.textContent=t('Sincronizzazione in corso…','Synchronizing…');
       try{
         const result=await window.GlaukaCloudSync.syncNow(id);
         revealIncoming(['incoming','conflict','needs-review'].includes(result?.status)?result.status:null);
         statusLine.textContent=result?.status==='synced'
           ?result?.direction==='download'?t('Aggiornamenti ricevuti e salvati sul dispositivo','Updates received and saved locally')
             :t('Modifiche caricate sul cloud','Changes uploaded to cloud')
           :result?.status==='incoming'
             ?t('Aggiornamento cloud ricevuto · scegli come aprirlo','Cloud update received · choose how to open it')
           :result?.status==='conflict'?t('Conflitto: nessuna sovrascrittura eseguita','Conflict: nothing overwritten'):
           t('Sincronizzazione non completata: ','Synchronization incomplete: ')+(result?.error||result?.status||'');
       }catch(error){
         statusLine.textContent=t('Sincronizzazione non riuscita: ','Synchronization failed: ')+String(error?.message||error).slice(0,130);
       }finally{syncNow.disabled=!check.checked||!connected}
     });
     sync.append(syncNow);row.append(sync);
   }
   if(connected){
    const browse=create('button','gl-cloud-find',t('Trova mappe','Find maps'));
    browse.type='button';
    browse.addEventListener('click',()=>{
     if(busy)return;
     void window.GlaukaCloudLibrary?.open(id,panel,feedback);
    });
    row.append(browse);
   }
   providers.append(row);
   let setup=null;
   if(!enabled && status.supported){
     setup=create('section','gl-cloud-setup');setup.id='gl-cloud-setup-'+id;setup.hidden=true;setup.tabIndex=-1;
     setup.setAttribute('role','region');setup.setAttribute('aria-label',names[id]);
     action.classList.add('gl-cloud-configure-toggle');
     action.setAttribute('aria-controls',setup.id);action.setAttribute('aria-expanded','false');
     const guide=create('p','gl-cloud-note',t(
       'Serve l’identificativo pubblico di una vera applicazione OAuth registrata dal produttore di Glauka. Non inserire password, client secret o token.',
       'A real public OAuth application ID registered by the Glauka publisher is required. Never enter passwords, client secrets or tokens.'));
     const label=create('label','gl-cloud-field');
     const fieldName=create('span','',id==='google'?'Google Desktop OAuth Client ID':id==='onedrive'?'Microsoft Entra Client ID':'Dropbox App Key');
     const input=create('input','gl-cloud-public-id');input.type='text';input.autocomplete='off';
     input.spellcheck=false;input.maxLength=250;input.placeholder=id==='google'?'1234567890-example.apps.googleusercontent.com':id==='onedrive'?'00000000-0000-0000-0000-000000000000':'Dropbox public app key';
     input.setAttribute('aria-label',fieldName.textContent);
     label.append(fieldName,input);
     let secretInput=null,secretLabel=null;
     if(id==='google'){
      secretLabel=create('label','gl-cloud-field');
      const secretName=create('span','',t('Google Desktop OAuth Client Secret (richiesto da Google)','Google Desktop OAuth Client Secret (required by Google)'));
      secretInput=create('input','gl-cloud-public-id');secretInput.type='password';secretInput.autocomplete='off';
      secretInput.spellcheck=false;secretInput.maxLength=512;secretInput.placeholder='GOCSPX-...';
      secretInput.setAttribute('aria-label',secretName.textContent);
      secretLabel.append(secretName,secretInput);
     }
     const accountGuide=create('p','gl-cloud-note',t('Per collegare il tuo account non devi creare un’app OAuth. Quando il servizio è configurato, premi Collega e autorizza nel browser ufficiale.','You do not need to create an OAuth app to connect your account. Once the service is configured, select Connect and authorize in the official browser.'));
     const admin=create('details','gl-cloud-admin');
     admin.append(create('summary','',t('Configurazione dell’editore / amministratore','Publisher / administrator setup')));
     const instructions=create('p','gl-cloud-note',id==='google'
      ?t('Google: registra un client OAuth di tipo App desktop. Glauka usa PKCE e un redirect loopback locale; non serve un client secret nell’app.','Google: register a Desktop app OAuth client. Glauka uses PKCE and a local loopback redirect; the app does not need a client secret.')
      :id==='dropbox'
      ?t('Dropbox: crea un’app con accesso alla cartella app e registra esattamente l’URI di ritorno indicato sotto. Usa l’App Key pubblica.','Dropbox: create an app with App folder access and register the exact callback URI below. Use the public App Key.')
      :t('Microsoft: registra un client pubblico desktop per gli account supportati e abilita il redirect loopback. Non creare un client secret.','Microsoft: register a public desktop client for the supported accounts and enable the loopback redirect. Do not create a client secret.'));
     const urls={google:['https://console.cloud.google.com/apis/credentials','https://developers.google.com/identity/protocols/oauth2/native-app'],dropbox:['https://www.dropbox.com/developers/apps','https://www.dropbox.com/developers/reference/oauth-guide'],onedrive:['https://entra.microsoft.com/','https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow']};
     const links=create('p','gl-cloud-note');
     for(const [i,url]of urls[id].entries()){const link=create('a','',i?t('Guida OAuth ufficiale','Official OAuth guide'):t('Console del provider','Provider console'));link.href=url;link.target='_blank';link.rel='noopener noreferrer';links.append(link,document.createTextNode(' '));}
     admin.append(guide,instructions,links,label);if(secretLabel)admin.append(secretLabel);setup.append(accountGuide,admin);
     let redirect=null;
     if(id==='onedrive'){
       redirect=create('p','gl-cloud-note',t(
        'L’editore registra una sola volta Glauka su Microsoft Entra per account personali, aziendali e universitari. L’URI loopback è da autorizzare per il client desktop.',
        'The publisher registers Glauka once on Microsoft Entra for personal and work/school accounts. Approve the desktop loopback URI.'));
       admin.append(redirect);
     }
     if(id==='dropbox'){
       redirect=create('p','gl-cloud-note');
       void bridge().getPublicConfig().then(cfg=>{
         if(redirect?.isConnected)redirect.textContent=t('Registra questo URI di ritorno nella console Dropbox: ','Register this callback URI in the Dropbox console: ')+cfg.callback;
       }).catch(()=>{redirect.textContent=t('URI di callback non disponibile','Callback URI unavailable')});
       admin.append(redirect);
     }
     const save=create('button','gl-cloud-configure-save',t('Salva identificativo pubblico','Save public application ID'));
     save.type='button';admin.append(save);
     const statusText=create('p','gl-cloud-feedback');statusText.setAttribute('role','status');admin.append(statusText);
     save.addEventListener('click',async()=>{
       save.disabled=true;
       try{
         const cfg=await bridge().getPublicConfig();
         await bridge().configure({provider:id,clientID:input.value.trim(),
           clientSecret:secretInput?secretInput.value.trim():'',
           redirectURI:id==='dropbox'?cfg.callback:''});
         statusText.textContent=t('Configurazione salvata. Ora puoi collegare l’account.','Configuration saved. You can now connect your account.');
         void reload();
       }catch(error){
         statusText.textContent=t('Configurazione non valida: ','Invalid configuration: ')+String(error?.message||error).slice(0,160);
       }finally{save.disabled=false}
     });
     row.append(setup);
   }
   action.addEventListener('click',async()=>{
    if(!enabled){
      if(setup){setup.hidden=!setup.hidden;action.setAttribute('aria-expanded',String(!setup.hidden));if(!setup.hidden)setup.focus()}
      else feedback.textContent=t('OAuth non disponibile su questo dispositivo.','OAuth is not available on this device.');
      return;
    }
    if(busy)return;busy=true;action.disabled=true;
    try{
     if(connected){
      window.GlaukaCloudLibrary?.reset();
      await window.GlaukaCloudSync?.setEnabled(id,false);
      const disconnected=await bridge().disconnect(id);
      window.GlaukaCloudSync?.forgetAccount(id);
      feedback.textContent=disconnected.revoked
       ?t('Autorizzazione revocata e account scollegato.','Authorization revoked and account disconnected.')
       :t('Credenziali rimosse dal dispositivo. La revoca online non è stata confermata: controlla le autorizzazioni nel tuo account cloud.',
         'Credentials removed from device. Remote revocation was not confirmed; review connected apps in your cloud account.');
     }else{
      await bridge().start(id);
      feedback.textContent=t('Si è aperta la pagina ufficiale di '+names[id]+'. Completa l’accesso nel browser: Glauka rileverà il collegamento.',
       'The official '+names[id]+' sign-in page opened. Finish in your browser; Glauka will detect the connection.');
      stopAuthWatch();authWatch=setTimeout(()=>void watchAuthorization(id),2000);
     }
    }catch(_){
     feedback.textContent=t('Autorizzazione non riuscita. Controlla la configurazione OAuth.',
      'Authorization failed. Check OAuth configuration.');
    }finally{busy=false;action.disabled=false;if(connected)void reload()}
   });
  }
 }
 function hide(restoreFocus=true){stopAuthWatch();curtain.hidden=true;curtain.classList.remove('gl-cloud-docked');curtain.setAttribute('aria-modal','true');window.GlaukaCloudLibrary?.reset();if(restoreFocus)openerToRestore.focus();openerToRestore=opener}
 opener.addEventListener('click',()=>{curtain.hidden=false;void reload();close.focus()});
 close.addEventListener('click',hide);refresh.addEventListener('click',()=>void reload());
 curtain.addEventListener('click',e=>{if(e.target===curtain)hide()});
 curtain.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();hide()}
  if(e.key==='Tab'&&!curtain.classList.contains('gl-cloud-docked')){
   const active=[...curtain.querySelectorAll('button:not(:disabled):not([hidden]),input:not(:disabled):not([hidden]),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length>0);
   const current=active.indexOf(document.activeElement);
   if(e.shiftKey&&current===0){e.preventDefault();active[active.length-1]?.focus()}
   if(!e.shiftKey&&current===active.length-1){e.preventDefault();active[0]?.focus()}
  }
 });
 window.addEventListener?.('resize',()=>{if(!curtain.hidden)presentCloud()});
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&!curtain.hidden)void reload()
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
})();
