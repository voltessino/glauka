  function drawOutline(){
   const total=rows.length,unit=36;
   let body=scroll.firstElementChild;
   if(!body || !body.classList.contains('nm-kn-virtual')){
    body=create('div','nm-kn-virtual');body.style.position='relative';scroll.replaceChildren(body);
   }
   body.style.height=(total*unit)+'px';
   const start=Math.max(0,Math.floor(scroll.scrollTop/unit)-6),
    stop=Math.min(total,start+Math.ceil((scroll.clientHeight||600)/unit)+14);
   const signature=JSON.stringify([start,stop,...rows.slice(start,stop).map(r=>[r.id,r.text,r.depth,r.collapsed,r.hasChildren])]);
   if(body._nmOutlineSignature===signature){for(const line of body.children){if(line.dataset.nodeId===app.state.selectedNodeId)line.dataset.active='true';else delete line.dataset.active;}return;}
   body._nmOutlineSignature=signature;
   const frag=document.createDocumentFragment();
   for(let i=start;i<stop;i++){
    const row=rows[i],line=create('div','nm-kn-row');line.style.top=(i*unit)+'px';
    line.style.paddingLeft=Math.min(row.depth,15)*12+'px';
    line.dataset.nodeId=row.id;
    if(row.id===app.state.selectedNodeId)line.dataset.active='true';
    const toggle=create('button','nm-kn-disclose',row.hasChildren?(row.collapsed?'▸':'▾'):'');
    toggle.type='button';toggle.disabled=!row.hasChildren;
    toggle.setAttribute('aria-label',tr('Espandi o comprimi','Expand or collapse'));
    toggle.addEventListener('click',e=>{e.stopPropagation();if(app.state.toggleCollapse(row.id))app.markChanged()});
    const label=create('button','nm-kn-text',row.text||tr('(senza titolo)','(untitled)'));
    label.type='button';label.title=row.text;label.addEventListener('click',()=>select(row.id));
    label.addEventListener('dblclick',e=>{e.preventDefault();beginEdit(row,label)});
    label.addEventListener('keydown',e=>{if(e.key==='F2'){e.preventDefault();beginEdit(row,label)}
     if(e.key==='Insert'){e.preventDefault();select(row.id);addChild()}});
    line.append(toggle,label);frag.append(line);
   }body.replaceChildren(frag);
  }
  scroll.addEventListener('scroll',()=>{if(mode==='outline'&&!editing)drawOutline()},{passive:true});
  function drawAtlas(){
   const doc=create('div','nm-kn-results');
   const A=root.NeuroMapAtlasLibrary;
   const active=app.state.selectedNodeId,sourceTab=A?.idFor(app.tabs.find(t=>t.id===app.activeTabId))||app.activeTabId;
   const edges=A?A.normalizeEdges(K,app._nmAtlasEdges||[],atlasIndex):K.normalizeEdges(app._nmAtlasEdges||[],atlasIndex);
   const links=K.backlinks(atlasIndex,edges,sourceTab,active);
   const summary=create('p','nm-kn-muted',tr('Ricerca offline nelle schede aperte e nei documenti salvati già indicizzati. Le mappe chiuse sono istantanee locali: scegli il file originale per riaprirle.','Offline search in open tabs and indexed saved documents. Closed maps are local snapshots: select the original file to reopen them.'));
   doc.append(summary);
   // Semantic types are selected by the user, not inferred from similar labels.
   const typePicker=create('select');typePicker.setAttribute('aria-label',tr('Tipo di collegamento','Link type'));
   const types=[['correlato','Correlato','Related'],['prerequisito','Prerequisito di','Prerequisite for'],['causa','Causa di','Causes'],['dipende','Dipende da','Depends on'],['contraddice','Contraddice','Contradicts'],['esempio','Esempio di','Example of']];
   for(const [value,it,en] of types){const option=create('option','',tr(it,en));option.value=value;typePicker.append(option)}
   typePicker.value=semanticKind;
   typePicker.addEventListener('change',()=>{semanticKind=typePicker.value});
   const typeRow=create('label','nm-kn-muted',tr('Relazione da creare: ','New relationship: '));typeRow.append(typePicker);doc.append(typeRow);
   const showHit=(item,kind)=>{
    const row=create('div','nm-kn-hit'),label=create('button','nm-kn-name',item.text||'(empty)');
    label.type='button';const info=create('small','',item.title+(item.archived?' · '+tr('chiuso','closed'):''));label.append(info);
    label.addEventListener('click',()=>void jump(item.tabId,item.nodeId));row.append(label);
    if(item.archived){
     const forget=create('button','',tr('Dimentica indice','Forget index'));
     forget.title=tr('Non elimina il file originale','Does not delete the original file');
     forget.addEventListener('click',async()=>{
       const decision=await app.nmAsk({title:'Atlas · '+tr('Dimenticare il documento?','Forget document?'),
        message:item.title+'\n'+tr('Eliminerò solo la copia indicizzata e i suoi link Atlas; il file originale resterà intatto.',
          'Only the indexed snapshot and its Atlas links are removed; the original file stays untouched.'),
        choices:[{value:'no',text:tr('Annulla','Cancel')},
          {value:'yes',text:tr('Dimentica','Forget'),danger:true}]});
       if(decision!=='yes')return;
       const A=root.NeuroMapAtlasLibrary;
       const old=(app._nmAtlasArchive||[]).find(x=>x.key===item.tabId);
       app._nmAtlasArchive=A.forget(app._nmAtlasArchive,item.tabId);
       app._nmAtlasEdges=(app._nmAtlasEdges||[]).filter(e=>![e.fromTab,e.toTab].some(id=>
         id===item.tabId||id===old?.tabId));
       app.scheduleSave();state.request();
     });row.append(forget);
    }
    if(kind==='result'&&(item.tabId!==sourceTab||item.nodeId!==active)){
     const way=create('button','',tr('Percorso','Path'));way.type='button';
     way.addEventListener('click',()=>{
      const route=K.route(atlasIndex,edges,sourceTab,active,item.tabId,item.nodeId);
      const message=route.length?route.slice(0,12).map(p=>atlasIndex.perTab.get(p.tabId)?.get(p.nodeId)?.text||p.nodeId).join(' → ')+(route.length>12?' …':''):
       tr('Non esiste un percorso tra questi nodi','No path exists between these nodes');
      const summary=create('p','nm-kn-muted',message);doc.prepend(summary);
     });
     row.append(way);
     const link=create('button','',tr('Collega','Link'));link.title=tr('Collega il nodo selezionato a questo risultato','Link selected node to this result');
     link.addEventListener('click',async()=>{
      const src=app.tabs.find(t=>(A?.idFor(t)||t.id)===sourceTab)?.state?.findNode(active);
      if(!src)return;
      const answer=await app.nmAsk({title:'Atlas · '+tr('Conferma collegamento','Confirm link'),
       message:(src.text||'')+' → '+item.text+' ('+item.title+') · '+semanticKind,
       choices:[{value:'no',text:tr('Annulla','Cancel')},{value:'yes',text:tr('Collega','Link'),primary:true}]});
      if(answer!=='yes')return;
      const existing=A?A.normalizeEdges(K,app._nmAtlasEdges||[],atlasIndex):K.normalizeEdges(app._nmAtlasEdges||[],atlasIndex);
      const e={fromTab:sourceTab,fromNode:active,toTab:item.tabId,toNode:item.nodeId,label:semanticKind};
      app._nmAtlasEdges=K.normalizeEdges([...existing,e],atlasIndex).slice(0,500);
      app.scheduleSave();state.request();
     });row.append(link);
    }
    doc.append(row);
   };
   if(links.length){
    doc.append(create('strong','',tr('Backlink e riferimenti','Backlinks and references')));
    for(const l of links.slice(0,30)){
     const other=l.toTab===sourceTab&&l.toNode===active?
      atlasIndex.perTab.get(l.fromTab)?.get(l.fromNode):atlasIndex.perTab.get(l.toTab)?.get(l.toNode);
     if(other){
      showHit(other,'backlink');
      if(l.label){const relation=create('small','',tr('Relazione: ','Relationship: ')+l.label);doc.lastElementChild.append(relation)}
      const line=doc.lastElementChild;
      const remove=create('button','',tr('Scollega','Unlink'));remove.type='button';
      remove.addEventListener('click',()=>{
       const all=A?A.normalizeEdges(K,app._nmAtlasEdges||[],atlasIndex):K.normalizeEdges(app._nmAtlasEdges||[],atlasIndex);
       const target=JSON.stringify([l.fromTab,l.fromNode,l.toTab,l.toNode]);
       app._nmAtlasEdges=all.filter(e=>JSON.stringify([e.fromTab,e.fromNode,e.toTab,e.toNode])!==target);
       app.scheduleSave();state.request();
      });line.append(remove);
     }
    }
   }
   if(activeFilter.trim()){
    atlasResults=K.search(atlasIndex,activeFilter,75);
    doc.append(create('strong','',tr('Risultati','Results')+' · '+atlasResults.length));
    for(const item of atlasResults)showHit(item,'result');
   } else {
    const suggestions=K.suggested(atlasIndex,35);
    doc.append(create('strong','',tr('Suggerimenti per etichetta identica (non AI)','Same-label suggestions (not AI)')+' · '+suggestions.length));
    for(const x of suggestions){showHit(x.to,'result')}
   }
   scroll.replaceChildren(doc);
   status.textContent=atlasIndex.records.length+' '+tr('nodi indicizzati','indexed nodes')+' · '+(atlasIndex.archivedDocuments||0)+' '+tr('documenti chiusi','closed documents')+' · '+edges.length+' '+tr('collegamenti','links')+(atlasIndex.limitReached?' · '+tr('limite raggiunto','limit reached'):'');
  }
  function drawDocument(){
   if(!D){scroll.replaceChildren(create('p','nm-kn-muted',tr('Editor documentale non disponibile.','Document editor unavailable.')));return}
   const owner=app.state,tab=app.activeTabId;
   let chapters;try{chapters=D.project(owner.root)}catch(error){
    scroll.replaceChildren(create('p','nm-kn-muted',String(error.message||error)));return;
   }
   if(!chapters.length){scroll.replaceChildren(create('p','nm-kn-muted',tr('Questa mappa non contiene ancora capitoli.','This map has no chapters yet.')));return}
   const panel=create('div','nm-kn-results');
   panel.append(create('p','nm-kn-muted',tr('Ogni capitolo è un nodo originale della mappa. Le modifiche non creano duplicati.',
    'Every chapter is an original map node. Edits never create duplicates.')));
   const current=chapters.find(c=>c.id===owner.selectedNodeId)||chapters[0];
   const chapterLabel=create('label','nm-kn-section-label',tr('Cerca e scegli un capitolo','Find and select a chapter'));
   const chapterSearch=create('input','nm-kn-query nm-kn-doc-search');
   chapterSearch.type='search';chapterSearch.id='nm-kn-document-search';
   chapterSearch.placeholder=tr('Cerca tra tutti i capitoli…','Search all chapters…');
   chapterSearch.setAttribute('aria-label',tr('Cerca capitoli','Search chapters'));
   chapterSearch.value=documentSearch;chapterLabel.htmlFor=chapterSearch.id;
   const chooser=create('div','nm-kn-chapters');
   chooser.setAttribute('aria-label',tr('Capitoli del documento','Document chapters'));
   const chapterCounter=create('span','nm-kn-doc-count');
   function showChapters(){
    const term=documentSearch.trim().toLocaleLowerCase();
    const matches=term?chapters.filter(c=>String(c.title||'').toLocaleLowerCase().includes(term)):chapters;
    const shown=matches.slice(0,10);
    // When no filter is active, always show the selected chapter even if it is deep in a long map.
    if(!term&&!shown.some(c=>c.id===current.id))shown.push(current);
    const nodes=[];
    for(const chapter of shown){
     const b=create('button','nm-kn-name nm-kn-chapter',chapter.title||tr('(senza titolo)','(untitled)'));
     b.type='button';b.title=chapter.title||'';
     b.setAttribute('aria-current',String(chapter.id===current.id));
     b.setAttribute('aria-pressed',String(chapter.id===current.id));
     b.style.paddingLeft=(11+Math.min(6,Math.max(0,Number(chapter.depth)||0))*9)+'px';
     b.addEventListener('click',()=>{if(editing)return;select(chapter.id)});
     nodes.push(b);
    }
    if(!nodes.length)nodes.push(create('p','nm-kn-muted',tr('Nessun capitolo trovato.','No matching chapters.')));
    chooser.replaceChildren(...nodes);
    chapterCounter.textContent=matches.length+' '+tr('capitoli trovati','chapters found')+
     (matches.length>shown.length?' · '+tr('mostrati i primi 10: affina la ricerca','first 10 shown: refine your search'):'');
   }
   chapterSearch.addEventListener('input',()=>{documentSearch=chapterSearch.value;showChapters()});
   showChapters();
   panel.append(chapterLabel,chapterSearch,chooser,chapterCounter);
   const titleLabel=create('label','nm-kn-section-label',tr('Titolo del capitolo','Chapter title'));
   const headingField=create('input','nm-kn-query');headingField.value=current.title;
   headingField.id='nm-kn-chapter-title';titleLabel.htmlFor=headingField.id;
   headingField.maxLength=10000;headingField.setAttribute('aria-label',tr('Titolo del capitolo','Chapter title'));
   const textLabel=create('label','nm-kn-section-label',tr('Testo / Markdown','Text / Markdown'));
   const notesField=create('textarea','nm-kn-query');notesField.value=current.notes;
   notesField.id='nm-kn-chapter-text';textLabel.htmlFor=notesField.id;
   notesField.rows=7;notesField.maxLength=50000;notesField.style.resize='vertical';
   notesField.style.minHeight='125px';notesField.setAttribute('aria-label',tr('Testo del capitolo','Chapter text'));
   const changed=()=>headingField.value!==current.title||notesField.value!==current.notes;
   const onInput=()=>{editing=changed()?headingField:null;};
   headingField.addEventListener('input',onInput);notesField.addEventListener('input',onInput);
   const actions=create('div','nm-kn-tools nm-kn-document-actions');
   const save=create('button','',tr('Salva capitolo','Save chapter'));
   const cancel=create('button','',tr('Annulla modifiche','Discard changes'));
   const exportButton=create('button','',tr('Esporta testo JSONL','Export JSONL text'));
   exportButton.title=tr('Esporta testo strutturato da copiare. Non sostituisce il backup .neuromap.',
    'Export structured text for copying. This does not replace a .neuromap backup.');
   const saveCurrent=()=>{
    if(!app.tabs.some(t=>t.state===owner&&t.id===tab)){
     status.textContent=tr('Scheda cambiata: annulla e riapri.','Tab changed: cancel and reopen.');return false;
    }
    try{
     const result=D.commit(owner,[{id:current.id,expectedTitle:current.title,
      expectedNotes:current.notes,title:headingField.value,notes:notesField.value}]);
     editing=null;draftActions=null;if(result.changed)notifyOwner(owner,tab);state.request();return true;
    }catch(error){status.textContent=String(error.message||error);return false}
   };
   const discard=()=>{editing=null;draftActions=null;state.request()};
   draftActions={tab,owner,changed,save:saveCurrent,discard};
   save.addEventListener('click',saveCurrent);
   cancel.addEventListener('click',discard);
   exportButton.addEventListener('click',()=>{
    if(changed()){status.textContent=tr('Salva o annulla prima di esportare.','Save or cancel before export.');return}
    try{
     const value=D.exportText(owner.root),out=create('textarea','nm-kn-query');
     out.readOnly=true;out.rows=10;out.value=value;out.setAttribute('aria-label','NeuroMap JSONL export');
     panel.append(out);out.focus();out.select();
     status.textContent=tr('Testo JSONL pronto per copiare. Non è un file .neuromap.',
      'JSONL text ready to copy. This is not a .neuromap file.');
    }catch(error){status.textContent=String(error.message||error)}
   });
   actions.append(save,cancel,exportButton);
   panel.append(titleLabel,headingField,textLabel,notesField,actions);
   scroll.replaceChildren(panel);
   status.textContent=chapters.length+' '+tr('capitoli sincronizzati · nessuna copia','synced chapters · no duplicate data');
  }

  function drawJourney(){
   const chapters=K.journey(app.state.root),tab=app.activeTabId;
   const saved=app._nmJourneyProgress||{};
   let n=Math.max(0,Math.min(chapters.length-1,Number(saved[tab])||0));
   const panel=create('div','nm-kn-results'),chapter=chapters[n];
   if(!chapter){scroll.replaceChildren(create('p','nm-kn-muted',tr('Mappa vuota','Empty map')));return}
   const lookup=new Map(chapters.map(c=>[c.id,c]));
   const parents=[];for(let p=chapter;p;p=lookup.get(p.parentId))parents.push(p.title);
   const nav=create('div','nm-kn-tools'),previous=create('button','','←'),next=create('button','','→');
   previous.disabled=n===0;next.disabled=n===chapters.length-1;
   const go=direction=>{n=Math.max(0,Math.min(chapters.length-1,n+direction));
    app._nmJourneyProgress={...saved,[tab]:n};app.scheduleSave();drawJourney()};
   previous.addEventListener('click',()=>go(-1));next.addEventListener('click',()=>go(1));
   nav.append(previous,create('strong','',(n+1)+' / '+chapters.length),next);
   panel.append(nav,create('p','nm-kn-muted nm-kn-authored',parents.reverse().join(' › ')),
    create('strong','nm-kn-authored',chapter.title),create('p','nm-kn-authored',chapter.notes||tr('Nessuna nota per questo concetto.','No notes for this concept.')));
   const show=create('button','',tr('Vai al nodo originale','Go to original node'));
   show.addEventListener('click',()=>jump(tab,chapter.id));panel.append(show);
   scroll.replaceChildren(panel);
   status.textContent=tr('Lettura offline · nessun nodo duplicato · avanzamento locale','Offline reading · no duplicated nodes · local progress');
  }
  function drawRadar(){
   const report=K.memoryRadar(app.state.root,app.studyCards||[],app.activeTabId);
   const panel=create('div','nm-kn-results');
   const headRow=create('div','nm-radar-head');
   headRow.append(create('strong','',tr('Evidenze dei ripassi reali','Observed review evidence')));
   if(radarStatusFilter!=='all'){
    const reset=create('button','',tr('Mostra tutti','Show all'));
    reset.type='button';reset.style.minHeight='26px';reset.style.padding='2px 8px';reset.style.fontSize='11px';
    reset.addEventListener('click',()=>{radarStatusFilter='all';drawRadar()});
    headRow.append(reset);
   }
   panel.append(headRow);
   const totals=report.totals;
   const kpiGrid=create('div','nm-radar-kpi-grid');
   const buckets=[
    ['due',totals.due,tr('Da ripassare','Due')],
    ['scheduled',totals.scheduled,tr('Programmati','Scheduled')],
    ['reviewed',totals.reviewed,tr('Ripassati','Reviewed')],
    ['unreviewed',totals.unreviewed,tr('Senza dati','No data')]
   ];
   for(const [tone,count,labelText] of buckets){
    const tile=create('button','nm-radar-kpi');
    tile.type='button';tile.dataset.tone=tone;
    tile.dataset.active=String(radarStatusFilter===tone);
    tile.setAttribute('aria-pressed',String(radarStatusFilter===tone));
    const num=create('strong','',String(count));
    const lbl=create('span','',labelText);
    tile.append(num,lbl);
    tile.addEventListener('click',()=>{radarStatusFilter=radarStatusFilter===tone?'all':tone;drawRadar()});
    kpiGrid.append(tile);
   }
   panel.append(kpiGrid);

   const strip=create('div','nm-radar-strip');
   const quizCount=(app.learningAttempts||[]).filter(a=>a&&a.tabId===app.activeTabId).length;
   const hasReviews=(totals.due+totals.scheduled+totals.reviewed)>0;
   const stripCopy=create('div','nm-radar-strip-copy');
   stripCopy.append(
    create('strong','',tr('Collegato a Studio (pannello destro)','Connected to Studio (right panel)')),
    create('small','',!hasReviews&&!quizCount
     ?tr('Non ci sono ancora ripassi registrati. Crea flashcard o fai un quiz: le scadenze compaiono qui.','No reviews have been recorded yet. Create flashcards or take a quiz: schedules appear here.')
     :quizCount
      ?tr(`${quizCount} risposte quiz/immagini registrate`,`${quizCount} quiz/image answers recorded`)
      :tr('Le flashcard e i quiz alimentano questo calendario automatico.','Flashcards and quizzes feed this automatic schedule.'))
   );
   const stripBtns=create('div','nm-radar-strip-actions');
   const toStudio=create('button','nm-kn-bridge-primary',tr('Apri Studio · Da ripassare','Open Study · Review mistakes'));
   toStudio.type='button';
   toStudio.addEventListener('click',()=>{closePanel();app._nmLearning?.open?.('radar')});
   const openCards=create('button','',tr('Apri le flashcard','Open flashcards'));
   openCards.type='button';openCards.addEventListener('click',()=>{closePanel();document.getElementById('btn-flashcards')?.click()});
   stripBtns.append(toStudio,openCards);
   strip.append(stripCopy,stripBtns);
   panel.append(strip);

   const rank={due:0,scheduled:1,reviewed:2,unreviewed:3};
   const term=activeFilter.trim().toLocaleLowerCase();
   const filtered=report.nodes
    .filter(n=>(radarStatusFilter==='all'||n.status===radarStatusFilter)&&(!term||String(n.text).toLocaleLowerCase().includes(term)))
    .sort((a,b)=>rank[a.status]-rank[b.status]||b.lapses-a.lapses||(a.dueAt||Infinity)-(b.dueAt||Infinity))
    .slice(0,120);

   const list=create('div','nm-radar-list');
   const langLocale=document.documentElement.lang==='en'?'en-GB':'it-IT';
   const formatDue=dueAt=>{
    if(!dueAt)return '';
    const diffMs=dueAt-Date.now();
    if(diffMs<=0)return tr('scaduto ora','due now');
    const hours=Math.round(diffMs/3600000);
    if(hours<24)return tr(`tra ${Math.max(1,hours)}h`,`in ${Math.max(1,hours)}h`);
    const days=Math.round(diffMs/86400000);
    if(days<=14)return tr(`tra ${days}g`,`in ${days}d`);
    return new Date(dueAt).toLocaleDateString(langLocale,{day:'2-digit',month:'short'});
   };
   const statusNames={
    due:tr('Da ripassare','Due'),
    scheduled:tr('In programma','Scheduled'),
    reviewed:tr('Ripassato','Reviewed'),
    unreviewed:tr('Senza dati','No data')
   };
   if(!filtered.length){
    list.append(create('p','nm-kn-muted',tr('Nessun concetto corrisponde al filtro selezionato.','No concepts match the active filter.')));
   }
   for(const n of filtered){
    const item=create('button','nm-radar-card');
    item.type='button';item.dataset.status=n.status;
    const main=create('div','nm-radar-card-main'),dot=create('span','nm-radar-dot'),txt=create('div','nm-radar-card-text');
    dot.setAttribute('aria-hidden','true');
    const titleEl=create('strong','',n.text||tr('(senza titolo)','(untitled)'));
    const parts=[];
    if(n.reviews>0)parts.push(n.reviews+' '+tr(n.reviews===1?'ripasso':'ripassi',n.reviews===1?'review':'reviews'));
    if(n.lapses>0)parts.push(n.lapses+' '+tr(n.lapses===1?'errore':'errori',n.lapses===1?'lapse':'lapses'));
    if(n.dueAt)parts.push(formatDue(n.dueAt));
    if(!parts.length)parts.push(tr('Nessuna flashcard collegata','No linked flashcards yet'));
    txt.append(titleEl,create('small','',parts.join(' · ')));
    main.append(dot,txt);
    const badge=create('span','nm-radar-badge',statusNames[n.status]||n.status);
    item.append(main,badge);
    item.addEventListener('click',()=>jump(app.activeTabId,n.nodeId));
    list.append(item);
   }
   panel.append(list);
   scroll.replaceChildren(panel);status.textContent=filtered.length+' / '+report.nodes.length+' '+tr('concetti · stato basato su dati','concepts · evidence-based');
  }

