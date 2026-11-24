const {test,expect}=require('@playwright/test');
const names={it:['Organizza i rami','Cerca nelle mappe','Leggi passo passo','Scadenze dei ripassi','Consulta le fonti','Scrivi appunti'],en:['Organize branches','Search across maps','Read step by step','Review schedule','Consult sources','Write notes']};
const modes=['outline','atlas','journey','radar','sources','document'];
async function boot(page,locale='it',width=1440,height=900){
 await page.addInitScript(locale=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale',locale)},locale);
 await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>neuroMapApp?._nmKnowledge);
}
for(const locale of ['it','en'])for(const width of [360,1440])test(locale+' clear purposes and compact header '+width,async({page},info)=>{
 await boot(page,locale,width);const original=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
 await expect(page.locator('.tab-bar #nm-save-status')).toHaveCount(0);await expect(page.locator('.brand-Mini')).toBeVisible();await expect(page.locator('.tab-bar #nm-build-revision')).toHaveCount(0);
 await page.locator('#btn-menu-tools').click();if(await page.locator('#nm-tools-write').getAttribute('open')===null)await page.locator('#nm-tools-write > summary').click();const command=page.locator('#nm-tool-outline');await expect(command.locator('.nm-task-command-hint')).toBeVisible();await expect(command).toHaveAccessibleName(names[locale][0]);await command.click();
 const panel=page.locator('#nm-knowledge-panel'),picker=panel.locator('.nm-kn-picker');await expect(picker).not.toHaveAttribute('open','');
 for(let i=0;i<modes.length;i++){
  if(i){await picker.locator('summary').click();await expect(panel.getByRole('tab',{name:names[locale][i],exact:true})).toBeVisible();await panel.getByRole('tab',{name:names[locale][i],exact:true}).click()}
  await expect(panel.locator('.nm-kn-header strong')).toHaveText(names[locale][i]);await panel.locator('.nm-kn-example>summary').click();await expect(panel.locator('.nm-kn-intro-example')).toBeVisible();await panel.locator('.nm-kn-example>summary').click();
  expect((await panel.locator('.nm-kn-intro-example').textContent()).length).toBeGreaterThan(50);
  await expect(panel.locator('.nm-kn-tabs')).toBeHidden();
 }
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(original);
 await page.screenshot({path:info.outputPath('notes-'+width+'-'+locale+'.png')});
 await picker.locator('summary').click();await page.screenshot({path:info.outputPath('choose-tool-'+width+'-'+locale+'.png')});
 const bounds=await panel.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);
});
test('switching tools never replaces unsaved notes; existing save and undo still work',async({page})=>{
 await boot(page);await page.evaluate(()=>neuroMapApp._nmKnowledge.open('document'));const panel=page.locator('#nm-knowledge-panel');
 const old=await panel.locator('#nm-kn-chapter-text').inputValue();await panel.locator('#nm-kn-chapter-text').fill('Appunti da conservare');
 await page.evaluate(()=>neuroMapApp._nmKnowledge.open('atlas'));await expect(panel.locator('#nm-kn-chapter-text')).toHaveValue('Appunti da conservare');
 await expect(panel.getByText('Salva o annulla le modifiche prima di cambiare strumento.')).toBeVisible();
 await panel.getByRole('button',{name:'Salva capitolo',exact:true}).click();expect(await page.evaluate(()=>neuroMapApp.state.root.notes)).toBe('Appunti da conservare');
 await page.evaluate(()=>neuroMapApp.undo());await expect(panel.locator('#nm-kn-chapter-text')).toHaveValue(old);
});
test('review tool explains missing data and opens the existing flashcard flow',async({page})=>{
 await boot(page);await page.evaluate(()=>{neuroMapApp.studyCards=[];neuroMapApp._nmKnowledge.open('radar')});const panel=page.locator('#nm-knowledge-panel');
 await expect(panel.locator('.nm-kn-scroll')).toContainText('Non ci sono ancora ripassi registrati');
 await panel.getByRole('button',{name:'Apri le flashcard',exact:true}).click();await expect(panel).toBeHidden();
 await expect(page.locator('#flash-modal')).toBeVisible();
});
test('changing language updates tool purposes without translating map contents',async({page})=>{
 await boot(page);await page.evaluate(()=>{neuroMapApp.state.root.text='Appunti personali non tradotti';neuroMapApp._nmKnowledge.open('journey')});
 await page.evaluate(async ()=>{await GlaukaI18n.setLanguage('en');});
 await expect(page.locator('.nm-kn-header strong')).toHaveText('Read step by step');await page.locator('.nm-kn-example>summary').click();await expect(page.locator('.nm-kn-intro')).toContainText('oral explanation');
 expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe('Appunti personali non tradotti');
});
test('tool chooser works from the keyboard and stays usable in a short window',async({page})=>{
 await boot(page,'it',844,390);await page.evaluate(()=>neuroMapApp._nmKnowledge.open('outline'));const panel=page.locator('#nm-knowledge-panel');
 await panel.locator('.nm-kn-picker>summary').click();const first=panel.getByRole('tab',{name:'Organizza i rami',exact:true});await first.focus();await page.keyboard.press('End');
 await expect(panel.getByRole('tab',{name:'Scrivi appunti',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(panel.locator('.nm-kn-header strong')).toHaveText('Scrivi appunti');
 const geometry=await panel.evaluate(el=>({horizontal:el.scrollWidth>el.clientWidth+1,bottom:el.getBoundingClientRect().bottom}));expect(geometry.horizontal).toBe(false);expect(geometry.bottom).toBeLessThanOrEqual(390);
 await panel.locator('#nm-kn-chapter-text').fill('Appunto in finestra bassa');await panel.getByRole('button',{name:'Salva capitolo',exact:true}).click();
 expect(await page.evaluate(()=>neuroMapApp.state.root.notes)).toBe('Appunto in finestra bassa');
});
