/* NeuroMap 6.13 Developer: ordered navigation, genuinely floating menus and bounded imports. */
const NM613 = {
  capacityKey:'neuromap.import.nodesPerMap.v613',
  capacity(){let v=125;try{v=Number(localStorage.getItem(this.capacityKey)||125);}catch{}return [80,100,125,150,200].includes(v)?v:125;},
  // Each page is an ordered projection of the original tree. A chapter which exceeds
  // the target is split *within* its children, repeating only the minimum ancestor
  // context. No leaf is omitted; each page has a hard node bound.
  split(root,capacity=this.capacity()) {
    const limit=Math.max(30,Math.min(250,Number(capacity)||125));
    // A page cannot contain a complete ancestor path deeper than its capacity.
    // Validate iteratively before recursive splitting to avoid stack overflow.
    const pending=[{node:root,depth:1}],seen=new WeakSet();
    while(pending.length){
      const {node,depth}=pending.pop();
      if(!node||typeof node!=='object')continue;
      if(depth>limit)throw Error('Gerarchia troppo profonda per la dimensione delle mappe: riduci i livelli o aumenta il limite.');
      if(seen.has(node))throw Error('Struttura della mappa circolare o condivisa: importazione annullata.');
      seen.add(node);
      for(const child of node.children||[])pending.push({node:child,depth:depth+1});
    }
    const subtreeSizes=new WeakMap();
    // Iterative postorder avoids overflowing the stack on large imported trees.
    const sizesPending=[{node:root,done:false}];
    while(sizesPending.length){
      const {node,done}=sizesPending.pop();
      if(done){
        let total=1;
        for(const child of node.children||[])total+=subtreeSizes.get(child)||0;
        subtreeSizes.set(node,total);
      }else{
        sizesPending.push({node,done:true});
        for(const child of node.children||[])sizesPending.push({node:child,done:false});
      }
    }
    const size=node=>subtreeSizes.get(node)||0;
    const pages=[];let map,refs,count,serial=0;
    const shell=n=>({...n,children:[]});
    const start=()=>{map=shell(root);refs=new Map([[root,map]]);count=1;};
    const flush=()=>{if(count>1){map.text=String(root.text||'Mappa')+' · '+(++serial);pages.push(map);}start();};
    start();
    const ensure=(path)=>{for(let i=1;i<path.length;i++){
      let copy=refs.get(path[i]);if(copy)continue;
      copy=shell(path[i]);refs.set(path[i],copy);refs.get(path[i-1]).children.push(copy);count++;
    }};
    const addFull=(node,path)=>{
      ensure(path);const parent=refs.get(path[path.length-1]);
      // Import re-generates node IDs, so original immutable subtrees can be reused here.
      parent.children.push(node);count+=size(node);
    };
    const visit=(node,path)=>{
      const needed=path.slice(1).filter(a=>!refs.has(a)).length;
      const total=size(node);
      if(total+needed+count<=limit){addFull(node,path);return;}
      // Keep an entire section together whenever it fits a fresh map.
      if(total+path.length<=limit && count>1){flush();addFull(node,path);return;}
      if(count+needed+1>limit)flush();
      ensure(path.concat(node));
      for(const c of node.children||[])visit(c,path.concat(node));
    };
    for(const child of root.children||[])visit(child,[root]);
    if(count>1){map.text=String(root.text||'Mappa')+' · '+(++serial);pages.push(map);}
    if(!pages.length)return [root];
    return pages;
  },
  // Long single-line clipboard/plaintext needs wrapping *before* the editor's
  // legacy 500-character per-node safety cap; text stays in sequential chunks.
  wrapLongLines(input){
    return String(input||'').replace(/\r\n?/g,'\n').split('\n').flatMap(line=>{
      if(line.length<=420)return [line];
      const m=line.match(/^(\s*(?:(?:[-*+]\s+)|(?:\d+[.)]\s+)|(?:#{1,6}\s+))?)(.*)$/s);
      const lead=m?.[1]||'',body=m?.[2]||line;
      const chunks=[];let rest=body;
      while(rest.length>420){let end=rest.lastIndexOf(' ',360);
        if(end<180)end=360;
        chunks.push(rest.slice(0,end));rest=rest.slice(end).replace(/^\s+/, '');
      }
      if(rest)chunks.push(rest);
      // Continue siblings at the same depth: never discard the remainder.
      return chunks.map((chunk,i)=>(i?lead.replace(/#{1,6}\s+/, '- '):lead)+chunk);
    }).join('\n');
  },
  menus(){return [...document.querySelectorAll('.dropdown-panel')];},
  positionMenu(panel,trigger){
    if(!panel||panel.classList.contains('hidden')||!trigger)return;
    if(panel.parentElement!==document.body)document.body.append(panel);
    panel.classList.add('nm613-floating-menu');
    const r=trigger.getBoundingClientRect(),margin=12,width=Math.min(innerWidth-margin*2,355,Math.max(280,panel.scrollWidth));
    const left=Math.max(margin,Math.min(r.left,innerWidth-width-margin));
    const top=Math.max(margin,Math.min(r.bottom+7,innerHeight-margin-60));
    const next={left:left+'px',right:'auto',top:top+'px',width:width+'px',maxHeight:Math.max(1,innerHeight-top-margin)+'px'};
    for(const [key,value] of Object.entries(next)) if(panel.style[key]!==value) panel.style[key]=value;
  },
  menuShortcutLabels(){
    const mac=/Mac|iPhone|iPad/.test(navigator.platform||'') || /Macintosh/.test(navigator.userAgent||'');
    if(!mac)return;
    // Hints follow the same Mod key interpreted by nm66NormalizeCombo.
    document.querySelectorAll('kbd.kbd-key,[title],#v5-selection-hint,.nm54-hint,#spotlight-count').forEach(el=>{
      if(el.matches('[title]')&&el.hasAttribute('title'))el.title=el.title.replace(/Ctrl\+/g,'⌘+');
      if(el.matches('kbd.kbd-key,#v5-selection-hint,.nm54-hint,#spotlight-count'))
        el.textContent=el.textContent.replace(/Ctrl\+/g,'⌘+').replace('⌘+Y','⌘+Shift+Z');
    });
  }
};
// Preserve DFS order from XMind children arrays without sorting by layout or side.
NeuroMapApp.prototype.nm612Traversal=function(level,mode){
  let nodes=this.nm69NodesAtLevel(level);
  if(mode==='local'){
    let root=this.state.findNode(this._nm612LocalRootId);
    if(!root){let anchor=this.state.findNode(this.state.selectedNodeId);
      while(anchor?.parentId&&anchor.parentId!==this.state.root.id)anchor=this.state.findNode(anchor.parentId);
      root=anchor||this.state.root;this._nm612LocalRootId=root.id;
    }
    if(root.id!==this.state.root.id)nodes=nodes.filter(n=>n.id===root.id||this.v5IsDescendant(n,root));
  }else if(mode==='visual'){
    // Two-column maps are read column by column, top-to-bottom. A stable index
    // breaks ties, making repeated navigation deterministic even on equal rows.
    const ordered=nodes.map((node,index)=>({node,index,p:this.layout.getLayout(node.id)}));
    ordered.sort((a,b)=>{
      if(!a.p||!b.p)return (!a.p)-(!b.p)||a.index-b.index;
      if(this.state.branchStyle==='radial'){
        const angle=p=>(Math.atan2(p.y,p.x)+Math.PI/2+2*Math.PI)%(2*Math.PI);
        return angle(a.p)-angle(b.p)||a.index-b.index;
      }
      const side=p=>p.x<0?0:1;
      return side(a.p)-side(b.p)||a.p.y-b.p.y||a.index-b.index;
    });
    nodes=ordered.map(v=>v.node);
  }
  return nodes;
};
NeuroMapApp.prototype.nm67NavigateMain=function(direction=1){
  const level=this.nm69NavigationLevel(),mode=this.nm612NavMode();
  const nodes=this.nm612Traversal(level,mode);
  if(!nodes.length){this.showToast('Nessun ramo al livello '+level,'NAVIGAZIONE');return false;}
  // Only follow the last clicked navigation target while it stays selected;
  // direct user selection otherwise becomes the new navigation anchor.
  let cursor=this.state.findNode(this.state.selectedNodeId);
  while(cursor&&cursor.id!==this.state.root.id&&!nodes.some(n=>n.id===cursor.id))cursor=this.state.findNode(cursor.parentId);
  let index=nodes.findIndex(n=>n.id===cursor?.id);
  if(index<0&&this._nm612LastNavId)index=nodes.findIndex(n=>n.id===this._nm612LastNavId);
  const next=index<0?(direction>0?0:nodes.length-1):(index+direction+nodes.length)%nodes.length;
  const selected=nodes[next];this._nm612LastNavId=selected.id;
  this.nm612FitSubtree(selected.id);
  this.showToast(`${next+1}/${nodes.length} · ${mode==='visual'?'Visivo':mode==='local'?'Sotto-albero':'Originale'} · L${level} · ${selected.text}`,'RAMO');
  return true;
};
// All textual imports, including pasted text and Markdown, use the same splitter.
NM611.splitLargeMap=function(root,capacity){return NM613.split(root,capacity||NM613.capacity());};
const nm613OldChoice=NeuroMapApp.prototype.nm611LargeImportChoice;
NeuroMapApp.prototype.nm611LargeImportChoice=async function(root,label='testo'){
  const total=NM611.count(root),pages=NM613.split(root);
  if(total<=NM613.capacity()&&pages.length===1)return 'one';
  if(pages.length<2)return 'one';
  const choice=await this.nmAsk({title:'Importazione automatica leggibile',message:`“${label}”: ${total} nodi. Saranno generate ${pages.length} mappe da massimo ${NM613.capacity()} nodi, conservando l'ordine e replicando solo il contesto dei capitoli spezzati.`,choices:[{value:'cancel',text:'Annulla'},{value:'split',text:`Crea ${pages.length} mappe`,primary:true}]});
  return choice;
};
// Large outlines bypass the historical 3,500-node/1.6 MB parser limits;
// every 400-character line segment becomes a node without truncating text.
NM613.parseHugeOutline=function(input,ext){
  const text=String(input||'');
  if(text.length>16_000_000)throw Error('Documento oltre il limite di 16 MB per una singola importazione.');
  const lines=text.replace(/\r\n?/g,'\n').split('\n');
  if(lines.length>50_000)throw Error('Oltre 50.000 righe: suddividi il documento in più file.');
  const markdown=['md','markdown'].includes(ext)||/^\s*#{1,6}\s+/m.test(text)||
    lines.filter(l=>/^\s*[-*+]\s+/.test(l)).length>=Math.max(2,Math.ceil(lines.length/3));
  const rows=[];let fenced=false;
  for(const raw of lines){
    if(/^\s*```/.test(raw)){fenced=!fenced;continue;}
    if(fenced||!raw.trim()||/^\s*---\s*$/.test(raw))continue;
    const match=raw.match(/^([ \t]*)([\s\S]*?)\s*$/);
    if(!match)continue;
    const col=[...match[1]].reduce((v,c)=>v+(c==='\t'?4-v%4:1),0);
    const h=match[2].match(/^(#{1,6})\s+(.+)$/);
    const bullet=!h&&markdown&&match[2].match(/^(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);
    const label=(h?h[2]:bullet?bullet[1]:match[2]).trim();
    if(!label)continue;
    rows.push({col,level:h?.[1].length||0,label});
  }
  if(!rows.length)throw Error('Nessun contenuto leggibile.');
  const inds=[...new Set(rows.filter(r=>!r.level).map(r=>r.col))].sort((a,b)=>a-b);
  const forest=[],stack=[];let headingDepth=-1,headingBase=0,first=false;
  for(const r of rows){
    const rank=Math.max(0,inds.indexOf(r.col));let depth;
    if(r.level){headingDepth=r.level-1;first=true;depth=headingDepth;}
    else if(headingDepth>=0){if(first){headingBase=rank;first=false;}depth=headingDepth+1+Math.max(0,rank-headingBase);}
    else depth=rank;
    if(!stack.length)depth=0;else depth=Math.min(depth,stack[stack.length-1].depth+1);
    while(stack.length&&stack[stack.length-1].depth>=depth)stack.pop();
    const node={text:r.label,children:[]};
    if(stack.length)stack[stack.length-1].node.children.push(node);else forest.push(node);
    stack.push({depth,node});
  }
  return {root:forest.length===1?forest[0]:{text:'Mappa importata',children:forest}};
};
const nm613OldParse=NeuroMapApp.prototype.parseTextHierarchy;
NeuroMapApp.prototype.parseTextHierarchy=function(text,ext){
  // Own exports already encode long and multiline labels. Do not wrap or
  // reinterpret those lines before the lossless parser reads them.
  if(['md','markdown'].includes(ext)){
    const roots=NeuroMapCore.parseMarkdownExport(text);
    if(roots)return roots.length===1?{root:roots[0]}:{workspace:roots.map(root=>({root}))};
  }
  if(!['txt','text','md','markdown'].includes(ext))return nm613OldParse.call(this,text,ext);
  const fixed=NM613.wrapLongLines(text);
  // Split giant raw imports by structure after parsing, rather than silently
  // truncating maps to 2-3 oversized tabs.
  if(fixed.length>1_400_000 || fixed.split('\n').length>3300 || (fixed.match(/^\s*---\s*$/gm)||[]).length>19)
    return NM613.parseHugeOutline(fixed,ext);
  return nm613OldParse.call(this,fixed,ext);
};
const nm613OldPaste=NeuroMapApp.prototype.nm66PasteOutline;
NeuroMapApp.prototype.nm66PasteOutline=function(text,html=''){
  const input=String(text||'');
  if(input.length<10000 && input.split('\n').length<120)return nm613OldPaste.call(this,text,html);
  // Large Ctrl/Cmd+V should not feed an unbounded forest into the current tab.
  // The modal gives a clear preview and the same safe pagination as file import.
  const modal=document.getElementById('paste-modal');
  if(modal){const source=document.getElementById('paste-modal-textarea');
    source.value=input;
    // Programmatic writes do NOT fire the input event by themselves.
    source.dispatchEvent(new Event('input',{bubbles:true}));
    modal.classList.remove('hidden');this.showToast('Testo grande: importa in più mappe leggibili','IMPORT');
    document.getElementById('btn-confirm-paste-newtab')?.focus();return;
  }
  return nm613OldPaste.call(this,text,html);
};
const nm613OldBind=NeuroMapApp.prototype.bindUI;
NeuroMapApp.prototype.bindUI=function(...args){
  const result=nm613OldBind.apply(this,args);
  // Menus float in viewport space; never scroll the toolbar to reach them.
  const relayout=()=>{const active=NM613.menus().find(x=>!x.classList.contains('hidden'));
    if(active){const btn=document.querySelector(`[data-dropdown-target="${active.id}"]`);NM613.positionMenu(active,btn);}
  };
  document.addEventListener('click',e=>{
    if(!e.target.closest('[data-dropdown-target]'))return;
    requestAnimationFrame(relayout);
  });
  window.addEventListener('resize',relayout);
  document.addEventListener('focusin',e=>{if(e.target.matches('[data-dropdown-target]'))requestAnimationFrame(relayout);});
  const select=document.getElementById('nm613-import-size');
  if(select){select.value=String(NM613.capacity());select.addEventListener('change',()=>{
    try{localStorage.setItem(NM613.capacityKey,select.value);}catch{}
    this.showToast(`Massimo ${select.value} nodi per mappa · importazioni grandi`,'IMPORT');
  });}
  NM613.menuShortcutLabels();
  return result;
};
window.NM613=NM613;

