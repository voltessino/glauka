/* NeuroMap 6.19.1 adaptive Study views. Shared desktop renderer overlays are
 * ephemeral; neither node colors nor node metadata are rewritten.
 */
(function(root){
 'use strict';
 const A=root.NeuroMapAdaptiveCore;
 if(!A)return;
 const badgePalette={ 'needs-review':'#fb7185',recovering:'#fbbf24',reviewed:'#34d399'};
 function install(App,Renderer){
  if(Renderer.prototype._nmAdaptiveInstalled)return;
  Renderer.prototype._nmAdaptiveInstalled=true;
  const draw=Renderer.prototype.drawNode;
  Renderer.prototype.drawNode=function(node){
   draw.call(this,node);
   const scores=this._nmAdaptiveBadges;
   if(!scores||this._nmNavExport)return;
   const id=node.logicalId||node.id,item=scores.get(id);
   if(!item||!item.attempts||!item.mistakes)return;
   const geometry=this.layout?.getLayout?.(node.id);
   if(!geometry)return;
   const ctx=this.ctx;
   ctx.save();
   const x=geometry.x-geometry.width/2-10,y=geometry.y-geometry.height/2-8;
   ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);
   ctx.fillStyle=badgePalette[item.status]||'#94a3b8';ctx.fill();
   ctx.strokeStyle='#101c30';ctx.lineWidth=1.8;ctx.stroke();
   ctx.fillStyle='#0f172a';ctx.font='700 10px system-ui';
   ctx.textAlign='center';ctx.textBaseline='middle';
   // Numerical count is observed incorrect attempts, never a mastery score.
   const count=this.devicePoint?this.devicePoint(x,y+0.5):{x,y:y+0.5};
   ctx.fillText(item.mistakes>9?'9+':String(item.mistakes),count.x,count.y);
   ctx.restore();
  };
 }
 function render({app,mode,body,controls,intro,status,button,tr,el,scopeId}){
  body.replaceChildren();
  let report;
  try{
   report=A.radar(app.state.root,{
    tabId:app.activeTabId,attempts:app.learningAttempts||[],
    cards:app.studyCards||[],now:Date.now(),
    signatureFor:n=>app.v5Signature?.(n,app.state)||'',
    freshCard:c=>app.v5Staleness?.(c)==='fresh'
   });
  }catch(error){
   intro.textContent=tr('Impossibile analizzare questa mappa.',
     'Unable to analyze this map.');
   status.textContent=String(error.message||error);
   return;
  }
  const viewNode=(entry)=>{
   const row=el('div','nm-learn-adaptive-row');
   const label=el('strong','nm-learn-authored',entry.text.slice(0,170)||tr('Senza titolo','Untitled'));
   const kind=entry.status==='needs-review'?
    tr('Ultima risposta errata','Latest answer incorrect'):
    entry.status==='recovering'?
    tr('Ultima risposta corretta dopo errori','Latest answer correct after mistakes'):
    entry.status==='reviewed'?
    tr('Risposte corrette','Correct answers'):
    tr('Non ancora interrogato','Not yet quizzed');
   const details=el('small','nm-learn-muted',kind+' · '+entry.attempts+
    tr(' risposte · ',' answers · ')+entry.mistakes+
    tr(' errori · ',' mistakes · ')+entry.staleAttempts+
    tr(' obsolete',' stale')+
    (entry.dueCards?' · '+entry.dueCards+
     tr(' flashcard in scadenza',' due flashcards'):''));
   row.append(label,details);
   const visit=button(tr('Vai al nodo','Go to node'),()=>{
    app.teleportToNode?.(entry.nodeId,app.activeTabId)||
     app.selectNode?.(entry.nodeId);
   },row);
   visit.setAttribute('aria-label',tr('Apri ','Open ')+entry.text);
   return row;
  };
  const score=report.totals;
  if(mode==='radar'){
   const srs=root.NeuroMapKnowledgeCore?.memoryRadar?.(app.state.root,app.studyCards||[],app.activeTabId)?.totals;
   intro.textContent=tr('Dati osservati dai quiz, dalle immagini e dalle flashcard: nessun punteggio inventato.',
     'Observed data from quizzes, image hotspots, and flashcards; no invented scores.');
   status.textContent=score.attempts+tr(' risposte valide · ',' valid answers · ')+
    score.mistakes+tr(' errori · ',' mistakes · ')+score.stale+
    tr(' valutazioni riferite a contenuti modificati.',
      ' answers linked to changed content.');
   if(srs){
    const srsStrip=el('div','nm-learn-unified-stats');
    for(const [val,lbl] of [
     [srs.due,tr('Flashcard da ripassare','Flashcards due')],
     [srs.scheduled,tr('In programma','Scheduled')],
     [score.mistakes,tr('Errori quiz/immagini','Quiz/image mistakes')],
     [srs.reviewed,tr('Carte ripassate','Cards reviewed')]
    ]){
     const stat=el('div','nm-learn-stat');
     stat.append(el('strong','',String(val)),el('span','',lbl));
     srsStrip.append(stat);
    }
    body.append(srsStrip);
   }
   const list=el('div','nm-learn-adaptive-list');
   const header=el('strong','',tr('Argomenti da rivedere','Topics to review'));
   body.append(header,list);
   const relevant=report.ranked.filter(item=>item.mistakes||item.dueCards);
   const drawList=()=>{
    list.replaceChildren();
    if(!relevant.length)list.append(el('p','nm-learn-muted',
     tr('Nessun errore registrato o ripasso in scadenza. Completa un quiz, un ripasso su immagini o una sessione flashcard.',
      'No recorded mistakes or due reviews. Complete a quiz, an image review, or a flashcard session.')));
    for(const item of relevant.slice(0,80))list.append(viewNode(item));
    if(relevant.length>80)list.append(el('small','nm-learn-muted',
     tr('Mostrati i primi 80 risultati.','Showing the first 80 results.')));
   };
   drawList();
   if(srs?.due){
    button(tr('🎴 Studia flashcard in scadenza','🎴 Study due flashcards'),()=>{
     const b=document.getElementById('btn-flashcards');
     if(b)b.click();else app.openFlashcards?.();
    }).className='v4-primary';
   }
   button(tr('Evidenzia errori sulla mappa','Show mistakes on map'),()=>{
    app.renderer._nmAdaptiveBadges=new Map(report.nodes.filter(n=>
      n.mistakes>0).map(n=>[n.nodeId,n]));
    app.requestRender?.();
   });
   button(tr('Nascondi indicatori','Hide markers'),()=>{
    clearBadges(app);
   });
   button(tr('Scadenze complete','Full schedule'),()=>{
    app._nmKnowledge?.open?.('radar');
   });
   body.append(el('p','nm-learn-muted',tr(
    'Rosso: ultima risposta errata. Ambra: errori precedenti ma ultima risposta corretta. Le etichette indicano il numero reale di errori.',
    'Red: latest answer incorrect. Amber: previous mistakes but latest answer correct. Badges show observed mistake counts.')));
   return;
  }
  // The exam planner never changes flashcard due dates or creates calendar tasks.
  intro.textContent=tr('Piano indicativo generato localmente dalle mappe e dagli errori registrati. Non modifica i ripassi delle flashcard.',
    'Local indicative plan based on the map and recorded mistakes. Flashcard scheduling is unchanged.');
  const saved=A.cleanPlans(app.learningPlans).find(p=>p.tabId===app.activeTabId);
  const form=el('div','nm-learn-plan-form');
  const dateLabel=el('label','nm-learn-field',tr('Data esame','Exam date'));
  const dateInput=el('input');dateInput.type='date';
  dateInput.value=saved?.examDate||A.dayString(Date.now()+30*86400000);
  dateInput.min=A.dayString();
  dateLabel.append(dateInput);
  const budgetLabel=el('label','nm-learn-field',tr('Minuti di studio al giorno','Study minutes per day'));
  const minutes=el('input');minutes.type='number';minutes.min='10';minutes.max='180';minutes.step='5';
  minutes.value=String(saved?.minutesPerDay||35);
  budgetLabel.append(minutes);form.append(dateLabel,budgetLabel);
  body.append(form);
  const planBox=el('div','nm-learn-adaptive-list');body.append(planBox);
  function preview(){
   planBox.replaceChildren();
   try{
    const schedule=A.schedule(report,{
     examDate:dateInput.value,minutesPerDay:Number(minutes.value)
    });
    planBox.append(el('p','nm-learn-muted',
     schedule.daysUntilExam+tr(' giorni all’esame · ',' days to exam · ')+
     schedule.candidates+tr(' concetti candidati',' candidate concepts')+
     (schedule.truncated?tr(' · anteprima limitata a 180 giorni',' · preview capped at 180 days'):'')));
    for(const day of schedule.days.slice(0,14)){
     const item=el('div','nm-learn-plan-day');
     const heading=el('div','nm-learn-plan-heading'),date=el('time');
     date.dateTime=day.date;
     date.textContent=new Intl.DateTimeFormat(root.GlaukaI18n?.locale()||tr('it-IT','en-GB'),
      {weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(day.date+'T12:00:00Z'));
     heading.append(date,el('span','nm-learn-plan-count',day.items.length+tr(' concetti',' concepts')));
     const topics=el('ul','nm-learn-plan-topics');
     for(const entry of day.items.slice(0,6))topics.append(el('li','',entry.text));
     item.append(heading,topics);
     if(!day.items.length)item.append(el('small','nm-learn-muted',
      tr('Nessun concetto da pianificare.','No concepts to schedule.')));
     planBox.append(item);
    }
    if(schedule.days.length>14)planBox.append(el('small','nm-learn-muted',
     tr('Sono visualizzati i primi 14 giorni del piano.','Showing the first 14 days of the plan.')));
    status.textContent=tr('Anteprima non salvata.','Preview not saved.');
   }catch(e){status.textContent=e.message;}
  }
  preview();
  button(tr('Aggiorna anteprima','Refresh preview'),preview);
  button(tr('Salva piano','Save plan'),()=>{
   try{
    const updated=A.setPlan(app.learningPlans||[],{
     tabId:app.activeTabId,examDate:dateInput.value,
     minutesPerDay:Number(minutes.value)});
    // Validate temporal constraints BEFORE modifying the existing plan.
    A.schedule(report,updated.find(p=>p.tabId===app.activeTabId));
    app.learningPlans=updated;
    app.state.isDirty=true;app._desktopUserEdited=true;
    app.scheduleSave?.();app.renderTabBar?.();
    preview();status.textContent=tr('Piano salvato nel progetto.','Plan saved in the project.');
   }catch(e){status.textContent=e.message}
  });
  if(saved)button(tr('Elimina piano','Delete plan'),()=>{
   app.learningPlans=A.cleanPlans(app.learningPlans).filter(p=>p.tabId!==app.activeTabId);
   app.state.isDirty=true;app._desktopUserEdited=true;
   app.scheduleSave?.();app.renderTabBar?.();
   status.textContent=tr('Piano rimosso.','Plan removed.');
  });
 }
 function clearBadges(app){
  if(app.renderer?._nmAdaptiveBadges){
   app.renderer._nmAdaptiveBadges=null;
   app.requestRender?.();
  }
 }
 root.NeuroMapAdaptiveUI=Object.freeze({install,render,clearBadges});
})(typeof globalThis!=='undefined'?globalThis:this);
