/* Glauka linked-view appearance: presentation-only project metadata.
 * Never reads or mutates text, node colors, relationships, or task attributes.
 * Shared by desktop renderer, SVG export and state sanitization.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NeuroMapViewAppearance=api;
})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const MODES=Object.freeze(['orgchart','concept-tree','concept-network','flowchart','kanban','timeline']);
const PRESETS=Object.freeze(['studio','aurora','paper','graphite']);
const NETWORK_PRESETS=Object.freeze(['cluster','signal']);
const TREE_PRESETS=Object.freeze(['academic','taxonomy','study','aurora-tree','minimal-taxonomy']);
const FLOW_PRESETS=Object.freeze(['process','blueprint','pastel-flow','dark-logic']);
const ORG_PRESETS=Object.freeze(['corporate','people','department','executive']);
const KANBAN_PRESETS=Object.freeze(['task-board','studio-sprint','soft-saas','executive-board']);
const TIMELINE_PRESETS=Object.freeze(['roadmap','history','project-plan','milestone']);
function presetsFor(mode){
  if(mode==='concept-network')return [...PRESETS,...NETWORK_PRESETS];
  if(mode==='concept-tree')return [...PRESETS,...TREE_PRESETS];
  if(mode==='flowchart')return [...PRESETS,...FLOW_PRESETS];
  if(mode==='orgchart')return [...PRESETS,...ORG_PRESETS];
  if(mode==='kanban')return [...PRESETS,...KANBAN_PRESETS];
  if(mode==='timeline')return [...PRESETS,...TIMELINE_PRESETS];
  return [...PRESETS];
}
const MODE_COLORS=Object.freeze({
  orgchart:'#60a5fa','concept-tree':'#34d399','concept-network':'#a78bfa',
  flowchart:'#fbbf24',kanban:'#38bdf8',timeline:'#fb7185'
});
/* Shared semantic tokens consumed by live card rendering, split views,
 * thumbnails and SVG/PNG/PDF export. Keep these in ONE place: neither panel
 * CSS nor individual view renderers should duplicate the same hex palettes.
 * Tokens are presentation-only; never persisted on canonical node records.
 */
const GROUP_COLORS=Object.freeze(['#38bdf8','#a78bfa','#34d399','#fbbf24','#fb7185','#2dd4bf']);
const KANBAN_STATUS_COLORS=Object.freeze({
  unassigned:'#94a3b8',todo:'#60a5fa',doing:'#fbbf24',done:'#34d399'
});
const CANVAS_GRID_SIZE=28;
// One typography scale for the concept tree: root > category > concept >
// detail. Apply it in the live renderer, split view, thumbnail and SVG export.
// It derives from the user's view font size and never becomes node metadata.
function treeTypography(depth,fontSize=12){
  const value=Number.isFinite(fontSize)?Math.max(10,Math.min(18,fontSize)):12;
  const level=Number.isSafeInteger(depth)&&depth>=0?depth:0;
  const offset=level===0?2:level===1?1:level===2?0:-1;
  return Object.freeze({
    fontSize:Math.max(10,Math.min(18,value+offset)),
    fontWeight:level===0?750:level===1?700:level===2?600:500
  });
}
// A fixed badge width cannot fit arbitrary depths (e.g. 1000).
// Preserve actual depth for accessibility while bounding visual text.
function treeDepthBadge(depth){
  const value=Number.isSafeInteger(depth)&&depth>=0?depth:0;
  return value>99?'99+':String(value);
}
function groupColor(index){
  return Number.isSafeInteger(index)&&index>=0?GROUP_COLORS[index%GROUP_COLORS.length]:GROUP_COLORS[0];
}
function kanbanStatusColor(value){
  return Object.prototype.hasOwnProperty.call(KANBAN_STATUS_COLORS,value)?
    KANBAN_STATUS_COLORS[value]:KANBAN_STATUS_COLORS.unassigned;
}
function lightViewCanvas(style){
  const raw=style?.background;
  if(typeof raw!=='string'||!/^#[0-9a-f]{6}$/i.test(raw))return false;
  const red=parseInt(raw.slice(1,3),16),green=parseInt(raw.slice(3,5),16),blue=parseInt(raw.slice(5,7),16);
  return .2126*red+.7152*green+.0722*blue>170;
}
function semanticFlowColor(kind,style){
  if(kind!=='yes'&&kind!=='no')return style?.edge||'#8295b7';
  const light=lightViewCanvas(style);
  return kind==='yes'?(light?'#157354':'#34d399'):(light?'#b33058':'#fb7185');
}
const COLOR=/^#[0-9a-f]{6}$/i;
const ID=/^[A-Za-z0-9_:-]{1,140}$/;
const PROPS=Object.freeze(['accent','background','surface','edge','text','radius','fontSize','density','orientation','timeScale']);
const TIME_SCALES=Object.freeze(['auto','days','weeks','months']);
const ELEMENT_PROPS=Object.freeze(['accent','surface','text']);
const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
function color(value){return typeof value==='string'&&COLOR.test(value)?value.toLowerCase():null}
function finite(value,min,max){
  return typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):null;
}
function properties(raw,element=false,mode=null){
  const out={};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  for(const prop of element?ELEMENT_PROPS:PROPS){
    if(!has(raw,prop))continue;
    if(prop==='orientation'){
      if(mode==='orgchart'&&['vertical','horizontal'].includes(raw[prop]))out.orientation=raw[prop];
      continue;
    }
    if(prop==='timeScale'){
      if(mode==='timeline'&&TIME_SCALES.includes(raw[prop]))out.timeScale=raw[prop];
      continue;
    }
    const value=['radius','fontSize','density'].includes(prop)?
      finite(raw[prop],prop==='radius'?4:prop==='fontSize'?10:.85,
        prop==='radius'?24:prop==='fontSize'?18:1.4):color(raw[prop]);
    if(value!==null)out[prop]=value;
  }
  return out;
}
function clean(raw){
  const modes={};
  const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw.modes:null;
  if(!source||typeof source!=='object'||Array.isArray(source))return {version:1,modes};
  for(const mode of MODES){
    if(!has(source,mode))continue;
    const item=source[mode];
    if(!item||typeof item!=='object'||Array.isArray(item))continue;
    const entry={preset:presetsFor(mode).includes(item.preset)?item.preset:'studio',...properties(item,false,mode)};
    const elements={};
    const input=item.elements;
    if(input&&typeof input==='object'&&!Array.isArray(input)){
      for(const id of Object.keys(input).slice(0,200)){
        if(!ID.test(id)||['__proto__','constructor','prototype'].includes(id)||Object.keys(elements).length>=80)continue;
        const props=properties(input[id],true);
        if(Object.keys(props).length)elements[id]=props;
      }
    }
    if(Object.keys(elements).length)entry.elements=elements;
    modes[mode]=entry;
  }
  return {version:1,modes};
}
function update(raw,mode,patch,elementId=null){
  if(!MODES.includes(mode))throw Error('Unsupported linked-view appearance mode');
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Invalid appearance patch');
  const result=clean(raw),entry=result.modes[mode]||{preset:'studio'};
  if(elementId!==null){
    if(typeof elementId!=='string'||!ID.test(elementId)||['__proto__','constructor','prototype'].includes(elementId))throw Error('Invalid appearance node ID');
    const elements={...(entry.elements||{})};
    const next={...(elements[elementId]||{})};
    for(const prop of ELEMENT_PROPS){
      if(!has(patch,prop))continue;
      const parsed=color(patch[prop]);
      if(parsed)next[prop]=parsed;else if(patch[prop]===null)delete next[prop];
    }
    if(Object.keys(next).length)elements[elementId]=next;else delete elements[elementId];
    if(Object.keys(elements).length>80&&!has(entry.elements||{},elementId))throw Error('Too many styled nodes');
    if(Object.keys(elements).length)entry.elements=elements;else delete entry.elements;
  }else{
    if(has(patch,'preset')&&presetsFor(mode).includes(patch.preset))entry.preset=patch.preset;
    for(const prop of PROPS){
      if(!has(patch,prop))continue;
      const next=prop==='orientation'?(mode==='orgchart'&&['vertical','horizontal'].includes(patch[prop])?patch[prop]:null):
        prop==='timeScale'?(mode==='timeline'&&TIME_SCALES.includes(patch[prop])?patch[prop]:null):
        ['radius','fontSize','density'].includes(prop)?
        finite(patch[prop],prop==='radius'?4:prop==='fontSize'?10:.85,
          prop==='radius'?24:prop==='fontSize'?18:1.4):color(patch[prop]);
      if(next!==null)entry[prop]=next;else if(patch[prop]===null)delete entry[prop];
    }
  }
  result.modes[mode]=entry;
  return clean(result);
}
function reset(raw,mode,elementId=null){
  if(!MODES.includes(mode))throw Error('Unsupported linked-view appearance mode');
  const result=clean(raw);
  if(elementId===null){
    delete result.modes[mode];
    return clean(result);
  }
  if(typeof elementId!=='string'||!ID.test(elementId)||
     ['__proto__','constructor','prototype'].includes(elementId))
    throw Error('Invalid appearance node ID');
  const entry=result.modes[mode];
  if(!entry?.elements||!has(entry.elements,elementId))return result;
  delete entry.elements[elementId];
  if(!Object.keys(entry.elements).length)delete entry.elements;
  if(Object.keys(entry).length===1&&entry.preset==='studio')delete result.modes[mode];
  return clean(result);
}
// Remove one explicit override, leaving all unrelated settings and node metadata intact.
function resetProperty(raw,mode,prop,elementId=null){
  if(!MODES.includes(mode))throw Error('Unsupported linked-view appearance mode');
  const allowed=elementId===null?[...PROPS,'preset']:ELEMENT_PROPS;
  if(typeof prop!=='string'||!allowed.includes(prop)||
      (prop==='orientation'&&mode!=='orgchart')||
      (prop==='timeScale'&&mode!=='timeline'))
    throw Error('Unsupported appearance property');
  if(elementId!==null&&(typeof elementId!=='string'||!ID.test(elementId)||
      ['__proto__','constructor','prototype'].includes(elementId)))
    throw Error('Invalid appearance node ID');
  const result=clean(raw),entry=result.modes[mode];
  if(!entry)return result;
  if(elementId!==null){
    if(!entry.elements||!has(entry.elements,elementId))return result;
    delete entry.elements[elementId][prop];
    if(!Object.keys(entry.elements[elementId]).length)delete entry.elements[elementId];
    if(!Object.keys(entry.elements).length)delete entry.elements;
  }else{
    if(!has(entry,prop))return result;
    if(prop==='preset')entry.preset='studio';
    else delete entry[prop];
  }
  if(Object.keys(entry).length===1&&entry.preset==='studio')delete result.modes[mode];
  return clean(result);
}
function palette(mode,preset='studio'){
  const accent=MODE_COLORS[mode]||MODE_COLORS.orgchart;
  if(mode==='timeline'&&preset==='roadmap')return {
    background:'#f3f8fc',grid:'#d5e5f0',surface:'#ffffff',edge:'#7ea3b9',
    text:'#183c55',accent:'#1685b2',radius:10,fontSize:12,density:1.04
  };
  if(mode==='timeline'&&preset==='history')return {
    background:'#fcf7eb',grid:'#e8d9b7',surface:'#fffdf8',edge:'#ae9270',
    text:'#4a3422',accent:'#a76b33',radius:9,fontSize:12,density:1.1
  };
  if(mode==='timeline'&&preset==='project-plan')return {
    background:'#16243a',grid:'#304563',surface:'#243955',edge:'#839ab9',
    text:'#edf6ff',accent:'#58c3d6',radius:9,fontSize:13,density:1.08
  };
  if(mode==='timeline'&&preset==='milestone')return {
    background:'#f8f5ff',grid:'#e3dcf7',surface:'#ffffff',edge:'#a193ba',
    text:'#35264e',accent:'#9563db',radius:15,fontSize:13,density:1.14
  };
  if(mode==='kanban'&&preset==='task-board')return {
    background:'#f3f7fc',grid:'#dbe6f0',surface:'#ffffff',edge:'#8ca0b8',
    text:'#17344f',accent:'#328bc6',radius:12,fontSize:13,density:1.04
  };
  if(mode==='kanban'&&preset==='studio-sprint')return {
    background:'#131d31',grid:'#304666',surface:'#263955',edge:'#7993b0',
    text:'#f4f8ff',accent:'#b197fa',radius:15,fontSize:13,density:1.1
  };
  if(mode==='kanban'&&preset==='soft-saas')return {
    background:'#fcf8ff',grid:'#ebdef2',surface:'#ffffff',edge:'#a2a0b9',
    text:'#342b4c',accent:'#9564c2',radius:18,fontSize:13,density:1.14
  };
  if(mode==='kanban'&&preset==='executive-board')return {
    background:'#101820',grid:'#2d4149',surface:'#1c2e38',edge:'#789fa0',
    text:'#f1faf7',accent:'#59d4ba',radius:8,fontSize:12,density:.94
  };
  if(mode==='orgchart'&&preset==='corporate')return {
    background:'#f3f7fc',grid:'#d9e5f1',surface:'#ffffff',edge:'#7d96b0',
    text:'#173451',accent:'#276da8',radius:12,fontSize:13,density:1.08
  };
  if(mode==='orgchart'&&preset==='people')return {
    background:'#fff8f5',grid:'#f0e1d8',surface:'#ffffff',edge:'#ae968f',
    text:'#402e34',accent:'#c06c80',radius:18,fontSize:13,density:1.14
  };
  if(mode==='orgchart'&&preset==='department')return {
    background:'#eff9f6',grid:'#d7ede5',surface:'#ffffff',edge:'#729c90',
    text:'#173f3e',accent:'#238a78',radius:9,fontSize:12,density:1.04
  };
  if(mode==='orgchart'&&preset==='executive')return {
    background:'#111827',grid:'#283750',surface:'#202f44',edge:'#879bb9',
    text:'#f4f7ff',accent:'#d6b36e',radius:8,fontSize:13,density:1.18
  };
  if(mode==='flowchart'&&preset==='process')return {
    background:'#f4f7fb',grid:'#dce5ef',surface:'#ffffff',edge:'#758ba2',
    text:'#17324b',accent:'#137b9c',radius:11,fontSize:13,density:1.04
  };
  if(mode==='flowchart'&&preset==='blueprint')return {
    background:'#0a2542',grid:'#19486c',surface:'#10395f',edge:'#60b8d9',
    text:'#edf9ff',accent:'#6bd9f2',radius:8,fontSize:12,density:1.08
  };
  if(mode==='flowchart'&&preset==='pastel-flow')return {
    background:'#fdf7ff',grid:'#ebdef0',surface:'#ffffff',edge:'#ad9aaf',
    text:'#39243b',accent:'#c471a5',radius:16,fontSize:13,density:1.14
  };
  if(mode==='flowchart'&&preset==='dark-logic')return {
    background:'#0c101d',grid:'#26354d',surface:'#202b42',edge:'#75869b',
    text:'#f2f6ff',accent:'#e7aa52',radius:8,fontSize:12,density:1
  };
  if(mode==='concept-tree'&&preset==='academic')return {
    background:'#f8fafc',grid:'#dfe8f1',surface:'#ffffff',edge:'#8296ad',
    text:'#1b354a',accent:'#237795',radius:9,fontSize:13,density:1.08
  };
  if(mode==='concept-tree'&&preset==='taxonomy')return {
    background:'#0f2928',grid:'#234a45',surface:'#20413e',edge:'#74968f',
    text:'#e9fbf3',accent:'#8bd7b9',radius:7,fontSize:12,density:.98
  };
  if(mode==='concept-tree'&&preset==='study')return {
    background:'#f6f0ff',grid:'#e7dff4',surface:'#ffffff',edge:'#aa9dc1',
    text:'#34244e',accent:'#8455b6',radius:17,fontSize:13,density:1.14
  };
  if(mode==='concept-tree'&&preset==='aurora-tree')return {
    background:'#11192d',grid:'#2e4266',surface:'#263756',edge:'#829fd4',
    text:'#f2f7ff',accent:'#ab95f8',radius:16,fontSize:13,density:1.12
  };
  if(mode==='concept-tree'&&preset==='minimal-taxonomy')return {
    background:'#f7faf8',grid:'#e1e9e4',surface:'#ffffff',edge:'#638477',
    text:'#213c32',accent:'#306f5a',radius:5,fontSize:12,density:.9
  };
  if(mode==='concept-network'&&preset==='cluster')return {
    background:'#edf6f5',grid:'#cfe6e5',surface:'#ffffff',edge:'#76969d',
    text:'#123845',accent:'#147d91',radius:17,fontSize:13,density:1.08
  };
  if(mode==='concept-network'&&preset==='signal')return {
    background:'#090f20',grid:'#21334e',surface:'#15263d',edge:'#547990',
    text:'#f4fbff',accent:'#30e3cc',radius:10,fontSize:13,density:1.14
  };
  if(preset==='paper'){
    // On white canvas, vibrant dark-mode accents were too pale for 3:1
    // non-text contrast. Keep familiar hues but use legible dark versions.
    const paperAccent={
      orgchart:'#2563a8','concept-tree':'#18734e','concept-network':'#6742af',
      flowchart:'#966000',kanban:'#126e91',timeline:'#a0325b'
    }[mode]||'#2563a8';
    return {background:'#f3f6fc',grid:'#d4dce8',surface:'#ffffff',edge:'#94a3b8',
      text:'#16243d',accent:paperAccent,radius:11,fontSize:12,density:1};
  }
  if(preset==='aurora')return {background:'#10192e',grid:'#284365',surface:'#263856',edge:'#7995c7',text:'#f4f7ff',accent,radius:18,fontSize:13,density:1.08};
  if(preset==='graphite')return {background:'#111418',grid:'#30383f',surface:'#252b32',edge:'#81909d',text:'#edf2f7',accent,radius:7,fontSize:12,density:.94};
  return {background:'#0d1627',grid:'#2b405e',surface:'#1b2a40',edge:'#8295b7',text:'#eff6ff',accent,radius:12,fontSize:12,density:1};
}
function resolve(raw,mode,nodeId=null){
  const source=clean(raw).modes[mode]||{preset:'studio'};
  const preset=source.preset||'studio';
  const result={...palette(mode,preset),...properties(source,false,mode),preset};
  if(mode==='orgchart')result.orientation=source.orientation==='horizontal'?'horizontal':'vertical';
  if(mode==='timeline')result.timeScale=TIME_SCALES.includes(source.timeScale)?source.timeScale:'auto';
  if(nodeId!==null&&source.elements&&has(source.elements,nodeId))Object.assign(result,source.elements[nodeId]);
  return result;
}
function applyDensity(layout,style){
  if(!layout||!Array.isArray(layout.nodes)||!style||style.density===1)return layout;
  const factor=finite(style.density,.85,1.4)||1;
  const baseline=72;
  for(const node of layout.nodes)node.y=baseline+(node.y-baseline)*factor;
  if(Array.isArray(layout.ticks))for(const tick of layout.ticks){if(typeof tick.y==='number')tick.y=baseline+(tick.y-baseline)*factor}
  layout.height=Math.max(290,Math.ceil(baseline+(layout.height-baseline)*factor));
  return layout;
}
return Object.freeze({MODES,PRESETS,NETWORK_PRESETS,TREE_PRESETS,FLOW_PRESETS,ORG_PRESETS,KANBAN_PRESETS,TIMELINE_PRESETS,TIME_SCALES,presetsFor,MODE_COLORS,GROUP_COLORS,KANBAN_STATUS_COLORS,CANVAS_GRID_SIZE,treeTypography,treeDepthBadge,groupColor,kanbanStatusColor,lightViewCanvas,semanticFlowColor,clean,update,reset,resetProperty,palette,resolve,applyDensity});
});
