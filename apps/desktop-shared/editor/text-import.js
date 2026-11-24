/* ==================== NeuroMap 6.6: lossless text, keyboard & menus ==================== */
// These helpers share a single source of truth for text/Markdown imports and clipboard.
function nm66ParseIndentedForest(text,options={}) {
  const normalized=String(text??'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ');
  if(normalized.length>1600000)throw Error('Testo troppo grande (max 1,6 MB)');
  // A single "1) Vasi sanguigni" inside tab-indented notes is NOT evidence
  // of a Markdown document. Keep plain-text indentation as the source of truth.
  const lines=normalized.split('\n').filter(row=>row.trim());
  const headers=lines.some(row=>/^\s{0,3}#{1,6}\s+\S/.test(row));
  const bulletCount=lines.filter(row=>/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(row)).length;
  const markdown=Boolean(options.markdown||headers||
    (bulletCount>=2&&bulletCount>=Math.ceil(lines.length/3)));
  if(markdown)return NeuroMapCore.parseMarkdownOutline(normalized);
  const records=[];
  for(const line of lines){
    const match=line.match(/^([ \t]*)(.*?)\s*$/);
    if(!match)continue;
    const prefix=match[1],label=match[2].trim();
    if(!label)continue;
    // We NEVER reinterpret numbered headings, arrows or abbreviations as syntax.
    // Each non-empty indented row is exactly one node, including siblings.
    if(label.length>500)throw Error('Un ramo supera 500 caratteri: riduci il testo oppure incollalo come nodo singolo.');
    if(records.length>=3500)throw Error('Troppi nodi nel testo (max 3500).');
    const column=[...prefix].reduce((n,c)=>n+(c==='\t'?4-(n%4):1),0);
    records.push({column,label});
  }
  if(!records.length)return [];
  // Map observed columns to ranks: tolerate tabs/spaces, independent of their
  // literal width; a skipped indentation level attaches to the last real node.
  const columns=[...new Set(records.map(r=>r.column))].sort((a,b)=>a-b);
  // Dense rank lookup avoids repeatedly scanning indentation columns for each
  // row (quadratic on deeply indented, pasted outlines).
  const ranks=new Map(columns.map((column,index)=>[column,index]));
  const roots=[],stack=[];
  for(const record of records){
    let depth=ranks.get(record.column);
    if(stack.length)depth=Math.min(depth,stack[stack.length-1].depth+1);
    else depth=0;
    while(stack.length&&stack[stack.length-1].depth>=depth)stack.pop();
    const node={text:record.label,children:[]};
    if(stack.length)stack[stack.length-1].node.children.push(node);
    else roots.push(node);
    stack.push({depth,node});
  }
  return roots;
}
function nm66ForestAsText(nodes) {
  const lines=[];
  const walk=(node,depth)=>{
    lines.push('  '.repeat(depth)+String(node.text??'Nodo').replace(/[\r\n]+/g,' ').trim());
    for(const child of node.children||[])walk(child,depth+1);
  };
  for(const node of nodes||[])walk(node,0);
  return lines.join('\n');
}
function nm66ParseHtmlList(text) {
  if(!text||!/<(?:ul|ol)\b/i.test(text))return [];
  try {
    const doc=new DOMParser().parseFromString(text,'text/html');
    const ul=doc.querySelector('ul,ol');if(!ul)return [];
    let count=0;
    const children=list=>[...list.children].filter(e=>e.tagName==='LI').map(li=>{
      if(++count>3500)throw Error('Troppi nodi negli appunti.');
      const label=[...li.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE ||
        (n.nodeType===Node.ELEMENT_NODE && !['UL','OL'].includes(n.tagName))).map(n=>n.textContent).join(' ').trim();
      const child=[...li.children].find(n=>['UL','OL'].includes(n.tagName));
      return {text:label||'Nodo',children:child?children(child):[]};
    });
    return children(ul);
  }catch(_){return []}
}
// Append to the selected branch only. Never swap app.state or the active tab.
NeuroMapApp.prototype.nm66AppendImportedForest=function(forest,options={}){
  if(!Array.isArray(forest)||!forest.length)throw Error('Nessun ramo da incollare.');
  const selected=this.state.findNode(this.state.selectedNodeId)||this.state.root;
  const existing=this.state.getAllNodesIncludingCollapsed().length;
  let count=0;
  const convert=(node,depth=0)=>{
    if(depth>100)throw Error('Gerarchia troppo profonda (max 100 livelli).');
    if(++count+existing>3500)throw Error('Limite di 3500 nodi: nessuna modifica alla mappa.');
    if(!node||typeof node!=='object')throw Error('Ramo importato non valido.');
    const label=String(node.text??node.title??'');
    if(!label.trim())throw Error('Un ramo importato è senza testo.');
    return {
      ...node,id:'imported_plain_'+count,text:label,parentId:null,side:'right',
      color:selected.color||'#818cf8',colorIndex:selected.colorIndex||0,
      collapsed:false,customOrder:0,
      children:(Array.isArray(node.children)?node.children:[]).map(c=>convert(c,depth+1))
    };
  };
  const nodes=forest.map(n=>convert(n));
  // The dedicated "child branches" dialog always inserts as children,
  // even if the separate "paste as siblings" clipboard option is enabled.
  const oldSibling=this._nm612PasteSibling;
  if(options.forceChild)this._nm612PasteSibling=false;
  try{this.pasteSelection({kind:'nodes',nodes,images:[],relationships:[]});}
  finally{this._nm612PasteSibling=oldSibling;}
  return count;
};
NeuroMapApp.prototype.nm66PasteOutline=function(text,html=''){
  let forest=nm66ParseHtmlList(html);
  if(!forest.length)forest=nm66ParseIndentedForest(text);
  if(!forest.length)return;
  const count=this.nm66AppendImportedForest(forest);
  this.showToast(count+' nodi incollati sotto il ramo selezionato','INCOLLA');
  return count;
};

const NM66_SHORTCUT_KEY='neuromap.shortcuts.v6.6';
const NM66_ACTIONS=[
  {id:'save',label:'Salva sul file originale',defaults:['Mod+S']},
  {id:'saveAs',label:'Salva con nome',defaults:['Mod+Shift+S']},
  {id:'open',label:'Apri uno o più file',defaults:['Mod+O']},
  {id:'newTab',label:'Nuova scheda',defaults:['Mod+T']},
  {id:'closeTab',label:'Chiudi scheda',defaults:['Mod+W']},
  {id:'nextTab',label:'Scheda successiva',defaults:['Mod+Tab']},
  {id:'prevTab',label:'Scheda precedente',defaults:['Mod+Shift+Tab']},
  {id:'find',label:'Ricerca Spotlight',defaults:['Mod+F','Mod+K']},
  {id:'selectAll',label:'Seleziona tutti i rami',defaults:['Mod+A']},
  {id:'undo',label:'Annulla',defaults:['Mod+Z']},
  {id:'redo',label:'Ripristina',defaults:['Mod+Y','Mod+Shift+Z']},
  {id:'copy',label:'Copia rami e sotto-rami',defaults:['Mod+C']},
  {id:'cut',label:'Taglia rami e sotto-rami',defaults:['Mod+X']},
  {id:'paste',label:'Incolla struttura',defaults:['Mod+V']},
  {id:'duplicate',label:'Duplica selezione',defaults:['Mod+Shift+D']},
  {id:'duplicateTab',label:'Duplica scheda',defaults:['Mod+D']},
  {id:'addChild',label:'Aggiungi sotto-ramo',defaults:['Tab']},
  {id:'addSibling',label:'Aggiungi ramo fratello',defaults:['Enter']},
  {id:'editNode',label:'Modifica nodo selezionato',defaults:['F2']},
  {id:'deleteNode',label:'Elimina selezione',defaults:['Delete','Backspace']},
  {id:'moveBranchUp',label:'Sposta ramo su (ordine fratelli)',defaults:['Alt+ArrowUp','Mod+ArrowUp']},
  {id:'moveBranchDown',label:'Sposta ramo giù (ordine fratelli)',defaults:['Alt+ArrowDown','Mod+ArrowDown']},
  {id:'prevNavBranch',label:'Ramo precedente del livello scelto',defaults:['Alt+PageUp']},
  {id:'nextNavBranch',label:'Ramo successivo del livello scelto',defaults:['Alt+PageDown']},
  {id:'fitMap',label:'Adatta tutta la mappa',defaults:['Alt+F']},
  {id:'help',label:'Mostra / nascondi Tasti',defaults:['Shift+?']}
];
function nm66NormalizeCombo(e){
  if(['Control','Meta','Shift','Alt','AltGraph'].includes(e.key))return '';
  let key=e.key;
  if(key===' ')key='Space';
  if(key==='Esc')key='Escape';
  if(key==='Del')key='Delete';
  if(key.length===1)key=key.toUpperCase();
  return [(e.ctrlKey||e.metaKey)?'Mod':null,e.altKey?'Alt':null,e.shiftKey?'Shift':null,key].filter(Boolean).join('+');
}
function nm66ShortcutDefaults(){return Object.fromEntries(NM66_ACTIONS.map(a=>[a.id,[...a.defaults]]));}
class NM66ShortcutManager {
  constructor(){
    this.assignments=nm66ShortcutDefaults();this.recording=null;
    try{
      const raw=JSON.parse(localStorage.getItem(NM66_SHORTCUT_KEY)||'{}');
      if(raw && typeof raw==='object'){
        for(const def of NM66_ACTIONS){
          const list=raw[def.id];
          if(Array.isArray(list)&&list.length<=3&&list.every(x=>typeof x==='string'&&x.length<=40))this.assignments[def.id]=[...new Set(list)];
        }
      }
    }catch(_){}
    this.sanitize();
  }
  sanitize(){
    const used=new Set();
    for(const action of NM66_ACTIONS){
      this.assignments[action.id]=(this.assignments[action.id]||[]).filter(x=>{
        if(used.has(x))return false;used.add(x);return true;
      });
    }
  }
  persist(){try{localStorage.setItem(NM66_SHORTCUT_KEY,JSON.stringify(this.assignments));return true;}catch{return false;}}
  find(combo){return NM66_ACTIONS.find(a=>(this.assignments[a.id]||[]).includes(combo))?.id||null;}
  findOwner(combo){return NM66_ACTIONS.find(a=>(this.assignments[a.id]||[]).includes(combo));}
  legacy(combo){return NM66_ACTIONS.some(a=>a.defaults.includes(combo));}
  notice(message,error=false,recording=false){
    const el=document.getElementById('nm66-shortcuts-notice');if(!el)return;
    el.textContent=message;el.classList.toggle('error',error);el.classList.toggle('recording',recording);
  }
  render(){
    const host=document.getElementById('nm66-shortcuts-rows');if(!host)return;
    host.replaceChildren();
    for(const def of NM66_ACTIONS){
      const row=document.createElement('div');row.className='nm66-shortcut-row';
      const label=document.createElement('span');label.textContent=def.label;label.className='nm66-shortcut-row-label';row.append(label);
      const controls=document.createElement('div');controls.className='nm66-shortcut-controls';
      const choices=this.assignments[def.id]||[];
      if(!choices.length){const empty=document.createElement('span');empty.className='nm66-shortcut-empty';empty.textContent='Disattivata';controls.append(empty);}
      for(const combo of choices){
        const chip=document.createElement('span');chip.className='nm66-shortcut-chip';
        const edit=document.createElement('button');edit.type='button';edit.className='nm66-shortcut-add';
        edit.textContent=combo.replace('Mod+',navigator.platform.includes('Mac')?'⌘+':'Ctrl+');
        edit.title=`Modifica ${combo}`;
        edit.addEventListener('click',()=>this.start(def.id,combo));
        const remove=document.createElement('button');remove.type='button';remove.className='nm66-shortcut-remove';
        remove.textContent='×';remove.title=`Rimuovi ${combo}`;remove.setAttribute('aria-label',`Rimuovi ${combo}`);
        remove.addEventListener('click',()=>{this.assignments[def.id]=this.assignments[def.id].filter(x=>x!==combo);this.persist();this.render();this.notice('Scorciatoia rimossa.');});
        chip.append(edit,remove);controls.append(chip);
      }
      const add=document.createElement('button');add.type='button';add.className='nm66-shortcut-add';
      add.textContent='+ Aggiungi';add.disabled=choices.length>=3;
      add.addEventListener('click',()=>this.start(def.id));controls.append(add);row.append(controls);host.append(row);
    }
  }
  start(actionId,replaces=null){
    this.recording={actionId,replaces};
    const name=NM66_ACTIONS.find(x=>x.id===actionId)?.label;
    this.notice(`Registrazione «${name}»: premi la combinazione desiderata (Esc annulla).`,false,true);
  }
  record(e){
    if(!this.recording)return false;
    e.preventDefault();e.stopImmediatePropagation();
    if(e.key==='Escape'){this.recording=null;this.notice('Registrazione annullata.');return true;}
    const combo=nm66NormalizeCombo(e);
    if(!combo)return true;
    if(combo==='Mod+Alt+Delete'||combo==='Mod+Shift+Escape'){
      this.notice('Combinazione riservata dal sistema operativo.',true,true);return true;
    }
    const {actionId,replaces}=this.recording;
    const conflict=this.findOwner(combo);
    if(conflict && conflict.id!==actionId){this.notice(`Conflitto: «${combo}» è già usata per «${conflict.label}». Scegli altri tasti.`,true,true);return true;}
    const list=[...(this.assignments[actionId]||[])].filter(x=>x!==replaces);
    if(!list.includes(combo))list.push(combo);
    if(list.length>3){this.notice('Massimo tre scorciatoie per comando.',true,true);return true;}
    this.assignments[actionId]=list;this.recording=null;this.persist();this.render();
    this.notice(`Combinazione ${combo} assegnata e salvata.`);
    return true;
  }
  reset(){this.assignments=nm66ShortcutDefaults();this.recording=null;this.persist();this.render();this.notice('Tutte le scorciatoie predefinite sono state ripristinate.');}
}
const nm66Shortcuts=new NM66ShortcutManager();
window.NM66={parseIndentedForest:nm66ParseIndentedForest,forestAsText:nm66ForestAsText,parseHtmlList:nm66ParseHtmlList,shortcuts:nm66Shortcuts};
function nm66ExecuteShortcut(app,action,event){
  switch(action){
    case 'save':app.saveToFile(false);break;
    case 'saveAs':app.saveToFile(true);break;
    case 'open':document.getElementById('btn-import-files-new-tabs')?.click();break;
    case 'newTab':if(window.NeuroMapHome?.open)window.NeuroMapHome.open();else app.createNewTab();break;
    case 'closeTab':app.closeTab();break;
    case 'nextTab':case 'prevTab':{
      const tabs=app.tabs||[],pos=tabs.findIndex(t=>t.id===app.activeTabId);
      if(tabs.length>1)app.activateTab(tabs[(pos+(action==='nextTab'?1:tabs.length-1))%tabs.length].id);
      break;
    }
    case 'find':app.openFind();break;
    case 'selectAll':app.selectAllBranches();break;
    case 'undo':app.undo();break;
    case 'redo':app.redo();break;
    case 'copy':app.copySelection();break;
    case 'cut':app.cutSelection();break;
    case 'paste':
      // Native Ctrl+V triggers paste event with file/image/HTML access.
      if((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='v' && !event.altKey && !event.shiftKey) return false;
      if(window.NeuroMapDesktopWorkflow.clipboard?.readText){window.NeuroMapDesktopWorkflow.clipboard.readText().then(text=>{
        if(app.internalClipboard&&(!text||text===app._clipboardPlain))app.pasteSelection();
        else if(text)app.nm66PasteOutline(text);
      }).catch(error=>app.showToast('Impossibile leggere gli appunti: '+error.message,'APPUNTI'));}
      else app.pasteSelection();
      break;
    case 'duplicate':app.duplicateSelection();break;
    case 'duplicateTab':app.duplicateTab();break;
    case 'addChild':app.addChild();break;
    case 'addSibling':app.addSibling(event.shiftKey);break;
    case 'editNode':app.editSelected();break;
    case 'deleteNode':app.deleteSelected();break;
    case 'moveBranchUp':app.nm69SwapSibling(-1);break;
    case 'moveBranchDown':app.nm69SwapSibling(1);break;
    case 'prevNavBranch':app.nm67NavigateMain(-1);break;
    case 'nextNavBranch':app.nm67NavigateMain(1);break;
    case 'fitMap':(app.fitWholeMap||app.fitToScreen).call(app);break;
    case 'help':document.getElementById('shortcuts-panel')?.classList.toggle('hidden');break;
  }
  return true;
}
// Register in capture phase BEFORE other legacy listeners are attached at startup.
// This also blocks the old defaults after the user removes/remaps them.
document.addEventListener('keydown',event=>{
  if(event.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio'))return;
  if(nm66Shortcuts.recording){nm66Shortcuts.record(event);return;}
  if(event.defaultPrevented)return;
  const combo=nm66NormalizeCombo(event);if(!combo)return;
  const target=event.target;
  if(target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  // Native toolbox activation must not invoke a canvas command in capture.
  if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&
     target?.closest?.('#nm-insert-panel')&&target.closest('button,summary')&&
     ['Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  // Kanban owns its documented Alt-arrow card moves. Do not reorder the
  // underlying mind-map branch from this earlier document capture handler.
  if(target?.matches?.('.nm-kanban-card')&&event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&
     ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
  const panel=document.getElementById('shortcuts-panel');
  if(panel && !panel.classList.contains('hidden') && combo!=='Shift+?'){
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();panel.classList.add('hidden');}return;
  }
  if(['flash-modal','ai-settings-modal','ai-preview-modal','nm54-illustration-modal','nm62-assets','paste-modal','nm-decision-overlay','nm67-notes-overlay','nm6-plan-modal'].some(id=>{
    const el=document.getElementById(id);return el && !el.classList.contains('hidden');
  }))return;
  // Do not steal Tab/Enter from accessible buttons and other desktop toolbar controls.
  if(!combo.includes('+') && target?.closest?.('button,a,[role="button"]'))return;
  const action=nm66Shortcuts.find(combo);
  if(!action && !nm66Shortcuts.legacy(combo))return;
  const app=window.neuroMapApp;
  if(!app)return;
  if(action==='paste' && (event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='v' && !event.altKey && !event.shiftKey){
    // Let OS emit a rich native clipboard event; prevent legacy shortcut handling only.
    return;
  }
  event.preventDefault();event.stopImmediatePropagation();
  if(action)nm66ExecuteShortcut(app,action,event);
},true);
const nm66OriginalBindUI=NeuroMapApp.prototype.bindUI;
NeuroMapApp.prototype.bindUI=function(...args){
  const result=nm66OriginalBindUI.apply(this,args);
  nm66Shortcuts.render();
  document.getElementById('nm66-shortcuts-reset')?.addEventListener('click',()=>nm66Shortcuts.reset());
  document.getElementById('shortcuts-close')?.addEventListener('click',()=>{nm66Shortcuts.recording=null;});
  document.getElementById('btn-shortcuts')?.addEventListener('click',()=>{
    nm66Shortcuts.recording=null;nm66Shortcuts.render();
    nm66Shortcuts.notice('Clicca «Aggiungi» o una combinazione esistente per modificarla.');
  });
  return result;
};
/* ==================== end NeuroMap 6.6 ==================== */

