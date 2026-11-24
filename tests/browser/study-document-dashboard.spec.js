const {test,expect}=require('@playwright/test');
for(const target of ['desktop','android'])for(const locale of ['it','en'])test.describe(target+' '+locale+' integrated study workspace',()=>{
 test.beforeEach(async({page})=>{
  await page.addInitScript(locale=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale',locale)},locale);
  await page.setViewportSize(target==='android'?{width:393,height:852}:{width:1280,height:900});
  await page.goto(target==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapDocumentView&&window.NeuroMapDashboard82&&(location.pathname.includes('/app/')?window.NeuroMapAndroid74:window.neuroMapApp._nmDashboard82));
 });
 test('document edits update the original node and Undo restores its full content',async({page})=>{
  const before=await page.evaluate(target=>{const a=neuroMapApp,n=a.state.root.children[0];a.selectNode(n.id);window.docID=n.id;const old=JSON.stringify(a.state.constructor.cloneTree(a.state.root));target==='desktop'?a._nmKnowledge.open('document'):(NeuroMapAndroid74.open(),NeuroMapAndroid74.show('writing'));return old},target);
  const panel=page.locator(target==='desktop'?'#nm-knowledge-panel':'.nm74-content');
  const title=target==='desktop'?panel.getByRole('textbox',{name:locale==='it'?'Titolo del capitolo':'Chapter title',exact:true}):panel.locator('input').first();
  const notes=panel.locator('textarea').first();await title.fill('Titolo sincronizzato');await notes.fill('Appunti $E=mc^2$\n[[Collegamento]]\nFine');
  await page.evaluate(()=>{window.pendingDocumentClose=NeuroMapLifecycle.requestClose()});
  await page.locator('#nm-decision-panel').getByRole('button',{name:locale==='it'?'Continua a modificare':'Continue editing',exact:true}).click();
  expect(await page.evaluate(()=>window.pendingDocumentClose)).toBe(false);
  await panel.getByRole('button',{name:locale==='it'?'Salva capitolo':'Save chapter',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.findNode(window.docID).notes)).toContain('Fine');
  expect(await page.evaluate(()=>neuroMapApp.state.findNode(window.docID).text)).toBe('Titolo sincronizzato');
  await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.constructor.cloneTree(neuroMapApp.state.root)))).toBe(before);
 });
 test('dashboard is read-only and takes the user to the original task',async({page},testInfo)=>{
  const before=await page.evaluate(target=>{const a=neuroMapApp,n=a.state.root.children[0];n.text='Attivita di prova';n.taskStatus='todo';n.dueDate='2026-01-01';window.taskID=n.id;const before=JSON.stringify(a.state.root);target==='desktop'?a._nmDashboard82.open():(NeuroMapAndroid74.open(),NeuroMapAndroid74.show('dashboard'));return before},target);
  const panel=page.locator('.nm82-dashboard');await expect(panel).toBeVisible();await expect(panel).toContainText(locale==='it'?'Mappe aperte':'Open maps');
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
  await page.screenshot({path:testInfo.outputPath(target+'-'+locale+'-dashboard.png')});
  await panel.getByRole('button',{name:/Attivita di prova/}).first().click();expect(await page.evaluate(()=>neuroMapApp.state.selectedNodeId)).toBe(await page.evaluate(()=>window.taskID));
 });
 test('due-only review excludes future cards and grades a revealed answer once',async({page})=>{
  await page.evaluate(()=>{const a=neuroMapApp,n=a.state.root;const card=id=>({id,sourceTabId:a.activeTabId,sourceNodeId:n.id,sourceSignature:a.v5Signature(n),question:'Domanda '+id,answer:'Risposta',sr:{dueAt:0,intervalDays:0,reviews:0,lapses:0}});a.studyCards=[card('b'),card('a'),{...card('future'),sr:{dueAt:Date.now()+86400000}}];a.openFlashcards()});
  await expect(page.locator('#flash-progress')).toHaveText(locale==='it'?'Carta 1 / 2':'Card 1 / 2');await page.locator('#flash-reveal').click();
  await page.evaluate(()=>{neuroMapApp.rateFlashcard(3);neuroMapApp.rateFlashcard(3)});
  const out=await page.evaluate(()=>neuroMapApp.studyCards.map(c=>({id:c.id,reviews:c.sr.reviews||0,due:c.sr.dueAt})));
  expect(out.find(c=>c.id==='a').reviews).toBe(1);expect(out.find(c=>c.id==='b').reviews).toBe(0);expect(out.find(c=>c.id==='future').reviews).toBe(0);
 });
});
