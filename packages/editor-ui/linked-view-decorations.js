function kanbanDateCaption(node){
  const from=node.startDate,to=node.dueDate;
  if(from&&to)return from+' → '+to;
  if(from)return tr('Dal ','From ')+from;
  if(to)return tr('Entro ','Due ')+to;
  return '';
}
function decorateKanbanCard(card,mode,node){
  if(mode!=='kanban')return;
  card.classList.add('nm-kanban-card');
  card.dataset.status=Object.prototype.hasOwnProperty.call(KANBAN_STATUS_COLORS,node.status)?
    node.status:'unassigned';
  card.style.setProperty?.('--nm-kanban-status',kanbanStatusColor(card.dataset.status));
  const date=kanbanDateCaption(node);
  const names={
    unassigned:['Da classificare','Unassigned'],
    todo:['Da fare','To do'],doing:['In corso','In progress'],done:['Completato','Done']
  };
  const status=card.dataset.status;
  card.setAttribute('aria-label',String(node.text||'')+' · '+tr(...names[status])+
    ' · '+tr('Posizione ','Position ')+String((node.row||0)+1)+(date?' · '+date:''));
  if(date){
    const span=document.createElement('span');
    span.className='nm-kanban-date';span.dataset.glaukaUserContent='';
    span.textContent=date;span.title=date;card.append(span);
  }
}
function timelineDateCaption(node){
  return node.startDate&&node.dueDate&&node.startDate!==node.dueDate?
    node.startDate+' → '+node.dueDate:node.startDate||node.dueDate||'';
}
function addTimelineTitle(stage,node,style){
  const title=document.createElement('div');title.className='nm-timeline-title';
  title.style.top=node.y+'px';title.style.color=style?.text||'#dae5f4';
  // Timeline titles sit outside the card, so card font rules do not reach them.
  // Respect the same view-level typography token used by other view labels.
  if(Number.isFinite(style?.fontSize))title.style.fontSize=style.fontSize+'px';
  const text=document.createElement('span');
  text.dataset.glaukaUserContent='';text.textContent=node.text;
  const date=document.createElement('small');date.className='nm-timeline-date';
  date.textContent=timelineDateCaption(node);
  title.title=node.path||node.text;title.append(text,date);
  if(node.startGroupCount>1){
    const nearby=document.createElement('small');
    nearby.className='nm-timeline-concurrent';
    nearby.textContent=String(node.startGroupIndex+1)+'/'+String(node.startGroupCount);
    nearby.setAttribute('aria-label',tr('Evento ','Event ')+nearby.textContent+
      tr(' nello stesso giorno',' starting on the same day'));
    title.append(nearby);
  }
  stage.append(title);
  return title;
}
function drawKanbanDecorations(svg,node,style){
  const NS='http://www.w3.org/2000/svg';
  const band=document.createElementNS(NS,'rect');
  band.setAttribute('x',String(node.x-node.w/2+6));
  band.setAttribute('y',String(node.y-node.h/2+3));
  band.setAttribute('width',String(node.w-12));
  band.setAttribute('height','3');band.setAttribute('rx','2');
  band.setAttribute('data-kanban-ribbon',node.status||'unassigned');
  band.setAttribute('fill',kanbanStatusColor(node.status));
  svg.append(band);
  const date=kanbanDateCaption(node);
  if(!date)return;
  const text=document.createElementNS(NS,'text');
  text.textContent=date;
  text.setAttribute('x',String(node.x));
  text.setAttribute('y',String(node.y+node.h/2-12));
  text.setAttribute('font-family','system-ui,Arial,sans-serif');
  text.setAttribute('font-size','10');
  text.setAttribute('font-weight','600');
  text.setAttribute('text-anchor','middle');
  text.setAttribute('fill',style?.text||'#eff6ff');
  svg.append(text);
}
// F10: presentation-only organizational identity, never a fabricated
// employee photo or role. Unicode code points keep initials intact on WebView.
function orgCardInitials(text){
  const words=String(text||'').trim().split(/\s+/u).filter(Boolean);
  if(!words.length)return '•';
  const first=value=>Array.from(value)[0]||'';
  return Array.from(
    (first(words[0])+(words.length>1?first(words[words.length-1]):''))
      .toLocaleUpperCase()).slice(0,2).join('');
}
function hiddenDirectChildCount(node){
  // Direct collapsed children only — never a synthetic descendant total.
  const count=Number(node?.hiddenChildren);
  return Number.isFinite(count)&&count>0?Math.floor(count):0;
}
function formatHiddenBadge(count){
  const n=hiddenDirectChildCount({hiddenChildren:count});
  if(n<=0)return '';
  return n>99?'99+':'+'+n;
}
function hiddenChildrenCaption(count){
  const n=hiddenDirectChildCount({hiddenChildren:count});
  if(n<=0)return '';
  return n+' '+tr(n===1?'figlio nascosto':'figli nascosti',
    n===1?'hidden child':'hidden children');
}
function orgCardChildCount(node){
  // Collapsed direct children remain genuine data, not a synthetic count.
  return Math.max(node?.childIds?.length||0,hiddenDirectChildCount(node));
}
function orgCardCaption(node){
  const hidden=hiddenDirectChildCount(node);
  if(hidden)return tr('Liv. ','Level ')+String(node.depth||0)+' · '+hiddenChildrenCaption(hidden);
  const count=orgCardChildCount(node);
  return tr('Liv. ','Level ')+String(node.depth||0)+
    (count?' · '+count+' '+tr(count===1?'ramo':'rami',count===1?'branch':'branches'):'');
}
function appendHiddenChildrenBadge(card,node){
  const count=hiddenDirectChildCount(node);
  if(!card||count<=0)return null;
  const badge=document.createElement('span');
  badge.className='nm-hierarchy-hidden-badge';
  badge.textContent=formatHiddenBadge(count);
  const caption=hiddenChildrenCaption(count);
  badge.title=caption;badge.setAttribute('aria-label',caption);
  card.append(badge);return badge;
}
function decorateCollapseControl(button,collapsed,nodeText){
  if(!button)return;
  button.replaceChildren();
  const chevron=document.createElement('span');
  chevron.className='nm-view-collapse-chevron';
  chevron.setAttribute('aria-hidden','true');
  chevron.textContent='▾';
  button.append(chevron);
  button.classList.toggle('is-collapsed',!!collapsed);
  button.setAttribute('aria-expanded',String(!collapsed));
  button.setAttribute('aria-label',tr(collapsed?'Espandi ramo ':'Comprimi ramo ',
    collapsed?'Expand branch ':'Collapse branch ')+String(nodeText||''));
}
// Only a genuinely attached local raster image may become a small portrait.
function orgAttachedImages(state){
  const result=new Map();
  for(const image of state?.images||[]){
    if(image?.mode!=='attached'||typeof image.attachedNodeId!=='string'||
       result.has(image.attachedNodeId))continue;
    const src=typeof image.src==='string'?image.src:'';
    if(src.length>4_000_000||!/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(src))continue;
    result.set(image.attachedNodeId,src);
  }
  return result;
}
function decorateOrgCard(card,mode,node,imageSrc=''){
  if(mode!=='orgchart')return;
  card.classList.add('nm-orgchart-card');
  card.dataset.orgDepth=String(Math.max(0,Number(node.depth)||0));
  const group=Number.isInteger(node.groupIndex)&&node.groupIndex>=0?
    node.groupIndex:-1;
  if(group>=0)card.dataset.orgGroup=String(group%TREE_GROUP_COLORS.length);
  card.style.setProperty?.('--nm-orgchart-band',group>=0?
    appearance.groupColor(group):appearance.MODE_COLORS.orgchart);
  const useImage=typeof imageSrc==='string'&&
    imageSrc.length<=4_000_000&&/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(imageSrc);
  const mark=document.createElement(useImage?'img':'span');
  mark.className='nm-orgchart-mark';
  if(useImage){
    mark.src=imageSrc;mark.alt='';
    mark.decoding='async';mark.loading='lazy';
    card.dataset.orgMedia='attached';
  }else mark.textContent=orgCardInitials(node.text);
  mark.setAttribute('aria-hidden','true');
  card.append(mark);
  const meta=document.createElement('span');
  meta.className='nm-orgchart-meta';meta.textContent=orgCardCaption(node);
  meta.setAttribute('aria-hidden','true');
  card.append(meta);
  appendHiddenChildrenBadge(card,node);
  card.dataset.orgSearchText=String(node.text||'').toLocaleLowerCase();
  card.setAttribute('aria-label',String(node.text||'')+' · '+orgCardCaption(node));
}
function applyOrgSearch(stage,query){
  if(!stage)return 0;
  const needle=String(query||'').trim().toLocaleLowerCase();
  let matches=0;
  for(const card of stage.querySelectorAll('.nm-orgchart-card')){
    const match=!needle||String(card.dataset.orgSearchText||'').includes(needle);
    card.classList.toggle('nm-orgchart-dimmed',!match);
    if(match)matches++;
  }
  return matches;
}
function decorateTreeCard(card,mode,node,imageSrc=''){
  if(mode!=='concept-tree'||node.depth<1||!Number.isInteger(node.groupIndex)||node.groupIndex<0)return;
  card.classList.add('nm-tree-card');
  const depth=Math.max(0,Number(node.depth)||0);
  card.dataset.depth=appearance.treeDepthBadge(depth);
  card.dataset.treeTier=depth===0?'root':depth===1?'branch':'leaf';
  if(depth>99)card.dataset.depthLong='true';
  if(Number.isInteger(node.groupIndex)&&node.groupIndex>=0){
    card.dataset.group=String(node.groupIndex%TREE_GROUP_COLORS.length);
    card.style.setProperty?.('--nm-tree-group',appearance.groupColor(node.groupIndex));
  }else card.style.setProperty?.('--nm-tree-group',appearance.MODE_COLORS['concept-tree']||'#38bdf8');
  const useImage=typeof imageSrc==='string'&&
    imageSrc.length<=4_000_000&&/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(imageSrc);
  const mark=document.createElement(useImage?'img':'span');
  mark.className='nm-tree-mark';
  if(useImage){
    mark.src=imageSrc;mark.alt='';
    mark.decoding='async';mark.loading='lazy';
    card.dataset.treeMedia='attached';
  }else mark.textContent=orgCardInitials(node.text);
  mark.setAttribute('aria-hidden','true');
  card.append(mark);
  appendHiddenChildrenBadge(card,node);
  const base=card.getAttribute('aria-label')||String(node.text||'');
  const hidden=hiddenChildrenCaption(hiddenDirectChildCount(node));
  card.setAttribute('aria-label',base+' · '+tr('Livello ','Level ')+depth+(hidden?' · '+hidden:''));
}
function drawOrgMarkers(svg,node,style,imageSrc=''){
  const NS='http://www.w3.org/2000/svg';
  const strip=document.createElementNS(NS,'rect');
  const group=Number.isInteger(node.groupIndex)&&node.groupIndex>=0?node.groupIndex:-1;
  strip.setAttribute('x',String(node.x-node.w/2+2));
  strip.setAttribute('y',String(node.y-node.h/2+2));
  strip.setAttribute('width',String(node.w-4));
  strip.setAttribute('height',node.depth===0?'4':'3');
  strip.setAttribute('data-org-band',node.depth===0?'root':'report');
  strip.setAttribute('rx','2.5');
  const accent=group<0?style?.accent||'#60a5fa':TREE_GROUP_COLORS[group%TREE_GROUP_COLORS.length];
  strip.setAttribute('fill',accent);
  svg.append(strip);
  // Mirror the real DOM card: monogram + actual hierarchy level/report count.
  const cx=node.x-node.w/2+23,cy=node.y-5;
  const mark=document.createElementNS(NS,'circle');
  mark.setAttribute('cx',String(cx));mark.setAttribute('cy',String(cy));
  mark.setAttribute('r','14');mark.setAttribute('fill',accent);
  mark.setAttribute('fill-opacity','.24');mark.setAttribute('stroke',accent);
  mark.setAttribute('stroke-opacity','.65');svg.append(mark);
  const initial=document.createElementNS(NS,'text');
  initial.textContent=orgCardInitials(node.text);
  for(const [key,value] of Object.entries({x:cx,y:cy+4,'text-anchor':'middle',
    'font-family':'system-ui,Arial,sans-serif','font-size':12,'font-weight':750,
    fill:style?.text||'#eff6ff'}))initial.setAttribute(key,String(value));
  svg.append(initial);
  if(typeof imageSrc==='string'&&imageSrc.length<=4_000_000&&
     /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(imageSrc)){
    // Rounded clip directly in the exported SVG is reused by PNG/PDF.
    const clipId='nm-org-photo-'+Math.round(cx*10)+'-'+Math.round(cy*10);
    const clip=document.createElementNS(NS,'clipPath');
    clip.setAttribute('id',clipId);
    const circle=document.createElementNS(NS,'circle');
    circle.setAttribute('cx',String(cx));circle.setAttribute('cy',String(cy));
    circle.setAttribute('r','14');clip.append(circle);svg.append(clip);
    const image=document.createElementNS(NS,'image');
    for(const [k,v] of Object.entries({
      x:cx-14,y:cy-14,width:28,height:28,
      'preserveAspectRatio':'xMidYMid slice','clip-path':'url(#'+clipId+')',href:imageSrc
    }))image.setAttribute(k,String(v));
    svg.append(image);
  }
  const footer=document.createElementNS(NS,'text');
  footer.textContent=orgCardCaption(node);
  for(const [key,value] of Object.entries({
    x:node.x-node.w/2+45,y:node.y+node.h/2-8,
    'font-family':'system-ui,Arial,sans-serif','font-size':10,
    'font-weight':500,fill:style?.text||'#eff6ff',opacity:node.depth===0?'.9':'.82'
  }))footer.setAttribute(key,String(value));
  svg.append(footer);
  const hidden=hiddenDirectChildCount(node);
  if(hidden){
    const badge=document.createElementNS(NS,'text');
    badge.textContent=formatHiddenBadge(hidden);
    for(const [key,value] of Object.entries({
      x:node.x+node.w/2-18,y:node.y-node.h/2+16,
      'text-anchor':'middle','font-family':'system-ui,Arial,sans-serif',
      'font-size':10,'font-weight':700,fill:style?.text||'#eff6ff'
    }))badge.setAttribute(key,String(value));
    badge.setAttribute('aria-label',hiddenChildrenCaption(hidden));
    svg.append(badge);
  }
}
function drawTreeMarkers(svg,node,style,imageSrc=''){
  const NS='http://www.w3.org/2000/svg';
  const depth=Math.max(0,Number(node.depth)||0);
  const color=Number.isInteger(node.groupIndex)&&node.groupIndex>=0?
    TREE_GROUP_COLORS[node.groupIndex%TREE_GROUP_COLORS.length]:
    (style?.accent||'#38bdf8');
  if(depth>=1){
    const stripe=document.createElementNS(NS,'rect');
    stripe.setAttribute('x',String(node.x-node.w/2+14));
    stripe.setAttribute('y',String(node.y-node.h/2-4));
    stripe.setAttribute('width',String(Math.max(20,Math.min(96,node.w-62))));
    stripe.setAttribute('height','4');stripe.setAttribute('rx','2');stripe.setAttribute('fill',color);
    const accentBar=document.createElementNS(NS,'rect');
    accentBar.setAttribute('x',String(node.x-node.w/2));
    accentBar.setAttribute('y',String(node.y-node.h/2));
    accentBar.setAttribute('width','3');
    accentBar.setAttribute('height',String(node.h));
    accentBar.setAttribute('fill',color);
    accentBar.setAttribute('opacity',depth===1?'1':'.55');
    accentBar.setAttribute('data-tree-accent',depth===1?'branch':'leaf');
    svg.append(accentBar);
    const circle=document.createElementNS(NS,'circle');
    circle.setAttribute('cx',String(node.x+node.w/2-12));
    circle.setAttribute('cy',String(node.y-node.h/2+1));
    circle.setAttribute('r','10');circle.setAttribute('fill',color);
    circle.setAttribute('stroke',style?.background||'#0d1627');circle.setAttribute('stroke-width','2');
    const label=document.createElementNS(NS,'text');
    label.textContent=appearance.treeDepthBadge(node.depth);
    label.setAttribute('x',String(node.x+node.w/2-12));
    label.setAttribute('y',String(node.y-node.h/2+4));
    label.setAttribute('text-anchor','middle');
    label.setAttribute('font-size',node.depth>99?'8':'10');
    label.setAttribute('font-weight','700');label.setAttribute('fill','#102136');
    label.setAttribute('aria-label',tr('Livello ','Level ')+node.depth);
    svg.append(stripe,circle,label);
  }
  const cx=node.x-node.w/2+18,cy=node.y;
  const mark=document.createElementNS(NS,'rect');
  mark.setAttribute('x',String(cx-12));mark.setAttribute('y',String(cy-12));
  mark.setAttribute('width','24');mark.setAttribute('height','24');
  mark.setAttribute('rx','12');mark.setAttribute('ry','12');mark.setAttribute('fill',color);
  mark.setAttribute('fill-opacity','.22');mark.setAttribute('stroke',color);
  mark.setAttribute('stroke-opacity','.7');svg.append(mark);
  const useImage=typeof imageSrc==='string'&&imageSrc.length<=4_000_000&&
    /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(imageSrc);
  if(useImage){
    const clipId='nm-tree-photo-'+Math.round(cx*10)+'-'+Math.round(cy*10);
    const clip=document.createElementNS(NS,'clipPath');clip.setAttribute('id',clipId);
    const clipCircle=document.createElementNS(NS,'circle');
    clipCircle.setAttribute('cx',String(cx));clipCircle.setAttribute('cy',String(cy));
    clipCircle.setAttribute('r','12');clip.append(clipCircle);svg.append(clip);
    const image=document.createElementNS(NS,'image');
    for(const [k,v] of Object.entries({
      x:cx-12,y:cy-12,width:24,height:24,
      'preserveAspectRatio':'xMidYMid slice','clip-path':'url(#'+clipId+')',href:imageSrc
    }))image.setAttribute(k,String(v));
    svg.append(image);
  }else{
    const initial=document.createElementNS(NS,'text');
    initial.textContent=orgCardInitials(node.text);
    for(const [key,value] of Object.entries({x:cx,y:cy+4,'text-anchor':'middle',
      'font-family':'system-ui,Arial,sans-serif','font-size':10,'font-weight':700,
      fill:style?.text||'#eff6ff'}))initial.setAttribute(key,String(value));
    svg.append(initial);
  }
  const hidden=hiddenDirectChildCount(node);
  if(hidden){
    const badge=document.createElementNS(NS,'text');
    badge.textContent=formatHiddenBadge(hidden);
    for(const [key,value] of Object.entries({
      x:node.x+node.w/2-22,y:node.y+node.h/2-8,
      'text-anchor':'middle','font-family':'system-ui,Arial,sans-serif',
      'font-size':10,'font-weight':700,fill:style?.text||'#eff6ff'
    }))badge.setAttribute(key,String(value));
    badge.setAttribute('aria-label',hiddenChildrenCaption(hidden));
    svg.append(badge);
  }
}
function addFlowArrowMarkers(svg,prefix,style){
  const NS='http://www.w3.org/2000/svg';
  const defs=document.createElementNS(NS,'defs');
  for(const kind of flows.TYPES){
    const marker=document.createElementNS(NS,'marker');
    marker.setAttribute('id',prefix+'-'+kind);
    for(const [key,value]of Object.entries({
      viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'
    }))marker.setAttribute(key,String(value));
    const tip=document.createElementNS(NS,'path');
    tip.setAttribute('d','M0 0 L10 5 L0 10 z');
    tip.setAttribute('fill',semanticFlowColor(kind,style));
    marker.append(tip);defs.append(marker);
  }
  svg.append(defs);
}
function flowArrowId(prefix,kind){return 'url(#'+prefix+'-'+(flows.isFlowKind(kind)?kind:'sequence')+')'}
const FLOW_SHAPE_CHOICES=Object.freeze([
  ['auto','Automatica','Automatic'],['start','Inizio','Start'],
  ['process','Processo','Process'],['decision','Decisione','Decision'],
  ['input','Ingresso','Input'],['output','Uscita','Output'],['end','Fine','End']
]);
function flowShapeLabel(shape){
  const match=FLOW_SHAPE_CHOICES.find(([name])=>name===shape);
  return match?tr(match[1],match[2]):String(shape);
}
function decorateFlowCard(card,mode,node){
  if(mode!=='flowchart')return;
  card.dataset.flowShape=node.shape;
  if(node.io){
    card.classList.add('is-flow-io');
    const role=document.createElement('span');role.className='nm-flow-role-label';
    role.textContent=flowShapeLabel(node.shape);
    role.setAttribute('aria-hidden','true');card.append(role);
    card.setAttribute('aria-label',role.textContent+' · '+node.text);
    return;
  }
  if(!node.terminal)return;
  card.classList.add('is-flow-terminal');
  const role=document.createElement('span');role.className='nm-flow-role-label';
  role.textContent=node.shape==='start'?tr('Inizio','Start'):tr('Fine','End');
  role.setAttribute('aria-hidden','true');card.append(role);
  card.setAttribute('aria-label',role.textContent+' · '+node.text);
  if(node.roleConflict){
    card.classList.add('is-flow-role-conflict');
    const message=node.shape==='start'?
      tr('Un Inizio non dovrebbe avere collegamenti in ingresso','A Start should not have incoming links'):
      tr('Una Fine non dovrebbe avere collegamenti in uscita','An End should not have outgoing links');
    const warning=document.createElement('span');
    warning.className='nm-flow-role-warning';warning.textContent='!';
    warning.title=message;warning.setAttribute('aria-label',message);
    card.append(warning);
    card.setAttribute('aria-label',role.textContent+' · '+node.text+' · '+message);
  }
}
// Warn about intersecting manually placed nodes without ever moving saved data.
// A small spatial index keeps this bounded even for dense imported networks.
function overlappingManualConcepts(nodes){
  const overlapping=new Set(),buckets=new Map();
  for(const n of nodes){
    if(!n.manual||!Number.isFinite(n.x)||!Number.isFinite(n.y))continue;
    const bx=Math.floor(n.x/256),by=Math.floor(n.y/128);
    // One intersecting predecessor is enough to mark this card; stop early
    // so large groups with coincident user coordinates do not scan O(n²).
    scan:for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)
      for(const other of buckets.get((bx+dx)+':'+(by+dy))||[]){
        if(Math.abs(n.x-other.x)<(n.w+other.w)/2&&Math.abs(n.y-other.y)<(n.h+other.h)/2){
          overlapping.add(n.id);overlapping.add(other.id);
          break scan;
        }
      }
    const key=bx+':'+by;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(n);
  }
  return overlapping;
}
function decorateNetworkCard(card,mode,node,overlaps=null){
  if(mode!=='concept-network')return;
  if(overlaps?.has(node.id)){
    const warning=tr('Posizioni manuali sovrapposte: sposta uno dei nodi.',
      'Manually positioned nodes overlap: move one of the nodes.');
    card.classList.add('nm-network-manual-overlap');
    card.setAttribute('aria-label',(card.getAttribute('aria-label')||node.text)+' · '+warning);
    card.title=String(node.text||'')+' · '+warning;
  }
  if(!Number.isInteger(node.clusterIndex)||node.clusterIndex<0)return;
  card.dataset.cluster=String(node.clusterIndex%NETWORK_CLUSTER_COLORS.length);
  card.style.setProperty?.('--nm-network-cluster',appearance.groupColor(node.clusterIndex));
}
function paintViewFrame(scroller,style){
  if(!scroller||!style)return;
  const light=!!appearance?.lightViewCanvas?.(style);
  const edge=light?mixHex(style.background,'#1e293b',.22):mixHex(style.background,'#ffffff',.3);
  const control=light?'#ffffff':mixHex(style.background,'#ffffff',.14);
  const bar=light?mixHex(style.background,'#ffffff',.55):mixHex(style.background,'#000000',.2);
  const muted=mixHex(style.text,style.background,light?0.38:0.28);
  const host=scroller.id==='nm-dual-scroller'
    ?scroller.closest?.('#nm-dual-pane')
    :(scroller.closest?.('#nm-view-overlay')||document.getElementById('nm-view-overlay'));
  if(!host?.style?.setProperty)return;
  host.style.setProperty('--nm-view-control',control);
  host.style.setProperty('--nm-view-control-ink',style.text);
  host.style.setProperty('--nm-view-control-edge',edge);
  host.style.setProperty('--nm-view-bar',bar);
  host.style.setProperty('--nm-view-muted',muted);
  host.style.color=style.text;
  if(scroller.id==='nm-dual-scroller')return;
  host.style.backgroundColor=style.background;
  host.style.borderColor=edge;
  const header=host.querySelector?.('.nm-view-header');
  if(!header)return;
  header.style.backgroundColor=bar;
  header.style.color=style.text;
  header.style.borderBottomColor=edge;
}
function styleScene(scroller,style){
  if(!scroller||!style)return;
  scroller.classList.add('nm-theme-content');
  scroller.style.backgroundColor=style.background;
  scroller.style.backgroundImage='radial-gradient('+style.grid+' 1px, transparent 1px)';
  scroller.style.backgroundSize=appearance.CANVAS_GRID_SIZE+'px '+appearance.CANVAS_GRID_SIZE+'px';
  scroller.style.setProperty?.('--nm-network-label-stroke',style.background);
  scroller.style.setProperty?.('--nm-network-label-fill',style.accent);
  scroller.style.setProperty?.('--nm-network-focus-source',appearance.groupColor(0));
  scroller.style.setProperty?.('--nm-network-focus-target',appearance.groupColor(2));
  paintViewFrame(scroller,style);
}
function styleCard(card,state,mode,node,base=null,elements=null){
  const override=elements&&Object.prototype.hasOwnProperty.call(elements,node.id)?elements[node.id]:null;
  const style=base?(override?{...base,...override}:base):viewStyle(state,mode,node.id);
  if(!style)return;
  const viewEntry=state?.root?.viewAppearance?.modes?.[mode];
  const explicitAccent=viewEntry&&Object.prototype.hasOwnProperty.call(viewEntry,'accent')||
    override&&Object.prototype.hasOwnProperty.call(override,'accent');
  card.style.backgroundColor=style.surface;
  card.style.color=style.text;
  card.style.borderColor=style.accent;
  card.style.borderLeftColor=!explicitAccent&&/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(node.color||'')?
    node.color:style.accent;
  card.style.borderRadius=style.radius+'px';
  card.style.fontSize=style.fontSize+'px';
  if(mode==='flowchart'&&node.decision){
    card.style.setProperty?.('--nm-flow-decision-border',card.style.borderLeftColor||style.accent);
    card.style.setProperty?.('--nm-flow-decision-surface',style.surface);
  }
  if(mode==='flowchart'&&node.io){
    card.style.setProperty?.('--nm-flow-io-border',card.style.borderLeftColor||style.accent);
    card.style.setProperty?.('--nm-flow-io-surface',style.surface);
  }
}

// One semantic label drawing path for primary, split and SVG export.
function updateNetworkLabelVisual(visual,placement){
  if(!visual)return;
  const {plate,label}=visual,hidden=!placement||placement.hidden;
  plate.setAttribute('visibility',hidden?'hidden':'visible');
  label.setAttribute('visibility',hidden?'hidden':'visible');
  if(hidden)return;
  for(const [key,value]of [['x',placement.x-placement.w/2],['y',placement.y-placement.h/2],
    ['width',placement.w],['height',placement.h]])plate.setAttribute(key,String(value));
  label.setAttribute('x',String(placement.x));
  label.setAttribute('y',String(placement.y+4));
}
function describeNetworkEdge(path,edge){
  if(edge?.type!=='relation'||!edge.label)return;
  path.setAttribute('aria-label',edge.label);
  const title=document.createElementNS('http://www.w3.org/2000/svg','title');
  title.textContent=edge.label;path.append(title);
}
function parseCssColorChannels(value){
  const raw=String(value||'').trim();
  const hex=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if(hex){
    const body=hex[1].length===3?hex[1].split('').map(ch=>ch+ch).join(''):hex[1];
    const n=parseInt(body,16);
    return {r:(n>>16)&255,g:(n>>8)&255,b:n&255,a:1};
  }
  const rgb=/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i.exec(raw);
  if(rgb)return {r:Number(rgb[1]),g:Number(rgb[2]),b:Number(rgb[3]),
    a:rgb[4]===undefined?1:Number(rgb[4])};
  return null;
}
function relativeLuminance(channels){
  if(!channels)return 0;
  const channel=v=>{
    const c=Math.max(0,Math.min(255,Number(v)||0))/255;
    return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
  };
  return 0.2126*channel(channels.r)+0.7152*channel(channels.g)+0.0722*channel(channels.b);
}
function contrastRatio(foreground,background){
  const a=relativeLuminance(typeof foreground==='string'?parseCssColorChannels(foreground):foreground);
  const b=relativeLuminance(typeof background==='string'?parseCssColorChannels(background):background);
  const light=Math.max(a,b),dark=Math.min(a,b);
  return (light+0.05)/(dark+0.05);
}
function compositeOver(fg,bg){
  const front=typeof fg==='string'?parseCssColorChannels(fg):fg;
  const back=typeof bg==='string'?parseCssColorChannels(bg):bg;
  if(!front||!back)return back||front;
  const alpha=Math.max(0,Math.min(1,front.a??1));
  return {
    r:front.r*alpha+back.r*(1-alpha),
    g:front.g*alpha+back.g*(1-alpha),
    b:front.b*alpha+back.b*(1-alpha),
    a:1
  };
}
function accessibleNetworkLabelColors(style){
  const canvas=parseCssColorChannels(style?.background)||{r:13,g:22,b:39,a:1};
  let plate=parseCssColorChannels(style?.surface)||{r:27,g:42,b:64,a:1};
  plate={...plate,a:1};
  const composed=compositeOver(plate,canvas);
  const toHex=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  if(style?.text){
    const explicit=parseCssColorChannels(style.text);
    if(explicit && contrastRatio(explicit,composed)>=4.5){
      return {plate:toHex(plate),text:style.text,stroke:style?.edge||'#8295b7',ratio:contrastRatio(explicit,composed)};
    }
  }
  const lightText={r:244,g:247,b:255,a:1};
  const darkText={r:22,g:36,b:61,a:1};
  const light=contrastRatio(lightText,composed);
  const dark=contrastRatio(darkText,composed);
  const text=light>=dark?lightText:darkText;
  let ratio=Math.max(light,dark);
  if(ratio<4.5){
    const plateLum=relativeLuminance(composed);
    plate=plateLum>0.5?{r:248,g:250,b:252,a:1}:{r:15,g:23,b:42,a:1};
    const rebuilt=compositeOver(plate,canvas);
    const light2=contrastRatio(lightText,rebuilt);
    const dark2=contrastRatio(darkText,rebuilt);
    return {
      plate:plateLum>0.5?'#f8fafc':'#0f172a',
      text:light2>=dark2?'#f4f7ff':'#16243d',
      stroke:style?.edge||'#8295b7',
      ratio:Math.max(light2,dark2)
    };
  }
  return {plate:toHex(plate),text:toHex(text),stroke:style?.edge||'#8295b7',ratio};
}
function drawNetworkLabel(svg,edge,placement,style){
  if(!edge?.label)return null;
  const NS='http://www.w3.org/2000/svg';
  const colors=accessibleNetworkLabelColors(style);
  const plate=document.createElementNS(NS,'rect');plate.classList.add('nm-network-label-plate');
  plate.setAttribute('rx','7');plate.setAttribute('fill',colors.plate);
  plate.setAttribute('stroke',colors.stroke);
  plate.setAttribute('stroke-opacity','.9');plate.setAttribute('fill-opacity','1');
  plate.setAttribute('pointer-events','none');
  const label=document.createElementNS(NS,'text');label.classList.add('nm-network-label');
  label.dataset.glaukaUserContent='';
  label.textContent=placement?.text||network.displayLabel(edge.label);
  label.setAttribute('aria-label',edge.label);
  label.setAttribute('text-anchor','middle');label.setAttribute('font-size','12');
  label.setAttribute('font-weight','600');
  label.setAttribute('font-family','system-ui,Arial,sans-serif');
  label.setAttribute('fill',colors.text);label.setAttribute('pointer-events','none');
  const visual={plate,label,fullLabel:edge.label};updateNetworkLabelVisual(visual,placement);
  svg.append(plate,label);return visual;
}
function buildNetworkAdjacency(layout){
  const byNode=new Map(),byEdge=new Map(),cards=new Map(),paths=new Map();
  for(const edge of layout?.edges||[]){
    if(!edge?.id)continue;
    byEdge.set(String(edge.id),edge);
    for(const endpoint of [edge.fromId,edge.toId]){
      if(!byNode.has(endpoint))byNode.set(endpoint,new Set());
      byNode.get(endpoint).add(String(edge.id));
    }
  }
  return {byNode,byEdge,cards,paths};
}
function clearNetworkNeighborhood(stage){
  if(!stage)return;
  stage.classList.remove('nm-network-neighborhood-active');
  for(const card of stage.querySelectorAll('.nm-network-card')){
    card.classList.remove('is-neighborhood-active','is-neighborhood-neighbor','is-neighborhood-dimmed');
  }
  for(const path of stage.querySelectorAll('.nm-network-edge, path')){
    path.classList.remove('is-neighborhood-edge','is-neighborhood-dimmed');
  }
  for(const label of stage.querySelectorAll('.nm-network-label, .nm-network-label-plate'))
    label.classList.remove('is-neighborhood-label');
}
function applyNetworkNeighborhood(stage,index,nodeId){
  if(!stage||!index||!nodeId){clearNetworkNeighborhood(stage);return;}
  const edgeIds=index.byNode.get(nodeId);
  stage.classList.add('nm-network-neighborhood-active');
  const neighborIds=new Set([nodeId]);
  const activeEdges=new Set(edgeIds||[]);
  for(const edgeId of activeEdges){
    const edge=index.byEdge.get(edgeId);
    if(!edge)continue;
    neighborIds.add(edge.fromId);neighborIds.add(edge.toId);
  }
  for(const card of stage.querySelectorAll('.nm-network-card')){
    const id=card.dataset.nodeId;
    card.classList.toggle('is-neighborhood-active',id===nodeId);
    card.classList.toggle('is-neighborhood-neighbor',id!==nodeId&&neighborIds.has(id));
    card.classList.toggle('is-neighborhood-dimmed',!neighborIds.has(id));
  }
  for(const path of stage.querySelectorAll('.nm-network-edge')){
    const id=String(path.dataset.relationId||'');
    const active=activeEdges.has(id);
    path.classList.toggle('is-neighborhood-edge',active);
    path.classList.toggle('is-neighborhood-dimmed',!active);
  }
  for(const path of stage.querySelectorAll('svg path:not(.nm-network-edge)'))
    path.classList.add('is-neighborhood-dimmed');
  for(const edgeId of activeEdges){
    const visual=index.labelByEdge?.get(edgeId);
    if(!visual)continue;
    visual.plate?.classList?.add('is-neighborhood-label');
    visual.label?.classList?.add('is-neighborhood-label');
  }
}
function bindNetworkNeighborhood(stage,layout,netEdges){
  if(!stage||layout?.mode!=='concept-network')return null;
  const index=buildNetworkAdjacency(layout);
  index.labelByEdge=new Map();
  for(const item of netEdges||[]){
    if(item?.edge?.id){
      index.paths.set(String(item.edge.id),item.path);
      if(item.visual)index.labelByEdge.set(String(item.edge.id),item.visual);
    }
  }
  for(const card of stage.querySelectorAll('.nm-network-card'))
    if(card.dataset.nodeId)index.cards.set(card.dataset.nodeId,card);
  stage._nmNeighborhoodIndex=index;
  if(stage._nmNeighborhoodBound)return index;
  const readTarget=event=>{
    const card=event.target?.closest?.('.nm-network-card');
    return card?.dataset?.nodeId||null;
  };
  stage.addEventListener('pointerover',event=>{
    if(stage._nmNetworkDragging)return;
    const id=readTarget(event);
    if(!id||event.target?.closest?.('button,input,textarea'))return;
    applyNetworkNeighborhood(stage,stage._nmNeighborhoodIndex,id);
  });
  stage.addEventListener('pointerout',event=>{
    const next=event.relatedTarget?.closest?.('.nm-network-card');
    if(next&&stage.contains(next))return;
    if(!event.relatedTarget||!stage.contains(event.relatedTarget)||
       !event.relatedTarget.closest?.('.nm-network-card'))
      clearNetworkNeighborhood(stage);
  });
  stage.addEventListener('focusin',event=>{
    const id=readTarget(event);
    if(id)applyNetworkNeighborhood(stage,stage._nmNeighborhoodIndex,id);
  });
  stage.addEventListener('focusout',event=>{
    if(event.relatedTarget&&stage.contains(event.relatedTarget)&&
       event.relatedTarget.closest?.('.nm-network-card'))return;
    clearNetworkNeighborhood(stage);
  });
  stage._nmNeighborhoodBound=true;
  return index;
}
