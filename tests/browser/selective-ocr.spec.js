const OCR_DESKTOP=process.env.GLAUKA_OCR_DESKTOP_URL||'http://127.0.0.1:5174',OCR_ANDROID=process.env.GLAUKA_OCR_ANDROID_URL||'http://127.0.0.1:5173';
const {test,expect}=require('@playwright/test');const {scannedPDF}=require('./ocr-fixture');
for(const target of ['desktop','android'])test.describe(target+' local selective OCR',()=>{
 test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
  await page.setViewportSize(target==='android'?{width:393,height:852}:{width:1280,height:900});
  if(target==='desktop')await page.route('**/index.html',async route=>{
   const response=await route.fetch();const body=(await response.text()).replace('<script id="glauka-startup-guard">','<script id="glauka-startup-guard" nonce="ocr-test">').replace('<script>','<script nonce="ocr-test">');
   await route.fulfill({response,body,headers:{...response.headers(),'content-security-policy':"default-src 'none'; script-src 'self' 'nonce-ocr-test' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; media-src 'self' blob:; frame-src blob:"}});
  });

  await page.goto(target==='android'?OCR_ANDROID+'/app/index.html':OCR_DESKTOP+'/index.html');
  if(target==='android'){await page.waitForFunction(()=>window.NeuroMapOCREnsure&&window.neuroMapApp);await page.evaluate(()=>NeuroMapOCREnsure.open(neuroMapApp))}await page.waitForFunction(()=>window.neuroMapApp?._nmOCR);
 });
 test('real Italian WASM OCR requires approval, preserves style/source and supports one Undo',async({page},testInfo)=>{
  test.setTimeout(120000);const remote=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))remote.push(r.url())});
  const pdf=await scannedPDF(page);
  const before=await page.evaluate(()=>{const a=neuroMapApp;a.selectNode(a.state.root.id);a.state.root.fontItalic=true;a.state.root.color='#aabbcc';a._nmOCR.open();return JSON.stringify(a.state.constructor.cloneTree(a.state.root))});
  await page.locator('#nm-ocr-file').setInputFiles({name:'scan.pdf',mimeType:'application/pdf',buffer:pdf});await page.locator('#nm-ocr-run').click();
  await expect(page.locator('#nm-ocr-text')).toHaveValue(/cuore/i,{timeout:90000});await expect(page.locator('#nm-ocr-stop')).toBeDisabled({timeout:30000});
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.constructor.cloneTree(neuroMapApp.state.root)))).toBe(before);
  await page.getByRole('button',{name:'Ingrandisci originale',exact:true}).click();
  expect((await page.locator('.ocr-image img').boundingBox()).width).toBeGreaterThan(1000);
  await page.getByRole('button',{name:'Adatta originale',exact:true}).click();
  await expect(page.locator('#nm-ocr-apply')).toBeDisabled();await page.locator('#nm-ocr-text').fill('Testo corretto: il cuore. Dose 5 µg/mL.');
  await expect(page.locator('.ocr-warning[role=note]')).toContainText('5 µg');
  await page.evaluate(()=>{window.pendingOCRClose=NeuroMapLifecycle.requestClose()});
  await page.locator('#nm-decision-panel').getByRole('button',{name:'Continua a modificare',exact:true}).click();
  expect(await page.evaluate(()=>window.pendingOCRClose)).toBe(false);
  await expect(page.locator('#nm-ocr-text')).toHaveValue('Testo corretto: il cuore. Dose 5 µg/mL.');
  await page.locator('#nm-ocr-consent').check();
  await page.screenshot({path:testInfo.outputPath(target+'-ocr-review.png')});
  await page.locator('#nm-ocr-apply').click();await expect(page.locator('#nm-ocr')).toBeHidden();
  const inserted=await page.evaluate(()=>{const n=neuroMapApp.state.root.children.at(-1),p=n.children[0];return {notes:p.notes,ref:p.sourceRefs[0],color:p.color,italic:p.fontItalic,history:neuroMapApp.state.undoStack.length}});
  expect(inserted.notes).toContain('Testo corretto');expect(inserted.ref.page).toBe(1);expect(inserted.ref.fileName).toBe('scan.pdf');expect(inserted.ref.sha256).toMatch(/^[a-f0-9]{64}$/);expect(inserted.color).toBe('#aabbcc');expect(inserted.italic).toBe(true);
  await page.evaluate(()=>neuroMapApp.undo());expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.constructor.cloneTree(neuroMapApp.state.root)))).toBe(before);expect(remote).toEqual([]);
 });
 test('cancelling a pending local worker releases controls and never changes the map',async({page})=>{
  const pdf=await scannedPDF(page);const before=await page.evaluate(()=>{neuroMapApp._nmOCR.open();return JSON.stringify(neuroMapApp.state.root)});
  await page.locator('#nm-ocr-file').setInputFiles({name:'scan.pdf',mimeType:'application/pdf',buffer:pdf});
  const path=target==='android'?'**/assets/ocr/ita.traineddata':'**/ocr/ita.traineddata';
  let release;const gate=new Promise(r=>release=r);await page.route(path,async route=>{await gate;await route.continue().catch(()=>{})});
  const requested=page.waitForRequest(r=>r.url().endsWith('/ocr/ita.traineddata'));
  await page.locator('#nm-ocr-run').click();await requested;await expect(page.locator('#nm-ocr-stop')).toBeEnabled();await page.locator('#nm-ocr-stop').click();
  await expect(page.locator('#nm-ocr-run')).toBeEnabled();
  await expect.poll(()=>page.workers().filter(w=>w.url().includes('/ocr/')).length).toBe(0);release();expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
 });
});

test('selectable PDF pages are preserved without loading the OCR engine',async({page})=>{
 const {pdfFixture}=require('./pdfjs-fixture');await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(OCR_DESKTOP+'/index.html');await page.waitForFunction(()=>neuroMapApp?._nmOCR);await page.evaluate(()=>neuroMapApp._nmOCR.open());
 const requests=[];page.on('request',r=>{if(r.url().includes('/ocr/'))requests.push(r.url())});
 await page.locator('#nm-ocr-file').setInputFiles({name:'native.pdf',mimeType:'application/pdf',buffer:pdfFixture(1,{bookmarks:false})});await page.locator('#nm-ocr-run').click();
 await expect(page.locator('#nm-ocr-text')).toHaveValue(/Cardiovascular/);await expect(page.locator('#nm-ocr-stop')).toBeDisabled();
 await expect(page.locator('#nm-ocr-review-page')).toContainText('testo esistente');expect(requests).toEqual([]);
});
