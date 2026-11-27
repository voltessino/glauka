/* ==================== NeuroMap 6.7: study, navigation, export ==================== */
function nm67RenderMarkdown(markdown){
  // The model's text is untrusted. This renderer never inserts HTML from the model.
  const fragment=document.createDocumentFragment();
  const block=(tag,text)=>{const node=document.createElement(tag);if(text)nm67InlineText(node,text);fragment.append(node);return node;};
  const normalize=String(markdown||'').replace(/\r\n?/g,'\n').replace(/^```(?:markdown|md)?\s*\n?/i,'').replace(/\n?```\s*$/,'').trim();
  let paragraph=[],list=null;
  const flush=()=>{if(paragraph.length){block('p',paragraph.join(' ').trim());paragraph=[];}list=null;};
  for(const raw of normalize.split('\n')){
    const line=raw.trim();if(!line){flush();continue;}
    if(/^(-{3,}|\*{3,})$/.test(line)){flush();fragment.append(document.createElement('hr'));continue;}
    const heading=line.match(/^#{1,5}\s+(.+)$/)||line.match(/^\*\*([^*]{3,80})\*\*\s*:?$/);
    if(heading){flush();block('h3',heading[1].replace(/:$/,'').trim());continue;}
    const bullet=line.match(/^(?:[-*•]\s+|\d+[.)]\s+)(.+)$/);
    if(bullet){if(paragraph.length)flush();if(!list){list=document.createElement('ul');fragment.append(list);}const li=document.createElement('li');nm67InlineText(li,bullet[1]);list.append(li);continue;}
    if(list)list=null;
    paragraph.push(line);
  }
  flush();return fragment;
}
function nm67InlineText(parent,source){
  const text=String(source||'');const re=/(\*\*([^*]+)\*\*|(?<!\*)\*([^*]+)\*(?!\*))/g;let pos=0,match;
  while((match=re.exec(text))){if(match.index>pos)parent.append(document.createTextNode(text.slice(pos,match.index)));
    const part=document.createElement(match[2]?'strong':'em');part.textContent=match[2]||match[3];parent.append(part);pos=re.lastIndex;}
  if(pos<text.length)parent.append(document.createTextNode(text.slice(pos)));
}
NeuroMapApp.prototype.nm67OpenNotes=function(){
  this.hideMenus?.();const node=this.state.findNode(this.state.selectedNodeId);
  if(!node){this.showToast('Seleziona un nodo per leggere le note','NOTE');return;}
  this._nm67NotesNode=node.id;document.getElementById('nm67-notes-title').textContent='📝 '+node.text;
  document.getElementById('nm67-notes-editor').value=node.notes||'';
  document.getElementById('nm67-notes-overlay').classList.remove('hidden');
  this.nm67NotesPreview();
};
NeuroMapApp.prototype.nm67NotesPreview=function(){
  const host=document.getElementById('nm67-notes-preview');host.replaceChildren(nm67RenderMarkdown(document.getElementById('nm67-notes-editor').value));
};
NeuroMapApp.prototype.nm67SaveNotes=function(){
  const node=this.state.findNode(this._nm67NotesNode);if(!node)return;
  const newNotes=document.getElementById('nm67-notes-editor').value.slice(0,120000);
  if(newNotes!==node.notes){this.state.pushHistory();node.notes=newNotes;this.markChanged();}
  document.getElementById('nm67-notes-overlay').classList.add('hidden');
  this.showToast('Note salvate nel nodo e nei backup della mappa','NOTE');
};
NeuroMapApp.prototype.nm67AllStyles=function(){
  this.saveActiveTabSnapshot();
  const style=this.state.branchStyle||'neon',scale=this.state.strokeScale||1;
  let count=0;
  for(const tab of this.tabs){if(tab.state.branchStyle===style&&tab.state.strokeScale===scale)continue;
    tab.state.pushHistory();tab.state.branchStyle=style;tab.state.strokeScale=scale;tab.state.isDirty=true;count++;}
  this.recalculateAndRender();this.nm54SyncSettings?.();this.renderTabBar();this.scheduleSave();
  this.showToast(`Stile applicato a ${this.tabs.length} schede (${count} modificate)`,'STILE');
};
NeuroMapApp.prototype.nm67NavigateMain=function(direction=1){
  const branches=(this.state.root.children||[]).filter(n=>!n.isSummary&&!n.isFloating);
  if(!branches.length){this.showToast('Questa mappa non ha rami principali','NAVIGAZIONE');return;}
  // Follow the meaningful stable tree order, even when some branches are collapsed.
  const selected=this.state.findNode(this.state.selectedNodeId);
  let top=selected;
  while(top&&top.parentId&&top.parentId!==this.state.root.id)top=this.state.findNode(top.parentId);
  let position=branches.findIndex(n=>n.id===top?.id);
  if(position<0&&Number.isInteger(this._nm67MainIndex))position=this._nm67MainIndex;
  const next=position<0?(direction>0?0:branches.length-1):(position+direction+branches.length)%branches.length;
  this._nm67MainIndex=next;
  this.teleportToNode(branches[next].id);
  this.showToast(`${next+1}/${branches.length} · ${branches[next].text}`,'RAMO');
};
function nm67PDFWriter(){
  const enc=new TextEncoder();const chunks=[],offsets=[0];let bytes=0;
  function write(data){const value=typeof data==='string'?enc.encode(data):data;chunks.push(value);bytes+=value.length;}
  function obj(id,body){offsets[id]=bytes;write(id+' 0 obj\n');write(body);write('\nendobj\n');}
  write('%PDF-1.4\n%NeuroMap\n');
  function stream(id,dict,data){offsets[id]=bytes;write(id+' 0 obj\n'+dict+'\nstream\n');write(data);write('\nendstream\nendobj\n');}
  return {write,obj,stream,finish(max){const xref=bytes;write('xref\n0 '+(max+1)+'\n0000000000 65535 f \n');
    for(let i=1;i<=max;i++)write(String(offsets[i]||0).padStart(10,'0')+' 00000 n \n');
    write('trailer\n<< /Size '+(max+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
    return new Blob(chunks,{type:'application/pdf'});}};
}
MindMapIOManager.prototype.renderGraphicalPDFPages=async function(options={}){
  await this.app.renderer.prepareExportImages();
  const app=this.app,plan=NeuroMapGraphics.exportPlan(NeuroMapGraphics.bounds(app),options);
  const {pageW,pageH,margin,innerW,innerH,worldPerPt,cols,rows}=plan,total=cols*rows;
  // Preserve detail when zooming the fitted page, within the same pixel budget as PNG.
  const jpgPixelScale=Math.min(Math.max(2,worldPerPt*2),10000/innerW,10000/innerH,Math.sqrt(32000000/(innerW*innerH)));
  if(!options?.silent)app.showToast('PDF · '+total+'…','PDF');
  const rendered=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const off=document.createElement('canvas');off.width=Math.ceil(innerW*jpgPixelScale);off.height=Math.ceil(innerH*jpgPixelScale);
    const ctx=off.getContext('2d',{alpha:false});if(!ctx)throw Error('Memoria grafica insufficiente per generare il PDF.');
    ctx.fillStyle=NeuroMapGraphics.background();ctx.fillRect(0,0,off.width,off.height);
    const worldX=plan.startX+col*innerW*worldPerPt,worldY=plan.startY+row*innerH*worldPerPt;
    app.renderer.render(ctx,{scale:jpgPixelScale/worldPerPt,tx:-worldX,ty:-worldY});
    const image=await new Promise(resolve=>off.toBlob(resolve,'image/jpeg',.87));
    if(!image)throw Error('Impossibile codificare una pagina JPEG per il PDF.');
    const data=new Uint8Array(await image.arrayBuffer());
    rendered.push({data,width:off.width,height:off.height,pageW,pageH,margin,innerW,innerH});
    off.width=1;off.height=1;
    const pageNumber=row*cols+col+1;
    if(pageNumber%4===0)await new Promise(requestAnimationFrame); // keep UI interactive
  }
  return rendered;
};
MindMapIOManager.prototype.buildGraphicalPDFBlob=function(renderedPages){
  const PDF=nm67PDFWriter(),pages=[],fontId=3;let id=4;
  for(const pg of renderedPages){
    const pageW=pg.pageW||841.89,pageH=pg.pageH||595.28,margin=Number.isFinite(pg.margin)?pg.margin:28;
    const innerW=pg.innerW||(pageW-margin*2),innerH=pg.innerH||(pageH-margin*2);
    const imageId=id++,contentId=id++,pageId=id++;
    PDF.stream(imageId,'<< /Type /XObject /Subtype /Image /Width '+pg.width+' /Height '+pg.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+pg.data.length+' >>',pg.data);
    const draw='q\n'+innerW.toFixed(2)+' 0 0 '+innerH.toFixed(2)+' '+margin+' '+margin+' cm\n/Im0 Do\nQ\n';
    const content=new TextEncoder().encode(draw);
    PDF.obj(contentId,'<< /Length '+content.length+' >>\nstream\n'+draw+'endstream');
    PDF.obj(pageId,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageW+' '+pageH+'] /Resources << /XObject << /Im0 '+imageId+' 0 R >> /Font << /F1 '+fontId+' 0 R >> >> /Contents '+contentId+' 0 R >>');
    pages.push(pageId);
  }
  PDF.obj(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  PDF.obj(2,'<< /Type /Pages /Kids ['+pages.map(n=>n+' 0 R').join(' ')+'] /Count '+pages.length+' >>');
  PDF.obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  return PDF.finish(id-1);
};
MindMapIOManager.prototype.exportPDF=async function(options={}){
  const app=this.app,rendered=await this.renderGraphicalPDFPages(options);
  // PDF xref offsets are based on actual bytes, including binary JPEG data.
  const blob=this.buildGraphicalPDFBlob(rendered);
  const fname=this.sanitizeFilename(app.state.root.text)+'.pdf';
  if(options?.captureOnly)return {data:new Uint8Array(await blob.arrayBuffer()),blob,name:fname,pages:rendered};
  const saved=await this.triggerDownload(blob,fname);if(saved===false)return false;
  app.showToast('PDF · '+rendered.length+' · '+(options.paper==='a4'?'A4':'A3'),'EXPORT PDF');return true;
};
const nm67UIbind=NeuroMapApp.prototype.bindUI;
NeuroMapApp.prototype.bindUI=function(...args){
  const result=nm67UIbind.apply(this,args);
  const on=(id,fn)=>document.getElementById(id)?.addEventListener('click',fn);
  on('nm67-prev-main',()=>this.nm67NavigateMain(-1));
  on('nm67-next-main',()=>this.nm67NavigateMain(1));
  on('nm67-apply-all-styles',()=>this.nm67AllStyles());
  on('nm67-notes-context',()=>this.nm67OpenNotes());
  on('nm67-notes-close',()=>document.getElementById('nm67-notes-overlay').classList.add('hidden'));
  on('nm67-notes-save',()=>this.nm67SaveNotes());
  document.getElementById('nm67-notes-editor')?.addEventListener('input',()=>this.nm67NotesPreview());
  // Level-aware navigation and sibling reordering are handled by the configurable Tasti shortcuts.
  return result;
};
/* ==================== end NeuroMap 6.7 ==================== */

