'use strict';
// Offline, deterministic 7.4 stress suite. Run: npm run test:stress
// No GitHub Actions, external connections, cloud sync, or destructive file writes.
async function run(mod){
 const begin=Date.now(),failures=[],times=[],seedStart=7402026;let count=0,seed=seedStart>>>0;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const ok=(v,name,detail)=>{count++;if(!v)failures.push({name,detail:String(detail||'').slice(0,300)})};
 const {work,quality,html,calendar,anki,documentImport,pdf,exchange}=mod;
 const tree=n=>{
  const all=Array.from({length:n},(_,i)=>({id:'n'+i,text:'Concept '+i,children:[]}));
  for(let i=1;i<n;i++)all[Math.floor(random()*i)].children.push(all[i]);
  return all[0];
 };
 for(const n of [2,100,1200,1999,3499]){
  const root=tree(n),before=JSON.stringify(root),t=Date.now();
  const scan=quality.inspect({tabs:[{id:'t',state:{root,images:[],relationships:[]}}]});
  ok(scan.counts.nodes===n,'scan-'+n,scan.counts.nodes);
  ok(JSON.stringify(root)===before,'scan-readonly-'+n);
  const content=html.render(root);
  ok(content.includes('Concept '+(n-1)),'html-'+n);
  ok(content.includes('Content-Security-Policy'),'html-csp-'+n);
  ok(work.candidates(root,3500).length===n-1,'work-'+n);
  times.push({label:'tree-'+n,ms:Date.now()-t,nodes:n});
 }
 // Seeded property checks: 600 additional random topologies, each projected
 // through independent quality, work and sharing engines.
 let fuzzStart=Date.now();
 for(let round=0;round<600;round++){
  const n=8+Math.floor(random()*620),root=tree(n);
  const found=quality.inspect({tabs:[{id:'fuzz',state:{root}}]});
  ok(found.counts.nodes===n,'fuzz-nodes-'+round,found.counts.nodes);
  ok(work.candidates(root,3500).length===n-1,'fuzz-work-'+round);
  ok(html.render(root).includes('Concept '+(n-1)),'fuzz-export-'+round);
 }
 times.push({label:'600-seeded-random-topologies',ms:Date.now()-fuzzStart,cases:600});
 const cyclic=tree(18);cyclic.children.push(cyclic);
 try{quality.inspect({tabs:[{id:'bad',state:{root:cyclic}}]});ok(false,'cyclic-audit')}
 catch(e){ok(/Cyclic/.test(e.message),'cyclic-audit',e.message)}
 try{html.render(cyclic);ok(false,'cyclic-share')}
 catch(e){ok(true,'cyclic-share')}
 const many=Array.from({length:20},(_,i)=>({id:'t'+i,state:{root:{id:'root'+i,text:'Root',
  children:Array.from({length:1800},(_,j)=>({id:'t'+i+'n'+j,text:'n'+j,children:[]}))},
  images:[],relationships:[]}}));
 let t=Date.now(),q=quality.inspect({tabs:many});
 ok(q.counts.nodes===36020,'twenty-tabs',q.counts.nodes);
 times.push({label:'20-tabs',ms:Date.now()-t,nodes:36020});
 const project={id:'r',text:'Tasks',children:[]};
 for(let i=0;i<1900;i++)project.children.push({id:'task'+i,text:'Task '+i,children:[],
  startDate:'2026-10-23',dueDate:'2026-10-25',taskDependsOn:i?['task'+(i-1)]:[]});
 t=Date.now();
 for(let i=0;i<120;i++){
  const node='task'+(1899-i),parent='task'+(1898-i);
  try{ok(work.validateDependencies(project,node,[parent]).length===1,'dag-'+i)}
  catch(e){ok(false,'dag-'+i,e.message)}
 }
 try{work.validateDependencies(project,'task0',['task1899']);ok(false,'cycle-rejected')}
 catch(e){ok(/cycle/i.test(e.message),'cycle-rejected',e.message)}
 const links=work.project(project,'timeline',{maxNodes:2000}).edges;
 ok(links.length===1899,'gantt-edges',links.length);
 times.push({label:'dependency-dag',ms:Date.now()-t,nodes:1900});
 const xss={id:'root',text:'Safe',notes:'PRIVATE-MAP-NOTES',children:[
  {id:'child',text:'</script><script>alert(1)</script>',children:[]}]};
 const share=html.render(xss);
 ok(!share.includes('PRIVATE-MAP-NOTES'),'notes-private');
 ok(!share.includes('</script><script>alert(1)'),'xss-escaped');
 ok(share.includes('\\u003c/script\\u003e'),'script-delimiter');
 ok(html.render(xss,{notes:true}).includes('PRIVATE-MAP-NOTES'),'notes-opt-in');
 const schedule=calendar.render({id:'r',text:'Project',children:[
  {id:'a',text:'Review, A; B',taskStatus:'doing',startDate:'2026-10-23',dueDate:'2026-10-25',children:[]}
 ]},{now:'2026-10-23T14:00:00Z'});
 ok(schedule.count===1,'ics-count');
 ok(schedule.content.includes('DTEND;VALUE=DATE:20261026'),'ics-exclusive-date');
 ok(schedule.content.includes('SUMMARY:Review\\, A\\; B'),'ics-escape');
 const pairs=Array.from({length:500},(_,i)=>({question:'Q'+i,answer:'A'+i}));
 ok(anki.parse(anki.exportTSV(pairs)).length===500,'anki-500');
 try{anki.parse(Array.from({length:501},(_,i)=>'Q'+i+'\tA'+i).join('\n'));ok(false,'anki-limit')}
 catch(e){ok(/500/.test(e.message),'anki-limit',e.message)}
 const imported=await documentImport.preview({name:'notes.txt',size:13050,
  text:async()=> 'A'.repeat(13000)+'\nsecond line'});
 ok(imported.root.children[0].notes.length===13012,'full-text-import');
 try{await documentImport.preview({name:'too_long.txt',size:47000,
  text:async()=> 'B'.repeat(47000)});ok(false,'no-text-truncation')}
 catch(e){ok(/45,000/.test(e.message),'no-text-truncation',e.message)}
 function localPDF(word){
  const str='%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'+
  '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'+
  '3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n'+
  '4 0 obj\n<<>>\nstream\nBT ('+word+') Tj ET\nendstream\nendobj\n%%EOF';
  const bytes=Uint8Array.from(str,c=>c.charCodeAt(0)&255);
  return {size:bytes.length,arrayBuffer:async()=>bytes.buffer};
 }
 const good=await pdf.inspect(localPDF('Verified source'));
 ok(good.pages[0].text==='Verified source','pdf-text');
 const bad=await pdf.inspect(localPDF('A'.repeat(46000)));
 ok(bad.pages[0].text===''&&bad.unreadablePages===1,'pdf-no-truncation');
 const original={schema:'NeuroMapArchitect-SingleTab-v6',root:{id:'root',text:'Project',
  children:[{id:'a',text:'Original',children:[]}]},images:[],relationships:[],studyCards:[]};
 try{
  const copy=await exchange.create(original);
  const same=await exchange.inspect(copy,{...original,savedAt:'2026-10-24T10:00:00Z'});
  ok(same.status==='identical','portable-same');
  const changed=await exchange.inspect(copy,{...original,root:{...original.root,
   children:[{id:'a',text:'Changed',children:[]}]}});
  ok(changed.status==='divergent'&&changed.differences.modified===1,'portable-conflict');
  copy.project.root.children[0].text='Tampered';
  try{await exchange.inspect(copy,original);ok(false,'portable-tamper')}
  catch(e){ok(/checksum/.test(e.message),'portable-tamper',e.message)}
 }catch(e){ok(false,'portable-web-crypto',e.message)}
 return {suite:'NeuroMap v7.4 deterministic source stress',passed:failures.length===0,
  checks:count,failures,seed:seedStart,timings:times,elapsedMs:Date.now()-begin,
  nativeWindowsTested:false,nativeMacTested:false,playwrightTested:false};
}
if(typeof module==='object'&&module.exports)module.exports={run};
if(typeof require==='function'&&require.main===module){
 (async()=>{
  if(!globalThis.crypto)globalThis.crypto=require('node:crypto').webcrypto;
  const work=require('../../packages/editor-ui/work-core.js');
  globalThis.NeuroMapWorkCore=work;
  const report=await run({
   work,quality:require('../../apps/desktop-shared/editor/quality-core.js'),
   html:require('../../apps/desktop-shared/editor/share-html-core.js'),
   calendar:require('../../apps/desktop-shared/editor/task-calendar-core.js'),
   anki:require('../../apps/desktop-shared/editor/anki-tsv-core.js'),
   documentImport:require('../../apps/desktop-shared/editor/document-import-core.js'),
   pdf:require('../../apps/desktop-shared/editor/source-lens-pdf.js'),
   exchange:require('../../apps/desktop-shared/editor/portable-exchange-core.js')
  });
  console.log(JSON.stringify(report,null,2));
  if(!report.passed)process.exitCode=1;
 })().catch(e=>{console.error(e);process.exitCode=1});
}
