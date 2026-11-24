    // Spaced repetition: status colors plus due dates and review history.
    NeuroMapApp.prototype.collectFlashcards=function(mode='all'){
      let root=this.state.root;
      if(mode==='subtree')root=this.state.findNode(this.state.selectedNodeId)||root;
      const list=[];const now=Date.now();
      const walk=n=>{
        const hasChildren=Array.isArray(n.children)&&n.children.length>0;
        const hasDefinition=!hasChildren&&Boolean(String(n.notes||'').trim());
        if(hasChildren||hasDefinition){
          const due=Number(n.sr?.dueAt||0);const status=Number(n.srStatus||0);
          if(!['due','review'].includes(mode) || (mode==='review' ? (status===1||status===2) : (!due||due<=now)))list.push(n.id);
        }
        for(const child of n.children||[])walk(child);
      };walk(root);
      return list;
    };
    NeuroMapApp.prototype.openFlashcards=function(){
      this.closeEditor(true);this.closeFind();this._flashMode='all';this._flashCurrent=0;this._flashShowAnswer=false;this._flashRequeued=new Set();
      showV4('flash-modal');$v4('flash-filter').value='all';this.restartFlashcards();
    };
    NeuroMapApp.prototype.closeFlashcards=function(){hideV4('flash-modal');};
    NeuroMapApp.prototype.restartFlashcards=function(){
      this._flashDeck=this.collectFlashcards($v4('flash-filter').value);
      this._flashCurrent=0;this._flashShowAnswer=false;this.renderFlashcard();
    };
    NeuroMapApp.prototype.flashcardNode=function(){return this.state.findNode(this._flashDeck?.[this._flashCurrent]);};
    NeuroMapApp.prototype.nodeBreadcrumb=function(node){
      const parts=[node.text];let current=node;
      for(let i=0;i<80&&current.parentId;i++){current=this.state.findNode(current.parentId);if(!current)break;parts.unshift(current.text);}
      return parts.join(' › ');
    };
    NeuroMapApp.prototype.renderFlashcard=function(){
      const node=this.flashcardNode();const deck=this._flashDeck||[];
      $v4('flash-progress').textContent=node?`${this._flashCurrent+1} / ${deck.length}`:`0 / ${deck.length}`;
      const body=$v4('flash-card-content');body.replaceChildren();
      $v4('flash-rating').classList.toggle('hidden',!node||!this._flashShowAnswer);
      $v4('flash-reveal').disabled=!node;$v4('flash-teleport').disabled=!node;
      if(!node){const msg=document.createElement('div');msg.className='flash-empty';msg.textContent=deck.length?'Sessione completata! Scegli un filtro o ricomincia.':'Nessuna carta per questo filtro. Prova “Tutta la scheda”.';body.append(msg);return;}
      const eyebrow=document.createElement('div');eyebrow.className='flash-eyebrow';eyebrow.textContent=this._flashShowAnswer?'RISPOSTA':'RICHIAMO ATTIVO';body.append(eyebrow);
      const path=document.createElement('div');path.className='flash-breadcrumb';path.textContent=this.nodeBreadcrumb(node);body.append(path);
      const name=document.createElement('h3');name.className='flash-heading';name.textContent=node.text;body.append(name);
      if(!this._flashShowAnswer){const hint=document.createElement('p');hint.className='flash-hint';hint.textContent=node.children?.length?`Indica i ${node.children.length} sotto-rami`:'Ricorda la definizione';body.append(hint);}
      else{
        const list=document.createElement('div');list.className='flash-answers';
        for(const child of node.children||[]){const chip=document.createElement('span');chip.className='flash-answer-chip';
          const dot=document.createElement('i');dot.style.background=child.color||'#818cf8';chip.append(dot,document.createTextNode(child.text));list.append(chip);}
        if(node.notes){const note=document.createElement('p');note.className='flash-note';note.textContent=node.notes;list.append(note);}
        body.append(list);
        const images=this.state.images.filter(img=>img.mode==='attached'&&([node.id,...(node.children||[]).map(n=>n.id)].includes(img.attachedNodeId))).slice(0,5);
        if(images.length){const container=document.createElement('div');container.className='flash-images';
          for(const it of images){const img=document.createElement('img');img.src=it.src;img.alt='Immagine della mappa';img.loading='lazy';container.append(img);}
          body.append(container);}
      }
    };
    NeuroMapApp.prototype.revealFlashcard=function(){if(!this.flashcardNode())return;this._flashShowAnswer=!this._flashShowAnswer;this.renderFlashcard();};
    NeuroMapApp.prototype.rateFlashcard=function(score){
      const node=this.flashcardNode();if(!node)return;if(!this._flashShowAnswer){this.revealFlashcard();return;}
      const previous=node.sr||{};const now=Date.now();const oldInterval=Math.max(0,Number(previous.intervalDays)||0);
      const interval=score===1?0:score===2?Math.max(1,Math.round(oldInterval*.6)||1):Math.max(2,Math.round(oldInterval*2.4)||3);
      this.state.pushHistory();node.srStatus=score;
      node.sr={lastReviewedAt:now,dueAt:now+(score===1?4/24:interval)*86400000,
        intervalDays:interval,reviews:(Number(previous.reviews)||0)+1,lapses:(Number(previous.lapses)||0)+(score===1?1:0)};
      const deck=this._flashDeck;this._flashCurrent++;this._flashShowAnswer=false;
      // Failed cards return after at least two different cards, without making an infinite loop.
      if(score===1 && deck.length < 450 && !this._flashRequeued?.has(node.id)){
        if(!this._flashRequeued)this._flashRequeued=new Set();this._flashRequeued.add(node.id);
        deck.splice(Math.min(deck.length,this._flashCurrent+2),0,node.id);
      }
      this.markChanged();this.renderFlashcard();
    };

