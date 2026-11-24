const {test,expect}=require('@playwright/test');
const url=process.env.GLAUKA_DESKTOP_URL||'http://127.0.0.1:5174/index.html';
test('real editor leaves startup and its menu observer settles without starving the event loop',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
 await page.waitForFunction(()=>window.neuroMapApp?.tabs&&!document.documentElement.classList.contains('glauka-booting'),{},{timeout:10000});
 await expect(page.locator('#glauka-startup')).toBeHidden();
 const result=await page.evaluate(async()=>{
  const menu=document.getElementById('dropdown-tools');let mutations=0;
  const observer=new MutationObserver(records=>mutations+=records.length);observer.observe(menu,{childList:true,subtree:true});
  for(let i=0;i<50;i++)NeuroMapWorkspaceTools.curate();
  await new Promise(resolve=>setTimeout(resolve,200));
  const settled=mutations;await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,100)));
  observer.disconnect();
  NeuroMapSettingsCenter.open();
  document.querySelector('#gl-settings-nav button[data-category="editor"]').click();
  const help=[...document.querySelectorAll('#gl-settings-body p')].map(el=>el.textContent).join('\n');
  return {settled,after:mutations,help};
 });
 expect(result.after).toBe(result.settled);expect(result.after).toBeLessThan(10);
 expect(result.help).toContain('visibili');expect(errors).toEqual([]);
});
