NeuroMapApp.prototype.nm69MoveTab=function(fromId,toId,after=false){
  if(!fromId||!toId||fromId===toId)return false;
  this.saveActiveTabSnapshot();
  const source=this.tabs.findIndex(t=>t.id===fromId),target=this.tabs.findIndex(t=>t.id===toId);
  if(source<0||target<0)return false;
  const [moving]=this.tabs.splice(source,1);
  let pos=target-(source<target?1:0)+(after?1:0);
  this.tabs.splice(Math.max(0,Math.min(this.tabs.length,pos)),0,moving);
  this.renderTabBar();this.scheduleSave(); // only tab order; no change to map's isDirty
  const el=[...document.querySelectorAll('#tabs-list .tab-item')].find(e=>e.dataset.nm69TabId===fromId);
  el?.scrollIntoView?.({block:'nearest',inline:'nearest'});
  return true;
};
const nm69OldRenderTabs=NeuroMapApp.prototype.renderTabBar;
NeuroMapApp.prototype.renderTabBar=function(...args){
  const ret=nm69OldRenderTabs.apply(this,args);
  const items=[...document.querySelectorAll('#tabs-list .tab-item')];
  for(let i=0;i<items.length;i++){
    const item=items[i],tab=this.tabs[i];if(!tab)continue;
    item.dataset.nm69TabId=tab.id;
    item.draggable=true;
    item.title=(tab.title||'Scheda')+' · trascina per riordinare';
    item.addEventListener('dragstart',e=>{
      if(e.target?.closest?.('.tab-close-btn')){e.preventDefault();return;}
      this._nm69DraggingTab=tab.id;
      e.dataTransfer?.setData('text/plain','neuromap-tab:'+tab.id);
      if(e.dataTransfer)e.dataTransfer.effectAllowed='move';
      item.classList.add('nm69-dragging');
    });
    item.addEventListener('dragover',e=>{
      if(!this._nm69DraggingTab||this._nm69DraggingTab===tab.id)return;
      e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';
      const right=e.clientX>item.getBoundingClientRect().left+item.getBoundingClientRect().width/2;
      item.classList.toggle('nm69-drop-before',!right);
      item.classList.toggle('nm69-drop-after',right);
    });
    item.addEventListener('dragleave',()=>item.classList.remove('nm69-drop-before','nm69-drop-after'));
    item.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();
      const moving=this._nm69DraggingTab;
      const after=e.clientX>item.getBoundingClientRect().left+item.getBoundingClientRect().width/2;
      this._nm69DraggingTab=null;this.nm69MoveTab(moving,tab.id,after);
    });
    item.addEventListener('dragend',()=>{
      this._nm69DraggingTab=null;
      document.querySelectorAll('#tabs-list .tab-item').forEach(el=>el.classList.remove('nm69-dragging','nm69-drop-before','nm69-drop-after'));
    });
  }
  return ret;
};
// Opening a native existing file must not set the 'unsaved edits' indicator.
// The XMind content is interpreted into NeuroMap's own layout, but disk is untouched until Save.
const nm69OldSetOrigin=NeuroMapApp.prototype.v6SetOrigin;
NeuroMapApp.prototype.v6SetOrigin=function(origin,before,replaceTab,importedTabIds){
  const opened=nm69OldSetOrigin.call(this,origin,before,replaceTab,importedTabIds,true)||[];
  if(!origin?.path)return;
  // A user may edit an earlier chapter while a multi-map import continues.
  // Its history belongs to the user and must never be cleared or marked saved.
  for(const tab of opened)if(!tab.state.undoStack.length&&!tab.state.redoStack.length)tab.state.isDirty=false;
  this.renderTabBar();this.scheduleSave();
  return opened;
};
const nm69OldBindUI=NeuroMapApp.prototype.bindUI;
NeuroMapApp.prototype.bindUI=function(...args){
  const result=nm69OldBindUI.apply(this,args);
  const picker=document.getElementById('nm69-nav-level');
  if(picker){
    picker.value=String(nm69ReadLevel());this._nm69NavLevel=Number(picker.value);
    picker.addEventListener('change',()=>{
      const level=this.nm69NavigationLevel();this._nm69NavLevel=level;
      this._nm69LastNavId=null;this._nm69LastNavLevel=level;
      try{localStorage.setItem(NM69_NAV_KEY,String(level));}catch{}
      this.showToast('Navigazione impostata su livello '+level,'NAVIGAZIONE');
    });
  }
  return result;
};
/* ==================== end NeuroMap Architect 6.9 ==================== */

