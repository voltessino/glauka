/* NeuroMap Android Smart Import - pure offline outline parser and paginater.
   No external modules, network calls, license code or native privileges. */
(function(root, factory) {
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.NeuroMapSmartImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const RANGES = Object.freeze([80,100,125,150,200]);
  const LABEL_MAX = 245;
  // Use grapheme boundaries when available (emoji ZWJ, combining accents,
  // flags); older WebViews still must not split UTF-16 surrogate pairs.
  const graphemeSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, {granularity:'grapheme'}) : null;
  function safeBoundary(text, limit) {
    const upper = Math.min(text.length, limit);
    if (upper === text.length) return upper;
    if (graphemeSegmenter) {
      let end = 0;
      for (const part of graphemeSegmenter.segment(text)) {
        const next = part.index + part.segment.length;
        if (next > upper) break;
        end = next;
      }
      if (end) return end;
      // A single grapheme longer than the node limit cannot be preserved
      // intact and also satisfy the length limit. Reject, never corrupt it.
      throw Error('A Unicode character exceeds the maximum node length');
    }
    // Code-point fallback for older Android WebViews.
    let end = upper;
    if (end > 0 && /[\uD800-\uDBFF]/.test(text[end-1]) &&
        /[\uDC00-\uDFFF]/.test(text[end])) end--;
    return end;
  }

  function chunks(raw, maxLen = LABEL_MAX) {
    if (!Number.isInteger(maxLen) || maxLen < 2) throw RangeError('Invalid node length limit');
    const text = String(raw || '').trim();
    if (!text) return [];
    const result=[];
    let rest=text;
    while (rest.length > maxLen) {
      // Prefer sentence end, then word break; never throw away the remainder.
      let cut=-1;
      for(let i=Math.min(rest.length-1,maxLen);i>=Math.floor(maxLen*.62);i--){
        if(/[.!?。！？]/.test(rest[i-1]||'') && /\s/.test(rest[i]||'')){cut=i;break;}
      }
      if(cut<0){for(let i=maxLen;i>=Math.floor(maxLen*.65);i--)if(/\s/.test(rest[i])){cut=i;break;}}
      if(cut<0) cut=maxLen;
      cut=safeBoundary(rest,cut);
      const part=rest.slice(0,cut).trim();
      if(part)result.push(part);
      rest=rest.slice(cut).trimStart();
    }
    if(rest)result.push(rest);
    return result;
  }
  function parse(text, title='Documento importato') {
    if(typeof text!=='string' || !text.trim()) throw Error('Il testo da importare è vuoto.');
    const name=String(title||'Documento importato');
    const root={text:name.slice(0,safeBoundary(name,220)),children:[]};
    const stack=[{level:0,node:root}], rows=text.replace(/\r\n?/g,'\n').split('\n');
    let currentHeading=0, inFence=false, fenceMarker='', lastNode=null, uid=0;
    function addLine(value, level){
      const parts=chunks(value);
      for(const part of parts){
        while(stack.length>1 && stack[stack.length-1].level>=level)stack.pop();
        const parent=stack[stack.length-1].node;
        const node={text:part,children:[],_nmSourceId:++uid};
        parent.children.push(node);lastNode=node;
        // Long paragraph pieces are siblings, not hundreds of nested nodes.
        stack.push({level,node});
      }
    }
    for(const raw of rows){
      const line=raw.replace(/\s+$/,'');
      const fence=line.trim().match(/^(```+|~~~+)/);
      if(fence){
        if(!inFence){inFence=true;fenceMarker=fence[1][0];}
        else if(fence[1][0]===fenceMarker)inFence=false;
        if(lastNode)lastNode.notes=(lastNode.notes||'')+line+'\n';
        else addLine(line,1);
        continue;
      }
      if(inFence){
        // Preserve code verbatim as node notes instead of treating it as Markdown structure.
        if(lastNode) lastNode.notes=(lastNode.notes||'')+raw+'\n';
        else addLine(raw,1);
        continue;
      }
      if(!line.trim())continue;
      const heading=line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
      const bullet=line.match(/^(\s*)(?:[-*+•●○◦▪■–]\s+|\d+[.)]\s+|[a-zA-Z][.)]\s+)(.+)$/);
      if(heading){
        currentHeading=heading[1].length;
        addLine(heading[2], currentHeading);
      }else if(bullet){
        const indent=bullet[1].replace(/\t/g,'  ').length;
        addLine(bullet[2],Math.min(32,currentHeading+1+Math.floor(indent/2)));
      }else{
        const indent=(line.match(/^(\s*)/)||['',''])[1].replace(/\t/g,'  ').length;
        addLine(line.trim(), Math.min(32,currentHeading+1+Math.floor(indent/2)));
      }
    }
    return root;
  }
  function flatten(root){
    const results=[];
    const agenda=[];
    for(let i=(root.children||[]).length-1;i>=0;i--) agenda.push({node:root.children[i],path:[]});
    while(agenda.length){
      const item=agenda.pop(); const path=[...item.path,item.node];
      results.push({node:item.node,path});
      if(path.length>100)throw Error('La gerarchia supera i 100 livelli consentiti.');
      const children=item.node.children||[];
      for(let j=children.length-1;j>=0;j--)agenda.push({node:children[j],path});
    }
    return results;
  }
  function paginate(root, preferred=125){
    const desired=RANGES.includes(Number(preferred))?Number(preferred):125;
    const nodes=flatten(root);
    if(!nodes.length)throw Error('Non ci sono contenuti da importare.');
    // Prevent one last page with very few nodes while allowing context headings.
    const estimatedPages=Math.max(1,Math.ceil((nodes.length+1)/desired));
    const target=Math.max(2,Math.min(desired,Math.ceil(nodes.length/estimatedPages)+1));
    let page=null, pages=[], totalSources=0;
    function start(){page={root:{...root,children:[]},size:1,sourceCount:0,contextCount:0,map:new Map()};}
    function add(entry){
      let parent=page.root;
      for(let i=0;i<entry.path.length;i++){
        const original=entry.path[i];
        let copied=page.map.get(original);
        if(!copied){
          copied={...JSON.parse(JSON.stringify({...original,children:[]})),notes:original.notes||'',children:[],_nmSourceId:original._nmSourceId,
            _nmContext:i<entry.path.length-1};
          page.map.set(original,copied);
          parent.children.push(copied);page.size++;
          if(copied._nmContext)page.contextCount++;
          else{page.sourceCount++;totalSources++;}
        }else if(i===entry.path.length-1 && copied._nmContext){
          copied._nmContext=false;page.contextCount--;page.sourceCount++;totalSources++;
        }
        parent=copied;
      }
    }
    function finish(){if(page && page.sourceCount>0)pages.push(page);page=null;}
    start();
    for(const entry of nodes){
      const absent=entry.path.reduce((n,x)=>n+(!page.map.has(x)?1:0),0);
      if(page.sourceCount && page.size+absent>target){finish();start();}
      add(entry);
    }
    finish();
    const length=pages.length;
    for(let i=0;i<length;i++){
      pages[i].root.text=length===1 ? root.text : root.text+' · '+(i+1)+'/'+length;
      delete pages[i].map;
    }
    return {pages,totalSources,originalSources:nodes.length,preferred:desired};
  }
  return Object.freeze({RANGES, parse, paginate, chunks});
});
