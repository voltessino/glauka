/* Linked desktop views: one editable tree, multiple presentations, typed process flows. */
(function(root){
'use strict';
const core=root.NeuroMapViewCore;
const flows=root.NeuroMapFlowCore;
const work=root.NeuroMapWorkCore;
const network=root.NeuroMapConceptNetwork;
const guided=root.NeuroMapGuidedFlow;
const appearance=root.NeuroMapViewAppearance;
const TYPE=[['mindmap','Mappa mentale','Mind map'],['orgchart','Organigramma','Organization chart'],['concept-tree','Albero concettuale','Concept tree'],['concept-network','Rete concettuale','Concept network'],['flowchart','Flusso di lavoro','Workflow'],['kanban','Bacheca Kanban','Kanban board'],['timeline','Linea del tempo','Timeline']];
const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
function mixHex(from,to,amount){
  const channel=hex=>{
    const match=/^#([0-9a-f]{6})$/i.exec(String(hex||'').trim());
    if(!match)return null;
    const value=parseInt(match[1],16);
    return [(value>>16)&255,(value>>8)&255,value&255];
  };
  const a=channel(from),b=channel(to);
  if(!a||!b)return from||to||'#ffffff';
  const t=Math.max(0,Math.min(1,Number(amount)||0));
  const part=i=>Math.round(a[i]+(b[i]-a[i])*t).toString(16).padStart(2,'0');
  return '#'+part(0)+part(1)+part(2);
}
// The map background (Sfondo) is the only theme for every view until a
// document explicitly stores a per-view appearance. Default matches startup.
function chosenCanvasTheme(){
  const themes=root.NeuroMapThemePicker?.themes;
  const node=document.documentElement;
  const id=node?.dataset?.nm615Theme||node?.dataset?.nmTheme||'';
  if(themes&&themes[id]?.color)return themes[id];
  const marked=!!document.body?.classList?.contains?.('nm615-light')||
    !!document.body?.classList?.contains?.('nm-android-light');
  let color='';
  try{color=root.getComputedStyle?.(node)?.getPropertyValue?.('--bg-canvas')?.trim()||'';}catch{}
  if(/^#[0-9a-f]{6}$/i.test(color)){
    const light=marked||!!appearance?.lightViewCanvas?.({background:color});
    return {color,light,ink:light?'#6441df':'#a99cff'};
  }
  return {color:'#ffffff',light:true,ink:'#6441df'};
}
function mainThemeStyle(mode){
  const theme=chosenCanvasTheme();
  const background=String(theme.color||'#ffffff').toLowerCase();
  const light=!!theme.light||!!appearance?.lightViewCanvas?.({background});
  const accent=/^#[0-9a-f]{6}$/i.test(theme.ink||'')?String(theme.ink).toLowerCase():(light?'#6441df':'#a99cff');
  const style={
    background,
    grid:light?mixHex(background,'#5b6b82',.34):mixHex(background,'#ffffff',.22),
    surface:light?mixHex(background,'#16243d',.045):mixHex(background,'#ffffff',.12),
    edge:light?mixHex(background,'#1e293b',.4):mixHex(background,'#ffffff',.45),
    text:light?'#16243d':'#f4f7ff',
    accent,radius:12,fontSize:12,density:1,preset:'main'
  };
  // F10b: presentation-specific defaults, without changing persisted appearance.
  // All seven views share the canvas palette, but not their visual hierarchy.
  // Explicit per-view user settings still take precedence in viewStyle().
  const presentation={
    mindmap:{radius:12,fontSize:12,density:1},
    orgchart:{radius:10,fontSize:13,density:1},
    'concept-tree':{radius:8,fontSize:13,density:1},
    'concept-network':{radius:14,fontSize:12,density:1},
    flowchart:{radius:9,fontSize:12,density:1},
    kanban:{radius:10,fontSize:13,density:1},
    timeline:{radius:8,fontSize:12,density:1}
  };
  Object.assign(style,presentation[mode]||presentation.mindmap);
  // F10b: derive presentation accents from the *current* canvas theme.
  // No new hard-coded per-view background or persisted user color is introduced.
  // These defaults only apply when the document has no saved appearance for mode.
  switch(mode){
    case 'mindmap':
      style.edge=mixHex(background,accent,light?.58:.7);
      break;
    case 'orgchart':
      style.surface=mixHex(background,accent,light?.065:.16);
      style.edge=mixHex(background,accent,light?.43:.62);
      break;
    case 'concept-tree':
      style.grid=mixHex(background,accent,light?.18:.24);
      style.edge=mixHex(background,accent,light?.48:.65);
      break;
    case 'concept-network':
      style.edge=mixHex(background,accent,light?.66:.8);
      style.grid=mixHex(background,accent,light?.12:.18);
      break;
    case 'flowchart':
      style.edge=mixHex(background,accent,light?.58:.72);
      style.surface=mixHex(background,accent,light?.035:.11);
      break;
    case 'kanban':
      style.surface=mixHex(background,accent,light?.075:.18);
      style.grid=mixHex(background,accent,light?.13:.22);
      break;
    case 'timeline':
      style.grid=mixHex(background,accent,light?.28:.38);
      style.edge=mixHex(background,accent,light?.48:.66);
      break;
  }
  if(mode==='orgchart')style.orientation='vertical';
  if(mode==='timeline')style.timeScale='auto';
  return style;
}
function viewStyle(state,mode,id=null){
  const saved=state?.root?.viewAppearance;
  const modes=saved&&saved.modes;
  if(modes&&Object.prototype.hasOwnProperty.call(modes,mode))
    return appearance?.resolve(saved,mode,id)||null;
  return mainThemeStyle(mode);
}
const PRESET_NAMES=Object.freeze({
  studio:['Studio','Studio'],aurora:['Aurora','Aurora'],paper:['Carta','Paper'],
  graphite:['Grafite','Graphite'],cluster:['Cluster','Cluster'],signal:['Signal','Signal'],
  academic:['Accademico','Academic'],taxonomy:['Tassonomia','Taxonomy'],
  study:['Glauka Study','Glauka Study'],
  'aurora-tree':['Aurora Tree','Aurora Tree'],
  'minimal-taxonomy':['Tassonomia minimal','Minimal Taxonomy'],
  process:['Processo','Process'],blueprint:['Blueprint','Blueprint'],
  'pastel-flow':['Pastello','Pastel Flow'],'dark-logic':['Logica scura','Dark Logic'],
  'task-board':['Task Board','Task Board'],'studio-sprint':['Studio Sprint','Studio Sprint'],
  'soft-saas':['Soft SaaS','Soft SaaS'],'executive-board':['Executive Kanban','Executive Kanban'],
  roadmap:['Roadmap','Roadmap'],history:['Storica','History'],
  'project-plan':['Piano progetto','Project Plan'],milestone:['Milestone','Milestone'],
  corporate:['Corporate','Corporate'],people:['Persone','People'],department:['Reparti','Department'],executive:['Executive','Executive']
});
// One shared palette source for main/split renderer, thumbnails and export.
const NETWORK_CLUSTER_COLORS=appearance.GROUP_COLORS;
const TREE_GROUP_COLORS=appearance.GROUP_COLORS;
const KANBAN_STATUS_COLORS=appearance.KANBAN_STATUS_COLORS;
const kanbanStatusColor=appearance.kanbanStatusColor;
const lightViewCanvas=appearance.lightViewCanvas;
const semanticFlowColor=appearance.semanticFlowColor;
/* @neuromap-linked-view-decorations */
/* @neuromap-linked-view-styles */
/* @neuromap-linked-view-project */
function install(App,State){
  if(!core||!App||!State)throw Error('NeuroMap linked views dependency missing');
  const refresh=new WeakMap();
  const lastView=new WeakMap();
  const lastRenderedState=new WeakMap();
  const linking=new WeakMap();
  const flowPreview=new WeakMap();
  const networkPreview=new WeakMap();
  const sideMode=new WeakMap();
  const sideShift=new WeakMap();
  const viewCameras=new WeakMap();
  const viewCameraKey=(mode,side)=>mode+(side?':side':'');
  const getCamera=(app,mode,side)=>{
    const state=app.state,key=viewCameraKey(mode,side);
    let views=viewCameras.get(state);if(!views){views=new Map();viewCameras.set(state,views)}
    if(!views.has(key)){
      const prefs=workspacePref(app);
      if(!prefs.cameras||typeof prefs.cameras!=='object')prefs.cameras={};
      const restored=prefs.cameras[key];
      const valid=restored&&Number.isFinite(restored.zoom)&&restored.zoom>=.02&&restored.zoom<=3.5&&
        Number.isFinite(restored.left)&&restored.left>=0&&Number.isFinite(restored.top)&&restored.top>=0;
      const cam=valid?{zoom:restored.zoom,left:restored.left,top:restored.top}:
        {zoom:1,left:null,top:null};
      views.set(key,cam);
      prefs.cameras[key]=cam;
    }
    return views.get(key);
  };
  const activeCamera=app=>getCamera(app,displayMode(app.state),sideMode.has(app.state)&&core.mode(app.state.root?.viewMode)==='mindmap');
  const cameraSave=app=>app.scheduleSave?.();
  // Commit pending native scroll positions before changing the selected
  // presentation or tab; scroll events can otherwise arrive after the switch.
/* @neuromap-linked-view-camera-workspace */
/* @neuromap-linked-view-ensure */
/* @neuromap-linked-view-toolbars */
/* @neuromap-linked-view-export */
/* @neuromap-linked-view-runtime */

}
root.NeuroMapLinkedViewsInstall=install;
})(globalThis);
