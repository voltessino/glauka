  function kanbanInsertionAt(stage,targetStatus,clientY,movingId){
    if(!Number.isFinite(clientY))return null;
    for(const card of stage.querySelectorAll('.nm-work-card')){
      if(card.dataset.status!==targetStatus||card.dataset.nodeId===movingId)continue;
      const rect=card.getBoundingClientRect();
      if(clientY<rect.top+rect.height/2)return card.dataset.nodeId;
    }
    return null;
  }
  function kanbanClearDropHints(stage){
    stage.querySelectorAll('.nm-kanban-dropzone.is-over').forEach(el=>el.classList.remove('is-over'));
    stage.querySelectorAll('.nm-work-card.is-drop-before').forEach(el=>el.classList.remove('is-drop-before'));
  }
  function kanbanPreviewDrop(stage,status,beforeId){
    kanbanClearDropHints(stage);
    stage.querySelectorAll('.nm-kanban-dropzone').forEach(el=>el.classList.toggle('is-over',el.dataset.status===status));
    if(beforeId)for(const card of stage.querySelectorAll('.nm-work-card'))
      if(card.dataset.nodeId===beforeId)card.classList.add('is-drop-before');
  }
  function kanbanApplyMove(app,stage,id,status,beforeId=null){
    if(!app.state?.moveKanbanTask)return false;
    const done=app.state.moveKanbanTask(id,status,beforeId);
    kanbanClearDropHints(stage);
    if(done){
      app.markChanged();queue(app);
      announceViewAction('Scheda riordinata o spostata','Card reordered or moved');
    }
    return done;
  }
  function bindKanbanReorderKeys(app,card,node,stage){
    if(root.GlaukaMobile){
      card.removeAttribute?.('aria-keyshortcuts');
      card.setAttribute('title',tr('Trascina per spostare la scheda','Drag to move the card'));
    }else{
      card.setAttribute('aria-keyshortcuts','Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight F2 Enter Insert Shift+F10');
      card.setAttribute('title',tr(
        'Alt+↑/↓: riordina · Alt+←/→: cambia colonna · Invio: modifica',
        'Alt+Up/Down: reorder · Alt+Left/Right: change column · Enter: edit'));
    }
    card.addEventListener('keydown',event=>{
      if(event.target!==card||!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||
         !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      const layout=work.project(app.state.root,'kanban');
      const current=layout.nodes.find(item=>item.id===node.id);
      if(!current)return;
      const order=layout.nodes.filter(item=>item.status===current.status);
      const index=order.findIndex(item=>item.id===node.id);
      let target=current.status,before=null;
      if(event.key==='ArrowUp'){
        if(index<=0)return;
        before=order[index-1].id;
      }else if(event.key==='ArrowDown'){
        if(index>=order.length-1)return;
        before=order[index+2]?.id||null;
      }else{
        const column=current.column+(event.key==='ArrowRight'?1:-1);
        if(column<0||column>=work.STATUS.length)return;
        target=work.STATUS[column];
      }
      if(kanbanApplyMove(app,stage,node.id,target,before))
        requestAnimationFrame(()=>stage.querySelectorAll('.nm-work-card').forEach(
          el=>{if(el.dataset.nodeId===node.id)el.focus?.()}));
    });
  }
