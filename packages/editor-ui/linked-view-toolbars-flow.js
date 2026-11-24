  function syncFlowPreview(app,visible){
    const guide=document.getElementById('nm-flow-guide');
    const button=document.getElementById('nm-flow-suggest');
    if(!guide||!button)return;
    button.hidden=!visible;
    if(!visible){guide.hidden=true;return}
    button.textContent=flowPreview.has(app.state)?tr('Nascondi anteprima','Close preview'):tr('Crea flusso dai rami…','Build flow from branches…');
    const current=flowPreview.get(app.state);
    guide.hidden=!current;
    if(!current)return;
    let inventory,proposal;
    try{
      inventory=guided.inventory(focusRoot(app.state)||app.state.root);
      if(!inventory.groups.some(g=>g.id===current.parentId))current.parentId=inventory.groups[0]?.id;
      if(!current.parentId)throw Error('No branch with two or more children');
      proposal=guided.preview(app.state.root,current.parentId,app.state.relationships);
    }catch(error){
      guide.hidden=true;flowPreview.delete(app.state);app.showToast?.(error.message,'FLUSSO');return;
    }
    const heading=guide.querySelector('.nm-flow-guide-heading');
    heading.textContent=tr('Anteprima: nessuna modifica ancora applicata','Preview: nothing has been changed yet');
    const note=guide.querySelector('.nm-flow-guide-note');
    note.textContent=tr('L’ordine dei sottoargomenti NON significa che esista una sequenza. Seleziona solo i collegamenti realmente corretti e conferma.','Sibling order does NOT imply a process sequence. Select only valid transitions and confirm.');
    const selector=document.getElementById('nm-flow-guide-parent');
    selector.replaceChildren();
    selector.setAttribute('aria-label',tr('Ramo da convertire','Branch to convert'));
    for(const group of inventory.groups){
      const option=document.createElement('option');option.value=group.id;
      option.textContent=group.path.slice(0,130)+' ('+group.children+')';
      selector.append(option);
    }
    selector.value=current.parentId;
    const entries=guide.querySelector('.nm-flow-guide-items');entries.replaceChildren();
    const keys=new Set(proposal.pairs.map(p=>p.fromId+'\\x00'+p.toId));
    current.checked=new Set([...current.checked].filter(k=>keys.has(k)));
    for(const pair of proposal.pairs){
      const key=pair.fromId+'\\x00'+pair.toId;
      const row=document.createElement('label');row.className='nm-flow-guide-item';
      const input=document.createElement('input');input.type='checkbox';input.checked=current.checked.has(key);
      input.setAttribute('aria-label',pair.fromText+' → '+pair.toText);
      const title=document.createElement('span');title.textContent=pair.fromText+' → '+pair.toText;
      input.addEventListener('change',()=>{
        if(input.checked)current.checked.add(key);else current.checked.delete(key);
        updateGuideButton(app);
      });
      row.append(input,title);entries.append(row);
    }
    const skipped=proposal.skipped.filter(x=>x.reason==='existing').length,
      cycles=proposal.skipped.filter(x=>x.reason==='cycle').length,
      limited=proposal.skipped.filter(x=>x.reason==='limit').length;
    const status=document.getElementById('nm-flow-guide-status');
    status.textContent=tr('Proposti: ','Proposed: ')+proposal.pairs.length+
      (skipped?' · '+tr('già presenti: ','existing: ')+skipped:'')+
      (cycles?' · '+tr('cicli evitati: ','cycles prevented: ')+cycles:'')+
      (limited?' · '+tr('oltre limite: ','over limit: ')+limited:'');
    document.getElementById('nm-flow-guide-cancel').textContent=tr('Annulla','Cancel');
    updateGuideButton(app);
  }
  function updateGuideButton(app){
    const btn=document.getElementById('nm-flow-guide-confirm'),current=flowPreview.get(app.state);
    if(!btn)return;
    const count=current?.checked?.size||0;
    btn.disabled=!count;
    btn.textContent=tr('Conferma passaggi: ','Confirm steps: ')+count;
  }
  function syncFlowToolbar(app,visible){
    const bar=document.getElementById('nm-flow-toolbar');
    if(!bar)return;
    bar.hidden=!visible;
    syncFlowPreview(app,visible);
    if(!visible)return;
    let nodes=[];
    try{nodes=flows.candidates(focusRoot(app.state)||app.state.root,1200)}
    catch(error){
      bar.querySelector('#nm-flow-connect').disabled=true;
      return;
    }
    const from=bar.querySelector('#nm-flow-from'),to=bar.querySelector('#nm-flow-to'),
      kind=bar.querySelector('#nm-flow-type'),shape=bar.querySelector('#nm-flow-shape');
    const signature=nodes.map(n=>n.id+'\u0001'+n.text).join('\u0002');
    if(bar._nmFlowSignature!==signature){
      for(const select of [from,to]){
        const previous=select.value;select.replaceChildren();
        for(const node of nodes){
          const option=document.createElement('option');option.value=node.id;
          option.textContent=node.path.slice(0,100);select.append(option);
        }
        if(nodes.some(n=>n.id===previous))select.value=previous;
      }
      bar._nmFlowSignature=signature;
    }
    const selected=app.state.selectedNodeId;
    if(nodes.some(n=>n.id===selected)&&!from.value)from.value=selected;
    if(nodes.length>1&&(!to.value||to.value===from.value)){
      const another=nodes.find(n=>n.id!==from.value);if(another)to.value=another.id;
    }
    if(shape){shape.value=flows.shape(app.state.findNode(from.value)?.flowShape);
      shape.disabled=!from.value||from.value===app.state.root?.id}
    const labels=[['Da','From'],['A','To'],['Collegamento','Transition'],['Forma nodo Da','From node shape']];
    for(const [i,label] of [...bar.querySelectorAll('.nm-flow-selector-field')].entries()){
      label.querySelector('.nm-flow-label').textContent=tr(...labels[i]);
      label.querySelector('select').setAttribute('aria-label',tr(...labels[i]));
    }
    for(const [i,option]of [...kind.options].entries())option.textContent=tr(...[['Segue','Next'],['Sì','Yes'],['No','No']][i]);
    const list=bar.querySelector('#nm-flow-list');list.replaceChildren();
    list.setAttribute('aria-label',tr('Collegamenti del flusso','Workflow transitions'));
    if(!Number.isInteger(list._nmVisible))list._nmVisible=36;
    const lookup=new Map(nodes.map(n=>[n.id,n]));
    const edges=app.state.relationships.filter(r=>flows.isFlowKind(r.kind)&&lookup.has(r.fromId)&&lookup.has(r.toId));
    for(const edge of edges.slice(0,list._nmVisible)){
      if(typeof edge.id!=='string')continue;
      const item=document.createElement('div');item.className='nm-flow-pill';
      const label=document.createElement('span');
      const condition=edge.kind==='yes'?tr('Sì','Yes'):edge.kind==='no'?tr('No','No'):tr('Segue','Next');
      label.dataset.glaukaUserContent='';label.textContent=(lookup.get(edge.fromId).text||'?')+' → '+(lookup.get(edge.toId).text||'?')+' · '+condition;
      label.title=label.textContent;
      const remove=document.createElement('button');remove.type='button';remove.className='nm-flow-remove';
      remove.textContent='×';remove.setAttribute('aria-label',tr('Elimina collegamento ','Remove transition ')+label.textContent);
      remove.addEventListener('click',()=>{
        if(app.state.deleteRelationship(edge.id)){app.markChanged();queue(app)}
      });
      item.append(label,remove);list.append(item);
    }
    if(edges.length>list._nmVisible){
      const more=document.createElement('button');more.type='button';more.className='nm-flow-more';
      more.textContent=tr('Mostra altri ','Show more ')+(edges.length-list._nmVisible);
      more.addEventListener('click',()=>{list._nmVisible=Math.min(edges.length,list._nmVisible+36);queue(app)});
      list.append(more);
    }
    const btn=bar.querySelector('#nm-flow-connect');btn.textContent=tr('Collega','Connect');
    btn.title=tr('Collega i due passaggi selezionati','Connect the two selected steps');
    btn.setAttribute('aria-label',btn.title);
    btn.disabled=nodes.length<2||from.value===to.value;
    const update=()=>{btn.disabled=!from.value||!to.value||from.value===to.value};
    from.onchange=update;to.onchange=update;
  }
