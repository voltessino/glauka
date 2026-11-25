/* ========== NeuroMap Architect 6.8: visual text, spacing, labels ========== */
NeuroMapApp.prototype.nm68SelectedNodes = function(){
  const ids=Array.isArray(this.state.selectedNodeIds)&&this.state.selectedNodeIds.length
    ? this.state.selectedNodeIds : [this.state.selectedNodeId];
  return [...new Set(ids)].map(id=>this.state.findNode(id)).filter(Boolean);
};
NeuroMapApp.prototype.nm68SetTextAlign = function(align){
  if(!['left','center','right'].includes(align))return;
  const nodes=this.nm68SelectedNodes().filter(n=>(n.labelAlign||'center')!==align);
  if(!nodes.length)return;
  this.closeEditor(true);
  this.state.pushHistory();
  for(const n of nodes)n.labelAlign=align;
  this.markChanged();
};
NeuroMapApp.prototype.nm68SetTextIndent = function(value){
  const indent=Math.max(0,Math.min(45,Number(value)||0));
  const nodes=this.nm68SelectedNodes().filter(n=>(Number(n.labelIndent)||0)!==indent);
  if(!nodes.length)return;
  this.state.pushHistory();
  for(const n of nodes)n.labelIndent=indent;
  this.markChanged();
};
NeuroMapApp.prototype.nm68ToggleBullets = function(){
  this.closeEditor(true);
  const toggleNodes = (nodes) => {
    const allBulleted=nodes.every(n=>String(n.text||'').split(/\r?\n/).every(l=>!l.trim()||/^\s*[•●]\s/.test(l)));
    for(const node of nodes){
      const text=String(node.text||'');
      const lines=text.split(/\r?\n/);
      if(allBulleted)node.text=lines.map(l=>l.replace(/^\s*[•●]\s/, '')).join('\n');
      else node.text=lines.map(l=>l.trim()?(/^[ \t]*[•●]\s/.test(l)?l:'• '+l):l).join('\n');
    }
    return allBulleted;
  };
  if(typeof this.nm70BatchStyle === 'function'){
    let sampleNodes = [];
    if(typeof this.nm70ScopeAllNodes === 'function') sampleNodes = this.nm70ScopeAllNodes();
    else if(typeof this.nm70ScopeNodes === 'function') sampleNodes = this.nm70ScopeNodes();
    if(!sampleNodes.length)return;
    const removeBullets=sampleNodes.every(n=>String(n.text||'').split(/\r?\n/).every(l=>!l.trim()||/^\s*[•●]\s/.test(l)));
    this.nm70BatchStyle('font-style', n => {
      const text=String(n.text||'');
      const lines=text.split(/\r?\n/);
      n.text=removeBullets
        ? lines.map(l=>l.replace(/^\s*[•●]\s/, '')).join('\n')
        : lines.map(l=>l.trim()?(/^[ \t]*[•●]\s/.test(l)?l:'• '+l):l).join('\n');
    });
    this.showToast(removeBullets?'Elenco puntato rimosso':'Elenco puntato applicato','TESTO');
    return;
  }
  const nodes=this.nm68SelectedNodes();
  if(!nodes.length)return;
  this.state.pushHistory();
  const allBulleted=toggleNodes(nodes);
  this.markChanged();this.showToast(allBulleted?'Elenco puntato rimosso':'Elenco puntato applicato','TESTO');
};
NeuroMapApp.prototype.nm68SetBranchGap = function(value){
  const gap=nm68ClampGap(value);
  if(gap===nm68ClampGap(this.state.branchGapX))return;
  this.state.pushHistory();
  this.state.branchGapX=gap;
  this.markChanged();
};
const nm68OldBind=NeuroMapApp.prototype.bindUI;
NeuroMapApp.prototype.bindUI=function(...args){
  const result=nm68OldBind.apply(this,args);
  for(const btn of document.querySelectorAll('[data-nm68-align]')){
    btn.addEventListener('click',()=>this.nm68SetTextAlign(btn.dataset.nm68Align));
  }
  const indent=document.getElementById('nm68-text-indent');
  if(indent){indent.addEventListener('input',e=>document.getElementById('nm68-indent-value').textContent=e.target.value+' px');
    indent.addEventListener('change',e=>this.nm68SetTextIndent(e.target.value));}
  document.getElementById('nm68-bullets')?.addEventListener('click',()=>this.nm68ToggleBullets());
  const gap=document.getElementById('nm68-branch-gap');
  if(gap){gap.addEventListener('input',e=>document.getElementById('nm68-gap-value').textContent=e.target.value+' px');
    gap.addEventListener('change',e=>this.nm68SetBranchGap(e.target.value));}
  return result;
};

