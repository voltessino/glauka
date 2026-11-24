/* Source Lens 2.0 — progressive enhancement of the existing PDF citation form.
 * Text stays on-device; selected excerpts enter the original Undo-safe form.
 */
(function(root){
 'use strict';
 const original=root.NeuroMapSourceUI,engine=root.NeuroMapPdfText,Core=root.NeuroMapSourceCore;
 if(!original||!engine||!Core)return;
 const tr=(it,en)=>(globalThis.GlaukaI18n?.pair(it,en) ?? (document.documentElement.lang==='en'?en:it));
 const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
 const css=[
 '#nm-knowledge-panel .nm-sl2{display:grid;gap:8px;padding:10px;margin:10px 0;background:linear-gradient(150deg,#10274a,#06142e);border:1px solid #3875dc;border-radius:12px}',
 '#nm-knowledge-panel .nm-sl2>*{min-width:0}',
 '#nm-knowledge-panel .nm-sl2 .nm-sl2-search{box-sizing:border-box;width:100%;padding:8px;border:1px solid #4a76b3;border-radius:8px;background:#091c38;color:#fff}',
 '#nm-knowledge-panel .nm-sl2 .nm-sl2-pages{display:flex;gap:5px;flex-wrap:wrap;max-height:116px;overflow:auto}',
 '#nm-knowledge-panel .nm-sl2 textarea{min-height:130px;width:100%;box-sizing:border-box;padding:9px;border:1px solid #4a76b3;border-radius:8px;background:#091c38;color:#fff}',
 '#nm-knowledge-panel .nm-sl2 small{font-size:11px;line-height:1.45;color:#bbd2f2}',
 '#nm-knowledge-panel .nm-sl2 .nm-sl2-pages button[aria-pressed=true]{background:#104e8b;border-color:#71dfff}',
 '#nm-knowledge-panel .nm-sl2 :focus-visible{outline:2px solid #6dddf7;outline-offset:2px}'
 ].join('\n');
 let session={owner:null,file:null,version:0,result:null,activePage:1};
 function reset(owner){session={owner,file:null,version:session.version+1,result:null,activePage:1};}
 function decorate({app,scroll}){
  const host=scroll.querySelector('.nm-source-form');if(!host)return;
  if(session.owner!==app.activeTabId)reset(app.activeTabId);
  const picker=host.querySelector('input[type="file"]');
  const pageInput=host.querySelector('input[type="number"]');
  const quote=host.querySelector('textarea');
  if(!picker||!pageInput||!quote)return;
  if(!document.getElementById('nm-source-2-style')){
   const style=el('style');style.id='nm-source-2-style';style.textContent=css;document.head.append(style);
  }
  const box=el('section','nm-sl2');box.setAttribute('aria-label','Source Lens 2.0');
  box.append(el('strong','',tr('Source Lens 2.0 · testo PDF','Source Lens 2.0 · PDF text')));
  box.append(el('small','',tr(
   'Seleziona un PDF sopra e premi Leggi testo. Cerca e seleziona un passaggio, poi verifica la pagina originale.',
   'Choose a PDF above and click Read text. Search and select a passage, then verify the original page.')));
  const read=el('button','',tr('Leggi testo del PDF sul dispositivo','Read PDF text on this device'));
  read.type='button';box.append(read);
  const status=el('small','');status.setAttribute('role','status');box.append(status);
  const search=el('input','nm-sl2-search');search.type='search';
  search.placeholder=tr('Cerca nel documento…','Search this document…');search.setAttribute('aria-label',search.placeholder);
  box.append(search);
  const hits=el('div','nm-sl2-pages');
  const pageLabel=el('strong','',tr('Pagina','Page'));
  const pageText=el('textarea');pageText.readOnly=true;
  pageText.setAttribute('aria-label',tr('Testo estratto: seleziona le parole da citare','Extracted text: select words to quote'));
  const use=el('button','',tr('Usa selezione come citazione','Use selected text as quote'));use.type='button';
  box.append(hits,pageLabel,pageText,use);
  const actions=host.querySelector('.nm-source-actions');
  const parent=actions?.parentElement;
  if(parent)parent.insertBefore(box,actions);else host.append(box);
  function showPage(number){
   if(!session.result)return;
   const p=session.result.pages.find(x=>x.page===number);if(!p)return;
   session.activePage=number;pageLabel.textContent=tr('Pagina ','Page ')+number+' / '+session.result.pages.length;
   pageText.value=p.text;pageInput.value=String(number);
   pageInput.dispatchEvent(new Event('change',{bubbles:true}));
   for(const b of hits.querySelectorAll('button[data-p]'))
    b.setAttribute('aria-pressed',String(Number(b.dataset.p)===number));
   status.textContent=p.text?tr('Verifica il testo nel PDF originale.','Verify the original PDF.'):
    tr('Nessun testo leggibile: incolla manualmente.','No readable text: paste manually.');
  }
  function showHits(){
   hits.replaceChildren();if(!session.result)return;
   const q=search.value.trim();
   const rows=q?engine.search(session.result.pages,q):
    session.result.pages.filter(x=>x.text).slice(0,30).map(p=>({page:p.page}));
   for(const item of rows){
    const b=el('button','',tr('Pag. ','Page ')+item.page);b.type='button';
    b.dataset.p=String(item.page);b.title=item.excerpt||'';
    b.addEventListener('click',()=>showPage(item.page));hits.append(b);
   }
   if(!rows.length)hits.append(el('small','',tr('Nessuna corrispondenza.','No matches.')));
  }
  search.addEventListener('input',showHits);
  picker.addEventListener('change',()=>{
   session.file=picker.files?.[0]||null;session.result=null;session.version++;session.activePage=1;
   pageText.value='';hits.replaceChildren();
   status.textContent=session.file?tr('PDF selezionato: premi Leggi testo.','PDF selected: click Read text.'):'';
  });
  use.addEventListener('click',()=>{
   if(!session.result)return;
   const part=pageText.value.slice(pageText.selectionStart,pageText.selectionEnd).trim();
   if(!part){status.textContent=tr('Seleziona prima del testo nella pagina.','Select text on the page first.');pageText.focus();return;}
   quote.value=part.slice(0,Core.MAX_QUOTE);
   pageInput.value=String(session.activePage);
   pageInput.dispatchEvent(new Event('change',{bubbles:true}));quote.focus();
  });
  read.addEventListener('click',async()=>{
   const file=picker.files?.[0]||session.file;
   if(!file||!Core.isPDF(file)){status.textContent=tr('Scegli un PDF valido nel campo sopra.','Choose a valid PDF above.');return;}
   const maxMb=Math.max(1,Math.round((engine.MAX_BYTES||512*1024*1024)/(1024*1024)));
   if(file.size>engine.MAX_BYTES){status.textContent=tr(`Estrazione fino a ${maxMb} MB; la citazione manuale resta disponibile.`,`Extraction supports up to ${maxMb} MB; manual citation remains available.`);return;}
   const version=session.version,owner=app.activeTabId;
   read.disabled=true;status.textContent=tr('Lettura locale del PDF…','Reading PDF locally…');
   try{
    const result=await engine.inspect(file);
    if(version!==session.version||owner!==app.activeTabId||session.owner!==owner)return;
    session.file=file;session.result=result;
    showHits();showPage(Math.min(session.activePage,result.pages.length));
    status.textContent=tr('Pagine: ','Pages: ')+result.pages.length+
     tr(' · senza testo: ',' · without text: ')+result.unreadablePages+
     tr('. Controlla la pagina originale.','. Verify the original page.');
   }catch(e){if(version===session.version)status.textContent=tr('Testo non disponibile: ','Text unavailable: ')+String(e.message||e);}
   finally{read.disabled=false;}
  });
  if(session.result){showHits();showPage(Math.min(session.activePage,session.result.pages.length));}
 }
 root.NeuroMapSourceUI=Object.freeze({draw(args){original.draw(args);decorate(args)},
  hasVerified:original.hasVerified,openCited:original.openCited,chip:original.chip
 });
})(globalThis);
