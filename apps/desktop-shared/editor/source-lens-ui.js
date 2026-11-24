/* 6.17 Source Lens, using the existing knowledge panel and real node IDs.
 * PDF bytes are held only in this UI session (Blob URL), never in projects.
 * The built-in PDF viewer cannot expose its selection to NeuroMap: paste an
 * excerpt explicitly, choose a page, and confirm the reference.
 */
(function(root){
 'use strict';
 const Core=root.NeuroMapSourceCore;if(!Core)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const el=(tag,cls='',text='')=>{const node=document.createElement(tag);if(cls)node.className=cls;
  if(text)node.textContent=text;return node};
 const CSS=String.raw`
 #nm-knowledge-panel .nm-source-form{display:grid;gap:9px}
 #nm-knowledge-panel .nm-source-form label{display:grid;gap:4px;font:12px system-ui}
 #nm-knowledge-panel .nm-source-form input,#nm-knowledge-panel .nm-source-form select,
 #nm-knowledge-panel .nm-source-form textarea{width:100%;min-width:0;box-sizing:border-box;
  padding:7px;border-radius:8px;border:1px solid #64748b;background:#14263e;color:#f8fafc}
 #nm-knowledge-panel .nm-source-form textarea{resize:vertical;min-height:65px}
 #nm-knowledge-panel .nm-source-form .nm-source-actions{display:flex;gap:8px;flex-wrap:wrap}
 #nm-knowledge-panel .nm-source-card{border:1px solid #657a99;padding:9px;margin:8px 0;
  border-radius:10px;overflow-wrap:anywhere;display:grid;gap:5px}
 #nm-knowledge-panel .nm-source-card small{opacity:.85}
 #nm-knowledge-panel .nm-source-card button{width:max-content;max-width:100%}
 #nm-knowledge-panel .nm-source-pdf{width:100%;min-height:240px;border:1px solid #64748b;
  border-radius:9px;background:#e2e8f0}
 #nm-knowledge-panel .nm-source-note{font-size:12px;line-height:1.45;opacity:.82}
 #nm-knowledge-panel .nm-source-error{font-size:12px;color:#ffb4b4}
 #nm-knowledge-panel .nm-source-form :focus-visible{outline:2px solid #6ee7b7;outline-offset:2px}
 #nm-knowledge-panel .nm-source-help,#nm-knowledge-panel .nm-source-add{border:1px solid #657a99;border-radius:10px;padding:8px}
 #nm-knowledge-panel .nm-source-help summary,#nm-knowledge-panel .nm-source-add summary{cursor:pointer;font-weight:650}
 #nm-knowledge-panel .nm-source-viewer{display:grid;gap:8px;border:1px solid #657a99;border-radius:12px;padding:8px;background:#fff;color:#132033}
 #nm-knowledge-panel .nm-source-viewer:focus{outline:2px solid #6ee7b7;outline-offset:2px}
 #nm-knowledge-panel .nm-source-viewer-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;position:sticky;top:0;z-index:2;background:#fff}
 #nm-knowledge-panel .nm-source-viewer-bar strong{flex:1 1 12rem;min-width:0;overflow-wrap:anywhere}
 #nm-knowledge-panel .nm-source-viewer-bar button{flex:0 0 auto}
 #nm-knowledge-panel .nm-source-zoom{display:flex;gap:4px;flex:0 0 auto}
 #nm-knowledge-panel .nm-source-stage{overflow:auto;max-height:min(62vh,520px)}
 #nm-knowledge-panel .nm-source-viewer canvas{display:block;width:auto;max-width:none;height:auto;background:#fff;border:1px solid #d5deea}
 #nm-knowledge-panel .nm-source-viewer button{width:max-content}
 .nm-source-chip{display:inline-flex;align-items:center;width:max-content;max-width:100%;
  border-radius:999px;padding:4px 10px;font:12px/1.3 system-ui;border:1px solid var(--nm-skin-stroke,#74869e);
  background:transparent;color:inherit;cursor:pointer}
 .nm-source-chip.is-missing{opacity:.8;cursor:default}
`;
 let currentFile=null,currentURL=null,currentDigest='',activePage=1,busy=false,fileOwnerTab=null,paintToken=0,citedView=null,lastApp=null;
 const verifiedFiles=new Map();
 const revoke=()=>{if(currentURL){URL.revokeObjectURL(currentURL);currentURL=null}};
 root.addEventListener?.('pagehide',revoke);
 function setFile(file){
  revoke();currentFile=file;currentDigest='';activePage=1;
  if(file)currentURL=URL.createObjectURL(file);
 }
 function mountCitedViewer(app,host,request){
  if(!citedView)return;
  const file=verifiedFiles.get(citedView.sha256);
  if(!file){citedView=null;return;}
  const slot=el('section','nm-source-viewer');
  slot.tabIndex=0;slot.setAttribute('role','region');
  slot.setAttribute('aria-label',tr('Pagina citata','Cited page'));
  const bar=el('div','nm-source-viewer-bar');
  const heading=el('strong','',(citedView.fileName||'')+' · '+tr('pagina ','page ')+citedView.page);
  const zoom=el('div','nm-source-zoom');
  const fit=el('button','',tr('Adatta','Fit'));fit.type='button';
  fit.title=tr('Adatta alla larghezza','Fit to width');fit.setAttribute('aria-label',fit.title);
  const zoomOut=el('button','','−');zoomOut.type='button';
  zoomOut.title=tr('Riduci','Zoom out');zoomOut.setAttribute('aria-label',zoomOut.title);
  const zoomIn=el('button','','+');zoomIn.type='button';
  zoomIn.title=tr('Ingrandisci','Zoom in');zoomIn.setAttribute('aria-label',zoomIn.title);
  const setZoom=(next,fitted)=>{citedView={...citedView,fit:fitted,zoom:next};request()};
  fit.addEventListener('click',()=>setZoom(1,true));
  zoomOut.addEventListener('click',()=>setZoom(Math.max(0.5,Math.round(((citedView.zoom||1)/1.25)*100)/100),false));
  zoomIn.addEventListener('click',()=>setZoom(Math.min(3,Math.round(((citedView.zoom||1)*1.25)*100)/100),false));
  zoom.append(fit,zoomOut,zoomIn);
  const close=el('button','',tr('Chiudi','Close'));close.type='button';
  close.addEventListener('click',()=>{citedView=null;request()});
  bar.append(heading,zoom,close);
  const stage=el('div','nm-source-stage');
  slot.append(bar,stage);host.append(slot);
  slot.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();citedView=null;request();return;}
   if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
   event.preventDefault();event.stopPropagation();
   const delta=event.key==='ArrowRight'?1:-1;
   const next=citedView.page+delta;
   const last=citedView.pages||citedView.page;
   if(next<1||next>last)return;
   citedView={...citedView,page:next};request();
  });
  const token=++paintToken;
  void root.NeuroMapPdfJs.withDocument(file,async(doc)=>{
   if(token!==paintToken||!slot.isConnected)return;
   if(!Number.isInteger(citedView.page)||citedView.page<1||citedView.page>doc.numPages)
    throw Error(tr('La pagina citata non è in questo documento.','The cited page is not in this document.'));
   citedView.pages=doc.numPages;
   heading.textContent=(citedView.fileName||'')+' · '+tr('pagina ','page ')+citedView.page+' / '+doc.numPages;
   const pdfPage=await doc.getPage(citedView.page);
   try{
    const natural=pdfPage.getViewport({scale:1});
    const width=Math.max(240,Math.min(640,(slot.clientWidth||360)-16));
    const fitScale=width/Math.max(1,natural.width);
    const zoom=citedView.fit===false?Math.max(0.5,Math.min(3,Number(citedView.zoom)||1)):1;
    const fitted=pdfPage.getViewport({scale:fitScale*zoom});
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(fitted.width);canvas.height=Math.ceil(fitted.height);
    canvas.style.width=canvas.width+'px';canvas.style.height=canvas.height+'px';
    const task=pdfPage.render({canvasContext:canvas.getContext('2d'),viewport:fitted});
    await (task.promise||task);
    if(token!==paintToken||!slot.isConnected)return;
    stage.replaceChildren(canvas);
    slot.focus({preventScroll:true});
    const scrollBox=slot.closest('.nm-kn-scroll');
    if(scrollBox){
     const delta=slot.getBoundingClientRect().top-scrollBox.getBoundingClientRect().top;
     scrollBox.scrollTop+=delta;
    }
   }finally{pdfPage.cleanup?.()}
  }).catch(error=>{
   if(token===paintToken)app.showToast(String(error.message||error),'FILE');
  });
 }
 function verifiedKey(sha){
  const key=String(sha||'').toLowerCase();
  if(verifiedFiles.has(key))return key;
  for(const existing of verifiedFiles.keys())if(String(existing).toLowerCase()===key)return existing;
  return '';
 }
 function hasVerified(sha){return !!verifiedKey(sha)}
 function openCited(ref){
  const key=verifiedKey(ref?.sha256);
  if(!key||!root.NeuroMapPdfJs?.withDocument)return false;
  citedView={sha256:key,page:Number(ref.page)||1,fileName:ref.fileName||ref.title||'',pages:0};
  if(lastApp?._nmKnowledge?.open)lastApp._nmKnowledge.open('sources');
  return true;
 }
 function chip(parent,source){
  installStyle();
  const button=el('button','nm-source-chip');button.type='button';
  const ready=source&&source.kind==='pdf'&&source.fileName&&source.page&&hasVerified(source.sha256);
  if(!ready){
   button.textContent=tr('Fonte non disponibile','Source unavailable');
   button.disabled=true;button.classList.add('is-missing');
  }else{
   const name=String(source.title||source.fileName).replace(/\.pdf$/i,'');
   button.textContent=name+' · Pag. '+source.page;
   button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openCited(source);});
  }
  parent.append(button);return button;
 }
 function draw({app,scroll,status,tools,request}){
  lastApp=app||lastApp;
  const ownerState=app.state,ownerTab=app.activeTabId;
  if(fileOwnerTab!==ownerTab){setFile(null);citedView=null;fileOwnerTab=ownerTab;}
  const node=ownerState?.findNode?.(ownerState.selectedNodeId);
  const live=()=>app.state===ownerState&&app.activeTabId===ownerTab&&
    app.tabs.some(t=>t.id===ownerTab&&t.state===ownerState)&&
    ownerState.findNode(node?.id)===node;
  const host=el('section','nm-source-form');
  if(!node){host.append(el('p','nm-source-note',tr('Seleziona prima un nodo.','Select a node first.')));scroll.replaceChildren(host);return;}
  const current=Core.normalizeAll(node.sourceRefs);
  const currentTitle=el('strong','',node.text||tr('Nodo','Node'));
  currentTitle.setAttribute('data-glauka-user-content','');host.append(currentTitle,el('small','',current.length+' / '+Core.MAX_REFS+' '+tr('fonti collegate','linked sources')));
  for(const item of current){
   const card=el('div','nm-source-card'),heading=el('strong','',item.title),meta=el('small','',
    item.kind.toUpperCase()+(item.kind==='pdf'?' · '+item.fileName+
    (item.page?' · p. '+item.page:''):'')+(item.kind==='web'?' · '+item.url:''));
   heading.setAttribute('data-glauka-user-content','');meta.setAttribute('data-glauka-user-content','');card.append(heading,meta);
   if(item.quote){const quote=el('p','',item.quote);quote.setAttribute('data-glauka-user-content','');card.append(quote)}
   if(item.kind==='pdf'){
    const verified=verifiedFiles.get(item.sha256)||null;
    const availability=el('p','nm-source-availability',verified
     ? tr('File verificato (SHA-256).','File checked (SHA-256).')
     : tr('Fonte non accessibile. La citazione resta sul nodo.','Source unavailable. The citation stays on the node.'));
    card.append(availability);
    const choose=el('button','',tr('Scegli il documento originale','Choose the original document'));
    choose.type='button';
    choose.addEventListener('click',()=>{
     const picker=el('input');picker.type='file';picker.accept='.pdf,application/pdf';
     picker.addEventListener('change',async()=>{
      const file=picker.files?.[0];if(!file)return;
      const before=JSON.stringify(node.sourceRefs);
      try{
       const digest=await Core.fingerprint(file);
       if(!Core.sameDocument(item,digest))throw Error(tr(
        'Il documento scelto non corrisponde alla citazione. Il riferimento originale resta com’è.',
        'The chosen document does not match the citation. The original reference is unchanged.'));
       if(!live()||JSON.stringify(node.sourceRefs)!==before)return;
       verifiedFiles.set(digest,file);
       setFile(file);fileOwnerTab=ownerTab;currentDigest=digest;activePage=item.page||1;
       app.showToast(tr('File verificato (SHA-256). La citazione non è stata riscritta.','File checked (SHA-256). The citation was not rewritten.'),'FILE');
       if(live())request();
      }catch(error){app.showToast(String(error.message||error),'SOURCE');}
     });
     picker.click();
    });card.append(choose);
    if(verified){
     const read=el('button','',tr('Apri pagina ','Open page ')+item.page);
     read.type='button';read.id='nm-source-open';
     read.addEventListener('click',()=>{
      if(!root.NeuroMapPdfJs?.withDocument){
       app.showToast(tr('Il lettore PDF non è disponibile. La pagina non viene aperta.','The PDF reader is unavailable. The page was not opened.'),'FILE');
       return;
      }
      citedView={sha256:item.sha256,page:item.page,fileName:item.fileName||item.title,pages:0};
      request();
     });card.append(read);
    }
   }else if(item.kind==='web'){
    const open=el('button','',tr('Apri fonte web','Open web source'));
    open.addEventListener('click',()=>{const url=Core.safeUrl(item.url);
     if(url)root.open(url,'_blank','noopener,noreferrer')});card.append(open);
   }
   const remove=el('button','',tr('Rimuovi riferimento','Remove citation'));
   remove.addEventListener('click',()=>{
    if(!live())return;ownerState.pushHistory();
    if(Core.detach(node,item.id)){app.markChanged();request();}
   });card.append(remove);host.append(card);
  }
  mountCitedViewer(app,host,request);
  const help=el('details','nm-source-help');
  help.append(el('summary','',tr('Come funziona','How this works')),el('p','nm-source-note',tr(
   'Apri un PDF locale, copia un estratto e indica la pagina. Il PDF resta sul dispositivo: nella mappa salvo solo nome, pagina e impronta SHA-256. L’impronta non controlla il significato del testo.',
   'Open a local PDF, copy an excerpt and enter the page. The PDF stays on the device: the map stores only the name, page and SHA-256. The fingerprint does not check the meaning of the text.')));
  host.append(help);
  const add=el('details','nm-source-add');
  add.open=!current.length;
  add.append(el('summary','',tr('Aggiungi una fonte','Add a source')));
  const kindLabel=el('label','',tr('Tipo di fonte','Source type'));
  const kind=el('select');for(const [v,it,en]of [['pdf','PDF locale','Local PDF'],['web','Pagina web','Web page'],['text','Citazione testuale','Text excerpt']]){
   const option=el('option','',tr(it,en));option.value=v;kind.append(option);
  }kindLabel.append(kind);
  const nameLabel=el('label','',tr('Titolo della fonte','Source title')),name=el('input');
  name.maxLength=180;name.placeholder=tr('Titolo o riferimento','Title or reference');nameLabel.append(name);
  const pdfLabel=el('label','',tr('Scegli PDF (massimo 80 MB)','Choose PDF (max 80 MB)'));
  const pdf=el('input');pdf.type='file';pdf.accept='.pdf,application/pdf';pdfLabel.append(pdf);
  const urlLabel=el('label','',tr('URL https://','URL https://')),url=el('input');url.type='url';url.maxLength=2048;url.placeholder='https://...';urlLabel.append(url);
  const pageLabel=el('label','',tr('Pagina PDF','PDF page')),page=el('input');
  page.type='number';page.min='1';page.max='100000';page.value=String(activePage);pageLabel.append(page);
  const quoteLabel=el('label','',tr('Estratto (incolla il testo selezionato)','Excerpt (paste selected text)'));
  const quote=el('textarea');quote.maxLength=Core.MAX_QUOTE;quote.rows=3;
  quote.placeholder=tr('Copia dal PDF con Ctrl+C, poi incolla qui.','Copy text in the PDF using Ctrl+C, then paste here.');
  quoteLabel.append(quote);
  add.append(kindLabel,nameLabel,pdfLabel,urlLabel,pageLabel,quoteLabel);
  const preview=el('div');if(currentFile&&currentURL){
   const frame=el('iframe','nm-source-pdf');frame.title=tr('Anteprima PDF locale','Local PDF preview');
   frame.setAttribute('sandbox','allow-scripts');
   frame.src=currentURL+'#page='+Math.max(1,Number(activePage)||1);
   const fallback=el('small','nm-source-note',tr(
    'Se il visualizzatore incorporato non funziona, apri il PDF con il pulsante qui sotto. La selezione nel PDF non viene letta automaticamente.',
    'If the embedded viewer is unavailable, open the PDF below. PDF selections are not read automatically.'));
   const open=el('button','',tr('Apri PDF separatamente','Open PDF separately'));
   open.addEventListener('click',()=>root.open(currentURL+'#page='+activePage,'_blank','noopener,noreferrer'));
   preview.append(frame,fallback,open);
  }add.append(preview);
  const error=el('p','nm-source-error'),buttons=el('div','nm-source-actions');
  const apply=el('button','',tr('Collega fonte al nodo','Attach source to node')),createChild=el('button','',
   tr('Crea figlio dalla citazione','Create child from excerpt'));
  buttons.append(apply,createChild);add.append(buttons,error);host.append(add);
  const updateKind=()=>{
   pdfLabel.hidden=kind.value!=='pdf';pageLabel.hidden=kind.value!=='pdf';
   urlLabel.hidden=kind.value!=='web';
  };kind.addEventListener('change',updateKind);updateKind();
  pdf.addEventListener('change',()=>{
   const file=pdf.files?.[0];if(!file)return;
   if(!Core.isPDF(file)){setFile(null);error.textContent=tr('Seleziona un PDF valido di massimo 80 MB.','Select a valid PDF up to 80 MB.');return;}
   setFile(file);fileOwnerTab=ownerTab;error.textContent='';name.value=name.value||file.name;
   // Do not rebuild the form: it would erase the user's pending quote.
   preview.replaceChildren();const frame=el('iframe','nm-source-pdf');
   frame.title='PDF';frame.setAttribute('sandbox','allow-scripts');frame.src=currentURL+'#page=1';preview.append(frame);
   const fallback=el('small','nm-source-note',tr(
    'Se il PDF non appare qui, usa il visualizzatore separato. Copia l’estratto con Ctrl+C e incollalo nel campo Citazione.',
    'If the PDF does not render, use the separate viewer. Copy the excerpt and paste it into the Quote field.'));
   const open=el('button','',tr('Apri PDF separatamente','Open PDF separately'));
   open.addEventListener('click',()=>root.open(currentURL+'#page='+activePage,'_blank','noopener,noreferrer'));
   preview.append(fallback,open);
  });
  page.addEventListener('change',()=>{activePage=Math.max(1,Math.min(100000,Number(page.value)||1));
   const frame=preview.querySelector('iframe');if(frame&&currentURL)frame.src=currentURL+'#page='+activePage});
  async function attach(makeChild=false){
   if(busy)return;busy=true;apply.disabled=true;createChild.disabled=true;
   try{
    if(!live())throw Error(tr('La scheda o il nodo è cambiato. Riprova.','The tab or node changed. Try again.'));
    const k=kind.value,excerpt=quote.value.trim(),title=name.value.trim();
    let candidate={id:Core.newId(),kind:k,title,quote:excerpt,createdAt:new Date().toISOString()};
    if(k==='pdf'){
     if(!currentFile||!Core.isPDF(currentFile))throw Error(tr('Seleziona prima un PDF.','Choose a PDF first.'));
     if(!excerpt)throw Error(tr('Incolla un estratto del PDF.','Paste a PDF excerpt.'));
     const verifyFile=currentFile;
     const digest=currentDigest||await Core.fingerprint(verifyFile);
     if(currentFile!==verifyFile||fileOwnerTab!==ownerTab||!live())throw Error(tr('La fonte è cambiata durante la verifica.','Source changed while verifying.'));
     currentDigest=digest;
     candidate={...candidate,fileName:currentFile.name,sha256:digest,page:Number(page.value)};
    }else if(k==='web'){
     candidate={...candidate,url:url.value};
    }else if(!excerpt)throw Error(tr('Inserisci la citazione.','Enter a text excerpt.'));
    const source=Core.normalize(candidate);
    if(!source)throw Error(tr('Fonte non valida: controlla URL, pagina e testo.','Invalid source: check URL, page and text.'));
    if(!live())throw Error(tr('La scheda è cambiata durante la verifica.','Tab changed while verifying source.'));
    if(makeChild){
     const child=ownerState.addChildNode(node.id,app.layout);
     if(!child)throw Error(tr('Impossibile aggiungere il ramo.','Unable to add child.'));
     child.text=(excerpt||source.title).slice(0,110);
     child.notes=excerpt;
     Core.attach(child,source);
     app.markChanged();app.selectNode(child.id);
    }else{
     if(Core.normalizeAll(node.sourceRefs).length>=Core.MAX_REFS)throw Error('Citation limit reached');
     ownerState.pushHistory();
     if(!Core.attach(node,source))throw Error(tr('Fonte duplicata o non valida.','Duplicate or invalid source.'));
     app.markChanged();
    }
    request();
   }catch(e){error.textContent=String(e.message||e);}
   finally{busy=false;apply.disabled=false;createChild.disabled=false;}
  }
  apply.addEventListener('click',()=>void attach(false));
  createChild.addEventListener('click',()=>void attach(true));
  scroll.replaceChildren(host);
  status.textContent=current.length+' '+tr('fonti · metadati salvati nel progetto; PDF originale locale',
   'sources · metadata saved in project; original PDF local');
 }
 function installStyle(){
  if(document.getElementById('nm-source-lens-css'))return;
  const sheet=el('style');sheet.id='nm-source-lens-css';sheet.textContent=CSS;document.head.append(sheet);
 }
 root.NeuroMapSourceUI=Object.freeze({draw:params=>{installStyle();draw(params)},hasVerified,openCited,chip});
})(globalThis);
