/* NeuroMap 6.3 — floating topics, offline markers and illustration gallery */
const NM62_MARKERS={
 'Priorità':[['priority-1','❶'],['priority-2','❷'],['priority-3','❸'],['priority-4','❹'],['priority-5','❺'],['priority-6','❻'],['priority-7','❼'],['priority-8','❽'],['priority-9','❾']],
 'Stato':[['check','✓'],['warning','!'],['question','?'],['done','✔'],['progress','◕'],['clock','◷']],
 'Espressioni':[['smile','☺'],['sad','☹'],['heart','♥'],['star','★']],
 'Segnali':[['flag','⚑'],['important','◆'],['info','ℹ'],['idea','✦'],['pin','●']],
 'Riferimenti':[['book','▤'],['medical','✚'],['up','↑'],['down','↓']]
};
const NM62_GALLERY={
 'Salute e anatomia':[['heart','❤️'],['brain','🧠'],['bone','🦴'],['lungs','🫁'],['tooth','🦷'],['eye','👁️'],['blood','🩸'],['microscope','🔬'],['dna','🧬'],['pill','💊'],['hospital','🏥'],['doctor','🩺']],
 'Educazione':[['book','📚'],['school','🏫'],['graduate','🎓'],['idea','💡'],['pencil','✏️'],['science','⚗️'],['calculator','🧮'],['globe','🌍']],
 'Lavoro e affari':[['briefcase','💼'],['chart','📈'],['money','💰'],['mail','✉️'],['calendar','📅'],['target','🎯'],['clock','🕘'],['phone','📱']],
 'Tecnologia':[['computer','💻'],['robot','🤖'],['gear','⚙️'],['cloud','☁️'],['lock','🔒'],['network','🌐'],['satellite','🛰️']],
 'Vita quotidiana':[['home','🏠'],['car','🚗'],['tree','🌳'],['flower','🌼'],['coffee','☕'],['family','👪'],['music','🎵'],['camera','📷']]
};
function nm62VectorIllustration(name,emoji){
 // Literal catalogue values only; never interpolate untrusted SVG or HTML.
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><text x="48" y="72" font-size="67" font-family="Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji,sans-serif" text-anchor="middle">'+emoji+'</text></svg>';
 return {type:'iconify',prefix:'neuromap-local',name,keyword:name,svg};
}
// One shared source for the consolidated creative library. Keep legacy
// pickers as compatibility fallbacks; do not copy emoji SVG into project files.
globalThis.GlaukaLegacyGallery=Object.freeze({gallery:NM62_GALLERY,vector:nm62VectorIllustration});
const NM62_EN_SECTIONS={'Priorità':'Priority','Stato':'Status','Espressioni':'Emotions','Segnali':'Signals','Riferimenti':'References','Salute e anatomia':'Health & anatomy','Educazione':'Education','Lavoro e affari':'Work & business','Tecnologia':'Technology','Vita quotidiana':'Everyday life'};
NeuroMapApp.prototype.nm62OpenAssets=function(tab='markers'){
 const node=this.state.findNode(this.state.selectedNodeId);
 if(!node){this.showToast('Seleziona un nodo prima di aprire la libreria','RISORSE');return;}
 const en=typeof nmLocale==='function'&&nmLocale()==='en';
 document.getElementById('nm62-title').textContent=(globalThis.GlaukaI18n?.pair("🏷️ Simboli & Libreria","🏷️ Symbols & Gallery")??(en?'🏷️ Symbols & Gallery':'🏷️ Simboli & Libreria'));
 document.getElementById('nm62-markers-tab').textContent=(globalThis.GlaukaI18n?.pair("🏷️ Simboli","🏷️ Symbols")??(en?'🏷️ Symbols':'🏷️ Simboli'));
 document.getElementById('nm62-gallery-tab').textContent=(globalThis.GlaukaI18n?.pair("🖼️ Libreria grafica","🖼️ Graphic gallery")??(en?'🖼️ Graphic gallery':'🖼️ Libreria grafica'));
 document.getElementById('nm62-remove-assets').textContent=(globalThis.GlaukaI18n?.pair("↺ Rimuovi","↺ Remove")??(en?'↺ Remove':'↺ Rimuovi'));
 document.getElementById('nm62-close').textContent=(globalThis.GlaukaI18n?.pair("✕ Chiudi","✕ Close")??(en?'✕ Close':'✕ Chiudi'));
 this._nm62AssetTarget=node.id;this._nm62AssetTab=this.activeTabId;
 document.getElementById('nm62-assets').classList.remove('hidden');this.nm62RenderAssets(tab);
};
NeuroMapApp.prototype.nm62CloseAssets=function(){document.getElementById('nm62-assets').classList.add('hidden');this.canvas.focus({preventScroll:true});};
NeuroMapApp.prototype.nm62RenderAssets=function(which='markers'){
 const root=document.getElementById('nm62-gallery-root');root.replaceChildren();
 document.getElementById('nm62-markers-tab').classList.toggle('active',which==='markers');
 document.getElementById('nm62-gallery-tab').classList.toggle('active',which==='gallery');
 const catalogue=which==='markers'?NM62_MARKERS:NM62_GALLERY;
 const selected=this.state.findNode(this._nm62AssetTarget);
 const status=document.getElementById('nm62-assets-status');
 status.textContent=selected?((globalThis.GlaukaI18n?.pair("Nodo: ","Node: ")??(typeof nmLocale==='function'&&nmLocale()==='en'?'Node: ':'Nodo: ')))+selected.text+' · '+(which==='markers'?'Seleziona o deseleziona simboli':'Clicca un’illustrazione per aggiungerla'):'Nessun nodo selezionato';
 for(const [section,entries] of Object.entries(catalogue)){
  const title=document.createElement('div');title.className='nm62-categories';title.textContent=(typeof nmLocale==='function'&&nmLocale()==='en'&&NM62_EN_SECTIONS[section])||section;root.append(title);
  const grid=document.createElement('div');grid.className='nm62-grid';root.append(grid);
  for(const [id,symbol] of entries){const button=document.createElement('button');button.type='button';button.className='nm62-tile';
   if(which==='markers'&&selected?.markers?.includes(id))button.classList.add('active');
   const icon=document.createElement('span');icon.className='nm62-glyph';icon.textContent=symbol;
   const label=document.createElement('span');label.textContent=id;button.append(icon,label);
   button.addEventListener('click',()=>{
    if(this._nm62AssetTab!==this.activeTabId)return;
    const n=this.state.findNode(this._nm62AssetTarget);if(!n)return;
    const markers=Array.isArray(n.markers)?[...n.markers]:[];
    if(which==='markers'){
     if(markers.includes(id))markers.splice(markers.indexOf(id),1);
     else if(markers.length<3)markers.push(id);
     else {this.showToast('Massimo tre simboli per nodo','MARCATORI');return;}
     this.state.pushHistory();n.markers=markers;
    }else{this.state.pushHistory();n.illustration=nm62VectorIllustration(id,symbol);}
    this.markChanged();this.nm62RenderAssets(which);
   });grid.append(button);
  }
 }
};
const nm62BindUI=NeuroMapApp.prototype.bindUI;
NeuroMapApp.prototype.bindUI=function(...args){const r=nm62BindUI.apply(this,args);
 const add=(id,fn)=>document.getElementById(id)?.addEventListener('click',fn);
 add('nm64-save-default-wrap',()=>{
  const n=Math.max(8,Math.min(60,Number(this.state.defaultLabelWrapChars)||48));
  try{localStorage.setItem(NM64_WRAP_PREF_KEY,String(n));}
  catch(err){this.showToast('Impossibile salvare preferenza sul browser: '+err.message,'AVVISO');return;}
  // The current map becomes the template, future maps follow the preference.
  this.state.wrapCustom=false;
  for(const tab of this.tabs){if(!tab?.state?.wrapCustom){tab.state.defaultLabelWrapChars=n;}}
  this.markChanged();this.nm54SyncSettings();
  this.showToast('Testo a capo: '+n+' caratteri salvato per le nuove mappe','PREFERENZE');
 });
 add('nm62-toolbar-assets',()=>this.nm62OpenAssets());
 add('nm62-ctx-markers',()=>{this.hideMenus();this.nm62OpenAssets();});
 add('nm62-close',()=>this.nm62CloseAssets());
 add('nm62-markers-tab',()=>this.nm62RenderAssets('markers'));
 add('nm62-gallery-tab',()=>this.nm62RenderAssets('gallery'));
 add('nm62-remove-assets',()=>{const n=this.state.findNode(this._nm62AssetTarget);if(!n)return;
   if(!(n.markers?.length||n.illustration))return;this.state.pushHistory();n.markers=[];n.illustration=null;this.markChanged();this.nm62RenderAssets('markers');});
 const overlay=document.getElementById('nm62-assets');overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)this.nm62CloseAssets();});
 document.addEventListener('keydown',e=>{
  if(e.target?.closest?.('.nm-creative-shade,#nm-drawing-toolbar,#nm-ai-studio'))return;if(e.key==='Escape'&&!overlay.classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();this.nm62CloseAssets();}},true);
 return r;};
// Canvas remains scrollable at natural reading size; explicit 'Fit all' command gives overview.
NeuroMapApp.prototype.fitWholeMap=function(){
 const box=this.layout.computeBoundingBox(this.state.images),w=innerWidth,h=innerHeight;
 const z=Math.max(.12,Math.min(1.5,(w-(w>850?190:45))/Math.max(1,box.width+60),(h-(h>650?230:150))/Math.max(1,box.height+60)));
 this.renderer.camera.zoom=z;this.renderer.camera.x=w/2-(box.minX+box.maxX)/2*z;this.renderer.camera.y=h/2-(box.minY+box.maxY)/2*z+22;
 this.updateStatus();this.requestRender();this.positionEditor();
};

