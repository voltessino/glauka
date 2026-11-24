/* 7.3 portable, OFFLINE read-only HTML viewer.
 * No network, third-party libraries, remote resources, or original project edits.
 * Notes and links are excluded by default and require deliberate opt-in.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NeuroMapShareHTML=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_NODES=3500,MAX_LABEL=500,MAX_NOTES=45000;
 const asText=(x,max)=>String(x==null?'':x).slice(0,max);
 const escapeMarkup=s=>String(s).replace(/[<>&\u2028\u2029]/g,ch=>({
  '<':'\\u003c','>':'\\u003e','&':'\\u0026','\u2028':'\\u2028','\u2029':'\\u2029'
 })[ch]);
 function safeLink(text){
  try{const url=new URL(String(text));
   if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return '';
   return url.href.slice(0,2048);
  }catch{return '';}
 }
 function project(tree,opts={}){
  if(!tree||typeof tree!=='object')throw Error('No map selected');
  const rows=[],stack=[{item:tree,parent:-1,depth:0}],seen=new Set(),ids=new Set();
  while(stack.length){
   const {item,parent,depth}=stack.pop();
   if(!item||typeof item!=='object'||seen.has(item))throw Error('Cyclic or shared node');
   seen.add(item);
   const id=String(item.id||'').trim();
   if(!id||ids.has(id))throw Error('Missing or duplicate logical node ID');
   ids.add(id);if(rows.length>=MAX_NODES)throw Error('HTML export supports 3,500 nodes at most');
   const label=asText(item.text,MAX_LABEL);
   if(String(item.text||'').length>MAX_LABEL)throw Error('Node label exceeds HTML export limit');
   const notes=opts.notes?String(item.notes||''):'';
   if(notes.length>MAX_NOTES)throw Error('Node notes exceed HTML export limit');
   const index=rows.length;rows.push({id,label,parent,depth,
    ...(opts.notes&&notes?{notes}:{}),
    ...(opts.links&&safeLink(item.linkUrl)?{url:safeLink(item.linkUrl)}:{})});
   const kids=Array.isArray(item.children)?item.children:[];
   for(let i=kids.length-1;i>=0;i--)stack.push({item:kids[i],parent:index,depth:depth+1});
  }
  return Object.freeze({title:rows[0].label||'NeuroMap',rows});
 }
 function viewer(){
  'use strict';
  const q=document.querySelector('#nm-data'),payload=JSON.parse(q.textContent);
  const list=document.querySelector('#tree'),count=document.querySelector('#count');
  const query=document.querySelector('#query'),message=document.querySelector('#notice');
  const rows=payload.rows,items=[],labels=[],branches=[];
  const make=(tag,cls,content)=>{const node=document.createElement(tag);if(cls)node.className=cls;
   if(content!==undefined)node.textContent=content;return node};
  document.querySelector('#heading').textContent=payload.title;
  count.textContent=String(rows.length)+' concepts';
  for(let i=0;i<rows.length;i++){
   const data=rows[i],li=make('li','item'),details=make('details');
   const title=make('summary','node'),name=make('span','label',data.label);
   title.append(name);
   if(data.url){const link=make('a','url','↗');link.href=data.url;link.target='_blank';
    link.rel='noopener noreferrer';link.title='Open external page';link.addEventListener('click',e=>e.stopPropagation());title.append(link)}
   const nested=make('ul','children');
   if(data.notes){const notes=make('p','notes',data.notes);details.append(title,notes,nested)}
   else details.append(title,nested);
   li.append(details);items.push(li);labels.push(details);branches.push(nested);
   if(data.parent===-1)list.append(li);
   else branches[data.parent].append(li);
   details.open=data.depth<2;
  }
  const ancestry=i=>{const result=[];let current=i;while(current>=0){
   result.push(current);current=rows[current].parent;if(result.length>rows.length)break}
   return result};
  function filter(){
   const term=query.value.trim().normalize('NFKC').toLocaleLowerCase();
   if(!term){for(let i=0;i<items.length;i++){items[i].hidden=false;labels[i].open=rows[i].depth<2}message.textContent='';return}
   const shown=new Set();let hits=0;
   for(let i=0;i<rows.length;i++){
    const hay=(rows[i].label+' '+(rows[i].notes||'')).normalize('NFKC').toLocaleLowerCase();
    if(!hay.includes(term))continue;hits++;
    for(const n of ancestry(i))shown.add(n);
   }
   for(let i=0;i<items.length;i++){items[i].hidden=!shown.has(i);if(shown.has(i))labels[i].open=true}
   message.textContent=hits+' matching concepts';
  }
  query.addEventListener('input',filter);
  document.querySelector('#all').addEventListener('click',()=>{for(const d of labels)d.open=true});
  document.querySelector('#none').addEventListener('click',()=>{for(let i=0;i<labels.length;i++)labels[i].open=i===0});
  document.querySelector('#clear').addEventListener('click',()=>{query.value='';filter();query.focus()});
 }
 const css=[
 ':root{color-scheme:dark;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#070e1d;color:#e9f3ff}',
 '*{box-sizing:border-box}body{margin:0;padding:24px;max-width:1120px;margin-inline:auto}',
 'header{display:flex;align-items:center;gap:15px;flex-wrap:wrap;margin-bottom:20px}',
 'h1{font-size:24px;margin:0;overflow-wrap:anywhere}.mark{color:#8fe4ff;letter-spacing:.08em}',
 '.muted{color:#9ab4db;font-size:12px}nav{display:flex;gap:9px;flex-wrap:wrap;margin:18px 0}',
 'input,button{border:1px solid #3767af;background:#102449;color:white;padding:10px 12px;border-radius:9px}',
 'input{min-width:min(420px,100%);flex:1}button{cursor:pointer}button:hover{background:#1f4c87}',
 'button:focus-visible,input:focus-visible,summary:focus-visible,a:focus-visible{outline:2px solid #73dfff;outline-offset:3px}',
 '#tree,.children{list-style:none;margin:0;padding-left:16px}#tree{padding:8px 0 30px}.children{border-left:1px solid #2a4c72;margin-left:11px}',
 'li.item{margin:4px 0}summary.node{cursor:pointer;padding:9px 12px;border-radius:8px;background:#0e203d;border:1px solid #294a77}',
 'summary.node:hover{background:#15345b}.label{font-weight:540;overflow-wrap:anywhere}',
 'summary.node::marker{color:#6ae4bd}.url{float:right;color:#8cf2dc;text-decoration:none;padding-inline:6px}',
 '.notes{white-space:pre-wrap;overflow-wrap:anywhere;color:#bfd3ec;background:#0c1a30;border-left:3px solid #388fc3;padding:10px;font-size:13px}',
 'li[hidden]{display:none!important}footer{border-top:1px solid #294a77;padding:16px;color:#9ab4db;font-size:12px}',
 '@media(max-width:600px){body{padding:12px}h1{font-size:20px}#tree,.children{padding-left:10px}}'
 ].join('');
 function render(tree,options={}){
  const data=project(tree,options);
  const title=data.title.replace(/[\u0000-\u001f]/g,' ');
  const meta=escapeMarkup(JSON.stringify(data));
  const titleSafe=title.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  // Script payload cannot prematurely close this script because all '<' are escaped
  // as Unicode JSON sequences. Model data is inserted via textContent only.
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
   '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; img-src data:; connect-src &#39;none&#39;; object-src &#39;none&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;">'+
   '<title>'+titleSafe+' · NeuroMap offline</title><style>'+css+'</style></head><body>'+
   '<header><strong class="mark">NEUROMAP · OFFLINE</strong><span class="muted" id="count"></span></header>'+
   '<h1 id="heading"></h1><nav><input id="query" type="search" aria-label="Search map" placeholder="Search concepts and included notes…">'+
   '<button id="clear">Clear</button><button id="all">Expand all</button><button id="none">Collapse</button></nav>'+
   '<p class="muted" id="notice" role="status"></p><ul id="tree" aria-label="Mind map outline"></ul>'+
   '<footer>Read-only interactive copy. No synchronization and no automatic updates. Files, pictures, source hashes and study data are not included.</footer>'+
   '<script id="nm-data" type="application/json">'+meta+'<'+ '/script><script>('+viewer.toString()+')();<'+ '/script></body></html>';
  if(html.length>6*1024*1024)throw Error('Standalone HTML exceeds 6 MB');
  return html;
 }
 return Object.freeze({project,render,safeLink,MAX_NODES});
});
