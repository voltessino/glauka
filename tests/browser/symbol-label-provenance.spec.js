const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])test(`${platform} symbol labels keep their source meaning across languages`,async({page})=>{
 await page.goto(platform==='desktop'?'http://127.0.0.1:5174/index.html':'http://127.0.0.1:5173/app/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.nm62OpenAssets&&window.GlaukaI18n);
 const before=await page.evaluate(()=>{
  const a=neuroMapApp;
  document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));
  a.importHierarchy({text:'Idee Note Degree',children:[]},{newTab:true});
  a.nm62OpenAssets();
  return {snapshot:JSON.stringify(a.state.createSnapshot()),history:a.state.undoStack.length};
 });
 const degree=page.locator('.nm-creative-library-glyph[data-it-label="Grado"][data-en-label="Degree"]');
 const idea=page.locator('.nm-creative-library-glyph[data-it-label="Idea"][data-en-label="Idea"]');
 await expect(degree.locator('.nm-creative-library-glyph-icon')).toHaveText('°');
 for(const [language,degreeText,ideaText] of [['de','Grad','Idee'],['en','Degree','Idea'],['it','Grado','Idea']]){
  await page.evaluate(code=>GlaukaI18n.setLanguage(code),language);
  await expect(degree).toHaveAttribute('aria-label',degreeText);
  await expect(degree.locator('small')).toHaveText(degreeText);
  await expect(idea).toHaveAttribute('aria-label',ideaText);
  await expect(idea.locator('small')).toHaveText(ideaText);
 }
 expect(await page.evaluate(()=>({snapshot:JSON.stringify(neuroMapApp.state.createSnapshot()),history:neuroMapApp.state.undoStack.length}))).toEqual(before);
});
