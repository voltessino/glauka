const {test,expect}=require('@playwright/test');

// UI-only regression: keep native map layout, saved project and user-selected
// palette untouched. No GitHub Actions; run locally with Playwright.
for(const width of [360,1280]){
 test('the branch height panel is precise, understandable and keyboard accessible at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapContinuation&&document.getElementById('nm-distribution-height'));
  await page.evaluate(()=>{
   document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden'));
   const a=window.neuroMapApp;
   a.state.root.layoutMode='clockwise';
   a.state.root.layoutDistribution={enabled:true,height:1240,minimumHeight:480,overflowMode:'expand'};
   a.state.balanceBias=50;
   a.markChanged();
   a.updateStatus();
  });
  await page.locator('#v6-show-layout').click();
  const panel=page.locator('#nm-distribution-controls');
  await expect(panel).toBeVisible();
  const range=panel.locator('#nm-distribution-height');
  const exact=panel.locator('#nm-distribution-exact');
  const start=await range.evaluate(x=>({min:Number(x.min),max:Number(x.max),step:Number(x.step)}));
  expect(start.max-start.min).toBeLessThanOrEqual(1200);
  expect(start.min).toBeLessThanOrEqual(1240);
  expect(start.max).toBeGreaterThanOrEqual(1240);
  expect(start.step).toBe(20);
  const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root.children));
  const advanced=panel.locator('#nm-distribution-advanced');
  await expect(advanced).not.toHaveAttribute('open');
  await advanced.locator('summary').click();
  await expect(advanced).toHaveAttribute('open');
  await panel.locator('#nm-distribution-more').click();
  await expect(exact).toHaveValue('1340');
  await panel.locator('#nm-distribution-less').click();
  await expect(exact).toHaveValue('1240');
  await exact.fill('1577');
  await exact.press('Enter');
  await expect(exact).toHaveValue('1580');
  await expect(range).toHaveValue('1580');
  const applied=await page.evaluate(()=>neuroMapApp.state.root.layoutDistribution.height);
  expect(applied).toBe(1580);
  await expect(panel.locator('#nm-distribution-legend-applied')).toContainText('Viola');
  await panel.locator('#nm-distribution-details-title').click();
  await expect(panel.locator('#nm-distribution-explanation')).toBeVisible();
  const plan=JSON.stringify(await page.evaluate(()=>neuroMapApp.state.root.children));
  expect(plan).toBe(before);
  expect(await panel.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(2);
  await panel.locator('#nm620-show-guides').click();
  await expect(panel.locator('#nm620-forecast-summary')).not.toBeEmpty();
 });
}
