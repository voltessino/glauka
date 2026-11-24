const {test,expect}=require('@playwright/test');
for(const [platform,url] of [['desktop','http://127.0.0.1:5174/index.html'],['android','http://127.0.0.1:5173/app/index.html']]){
 test(platform+' private license previews update AI access without changing local projects',async({page})=>{
  await page.addInitScript(platform=>{
   localStorage.setItem('nm6_welcome_seen','1');
   localStorage.setItem('nm_android_test_pro_enabled_02','yes');
   let state={plan:'free'};
   const api={productStatus:()=>state,productActivate:key=>{if(key!=='signed-by-native-fixture')throw Error('Invalid signature');return state={plan:'pro',owner:true,previewMode:'full'};},productPreviewMode:mode=>{if(!state.owner)throw Error('Owner required');return state={...state,plan:mode==='free'?'free':'pro',previewMode:mode};},productLogout:()=>state={plan:'free'}};
   if(platform==='android')window.NMAndroidAI=Object.fromEntries(Object.entries(api).map(([k,fn])=>[k,(...args)=>{try{return JSON.stringify(fn(...args))}catch(e){return JSON.stringify({error:e.message})}}]));
   else window.neuromapDesktop={...api,readWorkspace:async()=>null,readEditorPreferences:async()=>null,readAISettings:async()=>null,readAISecret:async()=>({}),writeWorkspace:async()=>true,onExternalFile:()=>{}};
  },platform);
  await page.goto(url);await page.waitForFunction(()=>window.neuroMapApp?.renderer&&window.nmProduct);
  await expect.poll(()=>page.evaluate(()=>nmProduct.isPro())).toBe(false);
  const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
  await page.evaluate(()=>nmProduct.open());await expect(page.locator('#glauka-owner-preview')).toBeHidden();
  await page.locator('#nm6-license-input').fill('bad-key');await page.locator('#nm6-license-activate').click();await expect(page.locator('#nm6-plan-current')).toContainText('Invalid signature');
  await page.locator('#nm6-license-input').fill('signed-by-native-fixture');await page.locator('#nm6-license-activate').click();
  const mode=page.locator('#glauka-owner-preview select');await expect(mode).toBeVisible();await mode.selectOption('free');await expect.poll(()=>page.evaluate(()=>nmProduct.isPro())).toBe(false);
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
  await mode.selectOption('pro');await expect.poll(()=>page.evaluate(()=>nmProduct.isPro())).toBe(true);
  await page.locator('#glauka-license-management>summary').click();await page.locator('#nm6-license-logout').click();await page.locator('#nm-decision-overlay').getByRole('button',{name:'Disattiva',exact:true}).click();await expect(page.locator('#glauka-owner-preview')).toBeHidden();await expect.poll(()=>page.evaluate(()=>nmProduct.isPro())).toBe(false);
 });
}
