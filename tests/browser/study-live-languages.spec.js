const {test,expect}=require('@playwright/test');
const platforms=[['android','http://127.0.0.1:5173/app/index.html'],['desktop','http://127.0.0.1:5174/index.html']];
async function boot(page,url,code){await page.setViewportSize({width:url.includes('/app/')?393:1280,height:900});await page.addInitScript(code=>{localStorage.setItem('nm6_locale',code);localStorage.setItem('nm6_welcome_seen','1');},code);await page.goto(url);await page.waitForFunction(()=>window.neuroMapApp);await page.evaluate(()=>{document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));const a=neuroMapApp;a.studyCards=[{id:'card',sourceTabId:a.activeTabId,sourceNodeId:a.state.root.id,sourceSignature:a.v5Signature(a.state.root,a.state),question:'Save',answer:'Close',srStatus:0,sr:{dueAt:0}}];a.openFlashcards();});}
for(const [platform,url] of platforms){
 for(const code of ['it','en','de','es','fr','pt','ar','zh-CN'])test(platform+' active flashcard UI translates '+code+' while authored text remains untouched',async({page},info)=>{
  await boot(page,url,code);await expect(page.locator('html')).toHaveAttribute('lang',code);await expect(page.locator('.flash-heading')).toHaveText('Save');
  const ui=await page.locator('#v5-study-status,.flash-hint,.flash-eyebrow').allTextContents();
  if(code!=='it'){expect(ui.join(' ')).not.toMatch(/carte salvate|Prova a rispondere|DOMANDA AI|Ultimo stato/);}
  if(code==='en'){await expect(page.locator('.flash-eyebrow')).toHaveText('Question');if(platform==='android')await expect(page.locator('.flash-hint')).toContainText('tap');}
  await page.locator('#flash-reveal').click();await expect(page.locator('.flash-heading')).toHaveText('Close');
  const answer=await page.locator('#flash-card-content .v5-note').textContent();if(code!=='it')expect(answer).not.toMatch(/Ultimo stato|non ancora ripassata|Ripasso previsto/);
  if(code==='en')await page.screenshot({path:info.outputPath('review-localized.png'),animations:'disabled'});
 });
 test(platform+' changing language during review keeps the revealed answer and progress',async({page})=>{
  await boot(page,url,'it');await page.locator('#flash-reveal').click();await page.evaluate(()=>GlaukaI18n.setLanguage('de'));
  await expect(page.locator('.flash-heading')).toHaveText('Close');await expect(page.locator('#v5-study-status')).not.toContainText('carte salvate');
  expect(await page.evaluate(()=>neuroMapApp._flashShowAnswer)).toBe(true);expect(await page.evaluate(()=>neuroMapApp._v5CardIndex)).toBe(0);
 });
}
