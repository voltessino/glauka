const {chooseTool}=require('./android-tools-helper');
const {test,expect}=require('@playwright/test');
const {pdfFixture}=require('./pdfjs-fixture');
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
});
const sizes=[
 {width:320,height:568},{width:360,height:740},{width:393,height:852},
 {width:412,height:915},{width:600,height:960},{width:768,height:1024},
 {width:1024,height:600},{width:1280,height:800},
 {width:852,height:393},{width:740,height:360}
];
for(const size of sizes){
 test('adaptive Android 7.4 workspace '+size.width+'x'+size.height,async({page})=>{
  await page.setViewportSize(size);
  await page.goto('/app/index.html');
  await page.waitForFunction(()=>window.NeuroMapAndroid74&&window.neuroMapApp&&window.NeuroMapQualityCore);
  const button=page.locator('#nm74-launch');
  await expect(button).toBeVisible();
  await button.click();
  const modal=page.locator('#nm74-overlay');
  await expect(modal).toBeVisible();
  const box=await modal.locator('.nm74-sheet').boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x+box.width).toBeLessThanOrEqual(size.width+2);
  expect(box.y+box.height).toBeLessThanOrEqual(size.height+2);
  await expect(modal.locator('.nm74-tab')).toHaveCount(14);
  const all=await modal.locator('.nm74-tab').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
  expect(all.every(height=>height>=39)).toBe(true);
  for(const section of ['documents','writing','sources','atlas','wiki','database','dashboard','image','cards','work','quality','share','exchange']){
   await chooseTool(page,'.nm74-tab[data-section="'+section+'"]');
   await expect(modal.locator('.nm74-content')).toBeVisible();
   const rect=await modal.locator('.nm74-content').boundingBox();
   expect(rect.x+rect.width).toBeLessThanOrEqual(size.width+2);
  }
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
 });
}
test('PDF importing requires manual confirmation and never edits before apply',async({page})=>{
 await page.goto('/app/index.html');
 await page.waitForFunction(()=>window.NeuroMapAndroid74&&window.neuroMapApp);
 const before=await page.evaluate(()=>neuroMapApp.state.getAllNodes().length);
 await page.locator('#nm74-launch').click();
 await chooseTool(page,'.nm74-tab[data-section=documents]');
 const source=pdfFixture(1,{bookmarks:false,texts:['Liver function']});
 await page.locator('.nm74-content input[type=file]').setInputFiles({name:'source.pdf',
  mimeType:'application/pdf',buffer:Buffer.from(source)});
 await expect(page.locator('.nm74-results')).toContainText('Pagina');
 expect(await page.evaluate(()=>neuroMapApp.state.getAllNodes().length)).toBe(before);
 await page.locator('.nm74-content .nm74-primary').click();
 await expect(page.locator('.nm74-status')).toContainText('Verifica');
 expect(await page.evaluate(()=>neuroMapApp.state.getAllNodes().length)).toBe(before);
 await page.locator('.nm74-confirm input[type=checkbox]').check();
 await page.locator('.nm74-content .nm74-primary').click();
 await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.getAllNodes().length)).toBeGreaterThan(before);
});
test('Android back-panel close, focus and report privacy',async({page})=>{
 await page.setViewportSize({width:320,height:640});
 await page.goto('/app/index.html');
 await page.waitForFunction(()=>window.NeuroMapAndroid74);
 await page.locator('#nm74-launch').click();
 await chooseTool(page,'.nm74-tab[data-section=share]');
 await expect(page.locator('.nm74-content input[type=checkbox]')).toHaveCount(2);
 expect(await page.locator('.nm74-content input[type=checkbox]').evaluateAll(a=>a.every(x=>!x.checked))).toBe(true);
 await page.keyboard.press('Escape');
 await expect(page.locator('#nm74-overlay')).toBeHidden();
 await expect(page.locator('#nm74-launch')).toBeFocused();
});


test('Android preserves source metadata, dependencies and image hotspots across project imports',async({page})=>{
 await page.goto('/app/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapSourceCore);
 const payload={
  schema:'NeuroMapArchitect-SingleTab-v6',
  root:{id:'oldroot',text:'Course',children:[
   {id:'oldA',text:'Heart',children:[],sourceRefs:[{
     kind:'pdf',id:'src_1234567890',fileName:'course.pdf',title:'Course',
     sha256:'a'.repeat(64),page:2,quote:'Heart anatomy',createdAt:'2026-10-23T12:00:00Z'}]},
   {id:'oldB',text:'Arteries',taskStatus:'doing',taskDependsOn:['oldA'],
    startDate:'2026-10-23',dueDate:'2026-10-25',children:[]}
  ]},
  images:[{id:'im1',src:'data:image/png;base64,aGVsbG8=',mode:'attached',
   attachedNodeId:'oldA',studyHotspots:[{nodeId:'oldA',x:.3,y:.4,label:'Heart'}]}],
  relationships:[],studyCards:[]
 };
 await page.evaluate(async(data)=>{
  await neuroMapApp.importFile(new File([JSON.stringify(data)],'course.neuromap',
   {type:'application/json'}),{newTab:true});
 },payload);
 const output=await page.evaluate(()=>{
  const s=neuroMapApp.state,a=s.root.children[0],b=s.root.children[1],img=s.images[0];
  return {heartId:a.id,dependsOn:b.taskDependsOn[0],
   citation:a.sourceRefs[0],hotspot:img.studyHotspots[0],attachment:img.attachedNodeId,
   dueDate:b.dueDate};
 });
 // Native .neuromap imports keep stable node IDs so dependencies, citations and
 // image attachments stay attached without a remap pass.
 expect(output.heartId).toBe('oldA');
 expect(output.dependsOn).toBe(output.heartId);
 expect(output.citation).toMatchObject({fileName:'course.pdf',page:2,quote:'Heart anatomy'});
 expect(output.citation.sha256).toBe('a'.repeat(64));
 expect(output.hotspot.nodeId).toBe(output.heartId);
 expect(output.attachment).toBe(output.heartId);
 expect(output.dueDate).toBe('2026-10-25');
});


test('mobile Markdown notes save via existing Undo and prevent accidental discard',async({page})=>{
 await page.setViewportSize({width:360,height:740});
 await page.goto('/app/index.html');
 await page.waitForFunction(()=>window.NeuroMapAndroid74&&window.NeuroMapWikiLinks);
 await page.locator('#nm74-launch').click();
 await chooseTool(page,'.nm74-tab[data-section=wiki]');
 const editor=page.locator('#nm74-overlay .nm75-panel textarea').first();
 await expect(editor).toBeVisible();
 const original=await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId)?.notes||'');
 await editor.fill('## Study\n[[UnknownTarget]]\n**Bold**');
 await expect(page.locator('#nm74-overlay .nm75-preview strong')).toHaveText('Bold');
 await page.evaluate(()=>{neuroMapApp.nmAsk=async()=> 'cancel'});
 await chooseTool(page,'.nm74-tab[data-section=atlas]');
 await expect(editor).toBeVisible();
 await page.locator('#nm74-overlay .nm75-actions').getByRole('button',{name:/Salva nota/}).click();
 expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).notes)).toContain('Study');
 await page.evaluate(()=>neuroMapApp.undo());
 expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId)?.notes||'')).toBe(original);
});

test('Android Knowledge Database stores tags and prevents duplicate daily notes',async({page})=>{
 await page.setViewportSize({width:360,height:740});
 await page.goto('/app/index.html');
 await page.waitForFunction(()=>window.NeuroMapAndroid74&&window.NeuroMapKnowledgeDB);
 await page.locator('#nm74-launch').click();
 await chooseTool(page,'.nm74-tab[data-section=database]');
 const panel=page.locator('#nm74-overlay .nm76-panel');
 await expect(panel).toBeVisible();
 await panel.locator('input').first().fill('Anatomia, Review, review');
 await panel.getByRole('button',{name:'Salva proprietà'}).click();
 const tags=await page.evaluate(()=>NeuroMapKnowledgeDB.normalize(neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).knowledge).tags);
 expect(tags).toEqual(['Anatomia','Review']);
 await panel.getByRole('button',{name:'Apri / crea diario'}).click();
 const count=await page.evaluate(()=>{
  const stack=[neuroMapApp.state.root];let n=0;
  while(stack.length){const node=stack.pop();if(node.knowledge?.dailyKey)n++;stack.push(...(node.children||[]))}
  return n;
 });
 expect(count).toBe(1);
});

test('tool launcher survives rotation and database drafts are protected in English',async({page},testInfo)=>{
 await page.setViewportSize({width:393,height:852});
 await page.goto('/app/index.html');
 await page.waitForFunction(()=>window.NeuroMapAndroid74);
 await page.evaluate(()=>GlaukaI18n.setLanguage('en'));
 for(const size of [{width:1024,height:600},{width:393,height:852}]){
  await page.setViewportSize(size);
  await page.locator('#nm74-launch').click();
  await expect(page.locator('#nm74-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
 }
 await page.locator('#nm74-launch').click();
 await chooseTool(page,'.nm74-tab[data-section=database]');
 const p=page.locator('#nm74-overlay .nm76-panel');
 await p.getByPlaceholder('Anatomy, Review, Exam').fill('Pending');
 await p.getByRole('button',{name:'Apply template',exact:true}).click();
 await expect(p.locator('[role=status]')).toContainText('Save or discard');
 await page.locator('.nm74-close').click();
 await expect(page.locator('#nm-decision-panel')).toBeVisible();
 await page.locator('#nm-decision-panel').getByRole('button',{name:'Continue editing',exact:true}).click();
 await expect(p.getByPlaceholder('Anatomy, Review, Exam')).toHaveValue('Pending');
 await p.getByRole('button',{name:'Save properties',exact:true}).click();
 await page.screenshot({path:testInfo.outputPath('android-database-en.png')});
 expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).knowledge.tags)).toEqual(['Pending']);
});


test('Android PDF.js handles 200 pages offline and never adds map nodes during preview',async({page})=>{
 test.setTimeout(120000);
 const {pdfFixture}=require('./pdfjs-fixture');
 const doc=pdfFixture(200);
 await page.setViewportSize({width:393,height:852});
 await page.goto('/app/index.html');
 await page.waitForFunction(()=>window.NeuroMapPdfJs&&window.NeuroMapDocumentImport&&window.neuroMapApp);
 const result=await page.evaluate(async bytes=>{
  const file=new File([new Uint8Array(bytes)],'sample.pdf',{type:'application/pdf'});
  const before=neuroMapApp.state.getNodeCountIncludingCollapsed();
  const pdf=await NeuroMapPdfJs.inspect(file);
  const preview=await NeuroMapDocumentImport.preview(file);
  const after=neuroMapApp.state.getNodeCountIncludingCollapsed();
  return {engine:pdf.engine,pages:pdf.pages.length,bookmarks:pdf.outline.map(x=>x.page),
   previewNodes:preview.count,before,after};
 },Array.from(doc));
 expect(result.engine).toBe('PDF.js 6.4.299');
 expect(result.pages).toBe(200);
 expect(result.bookmarks).toEqual([1,101]);
 expect(result.previewNodes).toBeGreaterThanOrEqual(201);
 expect(result.previewNodes).toBeLessThanOrEqual(250);
 expect(result.after).toBe(result.before);
});
