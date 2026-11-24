const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const folder=path.resolve(__dirname,'../../packages/editor-ui/locales');
const source=JSON.parse(fs.readFileSync(path.join(folder,'source.json'),'utf8'));
const texts=['Scegli dove inserire il simbolo: nella scritta oppure come distintivo esterno al ramo.','Il simbolo comparirà nella scritta del nodo (es. ❷ Ciao).','Distintivi esterni selezionati:'];
for(const platform of ['desktop','android'])test(`${platform}: symbol guidance and badge counter translate in all eight languages without changing the map`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.nm62OpenAssets&&window.GlaukaI18n);
 const before=await page.evaluate(()=>{
  const a=neuroMapApp;a.importHierarchy({text:'Ciao',children:[]},{newTab:true});a.state.root.markers=['priority-2'];a.nm62OpenAssets();
  return JSON.stringify(a.state.createSnapshot());
 });
 const panel=page.locator('#nm-creative-library-hub'),placement=panel.locator('.nm-creative-symbol-placement');
 const hint=panel.locator('.nm-creative-library-hint[data-glauka-ui-pair]'),status=panel.locator('.nm-creative-library-status[data-glauka-ui-pair]');
 for(const code of ['it','en','de','es','fr','pt','ar','zh-CN']){
  const pack=JSON.parse(fs.readFileSync(path.join(folder,code+'.json'),'utf8')),expected=texts.map(t=>pack[source.aliases[t]]);
  await page.evaluate(code=>GlaukaI18n.setLanguage(code),code);
  await expect(hint).toBeVisible();await expect(hint).toHaveText(expected[0]);
  await expect(status).toHaveText(expected[1]);
  await placement.locator('[data-placement="badge"]').click();
  await expect(status).toHaveText(expected[2]+' 1/3');
  await placement.locator('[data-placement="text"]').click();
  await expect(status).toHaveText(expected[1]);
 }
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()))).toBe(before);
});
