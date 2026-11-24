/* ================= NeuroMap 6.11: scoped audit, keyboard traversal, timed saves & safe large imports ================= */
const NM611 = {
  maxNodesPerAudit: 55,
  maxAuditBatches: 28,
  largeNodes: 130,
  largeCharacters: 12000,
  optionsKey: 'neuromap.desktop.autosave.v611',
  safeText: value => String(value == null ? '' : value).slice(0,2000),
  count(node) {
    if(!node||typeof node!=='object')return 0;
    const pending=[node],seen=new WeakSet();let count=0;
    while(pending.length){
      const current=pending.pop();
      if(!current||typeof current!=='object')continue;
      if(seen.has(current))throw Error('Struttura della mappa circolare o condivisa: importazione annullata.');
      seen.add(current);count++;
      for(const child of current.children||[])pending.push(child);
    }
    return count;
  },
  flatten(root, includePath=true) {
    const out=[],pending=[{node:root,depth:0,path:[]}],seen=new WeakSet();
    while(pending.length){
      const {node,depth,path}=pending.pop();
      if(!node||typeof node!=='object')continue;
      if(seen.has(node))throw Error('Struttura della mappa circolare o condivisa: analisi annullata.');
      seen.add(node);
      const currentPath=includePath?path.concat(node.text):undefined;
      out.push({node,depth,path:currentPath});
      const children=Array.isArray(node.children)?node.children:[];
      for(let i=children.length-1;i>=0;i--)pending.push({node:children[i],depth:depth+1,path:currentPath});
    }
    return out;
  },
  preferences(){try {const raw=JSON.parse(localStorage.getItem(this.optionsKey)||'{}');return {minutes:[0,1,3,5,10,15,30].includes(raw.minutes)?raw.minutes:0};}catch{return {minutes:0};}},
  boundedText(text) { return String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim(); },
  parseAuditResponse(text){
    const clean=this.boundedText(text);
    let obj;
    try{obj=JSON.parse(clean)}catch{
      const a=clean.indexOf('{'),b=clean.lastIndexOf('}');
      if(a>=0 && b>a)try{obj=JSON.parse(clean.slice(a,b+1));}catch{}
    }
    if(!obj||typeof obj!=='object')return {issues:[],note:'Risposta AI non strutturata. Non sono state generate modifiche automatiche.',raw:clean.slice(0,1800)};
    const input=Array.isArray(obj.issues)?obj.issues:[];
    return {issues:input.slice(0,24).filter(i=>i&&typeof i==='object').map(i=>({
      nodeId:String(i.nodeId||'').slice(0,100),
      observedText:String(i.observedText||'').slice(0,500),
      kind:String(i.kind||'chiarezza').slice(0,65),
      explanation:String(i.explanation||'').slice(0,600),
      proposedText:typeof i.proposedText==='string'?i.proposedText.trim().slice(0,500):'',
      confidence:['alta','media','bassa'].includes(String(i.confidence).toLowerCase())?String(i.confidence).toLowerCase():'bassa'
    })),note:String(obj.note||'').slice(0,600),raw:''};
  },
  groupSources(app,scope){
    const tab=app.tabs.find(t=>t.id===app.activeTabId);
    const chosen=app.state.findNode(app.state.selectedNodeId)||app.state.root;
    if(scope==='node')return [{tab,node:chosen,onlyNode:true}];
    if(scope==='subtree')return [{tab,node:chosen}];
    if(scope==='tabs')return app.tabs.map(t=>({tab:t,node:t.state.root}));
    return [{tab,node:app.state.root}];
  },
  buildBatches(app,scope){
    const sources=this.groupSources(app,scope),parts=[];
    let nodesInScope=0;
    for(const source of sources){
      const nodes=source.onlyNode?[{node:source.node,depth:0,path:[source.node.text]}]:this.flatten(source.node,false);
      nodesInScope+=nodes.length;
      let current=[];
      for(const entry of nodes){
        current.push({id:entry.node.id,text:String(entry.node.text||'').slice(0,300),depth:entry.depth});
        if(current.length===this.maxNodesPerAudit){parts.push({tabId:source.tab.id,tabName:source.tab.title,rows:current});current=[];}
      }
      if(current.length)parts.push({tabId:source.tab.id,tabName:source.tab.title,rows:current});
    }
    return {parts,nodesInScope,scannedNodes:parts.slice(0,this.maxAuditBatches).reduce((s,x)=>s+x.rows.length,0)};
  },
  // Split on first-level chapter boundaries. Preserve order, hierarchy, and labels.
  splitLargeMap(root,capacity=135){
    capacity=Math.max(45,Math.max(capacity,Math.ceil(this.count(root)/18)));
    const chapters=[];let bucket=[],size=0;
    const append=()=>{if(bucket.length){chapters.push({text:root.text+' · '+(chapters.length+1),children:bucket});bucket=[];size=0;}};
    const groups=(parent)=>{
      // Copy the necessary ancestry into successive maps. Within each map,
      // the original parent-child relationships and sibling order are intact.
      if(this.count(parent)<=capacity || !(parent.children||[]).length)return [parent];
      const result=[];let pending=[],used=1;
      const flush=()=>{if(pending.length){result.push({...parent,children:pending});pending=[];used=1;}};
      for(const c of parent.children){
        const childSize=this.count(c);
        if(childSize>capacity && (c.children||[]).length){
          flush();for(const part of groups(c))result.push({...parent,children:[part]});
        }else{
          if(pending.length && used+childSize>capacity)flush();
          pending.push(c);used+=childSize;
        }
      }
      flush();return result;
    };
    for(const child of root.children||[]){
      const total=this.count(child);
      if(total>capacity && (child.children||[]).length){
        append();for(const part of groups(child)){chapters.push({text:root.text+' · '+(chapters.length+1),children:[part]});}
      }else{
        if(bucket.length && size+total>capacity)append();
        bucket.push(child);size+=total;
      }
    }
    append();return chapters;
  }
};

// Select spatially adjacent visible nodes. Vertical movement can cross parents/branches.
NeuroMapApp.prototype.nm611MoveSelection = function(key){
  this.closeEditor?.(true);
  const all=this.state.getAllNodes().filter(n=>this.layout.getLayout(n.id)&&n.id!==this.state.root.id);
  if(!all.length)return false;
  const current=this.state.findNode(this.state.selectedNodeId)||this.state.root;
  const here=this.layout.getLayout(current.id)||{x:0,y:0};
  const candidates=all.map(n=>({node:n,pos:this.layout.getLayout(n.id)})).filter(v=>v.node.id!==current.id);
  const dir=key==='ArrowUp'?'up':key==='ArrowDown'?'down':key==='ArrowLeft'?'left':'right';
  const score=v=>{
    const dx=v.pos.x-here.x,dy=v.pos.y-here.y;
    const primary=dir==='up'?-dy:dir==='down'?dy:dir==='left'?-dx:dx;
    if(primary<=1)return Infinity;
    const lateral=dir==='up'||dir==='down'?Math.abs(dx):Math.abs(dy);
    // Favor same visual column, but permit going to a different subtree.
    return Math.hypot(primary,lateral*1.5)+(lateral>420?lateral*.25:0);
  };
  candidates.sort((a,b)=>score(a)-score(b));
  const next=candidates.find(v=>Number.isFinite(score(v)));
  if(!next)return false;
  this.selectNode(next.node.id);
  const p=next.pos,cam=this.renderer.camera,sx=p.x*cam.zoom+cam.x,sy=p.y*cam.zoom+cam.y;
  if(sx<100||sx>innerWidth-100||sy<180||sy>innerHeight-100)this.teleportToNode(next.node.id);
  return true;
};

NeuroMapApp.prototype.nm611OpenAutosave = function(){
  const panel=document.getElementById('nm611-autosave-overlay');
  const select=document.getElementById('nm611-autosave-period');select.value=String(NM611.preferences().minutes);
  panel.classList.remove('hidden');
  document.getElementById('nm611-autosave-status').textContent='Il recupero del workspace continua automaticamente. Questo timer salva il file originale soltanto se è già associato a un percorso.';
};
NeuroMapApp.prototype.nm611ConfigureAutosave = function(minutes){
  if(![0,1,3,5,10,15,30].includes(minutes))return;
  localStorage.setItem(NM611.optionsKey,JSON.stringify({minutes}));
  this.nm611StartAutosave();
  document.getElementById('nm611-autosave-status').textContent=minutes?'Salvataggio periodico impostato ogni '+minutes+' min. I file non ancora salvati sono esclusi.':'Salvataggio periodico disattivato; il backup per il recupero rimane attivo.';
  this.showToast(minutes?'Auto-salvataggio file ogni '+minutes+' minuti':'Auto-salvataggio periodico disattivato','BACKUP');
};
NeuroMapApp.prototype.nm611StartAutosave=function(){
  clearInterval(this._nm611PeriodicTimer);
  const minutes=NM611.preferences().minutes;
  if(!minutes)return;
  this._nm611PeriodicTimer=setInterval(async()=>{
    if(this._nm611AutoSaving || !window.neuromapDesktop)return;
    const tab=this.tabs.find(t=>t.id===this.activeTabId);
    if(!tab?.filePath || !tab.state?.isDirty)return;
    this._nm611AutoSaving=true;
    try{await this.io.saveProjectFile(false);}finally{this._nm611AutoSaving=false;}
  },minutes*60000);
};

NeuroMapApp.prototype.nm611AuditOpen = function(){
  this.closeEditor?.(true);this.hideMenus?.();
  const overlay=document.getElementById('nm611-audit-overlay');
  overlay.classList.remove('hidden');
  this._nm611AuditCancel=false;this._nm611AuditIssues=[];
  document.getElementById('nm611-audit-results').replaceChildren();
  document.getElementById('nm611-audit-status').textContent='Scegli quali nodi esaminare. I risultati non costituiscono una verifica scientifica certificata.';
  this.nm611AuditRefresh();
};
NeuroMapApp.prototype.nm611AuditRefresh=function(){
  const scope=document.getElementById('nm611-audit-scope').value;
  const coverage=NM611.buildBatches(this,scope);
  document.getElementById('nm611-audit-about').textContent=`Ambito: ${scope==='node'?'solo nodo selezionato':scope==='subtree'?'nodo e discendenti':scope==='tabs'?'tutte le schede aperte':'intera scheda attiva'} · ${coverage.nodesInScope} nodi · ${coverage.parts.length} gruppi AI. `+(coverage.parts.length>NM611.maxAuditBatches?'Oltre il limite operativo: la verifica risulterà PARZIALE.':'Nessuna modifica senza approvazione.');
};
NeuroMapApp.prototype.nm611AuditRun=async function(){
  if(this._nm611AuditBusy||this._aiBusy||this._v5GenRunning)return;
  const scope=document.getElementById('nm611-audit-scope').value;
  const coverage=NM611.buildBatches(this,scope);
  const batches=coverage.parts.slice(0,NM611.maxAuditBatches);
  if(coverage.parts.length>5){
    const answer=await this.nmAsk({title:'Verifica approfondita della mappa?',message:`Saranno inviate all’AI ${batches.length} parti con ${coverage.scannedNodes} nodi su ${coverage.nodesInScope}. Ogni parte comporta una chiamata e può consumare token. Continuare?`,choices:[{value:'cancel',text:'Annulla'},{value:'yes',text:'Procedi',primary:true}]});
    if(answer!=='yes')return;
  }
  if(this._nm611AuditBusy||this._aiBusy||this._v5GenRunning)return; // Recheck after the async confirmation.
  const status=document.getElementById('nm611-audit-status'),start=document.getElementById('nm611-audit-run');
  const result=document.getElementById('nm611-audit-results');result.replaceChildren();
  this._nm611AuditBusy=true;this._nm611AuditCancel=false;start.disabled=true;this.waitAI(true);
  const issues=[];let failures=0,reviewed=0;
  try{
    if(!this.aiClient){throw Error('Configura il provider AI in Impostazioni AI.');}
    for(const [index,batch] of batches.entries()){
      if(this._nm611AuditCancel)break;
      status.textContent=`Verifica gruppo ${index+1}/${batches.length} · ${reviewed}/${coverage.nodesInScope} nodi analizzati…`;
      const system='Sei un revisore didattico. Ricevi solo un frammento di mappa: valuta chiarezza, duplicati evidenti, termini ambigui e possibili inesattezze. Non affermare la correttezza medica senza fonti. Rispondi solo JSON valido con schema {"issues":[{"nodeId":"id", "observedText":"testo esatto","kind":"chiarezza","explanation":"motivo", "proposedText":"rinomina suggerita oppure stringa vuota", "confidence":"alta|media|bassa"}],"note":"sintesi"}. Massimo 5 problemi per gruppo. Non inventare nodeId. Se non puoi concludere, indica la verifica necessaria nella spiegazione.';
      const prompt=`Scheda: ${batch.tabName}. Frammento ${index+1}/${batches.length}. I livelli sono relativi al sotto-albero. Non correggere automaticamente la gerarchia.\n`+JSON.stringify(batch.rows);
      try{
        const answer=await this.aiClient.chat(system,prompt,{maxTokens:1700,timeout:75000});
        if(this._nm611AuditCancel)break;
        const parsed=NM611.parseAuditResponse(answer);
        if(parsed.raw)failures++;
        const allowed=new Map(batch.rows.map(r=>[r.id,r.text]));
        for(const issue of parsed.issues){
          if(!allowed.has(issue.nodeId)||allowed.get(issue.nodeId)!==issue.observedText)continue;
          issues.push({...issue,tabId:batch.tabId,tabName:batch.tabName});
        }
      }catch(err){failures++;console.warn('Audit batch error',index,err);}
      reviewed+=batch.rows.length;
    }
    this._nm611AuditIssues=issues;
    const partial=reviewed<coverage.nodesInScope || failures>0 || this._nm611AuditCancel;
    status.textContent=`${partial?'VERIFICA PARZIALE':'Verifica completata'}: ${reviewed}/${coverage.nodesInScope} nodi inviati, ${issues.length} osservazioni, ${failures} gruppi senza risultato valido. I suggerimenti AI non equivalgono a una conferma scientifica.`;
    this.nm611AuditRender();
  }catch(err){status.textContent='Verifica non riuscita: '+err.message;}
  finally{this._nm611AuditBusy=false;this._nm611AuditCancel=false;start.disabled=false;this.waitAI(false);}
};
NeuroMapApp.prototype.nm611AuditRender=function(){
  const host=document.getElementById('nm611-audit-results');host.replaceChildren();
  const issues=this._nm611AuditIssues||[];
  if(!issues.length){const p=document.createElement('p');p.className='nm611-muted';p.textContent='Nessuna proposta modificabile emersa. Questo non dimostra che la mappa sia priva di errori.';host.append(p);return;}
  issues.forEach((issue,index)=>{
    const card=document.createElement('article');card.className='nm611-issue';
    const h=document.createElement('div');h.className='nm611-issue-top';h.textContent=`${issue.tabName} · ${issue.kind} · attendibilità ${issue.confidence}`;
    const name=document.createElement('h4');name.textContent=issue.observedText;
    const desc=document.createElement('p');desc.textContent=issue.explanation;
    card.append(h,name,desc);
    if(issue.proposedText && issue.proposedText!==issue.observedText){
      const preview=document.createElement('div');preview.className='nm611-change-preview';preview.textContent=`Proposta di rinomina: “${issue.proposedText}”`;
      const apply=document.createElement('button');apply.type='button';apply.className='v4-primary';apply.textContent='✓ Applica rinomina';
      apply.addEventListener('click',async()=>{
        const tab=this.tabs.find(t=>t.id===issue.tabId),node=tab?.state.findNode(issue.nodeId);
        if(!tab||!node||node.text!==issue.observedText){this.showToast('Il nodo è cambiato: riesegui la verifica','AI');return;}
        const sourceState=tab.state;
        const choice=await this.nmAsk({title:'Applicare questa proposta?',message:`Scheda: ${issue.tabName}\nPrima: ${issue.observedText}\nDopo: ${issue.proposedText}\n\nConferma soltanto se la modifica è corretta.`,choices:[{value:'cancel',text:'Annulla'},{value:'yes',text:'Applica',primary:true}]});
        if(choice!=='yes')return;
        if(this.tabs.find(t=>t.id===tab.id)!==tab||tab.state!==sourceState||tab.state.findNode(issue.nodeId)!==node||node.text!==issue.observedText){this.showToast('Il nodo è cambiato: riesegui la verifica','AI');return;}
        if(tab.id!==this.activeTabId)this.activateTab(tab.id);
        if(this.state.updateNodeText(issue.nodeId,issue.proposedText)){this.markChanged();this.renderTabBar();apply.disabled=true;apply.textContent='✓ Applicata · Ctrl+Z per annullare';}
      });
      card.append(preview,apply);
    }
    host.append(card);
  });
};
NeuroMapApp.prototype.nm611AuditClose=function(){if(this._nm611AuditBusy)this.aiClient.cancel();this._nm611AuditCancel=true;document.getElementById('nm611-audit-overlay').classList.add('hidden');};

NeuroMapApp.prototype.nm611LargeImportChoice=async function(root,label='testo'){
  const total=NM611.count(root);
  if(total<NM611.largeNodes && JSON.stringify(root).length<NM611.largeCharacters)return 'one';
  const chapters=NM611.splitLargeMap(root);
  if(chapters.length<2)return 'one';
  return this.nmAsk({title:'Documento molto grande',message:`“${label}” contiene ${total} nodi. Puoi importarlo in una sola mappa, oppure suddividerlo in ${chapters.length} schede nell’ordine originale. I capitoli e i loro sotto-rami resteranno uniti; le schede saranno ordinate come nel testo.`,choices:[{value:'cancel',text:'Annulla'},{value:'one',text:'Una sola mappa'},{value:'split',text:`${chapters.length} mappe ordinate`,primary:true}]});
};
NeuroMapApp.prototype.nm611ImportRoot=async function(root,options={}){
  const action=await this.nm611LargeImportChoice(root,options.label||'Documento');
  if(action==='cancel')return -1;
  if(action!=='split')return this.importHierarchy(root,{newTab:options.newTab!==false});
  const chunks=NM611.splitLargeMap(root);
  let count=0;
  for(const chunk of chunks){count+=this.importHierarchy(chunk,{newTab:true});await new Promise(resolve=>setTimeout(resolve,0));}
  this.showToast(`Creati ${chunks.length} capitoli in schede ordinate`,'IMPORT');
  return count;
};

// Patch Markdown/text import without changing XMind/JSON/OPML behavior.
const nm611OldImportFile=NeuroMapApp.prototype.importFile;
NeuroMapApp.prototype.importFile=async function(file,options={}){
  const ext=String(file.name||'').split('.').pop().toLowerCase();
  if(!['md','markdown','txt','text'].includes(ext))return nm611OldImportFile.call(this,file,options);
  if(file.size>100*1024*1024)throw Error('Documento oltre il limite di 100 MB');
  const parsed=this.parseTextHierarchy(await file.text(),ext);
  if(parsed.workspace)return this.nm611ImportDocuments(parsed.workspace.map(part=>part.root),{newTab:true,label:file.name});
  return this.nm611ImportRoot(parsed.root,{...options,label:file.name});
};

const nm611OldBindUI=NeuroMapApp.prototype.bindUI;
NeuroMapApp.prototype.bindUI=function(...args){
  const result=nm611OldBindUI.apply(this,args);
  document.getElementById('btn-ai-audit')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();this.nm611AuditOpen();},true);
  document.getElementById('nm611-audit-run')?.addEventListener('click',()=>this.nm611AuditRun());
  document.getElementById('nm611-audit-close')?.addEventListener('click',()=>this.nm611AuditClose());
  document.getElementById('nm611-audit-scope')?.addEventListener('change',()=>this.nm611AuditRefresh());
  document.getElementById('nm611-autosave-open')?.addEventListener('click',()=>{this.hideMenus?.();this.nm611OpenAutosave();});
  document.getElementById('nm611-autosave-close')?.addEventListener('click',()=>document.getElementById('nm611-autosave-overlay').classList.add('hidden'));
  document.getElementById('nm611-autosave-save')?.addEventListener('click',()=>this.nm611ConfigureAutosave(Number(document.getElementById('nm611-autosave-period').value)));
  // The paste dialog is ADDITIVE by default. Never forward the "current map"
  // action to importHierarchy({newTab:false}), which replaces the entire state.
  document.getElementById('btn-import-paste')?.addEventListener('click',()=>{
    const target=this.state.findNode(this.state.selectedNodeId)||this.state.root;
    const label=document.getElementById('nm-paste-target');
    if(label)label.textContent=target.text||'Mappa';
  });
  const nmPasteFormat=raw=>{
    const value=String(raw||'').trim();
    if(/^<\?xml\b|^<opml\b/i.test(value))return 'opml';
    if(/^[{\[]/.test(value)){try{JSON.parse(value);return 'json';}catch{/* keep plain text */}}
    const rows=value.split(/\r?\n/).filter(v=>v.trim());
    if(rows.some(v=>/^\s{0,3}#{1,6}\s+\S/.test(v))||
      /^\s*<!-- NeuroMap-Markdown-v1 -->/.test(value))return 'md';
    const listCount=rows.filter(v=>/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(v)).length;
    return listCount>=2&&listCount>=Math.ceil(rows.length/3)?'md':'txt';
  };
  const previewButton=document.getElementById('nm-paste-preview-button');
  const previewBox=document.getElementById('nm-paste-preview');
  const sourceBox=document.getElementById('paste-modal-textarea');
  // Never restore an obsolete clipboard draft from a previous app session.
  if(sourceBox)sourceBox.value='';
  if(previewBox){previewBox.hidden=true;previewBox.replaceChildren();}
  // The preview belongs to the CURRENT pasted text, never to a former modal
  // opening or an earlier app session. Assignment via Ctrl+V must also notify it.
  let glPreviewTimer=null;
  const clearPreview=()=>{
    clearTimeout(glPreviewTimer);glPreviewTimer=null;
    if(previewBox){previewBox.hidden=true;previewBox.replaceChildren();}
  };
  const updatePreview=()=>{
    clearPreview();
    if(sourceBox?.value.trim())glPreviewTimer=setTimeout(()=>{
      glPreviewTimer=null;previewButton?.click();
    },180);
  };
  sourceBox?.addEventListener('input',updatePreview);
  document.getElementById('btn-import-paste')?.addEventListener('click',()=>{
    // Opening the dialog always starts with fresh results. A still-present
    // draft is re-parsed, never displayed with another text's hierarchy.
    updatePreview();
  });
  const pasteModal=document.getElementById('paste-modal');
  if(pasteModal){
    // Clear even when closed by a successful import or AI workflow. The browser
    // does not get to revive a stale preview from a prior Glauka session.
    new MutationObserver(()=>{
      if(!pasteModal.classList.contains('hidden'))return;
      clearPreview();
      if(sourceBox)sourceBox.value='';
    }).observe(pasteModal,{attributes:true,attributeFilter:['class']});
  }
  previewButton?.addEventListener('click',()=>{
    if(!previewBox)return;
    previewBox.replaceChildren();
    const raw=sourceBox?.value||'';
    try{
      if(!raw.trim())throw Error('Incolla prima un testo.');
      const format=nmPasteFormat(raw),parsed=this.parseTextHierarchy(raw,format);
      const roots=parsed.workspace?parsed.workspace.map(item=>item.root):[parsed.root];
      let count=0,seen=0;
      const frag=document.createDocumentFragment();
      const header=document.createElement('strong');
      const list=document.createElement('div');list.className='nm-paste-preview-rows';
      const stack=roots.slice().reverse().map(node=>({node,depth:0}));
      while(stack.length){
        const {node,depth}=stack.pop();if(++count>50000)throw Error('Oltre 50.000 nodi.');
        if(seen<85){
          const row=document.createElement('div');row.className='nm-paste-preview-row';
          row.style.paddingLeft=(Math.min(depth,12)*14)+'px';
          row.textContent=(depth?'↳ ':'◈ ')+String(node.text??node.title??'');
          list.append(row);seen++;
        }
        for(const child of [...(node.children||[])].reverse())stack.push({node:child,depth:depth+1});
      }
      header.textContent=count+' nodi · '+({txt:'Testo indentato',md:'Markdown',json:'JSON',opml:'OPML'}[format]||format)+
        (count>85?' · primi 85 visualizzati':'');
      frag.append(header,list);previewBox.replaceChildren(frag);
    }catch(error){
      const p=document.createElement('p');p.textContent=String(error.message||error);
      p.className='nm-paste-preview-error';previewBox.append(p);
    }
    previewBox.hidden=false;
  });
  const pasteActions=[['btn-confirm-paste-current','branches'],
    ['btn-paste-literal','literal'],['btn-confirm-paste-newtab','newtab']];
  for(const [id,action] of pasteActions){
    document.getElementById(id)?.addEventListener('click',async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      const raw=document.getElementById('paste-modal-textarea')?.value||'';
      try{
        if(!raw.trim())throw Error('Incolla prima un testo.');
        if(action==='literal'){
          const label=raw.trim().split('\n').find(line=>line.trim())?.trim()||'Testo incollato';
          // A giant multi-line paragraph belongs in notes, not an unreadable
          // label. Its exact source is retained without producing new branches.
          const leaf=(raw.length>500||raw.includes('\n'))?
            {text:label.slice(0,160),notes:raw,children:[]}:
            {text:raw.trim(),children:[]};
          this.nm66AppendImportedForest([leaf],{forceChild:true});
          this.showToast('Testo aggiunto in un solo nodo, senza cambiare la mappa','INCOLLA');
        }else{
          const ext=nmPasteFormat(raw);
          const parsed=this.parseTextHierarchy(raw,ext);
          if(action==='branches'){
            const roots=parsed.workspace?parsed.workspace.map(item=>item.root):[parsed.root];
            const count=this.nm66AppendImportedForest(roots,{forceChild:true});
            this.showToast(count+' nodi aggiunti sotto il ramo selezionato · Ctrl+Z','INCOLLA');
          }else{
            const roots=parsed.workspace?parsed.workspace.map(item=>item.root):[parsed.root];
            const plan=await NM615.pasteWizard(this,roots);
            if(!plan)return;
            const count=NM615.commitPastedMaps(this,plan);
            this.showToast(count+' nodi in '+plan.pages.length+' nuove schede · disposizione '+plan.layout,'INCOLLA');
          }
        }
        document.getElementById('paste-modal').classList.add('hidden');
      }catch(err){this.showToast(String(err.message||err),'IMPORT');}
    },true);
  }
  this.nm611StartAutosave();
  return result;
};

// Install new tabular navigation at capture, only when not editing or in modals.
document.addEventListener('keydown',event=>{
  if(event.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio,#nm-knowledge-panel,#nm616-minimap-shell,#nm616-navigation,#nm616-context,#nm614-navigation-flyout'))return;
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.defaultPrevented)return;
  if(event.target?.closest?.('input,textarea,select,button,summary,a,[contenteditable="true"]'))return;
  if(['nm611-audit-overlay','nm611-autosave-overlay','flash-modal','nm67-notes-overlay','ai-settings-modal','paste-modal','nm615-import-modal','nm615-boundary-modal','nm-decision-overlay','nm6-plan-modal','nm54-illustration-modal'].some(id=>{
    const el=document.getElementById(id);return el && !el.classList.contains('hidden');
  }))return;
  const app=window.neuroMapApp;
  if(!app || !app.state.root)return;
  app.nm611MoveSelection(event.key);event.preventDefault();event.stopImmediatePropagation();
},true);
/* ================= end NeuroMap 6.11 ================= */


