/* Shared editor algorithms: no native APIs, network access, licensing or DOM. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NeuroMapCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  // A request-local preorder index. Never retained across edits, Undo or imports.
  // Match findNode's first occurrence, including collapsed branches and aliases.
  function findNodesById(root, requested) {
    const ids=Array.from(requested),wanted=new Set(ids.filter(Boolean)),found=new Map();
    const pending=root&&wanted.size?[root]:[],seen=new WeakSet();
    while(pending.length&&wanted.size){
      const node=pending.pop();
      if(!node||typeof node!=='object'||seen.has(node))continue;
      seen.add(node);
      if(wanted.has(node.id)){found.set(node.id,node);wanted.delete(node.id);}
      if(!wanted.size)break;
      const children=Array.isArray(node.children)?node.children:[];
      for(let i=children.length-1;i>=0;i--)pending.push(children[i]);
    }
    return ids.map(id=>found.get(id)||null);
  }
  function splitClockwise(nodes, heights, gap = 0, bias = 50) {
    const preferred = Math.max(0, Math.min(100, Number.isFinite(+bias) ? +bias : 50)) / 100;
    const prefix = [0];
    for (let i = 0; i < nodes.length; i++) prefix.push(prefix[i] + Math.max(1, heights[i] || 1));
    const height = (sum, count) => sum + Math.max(0, gap) * Math.max(0, count - 1);
    let split = 0, score = Infinity;
    // Keep source sequence: choose a single contiguous cut, never sort by height.
    let conflicts = nodes.filter(n => n.sidePinned === 'right').length;
    for (let k = 0; k <= nodes.length; k++) {
      const right = height(prefix[k], k), left = height(prefix[nodes.length] - prefix[k], nodes.length - k);
      const next = conflicts * 1e6 + Math.abs(right / (right + left || 1) - preferred) + Math.abs(k / (nodes.length || 1) - preferred) * 1e-4;
      // Equal Auto candidates favour the clockwise starting side: right.
      if (next < score - 1e-12 || (Math.abs(next-score)<1e-12 && preferred===.5 && k>split)) {score = next; split = k;}
      if (nodes[k]?.sidePinned === 'right') conflicts--;
      if (nodes[k]?.sidePinned === 'left') conflicts++;
    }
    const rightIds = [], leftIds = [];
    let rightHeight = 0, leftHeight = 0;
    nodes.forEach((node, i) => {
      const side = node.sidePinned === 'left' || node.sidePinned === 'right' ? node.sidePinned : i < split ? 'right' : 'left';
      if (side === 'right') {rightIds.push(node.id); rightHeight += Math.max(1, heights[i] || 1);}
      else {leftIds.push(node.id); leftHeight += Math.max(1, heights[i] || 1);}
    });
    return {H_R: Math.round(height(rightHeight, rightIds.length)), H_L: Math.round(height(leftHeight, leftIds.length)),
      rightIds, leftIds, rightCount: rightIds.length, leftCount: leftIds.length,
      // Manual pins change the placed count, not the contiguous-order cut.
      splitIndex: split, totalPrimary: nodes.length};
  }
  // Fluid is a predictable right-first height balancer. Explicit side pins are
  // authoritative and the canonical child order is never sorted or rewritten.
  function splitFluid(nodes, heights, gap = 0) {
    const rightIds=[],leftIds=[];let rightHeight=0,leftHeight=0,cut=nodes.length,seenLeft=false;
    const padding=Math.max(0,Number(gap)||0);
    for(let i=0;i<nodes.length;i++){
      const node=nodes[i],h=Math.max(1,Number(heights[i])||1);
      const pinned=node.sidePinned==='left'||node.sidePinned==='right'?node.sidePinned:null;
      // First two automatic branches establish the reading direction. Thereafter
      // fill the shorter side with a small right bias, without oscillating old pins.
      const side=pinned||(rightIds.length<2&&!seenLeft?'right':
        rightHeight<=leftHeight*1.12?'right':'left');
      if(side==='right'){rightHeight+=h+(rightIds.length?padding:0);rightIds.push(node.id);}
      else {leftHeight+=h+(leftIds.length?padding:0);leftIds.push(node.id);if(!seenLeft)cut=i;seenLeft=true;}
    }
    return {H_R:Math.round(rightHeight),H_L:Math.round(leftHeight),rightIds,leftIds,
      rightCount:rightIds.length,leftCount:leftIds.length,splitIndex:cut,totalPrimary:nodes.length};
  }
  // A presentation plan: every leaf occurs once; shared paths only occur as views.
  function continuationSettings(value) {
    const finite=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;
    const minimum=Math.max(160,finite(value?.minimumHeight,160));
    const result={enabled:value?.enabled===true,height:Math.max(minimum,finite(value?.height,1000))};
    if(value?.minimumHeight!=null)result.minimumHeight=minimum;
    if(value?.anchorSides&&typeof value.anchorSides==='object')result.anchorSides=Object.fromEntries(Object.entries(value.anchorSides).filter(([id,side])=>id.length<=200&&['left','right'].includes(side)).slice(0,3500));
    if(value?.initialOrder===true)result.initialOrder=true;
    if(value?.overflowMode==='expand'){
      result.overflowMode='expand';
      result.height=Math.max(480,Math.min(100000,result.height));
    }
    return result;
  }
  function planContinuation(root, measure, options = {}) {
    const bias = Math.max(0, Math.min(100, Number(options.bias ?? 50)));
    const height = continuationSettings({height:options.height}).height;
    const gap = Math.max(0, Number(options.gap) || 0);
    const primaryGap = Math.max(gap, Number(options.primaryGap) || gap);
    const pages = [], canonical = new Set();
    let page;
    const nextPage = pinned => {
      const previous = page?.side;
      const side = pinned || (bias === 0 ? 'left' : bias === 100 ? 'right' : previous === 'right' ? 'left' : 'right');
      // Adaptive mode has one sector per side. Interleaved manual pins return
      // to that sector instead of creating another centre/page on every switch.
      const existing=options.reuseSides?pages.find(p=>p.side===side):null;
      if(existing){page=existing;return;}
      const share=side==='right'?bias:100-bias;
      // A manually pinned branch must remain usable even at a 0/100% bias.
      const capacity = Math.max(1, height * 2 * share/100,
        options.reuseSides&&share===0?height:0);
      page = {index:pages.length,side,capacity,height:0,children:[],childPositions:new Map(),views:new Map(),units:[]};
      pages.push(page);
    };
    const occupiedHeight = (node,childrenHeight) => {
      const value=measure(node),box=typeof value==='object'?value:{height:value};
      const base=Math.max(1,Number(box.height)||1,childrenHeight);
      return Math.max(base/2,Number(box.top)||0)+Math.max(base/2,Number(box.bottom)||0);
    };
    // Update just the new path in a page's trie, rather than cloning whole subtrees.
    const trial = (path, commit) => {
      let child=null;
      for(let i=path.length-1;i>=0;i--){
        const source=path[i],old=page.views.get(source.id),children=old?old.children:[];
        const childAt=child?old?.childPositions?.get(child.source.id):undefined;
        const oldChild=childAt!==undefined?children[childAt]:undefined;
        const sum=(old?old.sum:0)-(oldChild?oldChild.height:0)+(child?child.height:0);
        const count=children.length+(child&&!oldChild?1:0);
        const entry={source,children,sum,height:occupiedHeight(source,sum+gap*Math.max(0,count-1)),
          childPositions:old?.childPositions||new Map()};
        if(commit){if(child){if(childAt===undefined){entry.childPositions.set(child.source.id,children.length);children.push(child);}else children[childAt]=child;}page.views.set(source.id,entry);}
        child=entry;
      }
      const primaryAt=page.childPositions.get(child.source.id);
      const oldPrimary=primaryAt!==undefined?page.children[primaryAt]:undefined;
      const total=page.height-(oldPrimary?oldPrimary.height:0)+child.height+(!oldPrimary&&page.children.length?primaryGap:0);
      if(commit){if(primaryAt===undefined){page.childPositions.set(child.source.id,page.children.length);page.children.push(child);}else page.children[primaryAt]=child;page.height=total;}
      return total;
    };
    const visit=(node,path,pinned)=>{
      const next=[...path,node];
      const children=node.collapsed?[]:(node.children||[]).filter(n=>!n.isFloating);
      if(children.length){children.forEach(child=>visit(child,next,pinned));return;}
      if(!page || pinned&&page.side!==pinned)nextPage(pinned);
      let proposed=trial(next,false);
      if(page.units.length && proposed>page.capacity+1e-7){nextPage(pinned);proposed=trial(next,false);}
      trial(next,true);page.units.push(node.id);canonical.add(node.id);
    };
    // Preserve a manually interleaved side assignment when activating from an
    // existing map. This changes only presentation traversal, never child order.
    const primaries=[...(root.children||[])];
    if(options.initialOrder&&options.anchorSides){const rank=n=>options.anchorSides[n.id]==='right'?0:options.anchorSides[n.id]==='left'?1:2;primaries.sort((a,b)=>rank(a)-rank(b));}
    if(!root.collapsed)for(const node of primaries)if(!node.isFloating){
      const pinned=['left','right'].includes(node.sidePinned)?node.sidePinned:null;
      const anchor=options.anchorSides?.[node.id];
      if(!pinned&&anchor&&page?.side!==anchor)nextPage(anchor);
      visit(node,[],pinned);
    }
    const aliases = new Map();
    for(const p of pages){
      const materialize=entry=>{
        const n=entry.source,first=!aliases.has(n.id),id='nm-view:'+p.index+':'+n.id;
        const view={...n,id,logicalId:n.id,side:p.side,sidePinned:p.side,manualOffset:options.initialOrder?n.manualOffset:null,
          children:entry.children.map(materialize)};
        // Summary references stay within their own presentation page.
        if(n.summaryTargetIds){view.summaryTargetIds=n.summaryTargetIds.map(id=>'nm-view:'+p.index+':'+id);if(n.parentId===root.id||!n.summaryTargetIds.some(id=>p.views.has(id)))view.isSummary=false;}
        if(first)aliases.set(n.id,id);
        return view;
      };
      p.roots=p.children.map(materialize);delete p.children;delete p.views;
    }
    return {pages,aliases,logicalLeafCount:canonical.size,height,bias};
  }

  // New maps opt in; old documents keep the original sector algorithm.
  const ADAPTIVE_LIMIT_MIN=480, ADAPTIVE_LIMIT_MAX=100000;
  function planAdaptiveContinuation(root,measure,options={}){
    const amount=Number(options.height);
    const configured=Math.max(ADAPTIVE_LIMIT_MIN,Math.min(ADAPTIVE_LIMIT_MAX,
      Number.isFinite(amount)?Math.ceil(amount/20)*20:960));
    const bias=Number.isFinite(Number(options.bias))?Math.max(0,Math.min(100,Number(options.bias))):50;
    const opts={gap:Math.max(0,Number(options.gap)||0),primaryGap:Math.max(0,Number(options.primaryGap)||0),
      bias,initialOrder:false,reuseSides:true};
    const planAt=h=>planContinuation(root,measure,{...opts,height:h});
    const fits=p=>p.pages.length<=2 && new Set(p.pages.map(page=>page.side)).size===p.pages.length &&
      p.pages.every(page=>page.height<=page.capacity+1e-7);
    let plan=planAt(configured);
    if(fits(plan))return {...plan,configuredHeight:configured,effectiveHeight:configured,
      autoExpanded:false,blocked:false,maxHeight:ADAPTIVE_LIMIT_MAX};
    let low=configured/20,high=low,found=false;
    while(high<ADAPTIVE_LIMIT_MAX/20){
      high=Math.min(ADAPTIVE_LIMIT_MAX/20,Math.max(high+1,high*2));
      if(fits(planAt(high*20))){found=true;break;}
    }
    if(!found)return {...plan,configuredHeight:configured,effectiveHeight:configured,
      autoExpanded:false,blocked:true,maxHeight:ADAPTIVE_LIMIT_MAX};
    while(low+1<high){
      const mid=Math.floor((low+high)/2);
      if(fits(planAt(mid*20)))high=mid;else low=mid;
    }
    plan=planAt(high*20);
    return {...plan,configuredHeight:configured,effectiveHeight:high*20,
      autoExpanded:true,blocked:false,maxHeight:ADAPTIVE_LIMIT_MAX};
  }
  function visualOrder(nodes, layout) {
    return nodes.map((node, index) => ({node, index, p: layout.getLayout(node.id)})).sort((a, b) => {
      if (!a.p || !b.p) return Number(!!b.p) - Number(!!a.p) || a.index - b.index;
      if (layout.branchStyle === 'radial') {
        const angle = p => (Math.atan2(p.y, p.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
        return angle(a.p) - angle(b.p) || a.index - b.index;
      }
      const aLeft = a.p.x < 0, bLeft = b.p.x < 0;
      return Number(aLeft) - Number(bLeft) || (aLeft ? b.p.y - a.p.y : a.p.y - b.p.y) || a.index - b.index;
    }).map(item => item.node);
  }
  // Validate the entire batch before an editor clones trees or adds any tabs.
  // IDs are scoped to a sheet: reimporting a valid workspace is allowed, but
  // ambiguous IDs inside one tree must be rejected to protect references.
  function validateWorkspaceTabs(tabs) {
    if (!Array.isArray(tabs) || tabs.length === 0) throw Error('Il backup non contiene schede.');
    if (tabs.length > 20) throw Error('Il backup contiene più di 20 schede: dividilo in più file.');
    let total = 0;
    for (const tab of tabs) {
      if (!tab || typeof tab !== 'object') throw Error('Scheda del backup non valida.');
      for (const field of ['images', 'relationships', 'studyCards', 'learningAttempts']) {
        if (tab[field] != null && (!Array.isArray(tab[field]) || tab[field].some(v => !v || typeof v !== 'object' || Array.isArray(v))))
          throw Error('Metadati del backup non validi: ' + field);
      }
      const ids = new Set(), stack = [{node:tab.root, depth:0}];
      while (stack.length) {
        const {node, depth} = stack.pop();
        if (!node || typeof node !== 'object' || Array.isArray(node) || typeof node.text !== 'string')
          throw Error('Nodo del backup non valido.');
        if (++total > 3500) throw Error('Backup troppo grande: limite di 3500 nodi.');
        if (depth > 100) throw Error('La struttura contiene troppi livelli di annidamento.');
        if (node.id != null && node.id !== '') {
          if (typeof node.id !== 'string' || ids.has(node.id)) throw Error('ID dei nodi duplicati o non validi nel backup.');
          ids.add(node.id);
        }
        if (node.children != null && !Array.isArray(node.children)) throw Error('Figli del nodo non validi.');
        for (const child of node.children || []) stack.push({node:child, depth:depth+1});
      }
    }
    return total;
  }
  let labelSegmenter;
  // Re-layout repeatedly measures unchanged labels. Bound retained text and never
  // expose cached arrays: callers may edit their copy without affecting rendering.
  const labelWrapCache = new Map();
  function wrapLabelText(text, limit=18) {
    const max=Math.max(8,Math.min(60,Number(limit)||18));
    const source=String(text||'');
    if(source.length>1024)return computeLabelLines(source,max);
    const key=max+'\0'+source;
    if(labelWrapCache.has(key))return labelWrapCache.get(key).slice();
    const lines=computeLabelLines(source,max);
    if(labelWrapCache.size===256)labelWrapCache.delete(labelWrapCache.keys().next().value);
    labelWrapCache.set(key,lines);
    return lines.slice();
  }
  function computeLabelLines(text,max) {
    const lines=[];
    const segmenter=typeof Intl.Segmenter==='function'?(labelSegmenter ||= new Intl.Segmenter(undefined,{granularity:'grapheme'})):null;
    function* pieces(word){
      if(word.length<=max){yield word;return;}
      let part='',count=0;
      for(const item of segmenter?segmenter.segment(word):word){const glyph=typeof item==='string'?item:item.segment;part+=glyph;if(++count===max){yield part;part='';count=0;}}
      if(part)yield part;
    }
    for(const paragraph of text.split('\n')){
      let current='';
      for(const word of paragraph.trim().split(/\s+/).filter(Boolean))for(const part of pieces(word)){
        if(!current){current=part;continue;}
        if(current.length+1+part.length<=max){current+=' '+part;continue;}
        lines.push(current);if(lines.length===200)return lines;current=part;
      }
      lines.push(current||' ');if(lines.length===200)return lines;
    }
    return lines;
  }
  // External Markdown keeps unsupported inline constructs as literal text.
  // Fenced code is content, never an instruction to discard the enclosed lines.
  function parseMarkdownOutline(input) {
    const source=String(input).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
    if(source.length>1600000)throw Error('Testo troppo grande (max 1,6 MB)');
    const records=[];let fence=null,code=[],codeIndent=0,separated=true;
    const format=raw=>{
      let text=raw.trim(),fontWeight=null,fontItalic=false;
      if(/^(\*\*\*|___)([\s\S]+)\1$/.test(text)){text=text.slice(3,-3);fontWeight=700;fontItalic=true;}
      else if(/^(\*\*|__)([\s\S]+)\1$/.test(text)){text=text.slice(2,-2);fontWeight=700;}
      else if(/^(\*|_)([^\n]+)\1$/.test(text)){text=text.slice(1,-1);fontItalic=true;}
      return {text,...(fontWeight?{fontWeight}:{}),...(fontItalic?{fontItalic:true}:{}),children:[]};
    };
    for(const line of source.split('\n')){
      const f=line.match(/^\s*(`{3,}|~{3,})(.*)$/);
      if(f){if(!fence){fence=f[1];code=[line];codeIndent=line.search(/\S/);}else if(f[1][0]===fence[0]&&f[1].length>=fence.length){code.push(line);records.push({column:codeIndent,kind:'code',node:{text:code.join('\n'),notes:code.join('\n'),children:[]}});fence=null;code=[];separated=true;}else code.push(line);continue;}
      if(fence){code.push(line);continue;}
      if(!line.trim()||/^\s*---\s*$/.test(line)){separated=true;continue;}
      const m=line.match(/^([ \t]*)(.*?)\s*$/),column=[...m[1]].reduce((n,c)=>n+(c==='\t'?4-n%4:1),0),raw=m[2];
      const bq=raw.match(/^>\s?(.*)$/);
      if(bq){
        if(!records.length && /^(?:\*\*.*—\s*(?:Parte|Part)\s+\d+\s+(?:di|of)\s+\d+\*\*|Sezioni principali:|Main sections:|Continua da:|Continues from:)/i.test(bq[1].trim())){
          separated=true;continue;
        }
        const prevNode=records.at(-1)?.node;
        if(prevNode){
          prevNode.notes=prevNode.notes?(prevNode.notes+'\n'+bq[1]):bq[1];
          separated=false;
          continue;
        }
      }
      const h=raw.match(/^(#{1,6})\s+(.+)$/),b=!h&&raw.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);
      const node=format(h?h[2].replace(/\s+#+\s*$/,''):b?b[1]:raw),kind=h?'heading':b?'bullet':'paragraph';
      if(b&&/^\d+[.)]\s/.test(raw))node.notes=raw;
      const previous=records.at(-1);
      if(kind==='paragraph'&&!separated&&previous?.kind==='paragraph'&&previous.column===column){previous.node.text+='\n'+node.text;previous.node.notes=previous.node.text;}else records.push({column,heading:h?h[1].length:0,kind,node});
      separated=false;
      if(records.length>3500)throw Error('Troppi nodi nel testo (max 3500).');
    }
    if(fence)records.push({column:codeIndent,kind:'code',node:{text:code.join('\n'),notes:code.join('\n'),children:[]}});
    const columns=[...new Set(records.filter(r=>!r.heading).map(r=>r.column))].sort((a,b)=>a-b),forest=[],stack=[];let headingDepth=-1,base=0,first=false;
    for(const r of records){let level;
      if(r.heading){level=headingDepth=r.heading-1;first=true;}
      else {const rank=Math.max(0,columns.indexOf(r.column));if(first){base=rank;first=false;}level=headingDepth>=0?headingDepth+1+Math.max(0,rank-base):rank;}
      level=stack.length?Math.min(level,stack.at(-1).level+1):0;
      while(stack.length&&stack.at(-1).level>=level)stack.pop();
      if(stack.length)stack.at(-1).node.children.push(r.node);else forest.push(r.node);
      stack.push({node:r.node,level});
    }
    return forest;
  }
  function parseMarkdownDocuments(input) {
    const docs=[];let lines=[],fence=null;
    for(const line of String(input).replace(/\r\n?/g,'\n').split('\n')){
      const match=line.match(/^\s*(`{3,}|~{3,})/);
      if(match){if(!fence)fence=match[1];else if(match[1][0]===fence[0]&&match[1].length>=fence.length)fence=null;}
      if(!fence&&/^\s*---\s*$/.test(line)){if(lines.join('\n').trim())docs.push(lines.join('\n'));lines=[];}else lines.push(line);
    }
    if(lines.join('\n').trim())docs.push(lines.join('\n'));
    if(docs.length>20)throw Error('Il Markdown contiene più di 20 schede.');
    return docs.map(doc=>{const forest=parseMarkdownOutline(doc);if(!forest.length)throw Error('Nessun nodo valido nel documento.');return forest.length===1?forest[0]:{text:'Mappa importata',children:forest};});
  }
  const markdownMarker = '<!-- NeuroMap-Markdown-v1 -->';
  // Decode in one pass: a literal escaped backslash followed by n must not
  // become a newline on a subsequent replacement.
  function decodeMarkdownLabel(text) {
    return String(text).replace(/\\(\\|n)/g, (_, value) => value === 'n' ? '\n' : '\\');
  }
  // The legacy OPML 2.0 serializer is identical on Android and desktop.
  function serializeOPML(rootNode) {
    if(!rootNode)throw Error('Nessuna mappa da esportare.');
    // OPML 2.0 body must contain outlines, never live HTML controls.
    const escapeXml=value=>String(value??'')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'')
      .replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
    const title=escapeXml(rootNode.text);
    const xml=['<?xml version="1.0" encoding="UTF-8"?>','<opml version="2.0">',
      '  <head>','    <title>'+title+'</title>','  </head>','  <body>'];
    const stack=[{node:rootNode,depth:2,closing:false}],seen=new WeakSet();
    while(stack.length){
      const frame=stack.pop(),node=frame.node;
      const pad='  '.repeat(Math.min(frame.depth,32));
      if(frame.closing){xml.push(pad+'</outline>');continue;}
      if(!node||typeof node!=='object')continue;
      if(seen.has(node))throw Error('Struttura ciclica o condivisa: esportazione OPML annullata.');
      seen.add(node);
      const children=Array.isArray(node.children)?node.children:[];
      const start=pad+'<outline text="'+escapeXml(node.text)+'"';
      if(!children.length){xml.push(start+' />');continue;}
      xml.push(start+'>');
      stack.push({node,depth:frame.depth,closing:true});
      for(let i=children.length-1;i>=0;i--)
        stack.push({node:children[i],depth:frame.depth+1,closing:false});
    }
    xml.push('  </body>','</opml>');
    return xml.join('\n');
  }
  function serializeMarkdown(root) {
    // Validate before writing: do not create a Markdown file that cannot be reimported.
    // Iterative traversal avoids call-stack exhaustion on malformed deep trees.
    const fields=['fontWeight','fontItalic','fontUnderline','fontStrike','fontFamily','fontColor','notes','labelAlign','labelIndent','labelWrapChars'];
    const nodes=[], active=new Set(), stack=[{node:root,depth:0,exit:false}];
    let rich=false;
    while(stack.length){
      const entry=stack.pop(),n=entry.node;
      if(entry.exit){active.delete(n);continue;}
      if(!n||typeof n!=='object'||Array.isArray(n)||typeof n.text!=='string')
        throw Error('Nodo Markdown non valido.');
      if(active.has(n))throw Error('Struttura Markdown ciclica.');
      if(entry.depth>100)throw Error('Gerarchia Markdown troppo profonda (max 100 livelli).');
      if(nodes.length>=3500)throw Error('Markdown troppo grande (max 3500 nodi).');
      if(n.children!=null&&!Array.isArray(n.children))
        throw Error('Figli Markdown non validi.');
      rich ||= fields.some(k=>n[k]!=null&&n[k]!==false&&n[k]!=='') || !n.text.trim() || n.text!==n.text.trim() || n.text.includes('\r');
      nodes.push(entry);
      active.add(n);
      stack.push({node:n,exit:true});
      const children=n.children||[];
      for(let i=children.length-1;i>=0;i--)
        stack.push({node:children[i],depth:entry.depth+1,exit:false});
    }
    const label=text=>String(text??'').replace(/\\/g,'\\\\').replace(/\r\n?|\n/g,'\\n').trim()||'Nodo';
    const value=n=>{
      let text=label(n.text);
      if(rich&&n.fontWeight>=600)text='**'+text+'**';
      if(rich&&n.fontItalic)text='*'+text+'*';
      return text+(rich?' <!--NM:'+encodeURIComponent(JSON.stringify(Object.fromEntries(['text',...fields].filter(k=>Object.hasOwn(n,k)).map(k=>[k,n[k]]))))+'-->':'');
    };
    const lines=[rich?'<!-- NeuroMap-Markdown-v2 -->':markdownMarker];
    for(const {node,depth} of nodes)
      lines.push(depth===0?'# '+value(node):'  '.repeat(depth)+'- '+value(node));
    return lines.join('\n')+'\n';
  }
  function parseMarkdownExport(text) {
    const source = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    const rich=source.startsWith('<!-- NeuroMap-Markdown-v2 -->\n');
    if (!rich&&!source.startsWith(markdownMarker + '\n')) return null;
    const documents = source.split(/^\s*---\s*$/m);
    if (documents.length > 20) throw Error('Il Markdown contiene più di 20 schede.');
    let count = 0;
    return documents.map(document => {
      const lines = document.trim().split('\n');
      const version=lines.shift();
      if (![markdownMarker,'<!-- NeuroMap-Markdown-v2 -->'].includes(version) || !lines[0]?.startsWith('# ')) throw Error('Markdown NeuroMap non valido.');
      const decode=raw=>{
        const m=version.includes('-v2 ')?raw.match(/ <!--NM:([^ ]+)-->$/):null;
        if(!m)return {text:decodeMarkdownLabel(raw),children:[]};
        const data=JSON.parse(decodeURIComponent(m[1]));
        if(typeof data.text!=='string')throw Error('Metadati Markdown non validi.');
        const node={text:data.text,children:[]};for(const key of ['fontWeight','fontItalic','fontUnderline','fontStrike','fontFamily','fontColor','notes','labelAlign','labelIndent','labelWrapChars'])if(Object.hasOwn(data,key))node[key]=data[key];return node;
      };
      const root = decode(lines.shift().slice(2));
      const stack = [root];
      if (++count > 3500) throw Error('Markdown troppo grande.');
      for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/^( +)- (.*)$/);
        const depth = match ? match[1].length / 2 : 0;
        if (!Number.isInteger(depth) || depth < 1 || depth > stack.length || depth > 100) throw Error('Gerarchia Markdown NeuroMap non valida.');
        if (++count > 3500) throw Error('Markdown troppo grande.');
        const node = decode(match[2]);
        stack[depth-1].children.push(node);stack[depth] = node;stack.length = depth + 1;
      }
      return root;
    });
  }
  return Object.freeze({findNodesById, splitClockwise, splitFluid, continuationSettings, planContinuation, planAdaptiveContinuation, ADAPTIVE_LIMIT_MIN, ADAPTIVE_LIMIT_MAX, visualOrder, validateWorkspaceTabs,
    serializeOPML, serializeMarkdown, parseMarkdownExport, decodeMarkdownLabel, parseMarkdownOutline, parseMarkdownDocuments, wrapLabelText});
});
