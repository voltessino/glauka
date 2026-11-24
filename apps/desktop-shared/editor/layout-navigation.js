/* ==================== NeuroMap Architect 6.9: navigation, tab order, sibling order ==================== */
const NM69_NAV_KEY='neuromap.nav.level.v6.9';
function nm69ReadLevel(){
  try{const n=Number(localStorage.getItem(NM69_NAV_KEY));return Number.isInteger(n)&&n>=1&&n<=8?n:1}
  catch{return 1}
}
NeuroMapApp.prototype.nm69NavigationLevel=function(){
  const select=document.getElementById('nm69-nav-level');
  const n=Number(select?.value||this._nm69NavLevel||1);
  return Number.isInteger(n)&&n>=1&&n<=8?n:1;
};
NeuroMapApp.prototype.nm69NodesAtLevel=function(level){
  const result=[];
  const visit=(node,depth)=>{
    if(!node||node.isSummary||node.isFloating)return;
    if(depth===level){result.push(node);return;}
    if(depth>level)return;
    for(const child of node.children||[])visit(child,depth+1);
  };
  for(const child of this.state.root?.children||[])visit(child,1);
  return result;
};
NeuroMapApp.prototype.nm67NavigateMain=function(direction=1){
  const level=this.nm69NavigationLevel(),nodes=this.nm69NodesAtLevel(level);
  if(!nodes.length){this.showToast('Nessun ramo al livello '+level,'NAVIGAZIONE');return false;}
  const selected=this.state.findNode(this.state.selectedNodeId);
  let nearest=selected;
  while(nearest&&nearest.id!==this.state.root?.id){
    if(nodes.some(n=>n.id===nearest.id))break;
    nearest=this.state.findNode(nearest.parentId);
  }
  const anchor=nodes.some(n=>n.id===nearest?.id)?nearest?.id:this._nm69LastNavLevel===level?this._nm69LastNavId:null;
  const index=nodes.findIndex(n=>n.id===anchor);
  const next=index<0?(direction>0?0:nodes.length-1):(index+direction+nodes.length)%nodes.length;
  this._nm69LastNavId=nodes[next].id;this._nm69LastNavLevel=level;
  this.teleportToNode(nodes[next].id);
  this.showToast(`${next+1}/${nodes.length} · Livello ${level} · ${nodes[next].text}`,'NAVIGAZIONE');
  return true;
};
// A one-step structural edit; a node always carries its entire subtree.
NeuroMapApp.prototype.nm69SwapSibling=function(direction){
  const node=this.state.findNode(this.state.selectedNodeId);
  if(!node||!node.parentId||node.isSummary||node.isFloating){
    this.showToast('Seleziona un ramo da spostare (non il centro)','ORDINE');return false;
  }
  const parent=this.state.findNode(node.parentId);
  if(!parent)return false;
  const isRadial=this.state.branchStyle==='radial';
  // In horizontal layout branches on opposite sides have distinct visual orders.
  const rootMetric=this.layout.getLayout(this.state.root.id);
  const visualSide=n=>{
    const metric=this.layout.getLayout(n.id);
    return metric&&rootMetric?(metric.x<rootMetric.x?'left':'right'):(n.sidePinned||n.side);
  };
  // Clockwise root order continues from the bottom-right to the bottom-left,
  // then rises on the left. A per-side vertical sort breaks at that cut and
  // reverses the command after automatic side rebalancing.
  const clockwise=parent===this.state.root&&(isRadial||!parent.layoutMode||parent.layoutMode==='clockwise'||
    (parent.layoutMode==='balanced'&&parent.layoutBalanceMode!=='geometry'));
  const siblings=(parent.children||[]).filter(sibling=>!sibling.isSummary&&!sibling.isFloating&&
    (clockwise||parent!==this.state.root||visualSide(sibling)===visualSide(node)));
  const sameVisualSide=siblings.every(sibling=>visualSide(sibling)===visualSide(node));
  if(!clockwise||sameVisualSide)siblings.sort((a,b)=>{
    const am=this.layout.getLayout(a.id),bm=this.layout.getLayout(b.id);
    return am&&bm?am.y-bm.y:0;
  });
  const i=siblings.findIndex(n=>n.id===node.id),other=siblings[i+direction];
  if(i<0||!other){this.showToast(direction<0?'Il ramo è già il primo':'Il ramo è già l’ultimo','ORDINE');return false;}
  const a=parent.children.findIndex(n=>n.id===node.id),b=parent.children.findIndex(n=>n.id===other.id);
  this.closeEditor(true);
  this.state.pushHistory();
  [parent.children[a],parent.children[b]]=[parent.children[b],parent.children[a]];
  this.state.normalizeChildrenOrder(parent);
  this.markChanged();this.selectNode(node.id);
  this.showToast(clockwise?'Ramo spostato · Ctrl+Z annulla':direction<0?'Ramo spostato sopra · Ctrl+Z per annullare':'Ramo spostato sotto · Ctrl+Z per annullare','ORDINE');
  return true;
};
