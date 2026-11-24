  function startRecall(){
   endRecall();session.quiz=null;body.replaceChildren();
   const ownerState=app.state;
   let ids;
   try{ids=K.recallIds(ownerState.root,scopeId());}
   catch(error){message(error.message);return}
   if(scope.value==='node'){
    const id=app.state.selectedNodeId;
    ids=id&&id!==app.state.root.id?[id]:[];
   }
   if(!ids.length){message(tr('Non ci sono concetti da nascondere.','No concepts to hide.'));return}
   session.mask={state:ownerState,tabId:app.activeTabId,hiddenIds:new Set(ids),total:ids.length};
   app.renderer._nmLearnRecall=session.mask;
   const inspector=document.getElementById('inspector-sidebar');
   if(inspector&&!inspector.classList.contains('collapsed')){
    inspector.classList.add('collapsed');session.inspectorClosed=true;
   }
   // Never mark the document dirty: recall is a temporary visual state.
   app.closeEditor?.(true);app.requestRender?.();
   recallStatus();
  }
  function clearQuiz(){session.quiz=null;body.replaceChildren()}
  function questionText(item){return item.origin==='map'?(root.GlaukaI18n?.translate(item.question)||item.question):item.question}
  function reviewQuestion(){
   const q=session.quiz;if(!q)return;
   body.replaceChildren();
   if(q.tabId!==app.activeTabId||q.state!==app.state){
    clearQuiz();message(tr('La scheda è cambiata. Riavvia il quiz.','Map changed. Restart the quiz.'));return;
   }
   const item=q.items[q.index];
   const progress=el('p','nm-learn-muted',tr('Domanda ','Question ')+Math.min(q.index+1,q.items.length)+' / '+q.items.length);
   const progressBar=el('progress','nm-learn-progress');
   progressBar.max=Math.max(1,q.items.length);
   progressBar.value=Math.min(q.index+1,q.items.length);
   progressBar.setAttribute('aria-label',tr('Posizione nel quiz','Quiz question position'));
   if(!item){
    const total=K.stats(app.learningAttempts,app.activeTabId);
    body.append(progressBar,el('strong','',tr('Sessione completata','Session complete')));
    message(total.answered+tr(' risposte registrate, ',' recorded answers, ')+
      total.correct+tr(' corrette, ',' correct, ')+total.mistakes+tr(' da ripassare.',' to review.'));
    return;
   }
   const title=el('div','nm-learn-question',questionText(item));
   const origin=el('small','nm-learn-muted',item.origin==='ai'?
    tr('Proposta AI da controllare sulla fonte','AI proposal to check against the source'):
    item.origin==='flashcard'?
    tr('Dalla tua flashcard','From your flashcard'):
    tr('Generata offline dalla struttura della mappa','Generated offline from the map'));
   body.append(progress,progressBar,title,origin);
   if(item.origin==='ai')body.append(el('small','nm-learn-muted',tr(
    'La pagina è solo la provenienza. Non certifica che la risposta sia giusta.',
    'The page is only the source. It does not certify that the answer is right.')));
   if((item.source||item.origin==='ai')&&root.NeuroMapSourceUI?.chip)
    root.NeuroMapSourceUI.chip(body,item.source||null);
   const answer=el('div','nm-learn-answer',item.answer);answer.hidden=true;
   const explain=item.explanation?el('p','nm-learn-explain',item.explanation):null;
   if(explain)explain.hidden=true;
   const revealSolution=()=>{answer.hidden=false;if(explain)explain.hidden=false;};
   let graded=false;
   const next=()=>{
    q.index++;reviewQuestion();
   };
   function record(correct){
    if(graded)return;
    if(!q.state.findNode(item.nodeId)||
       app.v5Signature?.(q.state.findNode(item.nodeId),q.state)!==q.signatures[q.index]){
     clearQuiz();message(tr('Il nodo è cambiato: nessun risultato salvato. Riavvia il quiz.',
       'Node changed: no result stored. Restart the quiz.'));return;
    }
    graded=true;
    app.learningAttempts=K.addAttempt(app.learningAttempts,{
     tabId:q.tabId,nodeId:item.nodeId,itemId:item.id,
     format:item.format,correct,sourceSignature:q.signatures[q.index]});
    // Quiz attempts and existing flashcard review scheduling stay independent.
    // This prevents an offline quiz from changing the due date of a card.
    app.state.isDirty=true;app._desktopUserEdited=true;
    app.renderTabBar?.();app.scheduleSave?.();
    revealSolution();
    message(correct?tr('Risposta registrata come corretta.','Recorded as correct.'):
      tr('Risposta registrata per il ripasso.','Recorded for review.'));
    body.querySelectorAll('button').forEach(b=>b.disabled=true);
    button(tr('Prossima domanda →','Next question →'),next,body).focus();
   }
   if(item.format==='choice'){
    const options=el('div','nm-learn-options');
    item.options.forEach((choice,index)=>{
     button(choice,()=>record(index===item.correctIndex),options);
    });
    body.append(options,answer);
    if(explain)body.append(explain);
   }else{
    button(tr('Mostra risposta','Reveal answer'),()=>{
     revealSolution();
     reveal.hidden=true;
     evaluate.hidden=false;
    },body);
    const reveal=body.lastElementChild;
    body.append(answer);
    if(explain)body.append(explain);
    const evaluate=el('div','nm-learn-row');evaluate.hidden=true;
    button(tr('✓ Ricordato','✓ Remembered'),()=>record(true),evaluate);
    button(tr('↻ Da ripassare','↻ Review again'),()=>record(false),evaluate);
    body.append(evaluate);
   }
   const scroller=body.closest?.('.nm-panel-body');
   if(scroller&&title.getBoundingClientRect){
    const top=title.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
    scroller.scrollTop=Math.max(0,top-4);
   }
  }
  function startQuiz(){
   endRecall();clearQuiz();
   const tab=app.activeTabId,state=app.state;
   let items;
   try{items=K.quiz(state.root,{tabId:tab,scopeId:scopeId(),
    studyCards:app.studyCards||[],fresh:c=>app.v5Staleness?.(c)==='fresh',limit:50})}
   catch(error){message(error.message);return}
   if(scope.value==='node'){
    const id=app.state.selectedNodeId;
    items=items.filter(item=>item.nodeId===id);
   }
   if(!items.length){
    message(tr('Non ci sono ancora domande. Aggiungi note ai nodi o genera flashcard.',
      'No questions yet. Add notes to nodes or generate flashcards.'));return;
   }
   items=root.NeuroMapAdaptiveCore?.prioritizeQuiz(items,root.NeuroMapAdaptiveCore.radar(state.root,{
    tabId:tab,attempts:app.learningAttempts||[],cards:app.studyCards||[],
    signatureFor:n=>app.v5Signature?.(n,state)||'',
    freshCard:c=>app.v5Staleness?.(c)==='fresh'}))||items;
   const signatures=items.map(item=>{
    const n=state.findNode(item.nodeId);
    return app.v5Signature?.(n,state)||'';
   });
   session.quiz={tabId:tab,state,items,index:0,signatures};
   message(items.length+tr(' domande pronte, senza inviare dati a un provider AI.',
     ' offline questions ready; no data sent to an AI provider.'));
   reviewQuestion();
  }
  function studyNodes(){
   const id=scope.value==='node'?(app.state.selectedNodeId||app.state.root.id):scopeId();
   const {rows}=K.subtree(app.state.root,id);
   const list=scope.value==='node'?rows.filter(r=>r.id===id):rows;
   return list.slice(0,40).map(r=>({id:r.id,text:r.node.text,notes:r.node.notes,sourceRefs:r.node.sourceRefs||[]}));
  }
  function beginItems(items,note){
   endRecall();
   const state=app.state,tab=app.activeTabId;
   const signatures=items.map(item=>app.v5Signature?.(state.findNode(item.nodeId),state)||'');
   session.quiz={tabId:tab,state,items,index:0,signatures};
   message(note);reviewQuestion();
  }
  function paintProposal(result){
   body.replaceChildren();
   if(!result.items.length){message(tr('Nessuna domanda utilizzabile.','No usable question.'));return}
   const kept=result.items.map(item=>({item,on:true}));
   kept.forEach(row=>{
    const box=el('div','nm-learn-draft');
    const q=el('input');q.value=row.item.question;q.setAttribute('aria-label',tr('Domanda','Question'));
    q.addEventListener('input',()=>{row.item.question=q.value});
    const a=el('textarea');a.value=row.item.answer;a.setAttribute('aria-label',tr('Risposta','Answer'));
    a.addEventListener('input',()=>{row.item.answer=a.value});
    box.append(q,a);
    if(row.item.explanation){
     const exp=el('textarea');exp.value=row.item.explanation;exp.setAttribute('aria-label',tr('Spiegazione','Explanation'));
     exp.addEventListener('input',()=>{row.item.explanation=exp.value});box.append(exp);
    }
    if(root.NeuroMapSourceUI?.chip)root.NeuroMapSourceUI.chip(box,row.item.source||null);
    const drop=el('button','v4-secondary',tr('Scarta','Discard'));drop.type='button';
    drop.addEventListener('click',()=>{row.on=false;box.remove()});
    box.append(drop);body.append(box);
   });
   const save=button(tr('Aggiungi al ripasso','Add to review'),()=>{
    const items=kept.filter(r=>r.on&&r.item.question.trim().length>=7&&r.item.answer.trim().length>=2).map(r=>r.item);
    if(!items.length){message(tr('Nessuna domanda selezionata.','No question selected.'));return}
    beginItems(items,items.length+tr(' domande aggiunte. Controlla la fonte prima di fidarti della risposta.',' questions added. Check the source before trusting the answer.'));
   },body);
   save.className='v4-primary';
   if(result.rejected.length)message(tr('Alcune proposte sono state scartate: nodo o pagina non presenti.','Some proposals were dropped: the node or page was not present.'));
  }
  async function proposeQuiz(){
   if(root.nmProduct?.guard&&!root.nmProduct.guard())return;
   if(!app.aiClient?.settings?.baseUrl||!app.aiClient.settings.model){
    message(tr('Configura prima il provider in Impostazioni AI.','Set up the AI provider first.'));return;
   }
   const nodes=studyNodes();
   const payload=K.promptNodes(nodes);
   const system='Sei un esaminatore. Usa solo i testi forniti. Non inventare pagine, file o fatti. Rispondi solo JSON.';
   const user='Crea fino a 6 domande. Per ognuna: nodeId di un id presente, question, answer, explanation breve, options con 3 voci di cui una uguale ad answer se ha senso, source solo copiando fileName, page e sha256 già presenti su quel nodo. JSON {"questions":[...]}.\n'+JSON.stringify(payload);
   try{
    const raw=await app.aiClient.chat(system,user,{maxTokens:2200,timeout:85000,temperature:0.1,structured:true});
    paintProposal(K.acceptQuiz(raw,nodes));
   }catch(error){message(error.message||tr('Risposta non valida','Invalid response'));}
  }
  function refresh(){
   recallBtn.classList.toggle('nm-learn-current',session.mode==='recall');
   quizBtn.classList.toggle('nm-learn-current',session.mode==='quiz');
   radarBtn.classList.toggle('nm-learn-current',session.mode==='radar');
   plannerBtn.classList.toggle('nm-learn-current',session.mode==='planner');
   root.NeuroMapAdaptiveUI?.clearBadges(app);
   controls.replaceChildren();body.replaceChildren();
   endRecall();clearQuiz();
   if(session.mode==='recall'){
    intro.textContent=tr('Nasconde soltanto le etichette visibili sul canvas: i nodi originali e il salvataggio non cambiano.',
      'Masks labels on the canvas only: original nodes and saved content do not change.');
    button(tr('Nascondi concetti','Hide concepts'),startRecall);
    button(tr('Mostra tutto','Reveal all'),()=>{endRecall();message(tr('Etichette ripristinate.','Labels restored.'))});
    message(tr('Scegli l’ambito e premi Nascondi concetti.','Choose a scope and hide concepts.'));
   }else if(session.mode==='quiz'){
    intro.textContent=tr('Quiz offline da rami, note e flashcard esistenti. Le domande aperte si valutano manualmente.',
      'Offline quiz from branches, notes and existing flashcards. Open answers are self-rated.');
    button(tr('Inizia quiz','Start quiz'),startQuiz);
    button(tr('Proponi quiz con AI','Propose an AI quiz'),()=>void proposeQuiz());
    const n=K.stats(app.learningAttempts||[],app.activeTabId);
    message(n.answered+tr(' risposte registrate in questa mappa.',' answers recorded for this map.'));
   }else{
    root.NeuroMapAdaptiveUI.render({app,mode:session.mode,body,controls,intro,status,
      button,tr,el,scopeId});
   }
  }
  function open(startMode){
   if(root.NeuroMapWorkspaceLayout?.claim(app,'learn')===false)return;
   if(startMode&&['recall','quiz','radar','planner'].includes(startMode))session.mode=startMode;
   session.visible=true;panel.hidden=false;trigger.setAttribute('aria-expanded','true');refresh();
  }
  session.open=open;
  function closePanel(){
   if(session.confirmLeaveSync?.()===false)return;
   session.stop();session.visible=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');
  }
  function go(mode){
   if(session.mode!==mode&&session.confirmLeaveSync?.()===false)return;
   session.mode=mode;refresh();
  }
  trigger.addEventListener('click',()=>session.visible?closePanel():open());
  close.addEventListener('click',closePanel);
  recallBtn.addEventListener('click',()=>go('recall'));
  quizBtn.addEventListener('click',()=>go('quiz'));
  radarBtn.addEventListener('click',()=>go('radar'));
  plannerBtn.addEventListener('click',()=>go('planner'));
  session.scopeValue=scope.value;
  scope.addEventListener('change',()=>{
   if(session.confirmLeaveSync?.()===false){scope.value=session.scopeValue;return}
   session.scopeValue=scope.value;refresh();
  });
  // Recall is read-only, but its camera must always remain navigable.
  // A tap reveals a concept; a drag (including starting on a label) pans.
  // Capturing the gestures here prevents the normal editor from editing nodes.
  let recallDrag=null;
