/* Map-only visual presets. Never read or update UI skin preferences. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.NeuroMapMapStyleCore=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const KEY='nm_map_style_custom_v1';
 const PRESETS=Object.freeze([
  ['prisma','Prisma Vivo','Prisma Vivo','xmind8','pill','prisma',1,400],
  ['organic','Organico','Organic','buzan','pill','forest',1.15,500],
  ['classic','Classico','Classic','xmind8','card','default',1,400],
  ['minimal','Minimal','Minimal','simple','outline','default',.85,400],
  ['futuristic','Futuristico','Futuristic','neon','hex','neon',1.2,600],
  ['neon','Neon','Neon','neon','pill','neon',1.45,600],
  ['glass','Glass','Glass','simple','glass','ocean',.95,400],
  ['circuit','Circuitale','Circuit','thickparents','circuit','ocean',1.2,550],
  ['geometric','Geometrico','Geometric','simple','card','ocean',1.1,500],
  ['cards','Schede','Cards','xmind8','card','ocean',1.05,500],
  ['pills','Pillole','Pills','simple','pill','forest',1.1,500],
  ['outline','Outline','Outline','xmind8','outline','sunset',1,400],
  ['free','Testo libero','Free labels','simple','plain','prisma',.95,400]
 ].map(([id,it,en,branchStyle,nodeShape,palette,strokeScale,weight])=>
  Object.freeze({id,it,en,branchStyle,nodeShape,palette,strokeScale,weight})));
 const SHAPES=Object.freeze(['plain','pill','card','outline','hex','circuit','glass']);
 const BRANCHES=Object.freeze(['buzan','xmind8','simple','neon','thickparents','radial','elbow','straight','arc','dashed','wave','fork']);
 const PALETTES=Object.freeze(['default','neon','forest','sunset','ocean','prisma']);
 const valid=(p)=>!!p&&SHAPES.includes(p.nodeShape)&&BRANCHES.includes(p.branchStyle)&&
  PALETTES.includes(p.palette)&&Number.isFinite(p.strokeScale)&&p.strokeScale>=.5&&p.strokeScale<=2;
 function personal(raw){
  let v=raw;if(typeof v==='string'){try{v=JSON.parse(v)}catch{return null}}
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  const rawName=typeof v.name==='string'?v.name:typeof v.it==='string'?v.it:'';
  const name=rawName.trim().slice(0,42);
  const p={id:'personal',it:name||'Personale',en:name||'Custom',
   branchStyle:v.branchStyle,nodeShape:v.nodeShape,palette:v.palette,
   strokeScale:Number(v.strokeScale),weight:Number(v.weight)};
  return valid(p)&&Number.isFinite(p.weight)&&p.weight>=300&&p.weight<=800?p:null;
 }
 function sample(state,name='Personale'){
  const node=state?.findNode?.(state?.selectedNodeId);
  return personal({name,branchStyle:state?.branchStyle||'xmind8',
   nodeShape:SHAPES.includes(node?.nodeShape)?node.nodeShape:'plain',
   palette:PALETTES.includes(state?.activeThemeId)?state.activeThemeId:'default',
   strokeScale:Number(state?.strokeScale)||1,weight:Number(node?.fontWeight)||400});
 }
 function apply(state,preset,scope='map',paletteMap){
  if(!valid(preset)||!state?.root||typeof state.pushHistory!=='function')return 0;
  const picked=new Set(Array.isArray(state.selectedNodeIds)&&state.selectedNodeIds.length?
    state.selectedNodeIds:[state.selectedNodeId]);
  const colors=paletteMap?.[preset.palette];
  const colorList=Array.isArray(colors)&&colors.length?colors:['#6366f1'];
  const targets=[];
  const stack=[{node:state.root,level:0,color:0}];let scanned=0;
  while(stack.length&&scanned++<15000){
   const item=stack.pop(),n=item.node;if(!n)continue;
   const selected=scope==='selection'?(item.level>0&&picked.has(n.id)):item.level>0;
   if(selected)targets.push({n,color:item.color});
   const children=Array.isArray(n.children)?n.children:[];
   for(let i=children.length-1;i>=0;i--){
    stack.push({node:children[i],level:item.level+1,
     color:item.level===0?i:item.color});
   }
  }
  if(!['map','selection'].includes(scope))return 0;
  if(!targets.length&&scope==='selection')return 0;
  state.pushHistory();
  if(scope!=='selection'){
   state.branchStyle=preset.branchStyle;state.strokeScale=preset.strokeScale;
   state.activeThemeId=preset.palette;
  }
  for(const {n,color} of targets){
   n.nodeShape=preset.nodeShape;n.fontWeight=preset.weight;
   n.color=colorList[color%colorList.length];
  }
  return Math.max(1,targets.length);
 }
 return Object.freeze({KEY,PRESETS,SHAPES,BRANCHES,PALETTES,valid,personal,sample,apply});
});
