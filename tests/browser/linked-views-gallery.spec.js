// Opt-in visual proof for the public website. Screenshots are captured from the
// running Glauka desktop editor, not generated mockups or fabricated UI.
// Local execution: npx playwright test tests/browser/linked-views-gallery.spec.js
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
function checkoutCommit(){
 try{return execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}
 catch{return null}
}
function pngInfo(filename){
 const bytes=fs.readFileSync(filename);
 const header='89504e470d0a1a0a';
 if(bytes.length<24||bytes.subarray(0,8).toString('hex')!==header)throw Error('Invalid PNG artifact: '+filename);
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(width<640||height<320)throw Error('Gallery capture is unexpectedly small: '+width+' × '+height);
 return {width,height,bytes:bytes.length};
}
const EXPECTED_RENDERED_NODES=Object.freeze({
 orgchart:10,'concept-tree':10,'concept-network':10,flowchart:6,kanban:9,timeline:6
});
const DEMOS=[
 {mode:'orgchart',preset:'corporate',orientation:'horizontal'},
 {mode:'concept-tree',preset:'academic'},
 {mode:'concept-network',preset:'cluster'},
 {mode:'flowchart',preset:'blueprint'},
 {mode:'kanban',preset:'soft-saas'},
 {mode:'timeline',preset:'roadmap'}
];
test.use({viewport:{width:1560,height:980},deviceScaleFactor:2});

async function loadRealDemo(page,definition){
 await page.goto((process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html'));
 await page.waitForFunction(()=>Boolean(
  window.neuroMapApp&&window.NeuroMapLinkedViews&&window.NeuroMapViewAppearance&&
  document.getElementById('nm-view-overlay')));
 const fixture=await page.evaluate(({mode,preset,orientation})=>{
  document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden'));
  const app=window.neuroMapApp,state=app.state;
  state.root.text='Ricerca neuroscientifica';
  state.root.children=[];
  state.relationships=[];
  // Curated for legible real screenshots at fit-to-view, not artificial data.
  // The same 10 canonical nodes power all six presentations.
  const groups=[
   ['Studio',['Ipotesi','Protocollo']],
   ['Raccolta',['EEG','Analisi']],
   ['Esito',['Conferma','Revisione']]
  ];
  const ids=new Map();
  for(const [group,children]of groups){
   const parent=state.addChildNode(state.root.id,app.layout,group);
   ids.set(group,parent.id);
   for(const text of children){
    const node=state.addChildNode(parent.id,app.layout,text);
    ids.set(text,node.id);
   }
  }
  // Explicit relationships only: nothing is inferred from sibling order.
  for(const [a,z,label]of [
   ['Ipotesi','Analisi','orienta'],
   ['EEG','Analisi','produce segnali'],
   ['Conferma','Ipotesi','sostiene'],
   ['Revisione','Protocollo','migliora']
  ])state.addRelationship(ids.get(a),ids.get(z),label);
  for(const [a,z,kind]of [
   ['Ipotesi','Protocollo','sequence'],
   ['Protocollo','EEG','sequence'],
   ['EEG','Analisi','sequence'],
   ['Analisi','Conferma','yes'],
   ['Analisi','Revisione','no']
  ])state.addFlowTransition(ids.get(a),ids.get(z),kind);
  const statuses=['todo','doing','doing','done','todo','done'];
  const tasks=groups.flatMap(([group,children])=>children);
  tasks.forEach((text,i)=>state.setNodeWorkMetadata(ids.get(text),{taskStatus:statuses[i]}));
  for(const [text,from,to]of [
   ['Ipotesi','2026-11-03',null],
   ['Protocollo','2026-11-04','2026-11-07'],
   ['EEG','2026-11-08',null],
   ['Analisi','2026-11-09','2026-11-12'],
   ['Conferma','2026-11-13',null],
   ['Revisione','2026-11-16',null]
  ])state.setNodeWorkMetadata(ids.get(text),{
   startDate:from,dueDate:to||''
  });
  state.root.viewAppearance=window.NeuroMapViewAppearance.update(
   state.root.viewAppearance,mode,{preset,...(orientation?{orientation}:{})});
  app.markChanged();
  window.NeuroMapLinkedViews.setMode(app,mode);
  const nodes=state.root.children.flatMap(n=>[n,...(n.children||[])]);
  return {count:nodes.length,
    uniqueIds:new Set(nodes.map(n=>n.id)).size,
    relationships:state.relationships.length,
    processLinks:state.relationships.filter(r=>['sequence','yes','no'].includes(r.kind)).length,
    dated:nodes.filter(n=>n.startDate||n.dueDate).length,
    withStatus:nodes.filter(n=>n.taskStatus).length};
 },definition);
 expect(fixture).toEqual({count:9,uniqueIds:9,relationships:9,processLinks:5,dated:6,withStatus:6});
 await expect(page.locator('#nm-view-overlay')).toBeVisible();
 await expect(page.locator('#nm-view-appearance-theme')).toHaveValue(definition.preset);
 await expect(page.locator('#nm-view-stage .nm-view-card')).toHaveCount(EXPECTED_RENDERED_NODES[definition.mode]);
 const fit=page.locator('#nm-view-zoom-fit');
 await expect(fit).toBeVisible();
 await fit.click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(
   ()=>requestAnimationFrame(resolve)))); // wait for actual layout frames
 await expect(page.locator('#nm-view-frame')).toBeVisible();
 const geometry=await page.locator('#nm-view-stage .nm-view-card').evaluateAll(cards=>{
  const get=card=>card.getBoundingClientRect();
  const good=cards.every(card=>{
    const r=get(card);
    return r.width>4&&r.height>4&&[r.x,r.y,r.width,r.height].every(Number.isFinite);
  });
  let overlaps=0;
  for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){
    const a=get(cards[i]),b=get(cards[j]);
    if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>4&&
       Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>4)overlaps++;
  }
  return {good,overlaps};
 });
 expect(geometry.good,'Every card must have finite nonzero geometry').toBe(true);
 expect(geometry.overlaps,'Demo should not produce intersecting card rectangles').toBe(0);
}

test.describe('real linked-view website gallery capture',()=>{
 for(const definition of DEMOS){
  test(definition.mode+' / '+definition.preset+' — authentic app screenshots',async({page},testInfo)=>{
   await loadRealDemo(page,definition);
   const before=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    return {nodes:app.state.root.children.flatMap(n=>[n,...(n.children||[])]).length,
      relations:app.state.relationships.length,
      mode:app.state.root.viewMode,
      appearance:app.state.root.viewAppearance,
      canonical:JSON.stringify({children:app.state.root.children,relationships:app.state.relationships})};
   });
   expect(before.nodes).toBe(9);
   expect(before.relations).toBe(9);
   expect(before.mode).toBe(definition.mode);
   expect(before.appearance.modes[definition.mode].preset).toBe(definition.preset);
   if(definition.orientation)expect(before.appearance.modes[definition.mode].orientation).toBe(definition.orientation);
   const heroPath=testInfo.outputPath(definition.mode+'-hero.png');
   const galleryPath=testInfo.outputPath(definition.mode+'-gallery.png');
   await page.locator('#nm-view-overlay').screenshot({path:heroPath,animations:'disabled'});
   await page.locator('#nm-view-scroller').screenshot({path:galleryPath,animations:'disabled'});
   const heroInfo=pngInfo(heroPath),galleryInfo=pngInfo(galleryPath);
   expect(await page.evaluate(()=>JSON.stringify({
     children:window.neuroMapApp.state.root.children,
     relationships:window.neuroMapApp.state.relationships
   }))).toBe(before.canonical);
   await testInfo.attach(definition.mode+' product hero',{path:heroPath,contentType:'image/png'});
   await testInfo.attach(definition.mode+' gallery canvas',{path:galleryPath,contentType:'image/png'});
   const manifest={
    kind:'authentic-glauka-browser-capture',
    mode:definition.mode,preset:definition.preset,
    orientation:definition.orientation||null,
    source:'Glauka desktop browser preview, served locally by scripts/dev/serve.py (macos target)',
    commit:checkoutCommit(),
    capturedAt:new Date().toISOString(),
    executionPlatform:process.platform,
    browserName:testInfo.project.name||'chromium',
    browserVersion:page.context().browser()?.version()||null,
    viewport:{width:1560,height:980,deviceScaleFactor:2},
    canonicalNodeCount:before.nodes,relationshipCount:before.relations,
    demoLabel:'Ricerca neuroscientifica — 3 gruppi, 6 attività',
    screenshotArtifacts:{
      hero:{file:definition.mode+'-hero.png',...heroInfo},
      gallery:{file:definition.mode+'-gallery.png',...galleryInfo}
    },
    disclaimer:'Real local preview capture, not a released native app. QA approval and image ratio review required before public website use.'
   };
   fs.writeFileSync(testInfo.outputPath('manifest.json'),JSON.stringify(manifest,null,2)+'\n');
   await testInfo.attach(definition.mode+' capture manifest',{
    path:testInfo.outputPath('manifest.json'),contentType:'application/json'
   });
  });
 }
});

// Explicit opt-in: the real renderer regenerates publishable bilingual assets.
// Run with playwright.capture.config.js and GLAUKA_CAPTURE_LOCALIZED=1.
test.describe('localized production website captures',()=>{
 test.skip(process.env.GLAUKA_CAPTURE_LOCALIZED!=='1','Explicit asset regeneration only');
 for(const language of ['it','en'])test(language+' captures all seven views and both gallery examples',async({browser})=>{
  test.setTimeout(60000);
  const {captureLanguage,MODES}=require('../../scripts/dev/capture-website-localized.cjs');
  const manifest=await captureLanguage(language,{browser});
  expect(manifest.assets).toHaveLength(9);
  expect(manifest.assets.filter(a=>a.view).map(a=>a.view)).toEqual(MODES.map(m=>m[1]));
  for(const asset of manifest.assets){
   expect(asset.editorLanguage).toBe(language);
   expect(asset.width).toBeGreaterThanOrEqual(1600);
   expect(asset.height).toBeGreaterThanOrEqual(600);
   expect(asset.labels.length).toBeGreaterThan(0);
   expect(asset.cards?.every(c=>c.visible)??true).toBe(true);
  }
 });
});
