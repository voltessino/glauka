const cardBox=(card,part)=>{part.style.left=card.x+'px';part.style.top=card.y+'px';part.style.width=card.w+'px';part.style.height=card.h+'px';};
function projectView(state,mode,scopedRoot=null){
  const source=scopedRoot||state.root;
  if(mode==='concept-network')return network.project(source,state.relationships,{density:viewStyle(state,mode)?.density||1});
  if(mode==='flowchart')return flows.project(source,state.relationships,{maxCandidates:1200});
  if(mode==='kanban'||mode==='timeline')return work.project(source,mode,
    mode==='timeline'?{timeScale:viewStyle(state,'timeline')?.timeScale}:{});
  return core.project(source,mode,{maxNodes:2000,orientation:mode==='orgchart'?viewStyle(state,mode)?.orientation:undefined});
}

// Deterministic sample projected by the SAME six view engines used in Glauka.
// These preview nodes are transient, never added to the current document.
// Cache one tiny layout per mode, rather than re-projecting the user's map for
// every color preset or every editor render (potentially thousands of nodes).
const presetPreviewLayouts=new Map();
function presetPreviewLayout(mode){
  if(presetPreviewLayouts.has(mode))return presetPreviewLayouts.get(mode);
  const root={
    id:'preview-root',text:'Idea',children:[
      {id:'preview-plan',text:'Piano',flowShape:'input',taskStatus:'todo',startDate:'2026-11-01',dueDate:'2026-11-04',children:[
        {id:'preview-note',text:'Dettagli',taskStatus:'doing',startDate:'2026-11-03',dueDate:'2026-11-07',children:[]}
      ]},
      {id:'preview-check',text:'Verifica',flowShape:'decision',taskStatus:'doing',startDate:'2026-11-06',dueDate:'2026-11-06',children:[]},
      {id:'preview-finish',text:'Esito',flowShape:'output',taskStatus:'done',startDate:'2026-11-08',dueDate:'2026-11-09',taskDependsOn:['preview-check'],children:[]},
      {id:'preview-other',text:'Alternativa',taskStatus:'todo',startDate:'2026-11-09',dueDate:'2026-11-09',children:[]}
    ]
  };
  const relationships=[
    {id:'preview-e1',fromId:'preview-plan',toId:'preview-check',kind:'sequence'},
    {id:'preview-e2',fromId:'preview-check',toId:'preview-finish',kind:'yes'},
    {id:'preview-e3',fromId:'preview-check',toId:'preview-other',kind:'no'}
  ];
  const layout=projectView({root,relationships},mode);
  presetPreviewLayouts.set(mode,layout);
  return layout;
}
function renderPresetThumbnail(mode,preset){
  const style=appearance.palette(mode,preset);
  const layout=presetPreviewLayout(mode);
  const NS='http://www.w3.org/2000/svg';
  const el=tag=>document.createElementNS(NS,tag);
  const svg=el('svg');
  svg.setAttribute('viewBox','0 0 '+layout.width+' '+layout.height);
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  const rect=(x,y,w,h,fill,stroke=null,radius=0)=>{
    const node=el('rect');
    for(const [name,value] of Object.entries({x,y,width:w,height:h,fill}))
      node.setAttribute(name,String(value));
    if(stroke){node.setAttribute('stroke',stroke);node.setAttribute('stroke-width','2')}
    if(radius)node.setAttribute('rx',String(radius));
    svg.append(node);
    return node;
  };
  rect(0,0,layout.width,layout.height,style.background);
  // The exact dotted-grid design token also drives interactive and exported
  // views. Each preview owns its pattern ID: inline SVG IDs must never collide
  // across presets with different grid colors.
  const gridSize=appearance.CANVAS_GRID_SIZE;
  const gridId='nm-preview-grid-'+mode+'-'+preset;
  const defs=el('defs'),gridPattern=el('pattern'),dot=el('circle');
  gridPattern.setAttribute('id',gridId);
  gridPattern.setAttribute('width',String(gridSize));
  gridPattern.setAttribute('height',String(gridSize));
  gridPattern.setAttribute('patternUnits','userSpaceOnUse');
  dot.setAttribute('cx',String(gridSize/2));dot.setAttribute('cy',String(gridSize/2));
  dot.setAttribute('r','1');dot.setAttribute('fill',style.grid);
  gridPattern.append(dot);defs.append(gridPattern);svg.append(defs);
  const gridOverlay=el('rect');
  for(const [key,value]of Object.entries({
    x:0,y:0,width:layout.width,height:layout.height,fill:'url(#'+gridId+')'
  }))gridOverlay.setAttribute(key,String(value));
  svg.append(gridOverlay);
  if(mode==='kanban'){
    for(const column of layout.columns||[]){
      rect(column.x-column.width/2+5,72,column.width-10,layout.height-92,
        style.surface,style.grid,8);
      rect(column.x-column.width/2+8,78,column.width-16,6,
        kanbanStatusColor(column.id),null,3);
    }
  }
  if(mode==='timeline'){
    for(const tick of (layout.ticks||[]).slice(0,20)){
      const line=el('line');
      line.setAttribute('x1',String(tick.x));line.setAttribute('x2',String(tick.x));
      line.setAttribute('y1','80');line.setAttribute('y2',String(layout.height-12));
      line.setAttribute('stroke',style.edge);line.setAttribute('stroke-opacity','.45');
      svg.append(line);
    }
  }
  const boxes=new Map(layout.nodes.map(node=>[node.id,node]));
  for(const edge of layout.edges){
    const from=boxes.get(edge.fromId),to=boxes.get(edge.toId);
    if(!from||!to)continue;
    const d=mode==='concept-network'?network.path(from,to):
      mode==='flowchart'?flows.path(from,to,edge.kind):
      mode==='timeline'?timelineDependencyPath(from,to):core.path(from,to,mode);
    const line=el('path');
    line.setAttribute('d',d);line.setAttribute('fill','none');
    line.setAttribute('stroke',mode==='flowchart'?semanticFlowColor(edge.kind,style):
      mode==='concept-network'&&edge.type==='relation'?style.accent:style.edge);
    line.setAttribute('stroke-width',edge.type==='relation'?'3':'2');
    svg.append(line);
  }
  for(const node of layout.nodes){
    const isDiamond=(mode==='flowchart'&&node.decision)||
      (mode==='timeline'&&node.milestone);
    const fill=style.surface,stroke=style.accent;
    if(mode==='flowchart'&&node.io){
      const shape=el('polygon');
      shape.setAttribute('points',flows.ioPoints(node).map(([x,y])=>x+','+y).join(' '));
      shape.setAttribute('fill',fill);shape.setAttribute('stroke',stroke);
      shape.setAttribute('stroke-width','2');svg.append(shape);
    }else if(isDiamond){
      const diamond=el('polygon');
      diamond.setAttribute('points',[
        [node.x,node.y-node.h/2],[node.x+node.w/2,node.y],
        [node.x,node.y+node.h/2],[node.x-node.w/2,node.y]
      ].map(([x,y])=>x+','+y).join(' '));
      diamond.setAttribute('fill',fill);diamond.setAttribute('stroke',stroke);
      diamond.setAttribute('stroke-width','2');svg.append(diamond);
    }else rect(node.x-node.w/2,node.y-node.h/2,node.w,node.h,fill,stroke,
      mode==='flowchart'&&node.terminal?node.h/2:style.radius);
    if(mode==='kanban')
      rect(node.x-node.w/2+8,node.y-node.h/2+5,node.w-16,5,
        kanbanStatusColor(node.status),null,2);
    if((mode==='orgchart'||mode==='concept-tree')&&node.groupIndex>=0)
      rect(node.x-node.w/2+7,node.y-node.h/2+5,Math.max(14,node.w-14),5,
        TREE_GROUP_COLORS[node.groupIndex%TREE_GROUP_COLORS.length],null,2);
    const label=el('text');
    label.textContent=Array.from(String(node.text||'')).slice(0,13).join('');
    label.setAttribute('x',String(mode==='timeline'?23:node.x));
    label.setAttribute('y',String(mode==='timeline'?node.y-5:node.y+4));
    label.setAttribute('fill',style.text);
    label.setAttribute('font-family','system-ui,Arial,sans-serif');
    const typography=mode==='concept-tree'?
      appearance.treeTypography(node.depth,style.fontSize):null;
    label.setAttribute('font-size',String(typography?.fontSize??style.fontSize));
    label.setAttribute('font-weight',String(typography?.fontWeight??650));
    if(mode!=='timeline')label.setAttribute('text-anchor','middle');
    svg.append(label);
  }
  return svg;
}

// One calendar axis for the interactive timeline and its standalone SVG.
function timelineScaleHint(layout,dual=false){
 const id=dual?'nm-dual-time-scale-hint':'nm-work-time-scale-hint';
 const hint=document.getElementById(id);if(!hint)return;
 hint.hidden=!layout?.scaleLimited;
 hint.textContent=layout?.scaleLimited?
  tr('Dettaglio adattato al periodo (limite canvas)','Detail adapted to the date range (canvas limit)'):'';
}
function timelineDependencyPath(a,b){
 const x1=a.x+a.w/2+2,y1=a.y,x2=b.x-b.w/2-3,y2=b.y;
 if(x2>x1+36){
   const mid=x1+Math.max(16,Math.min(45,(x2-x1)/2));
   return `M${x1} ${y1} H${mid} V${y2} H${x2}`;
 }
 // Backwards or overlapping predecessors route underneath their two rows,
 // without inventing a chronological direction.
 const detour=Math.max(y1,y2)+36,outer=Math.max(x1,x2)+22,inner=x2-24;
 return `M${x1} ${y1} H${outer} V${detour} H${inner} V${y2} H${x2}`;
}
function timelineDependencyColor(edge,style){
 const light=lightViewCanvas(style);
 return edge.conflict?(light?'#b33058':'#fb7185'):
   (light?'#157354':'#46d2bd');
}
function decorateTimelineDependency(path,edge,from,to,style){
 path.setAttribute('stroke',timelineDependencyColor(edge,style));
 path.setAttribute('stroke-width','2.3');
 if(edge.conflict)path.setAttribute('stroke-dasharray','6 4');
 const title=(from.text||from.id)+' → '+(to.text||to.id)+
  (edge.conflict?tr(' · Possibile conflitto di date',' · Possible date conflict'):'');
 path.setAttribute('aria-label',title);
 const element=document.createElementNS('http://www.w3.org/2000/svg','title');
 element.textContent=title;path.append(element);
}
function timelineAxis(svg,layout,style=null){
  for(const tick of layout.ticks||[]){
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    for(const [key,value]of Object.entries({x1:tick.x,x2:tick.x,y1:78,y2:layout.height-20,stroke:style?.edge||'#64748b','stroke-opacity':'.4','stroke-dasharray':'4 5'}))line.setAttribute(key,String(value));
    const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.textContent=tick.label||tick.date;
    for(const [key,value]of Object.entries({x:tick.x,y:64,fill:style?.text||'#cbd5e1','text-anchor':tick.anchor,'font-size':11,'font-family':'system-ui,Arial,sans-serif'}))text.setAttribute(key,String(value));
    svg.append(line,text);
  }
}
