    // AI study deck: a question persists even as maps grow; changed/deleted
    // sources become "da aggiornare", not silently deleted or rescheduled.
    NeuroMapApp.prototype.v5Deck=function(){
      const filter=$v5('flash-filter')?.value||'due';
      const now=Date.now();
      const dueAt=c=>Number.isFinite(c?.sr?.dueAt)&&c.sr.dueAt>0?c.sr.dueAt:0;
      return (Array.isArray(this.studyCards)?this.studyCards:[]).filter(c=>{
        if(!c||typeof c!=='object')return false;
        if(filter==='active'&&c.sourceTabId!==this.activeTabId)return false;
        if(filter==='due'&&(this.v5Staleness(c)!=='fresh'||dueAt(c)>now))return false;
        if(filter==='stale'&&this.v5Staleness(c)==='fresh')return false;
        return true;
      }).sort((a,b)=>dueAt(a)-dueAt(b)||
        String(a.id||'').localeCompare(String(b.id||'')));
    };
    NeuroMapApp.prototype.v5CurrentCard=function(){return (this._v5Deck||[])[this._v5CardIndex||0]||null;};
    NeuroMapApp.prototype.v5CardStatus=function(message){$v5('v5-study-status').textContent=message;};
    NeuroMapApp.prototype.openFlashcards=function(){
      this.closeFind();this.closeEditor(true);
      $v5('flash-modal').classList.remove('hidden');
      this.restartFlashcards();
    };
    NeuroMapApp.prototype.restartFlashcards=function(){
      this._v5Deck=this.v5Deck();this._v5CardIndex=0;this._flashShowAnswer=false;
      this._v5Requeued=new Set();this.renderFlashcard();
    };
    NeuroMapApp.prototype.renderFlashcard=function(){
      const tr=(it,en)=>globalThis.GlaukaI18n?.pair(it,en)??it;
      const c=this.v5CurrentCard(),body=$v5('flash-card-content');body.replaceChildren();
      const deck=this._v5Deck||[];
      $v5('flash-progress').textContent=tr('Carta','Card')+' '+(c?this._v5CardIndex+1:0)+' / '+deck.length;
      $v5('flash-rating').classList.toggle('hidden',!c||!this._flashShowAnswer);
      $v5('flash-teleport').disabled=!c||!this.v5FindStudyNode(c);
      $v5('flash-reveal').disabled=!c;$v5('v5-remove-card').disabled=!c;
      $v5('v5-card-update').disabled=!c||this.v5Staleness(c)==='fresh';
      this.v5CardStatus(this.studyCards.length+' '+tr('carte salvate','saved cards')+' · '+(this.studyCards||[]).filter(x=>this.v5Staleness(x)!=='fresh').length+' '+tr('da aggiornare','need updating')+' · '+tr('dati inclusi nei backup JSON','data included in JSON backups'));
      if(!c){const empty=document.createElement('div');empty.className='flash-empty';
        empty.textContent=this.studyCards?.length?tr("Nessuna carta in questo filtro. Usa “Tutte”, oppure genera nuove domande.","No cards match this filter. Choose All or create new questions."):tr("Il mazzo è vuoto. Configura un provider AI e premi “Genera domande con AI”.","Your deck is empty. Connect an AI service and choose Generate questions with AI.");
        body.append(empty);return;}
      const status=this.v5Staleness(c);
      const eyebrow=document.createElement('div');eyebrow.className='flash-eyebrow';
      eyebrow.textContent=this._flashShowAnswer?tr("Risposta","Answer"):tr("Domanda","Question");body.append(eyebrow);
      if(status!=='fresh'){const stale=document.createElement('div');stale.className='v5-card-stale';
        stale.textContent=status==='missing'?tr("⚠ Nodo di origine non trovato · carta conservata","⚠ Source concept not found · card retained"):tr("⚠ Mappa modificata · verifica o rigenera la risposta","⚠ Map changed · check or regenerate the answer");body.append(stale);}
      const tab=this.tabs.find(t=>t.id===c.sourceTabId);
      const loc=document.createElement('div');loc.className='flash-breadcrumb';loc.textContent=(tab?.title||tr("Scheda non aperta","Project not open"))+' › '+(c.breadcrumb||tr("Concetto","Concept"));body.append(loc);
      const name=document.createElement('h3');name.className='flash-heading';name.textContent=this._flashShowAnswer?c.answer:c.question;body.append(name);
      if(!this._flashShowAnswer){const p=document.createElement('p');p.className='flash-hint';p.textContent=globalThis.GlaukaMobile?tr("Prova a rispondere, poi tocca Mostra risposta per controllare.","Try answering, then tap Show answer to check."):tr("Prova a rispondere a voce, poi premi Spazio per controllare.","Try answering aloud, then press Space to check.");body.append(p);}
      else{const t=document.createElement('div');t.className='v5-note';
        const dueDate=new Date(Number(c.sr?.dueAt));
        const due=c.sr?.dueAt&&Number.isFinite(dueDate.getTime())?dueDate.toLocaleDateString(globalThis.GlaukaI18n?.locale?.()||'it-IT'):tr('non ancora ripassata','not reviewed yet');
        const states=[tr('Non studiata','Not studied'),tr('Da ripassare','Needs review'),tr('Incerta','Uncertain'),tr('Consolidata','Confident')];
        t.textContent=tr('Ultimo stato','Last rating')+': '+(states[c.srStatus||0]||states[0])+' · '+tr('Ripasso previsto','Next review')+': '+due;body.append(t);}
      let slot=document.getElementById('flash-source-slot');
      if(!slot){slot=document.createElement('div');slot.id='flash-source-slot';$v5('flash-flip-card')?.after(slot);}
      slot.replaceChildren();
      if(c.source)globalThis.NeuroMapSourceUI?.chip?.(slot,c.source);

    };
    NeuroMapApp.prototype.revealFlashcard=function(){if(!this.v5CurrentCard())return;this._flashShowAnswer=!this._flashShowAnswer;this.renderFlashcard();};
    NeuroMapApp.prototype.rateFlashcard=function(score){
      const c=this.v5CurrentCard();if(!c)return;
      // Invalid or synthetic ratings must never change persisted SRS progress.
      if(!Number.isInteger(score)||score<1||score>3)return;
      if(!this._flashShowAnswer){this.revealFlashcard();return;}
      if(this.v5Staleness(c)!=='fresh'){this.showToast('Controlla e aggiorna questa carta prima di valutarla','FLASHCARD');return;}
      const old=c.sr&&typeof c.sr==='object'?c.sr:{};
      const interval=Number.isFinite(old.intervalDays)&&old.intervalDays>=0?
        Math.min(3650,old.intervalDays):0;
      const next=score===1?0:Math.min(3650,score===2?
        Math.max(1,Math.round(interval*.7)):Math.max(3,Math.round(interval*2.25)||3));
      const count=value=>Number.isSafeInteger(value)&&value>=0?
        Math.min(Number.MAX_SAFE_INTEGER-1,value):0;
      const now=Date.now();
      const dueAt=now+(score===1?4/24:next)*86400000;
      c.srStatus=score;
      c.sr={lastReviewedAt:now,dueAt,intervalDays:next,
        reviews:count(old.reviews)+1,lapses:count(old.lapses)+(score===1?1:0)};
      if(score===1&&!this._v5Requeued?.has(c.id)&&this._v5Deck.length<500){
        (this._v5Requeued ||= new Set()).add(c.id);
        this._v5Deck.splice(Math.min(this._v5CardIndex+3,this._v5Deck.length),0,c);
      }
      this._v5CardIndex++;this._flashShowAnswer=false;this.scheduleSave();this.renderFlashcard();
    };
    NeuroMapApp.prototype.v5DeleteCard=function(){
      const c=this.v5CurrentCard();if(!c)return;
      if(!confirm('Eliminare questa flashcard e la sua cronologia?'))return;
      this.studyCards=this.studyCards.filter(x=>x.id!==c.id);this.scheduleSave();this.restartFlashcards();
    };
    NeuroMapApp.prototype.v5AcceptChanged=function(){
      const card=this.v5CurrentCard(),node=card&&this.v5FindStudyNode(card);if(!card||!node)return;
      if(!confirm('Confermare che questa domanda e risposta sono ancora corrette per il nodo aggiornato?'))return;
      const tab=this.tabs.find(t=>t.id===card.sourceTabId);card.sourceSignature=this.v5Signature(node,tab?.state);card.srStatus=0;
      card.sr={dueAt:0,lastReviewedAt:0,intervalDays:0,reviews:0,lapses:0};
      this.scheduleSave();this.restartFlashcards();
    };
    NeuroMapApp.prototype.v5ExportCards=function(){
      const payload={schema:'NeuroMap-StudyDeck-v1',createdAt:new Date().toISOString(),
        tabs:this.tabs.map(t=>({id:t.id,title:t.title})),cards:this.studyCards||[]};
      this.io.triggerDownload(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),'neuromap_flashcards.json');
      this.showToast('Archivio flashcard esportato sul computer','FLASHCARD');
    };
    NeuroMapApp.prototype.v5ImportCards=async function(file){
      const doc=JSON.parse(await file.text());
      if(doc.schema!=='NeuroMap-StudyDeck-v1'||!Array.isArray(doc.cards)||doc.cards.length>3500)throw Error('Archivio di studio non valido o troppo grande');
      const mapped=[];const known=new Map(this.tabs.map(t=>[t.id,t]));
      for(const raw of doc.cards){
        const original=doc.tabs?.find(t=>t.id===raw.sourceTabId);
        const found=known.get(raw.sourceTabId)||this.tabs.find(t=>t.title===original?.title&&t.state.findNode(raw.sourceNodeId));
        if(!found)continue;
        const node=found.state.findNode(raw.sourceNodeId);
        if(!node||!raw.question||!raw.answer)continue;
        mapped.push({...raw,id:v5CardId(),sourceTabId:found.id,question:String(raw.question).slice(0,240),answer:String(raw.answer).slice(0,700)});
      }
      if(!mapped.length)throw Error('Nessun nodo di origine corrispondente nelle schede aperte. Importa prima le mappe originali.');
      const fingerprints=new Set(this.studyCards.map(c=>c.sourceTabId+'|'+c.sourceNodeId+'|'+c.question.toLocaleLowerCase()));
      let added=0;for(const card of mapped){const k=card.sourceTabId+'|'+card.sourceNodeId+'|'+card.question.toLocaleLowerCase();
        if(!fingerprints.has(k)){this.studyCards.push(card);fingerprints.add(k);added++;}}
      this.scheduleSave();this.restartFlashcards();this.showToast(added+' carte aggiunte','FLASHCARD');
    };
    NeuroMapApp.prototype.v5StudyContext=function(tab,root,limit=95,onlyNode=false){
      const studyRow=n=>{
        const row={id:n.id,parentId:n.parentId,text:n.text};
        const source=globalThis.NeuroMapLearningCore?.nodeSource?.(n);
        if(source)row.source={fileName:source.fileName,page:source.page,quote:source.quote,sha256:source.sha256};
        return row;
      };
      if(onlyNode&&root){
        return {lines:JSON.stringify(studyRow(root)),ids:new Set([root.id]),total:1,sampled:1};
      }
      // Wide maps are sampled across ALL main branches instead of taking only
      // the first 95 depth-first nodes. This bounds prompt cost and avoids
      // omitting an entire branch in large imported XMind projects.
      // Personal notes stay on the device: they are not part of the prompt.
      const all=[],queue=[{n:root,depth:0}];let index=0;
      while(index<queue.length && all.length<3500){
        const entry=queue[index++];all.push(entry);
        if(entry.depth<95)for(const child of entry.n.children||[])queue.push({n:child,depth:entry.depth+1});
      }
      const keep=Math.min(24,Math.floor(limit/3),all.length);
      const front=all.slice(0,keep),rest=all.slice(keep);
      const sample=[...front],slots=Math.min(limit-keep,rest.length);
      const cursor=(this._v5ContextCursor?.[tab.id]||0);
      for(let i=0;i<slots;i++){
        const idx=Math.floor(i*rest.length/slots+cursor)%rest.length;
        sample.push(rest[idx]);
      }
      if(rest.length && slots<rest.length){
        this._v5ContextCursor ||= {};
        this._v5ContextCursor[tab.id]=(cursor+Math.max(1,Math.floor(rest.length/slots/2)))%rest.length;
      }
      const ids=new Set(sample.map(x=>x.n.id));
      const lines=sample.map(({n,depth})=>'  '.repeat(Math.min(depth,6))+JSON.stringify(studyRow(n)));
      return {lines:lines.join('\n').slice(0,11500),ids,total:all.length,sampled:sample.length};
    };
    NeuroMapApp.prototype.v5ParseAICards=function(raw,tab,ids){
      let content=String(raw||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
      let doc;try{doc=JSON.parse(content);}catch(e){
        const start=content.indexOf('{'),end=content.lastIndexOf('}');
        if(start<0||end<=start)throw Error('Il provider non ha restituito JSON valido per le domande.');
        doc=JSON.parse(content.slice(start,end+1));
      }
      const rows=Array.isArray(doc)?doc:doc?.cards;
      if(!Array.isArray(rows))throw Error('La risposta AI deve contenere {"cards":[...]}.');
      return rows.slice(0,20).map(item=>{
        const node=tab.state.findNode(item.sourceId||item.sourceNodeId||item.nodeId);
        if(!node||!ids.has(node.id))return null;
        const question=v5SafeText(item.question).slice(0,240),answer=v5SafeText(item.answer).slice(0,700);
        if(question.length<7||answer.length<2)return null;
        const path=[];let cur=node;while(cur){path.unshift(cur.text);cur=tab.state.findNode(cur.parentId);}
        const source=globalThis.NeuroMapLearningCore?.nodeSource?.(node)||null;
        return {id:v5CardId(),question,answer,sourceNodeId:node.id,sourceTabId:tab.id,
          sourceSignature:this.v5Signature(node,tab.state),breadcrumb:path.join(' › ').slice(0,400),
          createdAt:Date.now(),srStatus:0,sr:{dueAt:0,lastReviewedAt:0,intervalDays:0,reviews:0,lapses:0},
          ...(source?{source}:{})};
      }).filter(Boolean);
    };
    NeuroMapApp.prototype.v5GenerateCards=async function(){
      if(this._v5GenRunning)return;
      if(globalThis.nmProduct?.guard&&!nmProduct.guard())return;
      if(!this.aiClient.settings.baseUrl||!this.aiClient.settings.model){this.showToast('Configura prima endpoint e modello in ✨ AI Settings','FLASHCARD');return;}
      const choice=$v5('v5-study-scope').value, count=v5Bound(Number($v5('v5-study-count').value)||7,3,12);
      const tab=this.tabs.find(t=>t.id===this.activeTabId);
      const selected=tab.state.findNode(tab.state.selectedNodeId);
      const tasks=choice==='all'?this.tabs.slice(0,8).map(t=>({tab:t,root:t.state.root})):
        choice==='node'?[{tab,root:selected||tab.state.root,onlyNode:!!selected}]:
        choice==='selected'?[{tab,root:selected||tab.state.root}]:
        [{tab,root:tab.state.root}];
      const button=$v5('v5-generate-cards');button.disabled=true;this._v5GenRunning=true;
      const all=[];try{
        for(let i=0;i<tasks.length;i++){
          const item=tasks[i];this.v5CardStatus(`Generazione AI ${i+1}/${tasks.length}: ${item.tab.title}…`);
          const ctx=this.v5StudyContext(item.tab,item.root,95,!!item.onlyNode);
          if(ctx.sampled<ctx.total)this.v5CardStatus(`Scheda ${i+1}/${tasks.length}: campione distribuito su ${ctx.sampled}/${ctx.total} nodi (limite di costo per richiesta). Ripeti per coprirne altri.`);
          const response=await this.aiClient.chat(
            'Sei un esaminatore attento alla precisione. Formula domande di richiamo attivo sui contenuti FORNITI, senza aggiungere informazioni non presenti. Rispondi solo JSON valido.',
            `Scheda: ${item.tab.title}. Genera ${count} domande DIFFERENTI che valutino collegamenti, cause, spiegazioni o confronto fra concetti, non mere elencazioni. Usa soltanto i dati contenuti nella mappa. Gli appunti personali non sono nel testo. Se un nodo riporta source, quella è l'unica pagina citabile. Per ogni carta restituisci: {"sourceId":"id esatto di un nodo", "question":"domanda concisa nella lingua selezionata", "answer":"risposta rigorosa nella lingua selezionata, basata sulla mappa"}. JSON di forma {"cards":[...]}. Non inventare dati: dove manca evidenza fai una domanda limitata ai termini presenti. Ogni sourceId deve appartenere all'elenco dato.\nMAPPA:\n${ctx.lines}`,
            {maxTokens:Math.min(1800,700+count*95),timeout:70000});
          all.push(...this.v5ParseAICards(response,item.tab,ctx.ids));
        }
        if(!all.length)throw Error('Nessuna carta AI valida. Controlla che il provider riporti gli ID dei nodi.');
        this._v5PendingCards=all;
        $v5('v5-study-preview-text').value=JSON.stringify(all.map(c=>({sourceTabId:c.sourceTabId,sourceNodeId:c.sourceNodeId,question:c.question,answer:c.answer})),null,2);
        $v5('v5-study-preview-count').textContent=`${all.length} carte proposte · puoi correggerle prima del salvataggio`;
        this.v5PaintStudyPreview();
        $v5('v5-study-preview').classList.remove('hidden');
        this.v5CardStatus('Domande pronte. Controlla e conferma l’anteprima.');
      }catch(error){console.warn('Generazione flashcard:',error);this.v5CardStatus('Errore: '+error.message);this.showToast(error.message,'FLASHCARD AI');}
      finally{button.disabled=false;this._v5GenRunning=false;}
    };
    NeuroMapApp.prototype.v5RegenerateStale=async function(){
      if(this._v5GenRunning)return;
      if(globalThis.nmProduct?.guard&&!nmProduct.guard())return;
      if(!this.aiClient.settings.baseUrl||!this.aiClient.settings.model){this.showToast('Configura prima ✨ AI Settings','FLASHCARD');return;}
      const old=(this.studyCards||[]).filter(c=>this.v5Staleness(c)==='stale');
      if(!old.length){this.showToast('Nessuna carta con origine modificata. Le carte senza nodo restano archiviate.','STUDIO');return;}
      const groups=[];
      for(const card of old){let g=groups.find(x=>x.tab.id===card.sourceTabId);
        if(!g){const tab=this.tabs.find(t=>t.id===card.sourceTabId);if(!tab)continue;
          g={tab,cards:[]};groups.push(g);}
        if(g.cards.length<10)g.cards.push(card);
      }
      const groupsToRun=groups.slice(0,8),button=$v5('v5-regenerate-stale');button.disabled=true;this._v5GenRunning=true;
      const proposals=[];
      try{
        for(let j=0;j<groupsToRun.length;j++){
          const {tab,cards}=groupsToRun[j];
          this.v5CardStatus(`Aggiorno le carte obsolete ${j+1}/${groupsToRun.length} · ${tab.title}…`);
          const ids=new Set(cards.map(c=>c.sourceNodeId));
          const entries=cards.map(c=>{
            const n=tab.state.findNode(c.sourceNodeId);
            const path=[];let v=n;for(let k=0;v&&k<12;k++){path.unshift(v.text);v=tab.state.findNode(v.parentId);}
            return {sourceId:n.id,path:path.join(' › '),node:n.text,
              children:(n.children||[]).map(x=>x.text).slice(0,18),
              previousQuestion:c.question,previousAnswer:c.answer};
          });
          const response=await this.aiClient.chat(
            'Sei un esaminatore. Riesamina domande preesistenti dopo modifiche alle mappe. Usa solo il nuovo contesto, senza inventare fatti. Restituisci soltanto JSON valido.',
            `Per ciascuna voce restituisci una domanda e una risposta aggiornate, mantenendo sourceId esatto. Se la vecchia domanda è ancora corretta, puoi riutilizzarla. Restituisci {"cards":[{"sourceId":"...","question":"...","answer":"..."}]}. Voce aggiornate:\n${JSON.stringify(entries)}`,
            {maxTokens:Math.min(1800,600+cards.length*130),timeout:70000});
          proposals.push(...this.v5ParseAICards(response,tab,ids));
        }
        if(!proposals.length)throw Error('Il provider non ha restituito domande aggiornate valide.');
        this._v5PendingCards=proposals;
        $v5('v5-study-preview-text').value=JSON.stringify(proposals.map(c=>({sourceTabId:c.sourceTabId,sourceNodeId:c.sourceNodeId,question:c.question,answer:c.answer})),null,2);
        $v5('v5-study-preview-count').textContent=`${proposals.length} carte riviste · controllale prima di confermare`;
        this.v5PaintStudyPreview();
        $v5('v5-study-preview').classList.remove('hidden');
      }catch(error){this.showToast(error.message,'AI STUDIO');this.v5CardStatus(error.message);}
      finally{button.disabled=false;this._v5GenRunning=false;}
    };
    NeuroMapApp.prototype.v5PaintStudyPreview=function(){
      const text=$v5('v5-study-preview-text');if(!text)return;
      if(!document.getElementById('v5-study-preview-css')){
        const sheet=document.createElement('style');sheet.id='v5-study-preview-css';
        sheet.textContent='.v5-study-preview-list{display:grid;gap:8px;max-height:min(52vh,420px);overflow:auto;margin:0 0 8px}.v5-study-draft{display:grid;gap:6px;border:1px solid var(--nm-skin-stroke,#74869e);border-radius:12px;padding:8px}.v5-study-draft input,.v5-study-draft textarea{width:100%;box-sizing:border-box;min-width:0}.v5-study-draft textarea{min-height:44px;max-height:72px}.v5-study-draft .v4-secondary{width:max-content;justify-self:start;background:transparent;font-weight:500}#v5-study-preview .v5-study-top{position:sticky;bottom:0;z-index:2;padding-top:6px}#v5-study-preview-apply.v4-primary{min-width:11rem;font-weight:700}@media(max-width:980px),(max-height:560px){.v5-review-modal{max-height:calc(100dvh - 12px);overflow:auto}.v5-study-preview-list{max-height:none;overflow:visible}}';
        document.head.append(sheet);
      }
      let host=document.getElementById('v5-study-preview-list');
      if(!host){host=document.createElement('div');host.id='v5-study-preview-list';host.className='v5-study-preview-list';text.before(host);}
      host.replaceChildren();
      let rows;try{rows=JSON.parse(text.value);}catch(_){return;}
      if(!Array.isArray(rows))return;
      const tr=(it,en)=>globalThis.GlaukaI18n?.pair(it,en)??it;
      rows.forEach((row,index)=>{
        const card=document.createElement('div');card.className='v5-study-draft';
        const q=document.createElement('input');q.value=row.question||'';q.maxLength=240;q.setAttribute('aria-label',tr('Domanda','Question'));
        const a=document.createElement('textarea');a.value=row.answer||'';a.maxLength=700;a.rows=2;a.setAttribute('aria-label',tr('Risposta','Answer'));
        const write=()=>{row.question=q.value;row.answer=a.value;text.value=JSON.stringify(rows,null,2);};
        q.addEventListener('input',write);a.addEventListener('input',write);
        const drop=document.createElement('button');drop.type='button';drop.className='v4-secondary';drop.textContent=tr('Scarta','Discard');
        drop.addEventListener('click',()=>{rows.splice(index,1);text.value=JSON.stringify(rows,null,2);this.v5PaintStudyPreview();});
        card.append(q,a);
        const pending=(this._v5PendingCards||[]).find(c=>c.sourceNodeId===row.sourceNodeId&&c.sourceTabId===row.sourceTabId);
        if(pending?.source)globalThis.NeuroMapSourceUI?.chip?.(card,pending.source);
        card.append(drop);host.append(card);
      });
      text.hidden=true;
    };
    NeuroMapApp.prototype.v5CommitCards=function(){
      let changed;try{changed=JSON.parse($v5('v5-study-preview-text').value);}catch(_){this.showToast('JSON nell’anteprima non valido','FLASHCARD');return;}
      if(!Array.isArray(changed)||changed.length>160){this.showToast('L’anteprima deve contenere fino a 160 carte','FLASHCARD');return;}
      const expected=new Map((this._v5PendingCards||[]).map(c=>[c.sourceTabId+'|'+c.sourceNodeId,c]));
      const newCards=[];
      for(const item of changed){const baseline=expected.get(item.sourceTabId+'|'+item.sourceNodeId);
        if(!baseline)continue;
        const q=v5SafeText(item.question).slice(0,240),a=v5SafeText(item.answer).slice(0,700);
        if(!q||!a)continue;
        newCards.push({...baseline,id:v5CardId(),question:q,answer:a});
      }
      if(!newCards.length){this.showToast('Nessuna domanda valida da salvare','FLASHCARD');return;}
      let fresh=0,updated=0;
      for(const c of newCards){const old=this.studyCards.find(x=>x.sourceTabId===c.sourceTabId&&x.sourceNodeId===c.sourceNodeId&&x.question.toLocaleLowerCase()===c.question.toLocaleLowerCase());
        if(old){if(old.answer!==c.answer || old.sourceSignature!==c.sourceSignature){
          old.answer=c.answer;old.sourceSignature=c.sourceSignature;old.breadcrumb=c.breadcrumb;old.srStatus=0;
          old.sr={dueAt:0,lastReviewedAt:0,intervalDays:0,reviews:old.sr?.reviews||0,lapses:old.sr?.lapses||0};updated++;}}
        else{this.studyCards.push(c);fresh++;}
      }
      $v5('v5-study-preview').classList.add('hidden');this._v5PendingCards=[];
      this.scheduleSave();$v5('flash-filter').value='all';this.restartFlashcards();
      this.showToast(`${fresh} nuove carte, ${updated} risposte aggiornate · esporta il mazzo per backup`,'STUDIO AI');
    };

    // Track cards when a node's content changes; fingerprint check is live, no
    // expensive traversal or card re-generation on every keypress.
    const v5Close0=NeuroMapApp.prototype.closeTab;
    NeuroMapApp.prototype.closeTab=function(id){const previous=this.tabs.length;
      const result=v5Close0.call(this,id);
      if(this.tabs.length<previous){this.v5CardStatusIfOpen();}
      return result;
    };
    NeuroMapApp.prototype.v5CardStatusIfOpen=function(){if(!$v5('flash-modal').classList.contains('hidden'))this.restartFlashcards();};
    const v5Del0=NeuroMapApp.prototype.deleteSelected;
    NeuroMapApp.prototype.deleteSelected=function(){
      if(this.state.selectedRelationshipId){this.v5DeleteRelation();return;}
      v5Del0.call(this);
    };
    const v5SelectNode0=NeuroMapApp.prototype.selectNode;
    NeuroMapApp.prototype.selectNode=function(...args){this.v5CloseRelation();return v5SelectNode0.apply(this,args);};

    const v5Bind0=NeuroMapApp.prototype.bindUI;
    NeuroMapApp.prototype.bindUI=function(){
      v5Bind0.call(this);
      const on=(id,fn)=>$v5(id)?.addEventListener('click',fn);
      on('v5-reset-map-fonts',()=>{const nodes=this.state.getAllNodes().filter(n=>n.fontSize!=null);
        if(!nodes.length)return;this.state.pushHistory();nodes.forEach(n=>n.fontSize=null);this.markChanged();this.showToast('Profilo tipografico riapplicato a tutta la mappa','STILE');});
      on('v5-font-reset',()=>{const nodes=this.v5BulkNodes().filter(n=>n.fontSize!=null);
        if(!nodes.length)return;this.state.pushHistory();nodes.forEach(n=>n.fontSize=null);this.markChanged();});
      $v5('v5-font-preset').addEventListener('change',e=>this.v5SetPreset(e.target.value));
      let scaleStart=false;
      $v5('v5-font-scale').addEventListener('pointerdown',()=>{if(!scaleStart){this.state.pushHistory();scaleStart=true;}});
      $v5('v5-font-scale').addEventListener('input',e=>{
        if(!scaleStart){this.state.pushHistory();scaleStart=true;}
        this.state.typographyScale=Number(e.target.value)/100;
        $v5('v5-font-scale-value').textContent=e.target.value+'%';
        if(!this._v5ScaleFrame)this._v5ScaleFrame=requestAnimationFrame(()=>{this._v5ScaleFrame=null;this.recalculateAndRender();});
      });
      $v5('v5-font-scale').addEventListener('change',()=>{scaleStart=false;this.markChanged();});
      // Capture cancels the v4 single-node slider handler; keep one undo step.
      const slider=$v5('inspector-fontsize-slider');let fontStart=false;
      slider.addEventListener('pointerdown',()=>{if(!fontStart){this.state.pushHistory();fontStart=true;}},true);
      slider.addEventListener('input',e=>{
        e.stopImmediatePropagation();if(!fontStart){this.state.pushHistory();fontStart=true;}
        this.v5BulkFont(Number(slider.value));
      },true);
      slider.addEventListener('change',e=>{e.stopImmediatePropagation();fontStart=false;this.markChanged();},true);
      on('v5-rel-close',()=>this.v5CloseRelation());
      $v5('v5-rel-label').addEventListener('change',e=>this.v5ChangeRelation({label:e.target.value.trim()||'Relazione'}));
      $v5('v5-rel-label').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur();}if(e.key==='Escape')this.v5CloseRelation();});
      $v5('v5-rel-color').addEventListener('change',e=>this.v5ChangeRelation({color:e.target.value}));
      on('v5-rel-reverse',()=>{const r=this.state.findRelationship(this.state.selectedRelationshipId);
        if(r)this.v5ChangeRelation({fromId:r.toId,toId:r.fromId});});
      on('v5-rel-delete',()=>this.v5DeleteRelation());
      // Context menu actions for moving a subtree without using the mouse.
      const nodeActions=document.getElementById('ctx-group-node');
      if(nodeActions){const container=document.createElement('div');container.className='v5-context-extra';
        const make=(name,label,fn)=>{const btn=document.createElement('button');btn.id=name;btn.type='button';
          btn.className='ctx-item';btn.textContent=label;btn.onclick=()=>{fn();this.hideMenus();};container.append(btn);};
        make('v5-ctx-google-ai','Cerca con Google (AI Mode)',()=>{
          const node=this.state?.findNode?.(this.state.selectedNodeId)||this.state?.root;
          const label=String(node?.text||'').replace(/\s+/g,' ').trim();
          if(!label)return;
          const path=this.aiNodePath?this.aiNodePath(node):label;
          const kids=(node?.children||[]).slice(0,6).map(c=>String(c?.text||'').replace(/\s+/g,' ').trim()).filter(Boolean);
          const kidsPart=kids.length?` (sottorami: ${kids.join(', ')})`:'';
          const q=`Spiega il concetto "${label}" nel contesto "${path}"${kidsPart}`;
          window.open?.('https://www.google.com/search?udm=50&q='+encodeURIComponent(q.slice(0,900)),'_blank','noopener,noreferrer');
        });
        make('v5-ctx-google-images','Cerca immagini su Google',()=>{
          const node=this.state?.findNode?.(this.state.selectedNodeId)||this.state?.root;
          const term=String(node?.text||'').replace(/\s+/g,' ').trim();
          if(!term)return;
          window.open?.('https://www.google.com/search?tbm=isch&q='+encodeURIComponent(term.slice(0,180)),'_blank','noopener,noreferrer');
        });
        const aiAudit=document.getElementById('btn-ai-audit');
        if(aiAudit?.parentElement){aiAudit.after(...container.children);}
        else{nodeActions.append(container);}}
      const canvas=this.canvas;
      // Hit testing + dragging are intercepted in capture phase so pan and image drag keep working unchanged.
      canvas.addEventListener('pointerdown',e=>{
        // Alt is an explicit nesting/detach modifier, even when held BEFORE
        // pointerdown. Capture it here to avoid the native canvas pan handler.
        if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey)return;
        const hit=this.findHit(e.clientX,e.clientY);
        if(hit?.type==='relationship'){
          e.preventDefault();e.stopImmediatePropagation();canvas.focus({preventScroll:true});this.v5SelectRelation(hit.item.id);return;
        }
        if(hit?.type==='node'&&hit.item.side!=='root'&&!this.relationshipSourceId){
          const nodeIds=NeuroMapDrag.dragIds(this,hit.item.id);
          if(!nodeIds.length)return;
          if(e.altKey){
            e.preventDefault();e.stopImmediatePropagation();
            canvas.focus({preventScroll:true});this.hideMenus();this.closeEditor(true);
            if(!this.state.selectedNodeIds.includes(hit.item.id))this.selectNode(hit.item.id);
          }
          this._v5Candidate={state:this.state,root:this.state.root,tabId:this.activeTabId,nodeIds,nodeId:NeuroMapDrag.dragAnchor(this.state,hit.item.id,nodeIds),startX:e.clientX,startY:e.clientY,pointerId:e.pointerId,moving:false,targetId:null};
          canvas.setPointerCapture(e.pointerId);
        }
      },true);
      canvas.addEventListener('pointermove',e=>{
        const d=this._v5Candidate;
        if(d&&e.pointerId===d.pointerId){
          const dist=Math.hypot(e.clientX-d.startX,e.clientY-d.startY);
          if(dist>7)d.moving=true;
          if(d.moving){e.stopImmediatePropagation();e.preventDefault();
            const dragHit=this.findHit(e.clientX,e.clientY);
            const hoverId=dragHit?.type==='node'?dragHit.item.id:null;
            if(d.hoverId!==hoverId){d.hoverId=hoverId;d.hoverSince=Date.now();}
            d.dropIntent=this.nm612ResolveDrop(d.nodeId,e.clientX,e.clientY,{
              nodeIds:d.nodeIds,altKey:e.altKey,childIntent:!!hoverId&&Date.now()-d.hoverSince>=600
            });
            d.targetId=d.dropIntent?.targetId||null;
            this.v5DragVisual(d,e.clientX,e.clientY);
            canvas.style.cursor='grabbing';return;
          }
        }
        const r=this.v5RelationHit(e.clientX,e.clientY);
        const id=r?.item.id||null;if(this.state.hoveredRelationshipId!==id){this.state.hoveredRelationshipId=id;this.requestRender();}
      },true);
      const finish=e=>{
        const d=this._v5Candidate;if(!d||e.pointerId!==d.pointerId)return;
        this._v5Candidate=null;
        this.v5DragVisualClear();
        if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
        if(!d.moving)return;
        e.preventDefault();e.stopImmediatePropagation();
        if(d.state!==this.state||d.tabId!==this.activeTabId){canvas.style.cursor='grab';return;}
        const releaseHit=this.findHit(e.clientX,e.clientY);
        const releaseId=releaseHit?.type==='node'?releaseHit.item.id:null;
        const intent=this.nm612ResolveDrop(d.nodeId,e.clientX,e.clientY,{
          nodeIds:d.nodeIds,altKey:e.altKey,childIntent:!!releaseId&&releaseId===d.hoverId&&Date.now()-d.hoverSince>=600
        });
        if(this.nmDragCommit(d.nodeId,intent,e.clientX,e.clientY,d.nodeIds))this.showToast(globalThis.GlaukaTouchGuidance?.message('branchMoved')??'Ramo spostato.','RAMI');
        canvas.style.cursor='grab';
      };
      canvas.addEventListener('pointerup',finish,true);
      canvas.addEventListener('pointercancel',e=>{if(this._v5Candidate?.pointerId===e.pointerId)this.nmCancelDrag();},true);
      canvas.addEventListener('dblclick',e=>{const hit=this.v5RelationHit(e.clientX,e.clientY);
        if(hit){e.stopImmediatePropagation();this.v5SelectRelation(hit.item.id);$v5('v5-rel-label').focus();$v5('v5-rel-label').select();}},true);
      canvas.addEventListener('contextmenu',e=>{const hit=this.v5RelationHit(e.clientX,e.clientY);
        if(hit){e.preventDefault();e.stopImmediatePropagation();this.v5SelectRelation(hit.item.id);}},true);
      document.addEventListener('keydown',e=>{
  if(e.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio'))return;
        if(e.key==='Escape' && this._v5Candidate){this.nmCancelDrag();}
      },true);
      // v4 flashcard keyboard navigation uses _flashDeck; skip those handlers
      // and use the new cross-tab deck instead.
      $v5('flash-filter').replaceChildren(...[
        ['due','In scadenza / mai studiate'],['all','Tutte le carte'],['active','Solo scheda attiva'],['stale','Da aggiornare / nodo mancante']
      ].map(([value,label])=>{const el=document.createElement('option');el.value=value;el.textContent=label;return el;}));
      $v5('flash-filter').value='due';
      on('v5-generate-cards',()=>this.v5GenerateCards());
      on('v5-regenerate-stale',()=>this.v5RegenerateStale());
      on('v5-export-cards',()=>this.v5ExportCards());
      on('v5-import-cards',()=> $v5('v5-import-file').click());
      $v5('v5-import-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;
        try{await this.v5ImportCards(file);}catch(err){this.showToast(err.message,'FLASHCARD');}});
      on('v5-remove-card',()=>this.v5DeleteCard());
      on('v5-card-update',()=>this.v5AcceptChanged());
      on('v5-study-preview-close',()=>$v5('v5-study-preview').classList.add('hidden'));
      on('v5-study-preview-apply',()=>this.v5CommitCards());
      // Keep Esc local to the preview, without closing the study player underneath.
      document.addEventListener('keydown',e=>{
  if(e.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio'))return;if(e.key==='Escape'&&!$v5('v5-study-preview').classList.contains('hidden')){
        e.preventDefault();e.stopImmediatePropagation();$v5('v5-study-preview').classList.add('hidden');}},true);
      on('flash-teleport',()=>{const c=this.v5CurrentCard();if(!c)return;
        if(!this.v5FindStudyNode(c)){this.showToast('Il nodo di origine non esiste più','STUDIO');return;}
        this.closeFlashcards();this.teleportToNode(c.sourceNodeId,c.sourceTabId);
      });
      // Suppress v4's legacy teleport callback (calls this.flashcardNode)
      // by intercepting before bubble handlers of the same element.
      $v5('flash-teleport').addEventListener('click',e=>{
        e.stopImmediatePropagation();e.preventDefault();const c=this.v5CurrentCard();if(!c)return;
        if(!this.v5FindStudyNode(c))return;
        this.closeFlashcards();this.teleportToNode(c.sourceNodeId,c.sourceTabId);
      },true);
      $v5('flash-modal').addEventListener('keydown',e=>{
        if(e.target.matches('input,textarea,select'))return;
        if(['ArrowLeft','ArrowRight'].includes(e.key)){
          e.preventDefault();e.stopImmediatePropagation();
          this._v5CardIndex=v5Bound((this._v5CardIndex||0)+(e.key==='ArrowRight'?1:-1),0,Math.max(0,(this._v5Deck?.length||0)-1));
          this._flashShowAnswer=false;this.renderFlashcard();
        }
      },true);
      // v4 already handles Space and 1/2/3 via overridable methods.
    };

