const OCR_DESKTOP=process.env.GLAUKA_OCR_DESKTOP_URL||'http://127.0.0.1:5174',OCR_ANDROID=process.env.GLAUKA_OCR_ANDROID_URL||'http://127.0.0.1:5173';
const{test,expect}=require('@playwright/test');const{scannedPDF}=require('./ocr-fixture');
for(const target of ['desktop','android'])test.describe(target+' OCR quality workflow',()=>{
 test.beforeEach(async({page})=>{
  await page.addInitScript(target=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale',target==='android'?'en':'it')},target);await page.setViewportSize(target==='android'?{width:393,height:852}:{width:1280,height:900});
  await page.goto(target==='android'?OCR_ANDROID+'/app/index.html':OCR_DESKTOP+'/index.html');if(target==='android'){await page.waitForFunction(()=>window.NeuroMapOCREnsure&&window.neuroMapApp);await page.evaluate(()=>NeuroMapOCREnsure.open(neuroMapApp))}await page.waitForFunction(()=>window.neuroMapApp?._nmOCR&&window.NeuroMapOCRQuality);await page.evaluate(()=>neuroMapApp._nmOCR.open());
 });
 test('higher-detail area reading stays separate until explicit replacement and import',async({page},testInfo)=>{
  test.setTimeout(120000);const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
  await page.locator('#nm-ocr-file').setInputFiles({name:'scan.pdf',mimeType:'application/pdf',buffer:await scannedPDF(page)});await page.locator('#nm-ocr-enhance').check();await page.locator('#nm-ocr-run').click();
  await expect(page.locator('#nm-ocr-text')).toHaveValue(/cuore/i,{timeout:60000});await expect(page.locator('#nm-ocr-stop')).toBeDisabled();
  await page.locator('#nm-ocr-text').fill('TESTO DA SOSTITUIRE');await page.locator('#nm-ocr-text').evaluate(el=>el.setSelectionRange(0,el.value.length));
  await page.locator('#nm-ocr-region summary').click();
  await page.locator('#nm-ocr-region-draw').click();await page.locator('.ocr-image img').scrollIntoViewIfNeeded();
  const image=await page.locator('.ocr-image img').boundingBox();await page.mouse.move(image.x+image.width*.05,image.y+image.height*.2);await page.mouse.down();await page.mouse.move(image.x+image.width*.6,image.y+image.height*.4,{steps:5});await page.mouse.up();
  expect(Number(await page.locator('#nm-ocr-crop-0').inputValue())).toBeCloseTo(5,0);await expect(page.locator('#nm-ocr-region-draw')).toHaveAttribute('aria-pressed','false');
  for(const [i,value]of ['3','18','92','16'].entries())await page.locator('#nm-ocr-crop-'+i).fill(value);
  await page.locator('#nm-ocr-region-read').click();await expect(page.locator('#nm-ocr-region-result')).toHaveValue(/cuore/i,{timeout:60000});await expect(page.locator('#nm-ocr-stop')).toBeDisabled();
  await expect(page.locator('#nm-ocr-text')).toHaveValue('TESTO DA SOSTITUIRE');expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
  await page.locator('#nm-ocr-text').fill('Modifica successiva');await expect(page.locator('#nm-ocr-region-use')).toBeDisabled();
  await page.locator('#nm-ocr-text').fill('TESTO DA SOSTITUIRE');await page.locator('#nm-ocr-text').evaluate(el=>el.setSelectionRange(0,el.value.length));await page.locator('#nm-ocr-text').dispatchEvent('select');
  await page.locator('#nm-ocr-region-use').click();await expect(page.locator('#nm-ocr-text')).toHaveValue(/cuore/i);await expect(page.locator('#nm-ocr-consent')).not.toBeChecked();await expect(page.locator('#nm-ocr-apply')).toBeDisabled();
  await page.screenshot({path:testInfo.outputPath(target+'-region-review.png')});
  const corrected=await page.locator('#nm-ocr-text').inputValue();
  for(const [i,value]of ['0','0','100','5'].entries())await page.locator('#nm-ocr-crop-'+i).fill(value);
  await page.locator('#nm-ocr-region-read').click();await expect(page.locator('#nm-ocr-stop')).toBeDisabled({timeout:60000});await expect(page.locator('#nm-ocr-region-result')).toHaveValue('');await expect(page.locator('#nm-ocr-region-use')).toBeDisabled();await expect(page.locator('#nm-ocr-text')).toHaveValue(corrected);
  await page.locator('#nm-ocr-title').fill('Anatomia del cuore');await expect(page.locator('#nm-ocr-consent')).not.toBeChecked();await page.locator('#nm-ocr-consent').check();await page.locator('#nm-ocr-apply').click();await expect(page.locator('#nm-ocr')).toBeHidden();
  const row=await page.evaluate(()=>neuroMapApp.state.root.children.at(-1).children[0]);expect(row.text).toBe('Anatomia del cuore');expect(row.knowledge.fields.sourceMethod.value).toContain('region');expect(row.sourceRefs[0].page).toBe(1);
 });
 test('reordering never silently removes manual edits',async({page})=>{
  test.setTimeout(90000);await page.locator('#nm-ocr-file').setInputFiles({name:'scan.pdf',mimeType:'application/pdf',buffer:await scannedPDF(page)});await page.locator('#nm-ocr-run').click();await expect(page.locator('#nm-ocr-text')).toHaveValue(/cuore/i,{timeout:60000});await expect(page.locator('#nm-ocr-stop')).toBeDisabled();
  await page.locator('#nm-ocr-text').fill('Correzione manuale 0,5 mg');await page.locator('#nm-ocr-order').selectOption('rows');
  await page.locator('#nm-decision-panel').getByRole('button',{name:target==='android'?'Keep edits':'Mantieni correzioni',exact:true}).click();await expect(page.locator('#nm-ocr-text')).toHaveValue('Correzione manuale 0,5 mg');await expect(page.locator('#nm-ocr-order')).toHaveValue('auto');
 });
});
