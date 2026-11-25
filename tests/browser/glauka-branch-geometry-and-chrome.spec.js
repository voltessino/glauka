const {test,expect}=require('@playwright/test');
async function enterMap(page){
 await page.waitForFunction(()=>window.neuroMapApp?.tabs&&!document.documentElement.classList.contains('glauka-booting'));
 await page.locator('#nm-home-close').click();
 await expect(page.locator('#nm6-welcome')).toBeHidden();
}
async function openBranches(page){
 await page.locator('#gl-settings-quick').click();
 await page.locator('#gl-settings-nav button[data-category="appearance"]').click();
 await expect(page.locator('#gl-settings-branches')).toBeVisible();
}

test('branch geometry changes the shape while preserving all node IDs',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174/index.html');
 await enterMap(page);
 await openBranches(page);
 const buttons=page.locator('#nm54-style-grid [data-style]');
 await expect(buttons).toHaveCount(11);
 const before=await page.evaluate(()=>{
  const root=neuroMapApp.state.root;
  const list=[];function walk(n){list.push(n.id);(n.children||[]).forEach(walk)}walk(root);
  return list;
 });
 for(const style of ['neon','elbow','straight','arc','dashed','wave','fork','buzan','xmind8']){
  const picker=page.locator('#nm54-branch-picker');
  if(!(await picker.evaluate(e=>e.open)))await page.locator('#nm54-branch-trigger').click();
  await page.locator('#nm54-style-grid [data-style="'+style+'"]').click();
  await expect(page.locator('#nm54-style-grid [data-style="'+style+'"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>neuroMapApp.state.branchStyle)).toBe(style);
  await page.evaluate(()=>neuroMapApp.recalculateAndRender());
 }
 const after=await page.evaluate(()=>{
  const result=[];function walk(n){result.push(n.id);(n.children||[]).forEach(walk)}
  walk(neuroMapApp.state.root);return result;
 });
 expect(after).toEqual(before);
 expect(errors).toEqual([]);
});

for(const width of [390,800,1440]){
 test('top bar keeps tabs, the +, and icon utilities accessible at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('http://127.0.0.1:5174/index.html');
  await enterMap(page);
  await page.waitForFunction(()=>document.body.classList.contains('gl-browser-chrome')
    &&document.getElementById('gl-chrome-utilities')
    &&document.getElementById('nm-home-open'));
  await expect(page.locator('#btn-new-tab')).toHaveText('+');
  await expect(page.locator('.tab-bar #nm-home-open')).toBeVisible();
  await expect(page.locator('.tab-bar #tabs-list')).toBeVisible();
  const utility=page.locator('#gl-chrome-utilities');
  await expect(utility).toBeVisible();
  await expect(page.locator('#gl-chrome-more')).toBeVisible();
  await expect(page.locator('.brand-Mini .gl-chrome-home')).toHaveCount(1);
  const nodes=await page.evaluate(()=>[...document.querySelectorAll('#nm-home-open,#nm6-plan-button,#btn-new-tab,#nm-orbit-command-trigger,#gl-history-quick,#gl-cloud-quick,#glauka-save-indicator')].map(x=>x.id));
  expect(nodes.length).toBe(new Set(nodes).size);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.locator('#gl-chrome-more summary').click();
  await expect(page.locator('#nm6-plan-button')).toBeVisible();
  await page.locator('#gl-chrome-more summary').press('Escape');
  await expect(page.locator('#gl-chrome-more')).not.toHaveAttribute('open','');
 });
}
