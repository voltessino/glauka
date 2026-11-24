#!/usr/bin/env node
// Real local WASM inference against an explicitly synthetic, self-authored corpus.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),Q=require('../../apps/desktop-shared/editor/ocr-quality');
const {chromium}=require('@playwright/test'),{cases,corpus}=require('../../tests/browser/ocr-benchmark-fixture');
const args=process.argv.slice(2),arg=(k,d)=>{const n=args.indexOf(k);return n<0?d:args[n+1]};
function distance(a,b){let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=next}return prev[b.length]}
const clean=s=>s.normalize('NFC').toLocaleLowerCase('it-IT').replace(/\s+/g,' ').trim();
function metric(a,b){a=clean(a);b=clean(b);const words=a.split(' ');return {characters:a.length,charErrors:distance([...a],[...b]),words:words.length,wordErrors:distance(words,b.split(' '))}}
(async()=>{
 const base=arg('--base-url','http://127.0.0.1:5287'),output=path.resolve(arg('--output','/tmp/neuromap-ocr-benchmark')),repo=path.resolve(__dirname,'../..');
 if(output===repo||output.startsWith(repo+path.sep)||fs.existsSync(output))throw Error('Choose a fresh output folder outside the checkout');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));const external=[];
  context.on('request',r=>{if(!r.url().startsWith(base+'/')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url())});
  const page=await context.newPage();await page.goto(base+'/index.html');await page.waitForFunction(()=>window.NeuroMapOCR&&window.NeuroMapOCRQuality);
  const pdf=await corpus(page);fs.writeFileSync(path.join(output,'synthetic-corpus.pdf'),pdf);
  const runs={};for(const enhance of [false,true]){
   const begin=Date.now();runs[enhance?'enhanced':'baseline']=await page.evaluate(async({bytes,enhance,count})=>{
    const file=new File([new Uint8Array(bytes)],'synthetic-corpus.pdf',{type:'application/pdf'}),times=[],start=performance.now();let current=start;
    const out=await NeuroMapOCR.analyze(file,'1-'+count,{enhance,order:enhance?'auto':'engine',onPage:()=>{times.push(performance.now()-current);current=performance.now()}});
    const elapsedMs=performance.now()-start;const results=await Promise.all(out.results.map(async(r,i)=>({page:r.page,text:r.text,rawText:r.rawText,processing:r.processing,orderMode:r.orderMode,orderAmbiguous:r.orderAmbiguous,milliseconds:times[i],originalPreviewSha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.preview)))].map(n=>n.toString(16).padStart(2,'0')).join('')})));return {results,elapsedMs};
   },{bytes:Array.from(pdf),enhance,count:cases.length});console.log((enhance?'enhanced':'baseline')+' '+(Date.now()-begin)+'ms');
  }
  const moduleHashes=Object.fromEntries(['ocr-image','ocr-quality','ocr-runtime','ocr-core'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,'apps/desktop-shared/editor',n+'.js'))).digest('hex')]));
  const report={synthetic:true,browser:browser.version(),platform:process.platform,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),sourceModuleSha256:moduleHashes,source:'self-authored canvas pages, no real lecture notes or patient data',engine:'Tesseract.js 6.0.1 / core 6.0.0 / pinned ita best',pdfSha256:crypto.createHash('sha256').update(pdf).digest('hex'),generatedAt:new Date().toISOString(),externalRequests:external,cases:cases.map((c,i)=>{
   const truth=c.text.join('\n'),a=runs.baseline.results[i],b=runs.enhanced.results[i];const extra=r=>({numericSourceDifferences:Q.numericReview(r.text,truth).alerts.filter(a=>a.kind==='differs-from-source').map(a=>a.value),associationMisses:c.table?c.text.filter(line=>!clean(r.text).includes(clean(line))):[]});return {id:c.id,truth,originalPreviewUnchanged:a.originalPreviewSha256===b.originalPreviewSha256,baseline:{...a,...metric(truth,a.text),...extra(a)},enhanced:{...b,...metric(truth,b.text),...extra(b)}}
  })};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  if(external.length)throw Error('Unexpected external request');
  for(const c of report.cases){
   if(!c.originalPreviewUnchanged)throw Error('Original preview changed: '+c.id);
   if(c.enhanced.charErrors>c.baseline.charErrors)throw Error('Synthetic recognition regression: '+c.id);
  }
  for(const id of ['columns','table']){const c=report.cases.find(c=>c.id===id);if(c.enhanced.charErrors>=c.baseline.charErrors)throw Error('Expected reading-order improvement: '+id)}
  for(const r of report.cases)console.log(r.id,JSON.stringify({baselineCER:r.baseline.charErrors/r.baseline.characters,enhancedCER:r.enhanced.charErrors/r.enhanced.characters,processing:r.enhanced.processing}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
