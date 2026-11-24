const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])test(platform+': native-validated Pro status controls activation and confirmed local deactivation',async({page})=>{
 await page.setViewportSize({width:platform==='android'?360:1280,height:900});
 // Native-response fixture exercises presentation, not signature verification.
 await page.addInitScript(platform=>{
  localStorage.setItem('nm6_welcome_seen','1');
  const read=()=>JSON.parse(localStorage.getItem('qa-license-state')||'{"plan":"free"}');
  const api={productStatus:()=>{if(window.qaLicenseFailure)throw Error('Verification unavailable');return read()},productActivate:key=>{if(key!=='qa-valid-native-license')throw Error('Invalid signature');const value={plan:'pro',owner:false};localStorage.setItem('qa-license-state',JSON.stringify(value));return value},productLogout:()=>{localStorage.setItem('qa-license-state','{"plan":"free"}');return{plan:'free'}}};
  if(platform==='android')window.NMAndroidAI=Object.fromEntries(Object.entries(api).map(([k,fn])=>[k,(...args)=>{try{return JSON.stringify(fn(...args))}catch(e){return JSON.stringify({error:e.message})}}]));
  else window.neuromapDesktop={...api,readWorkspace:async()=>null,readEditorPreferences:async()=>null,readAISettings:async()=>null,readAISecret:async()=>({}),writeWorkspace:async()=>true,onExternalFile:()=>{}};
 },platform);
 await page.goto(platform==='desktop'?'http://127.0.0.1:5174/index.html':'http://127.0.0.1:5173/app/index.html');await page.waitForFunction(()=>window.neuroMapApp&&window.nmProduct);await page.evaluate(()=>nmProduct.open());
 const input=page.locator('#nm6-license-input');await expect(input).toBeVisible();await input.fill('qa-valid-native-license');await page.locator('#nm6-license-activate').click();await expect(page.locator('#nm6-plan-current')).toHaveText('Glauka Pro attiva');await expect(input).toBeHidden();await expect(page.locator('#nm6-plan-buy')).toBeHidden();
 await page.reload();await page.waitForFunction(()=>window.neuroMapApp&&window.nmProduct);await page.evaluate(()=>nmProduct.open());await expect(input).toBeHidden();await expect(page.locator('#nm6-plan-current')).toHaveText('Glauka Pro attiva');
 await page.evaluate(async()=>{window.qaLicenseFailure=true;await nmProduct.status()});await expect(input).toBeVisible();expect(await page.evaluate(()=>nmProduct.isPro())).toBe(false);
 await page.evaluate(async()=>{window.qaLicenseFailure=false;await nmProduct.status()});await expect(input).toBeHidden();
 await page.locator('#glauka-license-management>summary').click();await expect(page.locator('#glauka-license-management p')).toContainText('solo su questo dispositivo');
 await page.locator('#nm6-license-logout').click();await page.locator('#nm-decision-overlay').getByRole('button',{name:'Annulla',exact:true}).click();expect(await page.evaluate(()=>nmProduct.isPro())).toBe(true);
 await page.locator('#nm6-license-logout').click();await page.locator('#nm-decision-overlay').getByRole('button',{name:'Disattiva',exact:true}).click();await expect(input).toBeVisible();await expect(page.locator('#glauka-license-management')).toBeHidden();expect(await page.evaluate(()=>nmProduct.isPro())).toBe(false);
});
