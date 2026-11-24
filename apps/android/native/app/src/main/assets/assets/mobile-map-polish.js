/* Glauka Android touch-native equivalent of desktop node style finishing.
 * Uses shared, release-pinned map-style-core.js. No desktop Orbit, hover-only
 * UX, external images, network calls or WebView token access.
 */
(function(root){
 'use strict';
 const KEY='gl_android_theme_finishes_v1';
 const doc=root.document;
 if(!doc)return;
 const Core=()=>root.NeuroMapMapStyleCore;
 const COLORS=Object.freeze({
  prisma:['#7651e7','#c062ee','#f1a453'],
  default:['#6366f1','#8b5cf6','#f59e0b'],
  neon:['#37c5df','#e16be4','#fbbe55'],
  forest:['#38a879','#8ebd4a','#61a5d9'],
  ocean:['#43a5d6','#5c7ff3','#4fbec3'],
  sunset:['#f28e55','#eabd52','#c66ea0']
 });
 const SHAPES=Object.freeze([
  ['plain','Senza contorno','No border'],
  ['card','Riquadro','Card'],
  ['pill','Pillola','Pill'],
  ['outline','Solo bordo','Outline'],
  ['glass','Vetro','Glass'],
  ['hex','Esagono','Hexagon'],
  ['circuit','Circuito','Circuit']
 ]);
 let sheet=null,previousFocus=null,sheetMode="map";
 const en=()=>doc.documentElement.lang==='en';
 const tr=(it,english)=>root.GlaukaI18n?.pair(it,english)||(en()?english:it);
 const el=(tag,cls,text)=>{
  const element=doc.createElement(tag);
  if(cls)element.className=cls;
  if(text!==undefined)element.textContent=text;
  return element;
 };
 function prefs(){
  try{
   const o=JSON.parse(root.localStorage?.getItem(KEY)||'{}');
   return {
    theme:['light','dark'].includes(o?.theme)?o.theme:'light',
    accent:['violet','cyan','amber'].includes(o?.accent)?o.accent:'violet',
    density:['comfortable','compact'].includes(o?.density)?o.density:'comfortable'};
  }catch{return {theme:'light',accent:'violet',density:'comfortable'}}
 }
 function finishing(next){
  const values={...prefs(),...next};
  if(!['light','dark'].includes(values.theme)||!['violet','cyan','amber'].includes(values.accent)||!
   ['comfortable','compact'].includes(values.density))return;
  doc.body.dataset.glAndroidTheme=values.theme;
  doc.body.dataset.glAndroidAccent=values.accent;
  doc.body.dataset.glAndroidDensity=values.density;
  try{root.localStorage?.setItem(KEY,JSON.stringify(values))}catch{}
 }
 function target(mode){
  const app=root.neuroMapApp,state=app?.state;
  if(!app||!state?.root||!app.activeTabId)return null;
  const ids=Array.isArray(state.selectedNodeIds)&&state.selectedNodeIds.length?
    state.selectedNodeIds:[state.selectedNodeId];
  const unique=[...new Set(ids)].filter(id=>mode==='node'||id!==state.root.id)
    .map(id=>state.findNode(id)).filter(Boolean);
  // Root selection can still browse map presets and theme finishing.
  return {app,state,tab:app.activeTabId,nodes:unique};
 }
 function fresh(t){
  return root.neuroMapApp===t.app&&t.app.state===t.state&&
    t.app.activeTabId===t.tab&&(t.selectionId==null||t.state.selectedNodeId===t.selectionId)&&t.nodes.every(n=>t.state.findNode(n.id)===n);
 }
 function shapeOne(t,shape){
  if(!t.nodes.length||!Core()?.SHAPES.includes(shape)||!fresh(t))return false;
  const changed=t.nodes.filter(n=>(n.nodeShape||'plain')!==shape);
  if(!changed.length)return false;
  t.state.pushHistory();
  for(const n of changed)n.nodeShape=shape;
  t.app.markChanged();t.app.scheduleSave?.();
  return true;
 }
 function mapPreset(t,preset){
  const core=Core();
  if(!core?.valid(preset)||!fresh(t))return false;
  const changed=core.apply(t.state,preset,'map',COLORS);
  if(!changed)return false;
  t.app.markChanged();t.app.scheduleSave?.();
  return true;
 }
 function mini(p,colors=COLORS.prisma){
  // The same node shapes and branch styles used in the actual canvas.
  const NS='http://www.w3.org/2000/svg',svg=doc.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','0 0 185 86');svg.setAttribute('aria-hidden','true');
  const put=(tag,props,text)=>{
   const e=doc.createElementNS(NS,tag);
   Object.entries(props).forEach(([k,v])=>e.setAttribute(k,String(v)));
   if(text!==undefined)e.textContent=text;svg.append(e);
  };
  put('rect',{x:0,y:0,width:185,height:86,rx:10,fill:'#19233b'});
  const palette=colors?.length?colors:COLORS.prisma;
  const line=(endY,c,level)=>{
   const circuit=['thickparents'].includes(p.branchStyle);
   const d=circuit?'M54 43 H76 V'+endY+' H96':
    'M54 43 C75 43 76 '+endY+' 96 '+endY;
   const base=p.branchStyle==='simple'?1.3:
    p.branchStyle==='buzan'||p.branchStyle==='thickparents'?3.2:2.3;
   put('path',{d,fill:'none',stroke:c,'stroke-width':(base*(p.strokeScale||1)*(level?.68:1)).toFixed(2),
    'stroke-linecap':'round'});
  };
  line(21,palette[0],false);line(64,palette[1]||palette[0],true);
  const entries=[
   [7,32,52,23,'IDEA',palette[0]],
   [95,11,78,22,'Tema',palette[1]||palette[0]],
   [95,53,78,22,'Ramo',palette[2]||palette[0]]
  ];
  for(const [x,y,w,h,label,color]of entries){
   if(p.nodeShape==='plain'){
    put('path',{d:'M'+x+' '+(y+h-2)+' H'+(x+w),stroke:color,'stroke-width':1.3});
   }else if(['hex','circuit'].includes(p.nodeShape)){
    const cut=p.nodeShape==='hex'?9:5;
    const pts=p.nodeShape==='hex'?
     [[x+cut,y],[x+w-cut,y],[x+w,y+h/2],[x+w-cut,y+h],[x+cut,y+h],[x,y+h/2]]:
     [[x+cut,y],[x+w-cut,y],[x+w,y+cut],[x+w,y+h-cut],[x+w-cut,y+h],
      [x+cut,y+h],[x,y+h-cut],[x,y+cut]];
    put('polygon',{points:pts.map(p=>p.join(',')).join(' '),
     fill:'#273b58',stroke:color,'stroke-width':1.2});
   }else{
    put('rect',{x,y,width:w,height:h,rx:p.nodeShape==='pill'?h/2:
     p.nodeShape==='glass'?10:4,fill:p.nodeShape==='outline'?'#142039':'#263a55',
     stroke:color,'stroke-width':p.nodeShape==='outline'?1.8:1});
   }
   put('text',{x:x+w/2,y:y+h/2+3.5,'text-anchor':'middle',
    fill:'#f5f7ff','font-size':10,'font-weight':Math.max(400,p.weight||500),
    'font-family':'system-ui,sans-serif'},label);
  }
  return svg;
 }
 function close(){
  if(!sheet)return;
  const focus=previousFocus;
  sheet.remove();sheet=null;previousFocus=null;
  if(focus?.isConnected)focus.focus({preventScroll:true});
 }
 function sectionTitle(it,english){
  const h=el('h3','gl-android-style-heading',tr(it,english));return h;
 }
 function nodeControls(t){
  const box=el('div','gl-node-format-controls'),node=t.nodes[0],selected=node.id;
  const field=(it,en,input)=>{const label=el('label','',tr(it,en));input.setAttribute('aria-label',tr(it,en));label.append(input);box.append(label);return input;};
  const scope=el('select');
  for(const [value,it,en]of [['node','Solo questo concetto','Only this concept'],['branch','Ramo e sottorami','Branch and child branches']]){const option=el('option','',tr(it,en));option.value=value;scope.append(option);}scope.value='node';field('Applica a','Apply to',scope);
  const original=[...t.nodes];
  scope.addEventListener('change',()=>{const stack=[...original],seen=new Set();t.nodes=[];while(stack.length){const n=stack.pop();if(seen.has(n.id))continue;seen.add(n.id);t.nodes.push(n);if(scope.value==='branch')stack.push(...(n.children||[]));}});
  const apply=(key,value)=>{
   if(!fresh(t)||t.state.selectedNodeId!==selected)return;
   const changed=t.nodes.filter(n=>n[key]!==value);if(!changed.length)return;
   t.state.pushHistory();for(const n of changed)n[key]=value;t.app.markChanged();t.app.scheduleSave?.();
  };
  const family=el('select');for(const name of root.GlaukaNodeText?.FONTS||['Inter','Arial','Verdana','Georgia','Times New Roman','Courier New']){const option=el('option','',name);option.value=name;family.append(option);}family.value=node.fontFamily||'Inter';field('Carattere','Font',family);family.addEventListener('change',()=>apply('fontFamily',family.value));
  const size=el('input');size.type='number';size.min='9';size.max='48';size.step='0.5';size.value=node.fontSize??'';size.placeholder=tr('Automatico','Automatic');field('Dimensione del testo','Text size',size);size.addEventListener('change',()=>{const n=Number(size.value);if(size.value==='')apply('fontSize',null);else if(Number.isFinite(n)&&n>=9&&n<=48)apply('fontSize',n);});
  const toolbar=el('div','gl-node-word-toolbar');toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label',tr('Stile del testo','Text style'));
  const fontRow=el('div','gl-node-font-row');fontRow.append(family.parentElement,size.parentElement);toolbar.append(fontRow);box.append(toolbar);
  const emphasis=el('div','gl-node-emphasis');
  for(const [key,it,en,on,off]of [['fontWeight','Grassetto','Bold',700,400],['fontItalic','Corsivo','Italic',true,false],['fontUnderline','Sottolineato','Underline',true,false],['fontStrike','Barrato','Strikethrough',true,false]]){
   const button=el('button','gl-format-'+key,({fontWeight:'B',fontItalic:'I',fontUnderline:'U',fontStrike:'S'})[key]);button.type='button';button.title=tr(it,en);button.setAttribute('aria-label',tr(it,en));button.setAttribute('aria-pressed',String(node[key]===on));button.addEventListener('click',()=>{const next=t.nodes.every(n=>n[key]===on)?off:on;apply(key,next);button.setAttribute('aria-pressed',String(next===on));});emphasis.append(button);
  }toolbar.append(emphasis);
  for(const [key,it,en,fallback]of [['fontColor','Colore del testo','Text color','#302046'],['color','Colore del ramo','Branch color','#7651e7']]){const input=el('input');input.type='color';input.value=/^#[a-f0-9]{6}$/i.test(node[key]||'')?node[key]:fallback;field(it,en,input);input.addEventListener('change',()=>{if(/^#[a-f0-9]{6}$/i.test(input.value))apply(key,input.value);});}
  const colors=el('div','gl-node-color-row');for(const input of box.querySelectorAll('input[type=color]'))colors.append(input.parentElement);toolbar.append(colors);
  const automatic=el('button','gl-node-auto-color','A↺');automatic.title=tr('Colore del testo automatico','Automatic text color');automatic.setAttribute('aria-label',automatic.title);automatic.type='button';automatic.addEventListener('click',()=>apply('fontColor',null));colors.append(automatic);
  const align=el('select');for(const [value,it,en]of [['left','Sinistra','Left'],['center','Centro','Center'],['right','Destra','Right']]){const option=el('option','',tr(it,en));option.value=value;align.append(option);}align.value=node.labelAlign||'center';field('Allineamento del testo','Text alignment',align);align.addEventListener('change',()=>apply('labelAlign',align.value));
  const paragraph=el('div','gl-node-paragraph-row');toolbar.append(paragraph);const alignLabel=align.parentElement;alignLabel.hidden=true;
  const alignment=el('div','gl-node-align-buttons');alignment.setAttribute('role','group');alignment.setAttribute('aria-label',tr('Allineamento del testo','Text alignment'));
  for(const [value,it,en]of [['left','Sinistra','Left'],['center','Centro','Center'],['right','Destra','Right']]){const b=el('button','gl-align-'+value);b.type='button';b.title=tr(it,en);b.setAttribute('aria-label',tr(it,en));b.setAttribute('aria-pressed',String(align.value===value));for(let i=0;i<4;i++)b.append(el('i'));b.addEventListener('click',()=>{apply('labelAlign',value);align.value=value;for(const other of alignment.children)other.setAttribute('aria-pressed',String(other===b));});alignment.append(b);}paragraph.append(alignment);
  const lists=el('select');for(const [value,it,en]of [['none','Senza elenco','No list'],['disc','Punti','Bullets'],['number','Numeri','Numbers'],['letter','Lettere','Letters']]){const option=el('option','',tr(it,en));option.value=value;lists.append(option);}lists.value='none';field('Elenco','List',lists);paragraph.append(lists.parentElement);lists.addEventListener('change',()=>{
   if(!fresh(t)||t.state.selectedNodeId!==selected||!root.NeuroMapCaption)return;
   const changes=t.nodes.map(n=>[n,root.NeuroMapCaption.list({text:String(n.text||''),spans:[]},lists.value).text]).filter(([n,text])=>n.text!==text);if(!changes.length)return;t.state.pushHistory();for(const [n,text]of changes)n.text=text;t.app.markChanged();t.app.scheduleSave?.();
  });
  return box;
 }
 function open(mode="map"){
  if(typeof mode!=="string")mode="map";
  if(sheet){close();return}
  const t=target(mode);
  if(t&&mode==="node"){t.selectionId=t.state.selectedNodeId;t.nodes=[t.state.findNode(t.state.selectedNodeId)].filter(Boolean);if(!t.nodes.length)return;}
  if(!t||!Core())return;
  previousFocus=doc.activeElement;
  const overlay=el('div','gl-android-style-overlay'+(mode==='interface'?' gl-interface-preview':''));
  overlay.id='gl-android-style-overlay';
  const panel=el('section','gl-android-style-sheet');
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  const title=el('h2','',mode==='node'?tr('Formato del concetto','Concept formatting'):mode==='interface'?tr('Aspetto dell’interfaccia','Interface appearance'):tr('Aspetto della mappa','Map appearance'));
  title.id='gl-android-style-title';panel.setAttribute('aria-labelledby',title.id);
  const exit=el('button','gl-android-style-close',tr('Chiudi','Close'));
  exit.type='button';exit.addEventListener('click',close);
  const heading=el('header','gl-android-style-head');
  heading.append(title,exit);
  const scroll=el('div','gl-android-style-scroll');
  const intro=el('p','gl-android-style-note',tr(
   mode==='node'?'Le modifiche riguardano solo il concetto scelto. Puoi includere i suoi sottorami.':'Queste impostazioni riguardano la mappa o l’interfaccia, non il singolo concetto.',
   mode==='node'?'Changes affect only this concept. You can include its child branches.':'These settings affect the map or interface, not an individual concept.'));
  scroll.append(intro);
  if(mode==='node'){
  if(t.nodes.length){const label=el('p','gl-node-format-target',t.nodes[0].text);label.setAttribute('data-glauka-user-content','');scroll.append(label,nodeControls(t));}
  if(t.nodes.length)scroll.append(sectionTitle('Contorno del ramo selezionato','Selected branch outline'));
  const shapes=el('div','gl-android-style-shapes');
  for(const [shape,it,english] of SHAPES){
   const b=el('button','gl-android-shape-button',tr(it,english));b.type='button';
   b.dataset.shape=shape;
   b.setAttribute('aria-pressed',String(t.nodes.every(n=>(n.nodeShape||'plain')===shape)));
   b.addEventListener('click',()=>{if(fresh(t)){shapeOne(t,shape);close()}});
   shapes.append(b);
  }
  if(t.nodes.length)scroll.append(shapes);
  }
  if(mode==='map'){
  scroll.append(sectionTitle('Galleria stili della mappa','Map style gallery'));
  const presetList=el('details','gl-android-style-picker');
  presetList.id='gl-android-map-style-picker';
  const presetSummary=el('summary','gl-android-style-trigger');
  const selected=Core().PRESETS.find(p=>p.branchStyle===t.state.branchStyle&&
    p.palette===t.state.activeThemeId)||Core().sample(t.state,tr('Personalizzato','Custom'))||Core().PRESETS[0];
  const compactPreview=el('span','gl-android-style-current-preview');
  compactPreview.append(mini(selected,COLORS[selected.palette]));
  const currentName=el('span','gl-android-style-current-name',tr(selected.it,selected.en));
  presetSummary.append(compactPreview,currentName);
  presetSummary.setAttribute('aria-label',tr('Scegli stile della mappa, attuale: ','Choose map style, current: ')+tr(selected.it,selected.en));
  presetList.append(presetSummary);
  presetList.append(el('p','gl-android-style-note',tr(
   'Tocca una miniatura per applicarla a tutta la mappa. Una sola operazione Annulla.',
   'Tap a miniature to apply to the entire map. One Undo action.')));
  const grid=el('div','gl-android-style-gallery');
  for(const p of Core().PRESETS){
   const button=el('button','gl-android-style-card');
   button.type='button';button.dataset.preset=p.id;
   button.setAttribute('aria-label',tr(p.it,p.en)+': '+tr('Applica alla mappa','Apply to map'));
   button.append(mini(p,COLORS[p.palette]),el('span','',tr(p.it,p.en)));
   button.addEventListener('click',()=>{if(fresh(t)){mapPreset(t,p);close()}});
   grid.append(button);
  }
  presetList.append(grid);scroll.append(presetList);
  }
  if(mode==='interface'){
  scroll.append(sectionTitle('Finiture dell’interfaccia','Interface finishing'));
  scroll.append(el('p','gl-android-style-note',tr(
   'Modifica solo i comandi del telefono, non le distanze o i colori dei rami.',
   'Changes phone controls only, not branch spacing or map colors.')));
  const settings=el('div','gl-android-style-finishing');
  const makeSelect=(it,english,options,key)=>{
   const label=el('label','',tr(it,english)),select=el('select');
   select.setAttribute('aria-label',tr(it,english));
   for(const [id,itText,enText] of options){
    const option=el('option','',tr(itText,enText));option.value=id;select.append(option);
   }
   select.value=prefs()[key];
   select.addEventListener('change',()=>finishing({[key]:select.value}));
   label.append(select);return label;
  };
  settings.append(
   makeSelect('Tema','Theme',[
    ['light','Chiaro (Prisma)','Light (Prisma)'],['dark','Scuro (Ardesia)','Dark (Slate)']],'theme'),
   makeSelect('Accento','Accent',[
    ['violet','Viola','Violet'],['cyan','Ciano','Cyan'],['amber','Ambra','Amber']],'accent'),
   makeSelect('Spaziatura','Spacing',[
    ['comfortable','Spaziosa','Comfortable'],['compact','Compatta','Compact']],'density'));
  scroll.append(settings);
  }
  panel.append(heading,scroll);overlay.append(panel);
  root.NeuroMapCreativeModules?.ui.makeCollapsible(overlay,panel,heading);
  overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close()});
  overlay.addEventListener('keydown',e=>{
   if(e.key==='Escape'||e.key==='BrowserBack'){e.preventDefault();close();return}
   if(e.key==='Tab'){
    const candidates=[...panel.querySelectorAll('button,select,input')].filter(b=>!b.disabled);
    if(!candidates.length)return;
    const first=candidates[0],last=candidates[candidates.length-1];
    if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first.focus()}
   }
  });
  sheetMode=mode;sheet=overlay;doc.body.append(overlay);exit.focus({preventScroll:true});
 }
 function install(){
  if(!doc.body||!Core())return;
  finishing({});
  // The full map gallery is accessible from the Style inspector even if
  // a user has not selected an individual branch.
  const inspector=doc.getElementById('inspector-sidebar');
  if(inspector&&!doc.getElementById('gl-android-open-style')){
   const launcher=el('button','gl-android-open-style',tr('Stili della mappa','Map styles'));
   launcher.id='gl-android-open-style';launcher.type='button';
   launcher.addEventListener('click',()=>open('map'));
   const heading=inspector.querySelector(".nm-settings-sticky-header")||inspector.querySelector(".inspector-header");
   if(heading)heading.after(launcher);else inspector.append(launcher);
  }
  const refreshLanguage=()=>{
   const launcher=doc.getElementById('gl-android-open-style');
   if(launcher)launcher.textContent=tr('Stili della mappa','Map styles');
   if(sheet){const mode=sheetMode;close();open(mode)}
  };
  doc.addEventListener('nm:language-change',refreshLanguage);
  root.addEventListener?.('glauka:language-change',refreshLanguage);
  root.GlaukaAndroidStylePanel=Object.freeze({open,openNode:()=>open('node'),openInterface:()=>open('interface'),close,prefs,shapeOne,mapPreset});
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
})(globalThis);
