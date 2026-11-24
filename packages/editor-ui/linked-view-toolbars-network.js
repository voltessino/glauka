  function focusNetworkRelation(edge,enabled){
    // Transient presentation-only highlight, shared by primary and split.
    for(const id of ['nm-view-stage','nm-dual-stage']){
      const stage=document.getElementById(id);
      if(!stage)continue;
      for(const card of stage.querySelectorAll('.nm-network-card')){
        card.classList.toggle('is-relation-source',enabled&&card.dataset.nodeId===edge.fromId);
        card.classList.toggle('is-relation-target',enabled&&card.dataset.nodeId===edge.toId);
      }
      for(const path of stage.querySelectorAll('.nm-network-edge'))
        path.classList.toggle('is-relation-focused',enabled&&path.dataset.relationId===String(edge.id));
    }
  }
  function syncNetworkToolbar(app,visible){
    const bar=document.getElementById('nm-network-toolbar');
    if(!bar)return;
    bar.hidden=!visible;
    if(!visible)return;
    const active=linking.get(app.state),button=bar.querySelector('#nm-network-link');
    button.setAttribute('aria-pressed',String(!!active));
    button.textContent=active?tr('Annulla collegamento','Cancel link'):tr('Collega due concetti','Link two concepts');
    button.title=button.textContent;button.setAttribute('aria-label',button.textContent);
    const arrange=bar.querySelector('#nm-network-arrange');
    const restore=bar.querySelector('#nm-network-restore-arrange');
    if(arrange){
      arrange.disabled=!app.state.selectedNodeId;
      arrange.setAttribute('aria-pressed',String(networkPreview.has(app)));
    }
    if(restore)restore.disabled=!networkPreview.has(app);
    bar.querySelector('#nm-network-label').placeholder=tr('es. causa, comprende, dipende da','e.g. causes, includes, depends on');
    bar.querySelector('#nm-network-label').setAttribute('aria-label',tr('Etichetta della relazione','Relationship label'));
    bar.querySelector('#nm-network-status').textContent=active?
      active.source?tr('Scegli il concetto di arrivo','Choose target concept'):
       tr('Scegli il concetto di partenza','Choose source concept'):
      tr('Trascina i nodi per riordinarli','Drag nodes to arrange them');
    const list=bar.querySelector('#nm-network-list');list.replaceChildren();
    const nodes=new Map();
    const walk=[app.state.root];
    while(walk.length){const node=walk.pop();if(!node)continue;nodes.set(node.id,node);walk.push(...(node.children||[]))}
    const refs=app.state.relationships.filter(r=>!r.kind&&nodes.has(r.fromId)&&nodes.has(r.toId));
    for(const edge of refs.slice(0,30)){
      const chip=document.createElement('div');chip.className='nm-network-link-item';
      chip.tabIndex=0;chip.setAttribute('role','group');
      const sourceName=String(nodes.get(edge.fromId).text||''),targetName=String(nodes.get(edge.toId).text||'');
      chip.setAttribute('aria-label',tr('Relazione da ','Relationship from ')+sourceName+
        tr(' a ',' to ')+targetName+(edge.label?' · '+String(edge.label):''));
      chip.addEventListener('mouseenter',()=>focusNetworkRelation(edge,true));
      chip.addEventListener('mouseleave',()=>focusNetworkRelation(edge,false));
      chip.addEventListener('focusin',()=>focusNetworkRelation(edge,true));
      chip.addEventListener('focusout',event=>{
        if(!event.relatedTarget||!chip.contains(event.relatedTarget))
          focusNetworkRelation(edge,false);
      });
      const label=document.createElement('span');
      // Reuse the Unicode-safe canvas label formatter instead of slicing
      // UTF-16 midway through emoji or combining sequences.
      label.dataset.glaukaUserContent='';
      label.textContent=network.displayLabel(sourceName,28)+' → '+
        network.displayLabel(targetName,28)+' · '+network.displayLabel(edge.label||'',44);
      label.title=sourceName+' → '+targetName+' · '+String(edge.label||'');
      const remove=document.createElement('button');remove.type='button';remove.className='nm-network-remove';remove.textContent='×';
      remove.setAttribute('aria-label',tr('Elimina relazione ','Remove relationship ')+label.textContent);
      remove.addEventListener('click',()=>{if(app.state.deleteRelationship(edge.id)){app.markChanged();queue(app)}});
      chip.append(label,remove);list.append(chip);
    }
    if(refs.length>30){const more=document.createElement('span');more.textContent='+'+(refs.length-30);list.append(more)}
  }
  function connectNetworkNode(app,id,labelOverride=null){
    const active=linking.get(app.state);
    if(!active)return false;
    if(!active.source){
      active.source=id;queue(app);return true;
    }
    if(active.source===id)return true;
    const source=active.source;
    const label=(labelOverride??document.getElementById('nm-network-label').value).trim()||tr('Relazione','Relationship');
    const duplicate=app.state.relationships.some(r=>!r.kind&&r.fromId===source&&r.toId===id&&r.label===label);
    if(duplicate)app.showToast?.(tr('Collegamento già presente','Relationship already exists'),'RETE');
    else{
      const relation=app.state.addRelationship(source,id,label);
      if(relation)app.markChanged();
    }
    linking.delete(app.state);queue(app);return true;
  }
