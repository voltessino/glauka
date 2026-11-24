const {test,expect}=require('@playwright/test');
async function ready(page,width,locale='it'){
 await page.setViewportSize({width,height:800});
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?._nmLearning);
 await page.locator('#nm6-welcome-start').click();
 await page.evaluate(async language=>{await GlaukaI18n.setLanguage(language);},locale);
}
for(const width of [360,768,1440])for(const locale of ['it','en']){
 test(`${width}px ${locale}: all study modes keep tabs fixed and fields separated`,async({page},testInfo)=>{
  await ready(page,width,locale);
  await page.evaluate(()=>neuroMapApp.importHierarchy({text:'Esame',children:Array.from({length:40},(_,i)=>({text:'Argomento '+i+' · dettagli di infermieristica clinica e fisiologia',children:[]}))},{newTab:true}));
  const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
  await page.locator('#nm-learn-open').click();
  const panel=page.locator('#nm-learn-panel'),tabs=panel.locator('.nm-learn-tabs button');
  const bounds=()=>tabs.evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height}}));
  const original=await bounds();
  for(const name of ['Quiz',locale==='it'?'Da ripassare':'Review mistakes',locale==='it'?'Esame':'Exam',locale==='it'?'Ripeti a memoria':'Recall concepts',locale==='it'?'Esame':'Exam']){
   await panel.getByRole('button',{name,exact:true}).click();
   expect(await bounds()).toEqual(original);
   expect(await panel.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
  }
  for(const control of await panel.locator('label :is(select,input)').all()){
   const geometry=await control.evaluate(e=>{
    const r=e.getBoundingClientRect(),label=e.parentElement;
    const text=document.createRange();text.selectNodeContents(label.firstChild);
    const t=text.getBoundingClientRect();
    return {gap:r.top-t.bottom,width:r.width,height:r.height,background:getComputedStyle(e).backgroundImage};
   });
   expect(geometry.gap).toBeGreaterThanOrEqual(5);
   expect(geometry.height).toBeGreaterThanOrEqual(40);
  }
  await expect(panel.locator('.nm-learn-plan-day')).toHaveCount(14);
  await expect(panel.locator('.nm-learn-plan-day').first().locator('time')).toHaveAttribute('datetime',/\d{4}-\d{2}-\d{2}/);
  expect(await panel.locator('.nm-learn-plan-day li').count()).toBeGreaterThan(0);
  await panel.locator('input[type=number]').fill('45');
  await panel.getByRole('button',{name:locale==='it'?'Salva piano':'Save plan',exact:true}).click();
  expect(await page.evaluate(()=>neuroMapApp.learningPlans[0].minutesPerDay)).toBe(45);
  expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
  await page.mouse.move(1,500);
  await panel.screenshot({path:testInfo.outputPath(`study-${width}-${locale}.png`)});
 });
}
for(const platform of ['desktop','android']){
 test(`${platform}: scrolled layout content is fully covered by its sticky heading`,async({page},testInfo)=>{
  await page.setViewportSize({width:1100,height:650});
  await page.goto(platform==='desktop'?'http://127.0.0.1:5174/index.html':'http://127.0.0.1:5173/app/index.html');
  await page.waitForFunction(()=>window.neuroMapApp?.nmSettings);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
  if(platform==='android'){
   await page.locator('#glauka-options-open').click();await page.locator('#glauka-app-sheet').getByRole('button',{name:'Disposizione dei rami',exact:true}).click();
   const content=page.locator('#glauka-sheet-content'),head=page.locator('#glauka-app-sheet header');
   const before=await head.boundingBox();await content.evaluate(e=>e.scrollTop=e.scrollHeight);
   await expect(head).toBeVisible();expect(await head.boundingBox()).toEqual(before);
   expect(await head.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+3))})).toBe(true);
   await expect(page.locator('#glauka-sheet-close')).toBeVisible();await page.locator('#glauka-app-sheet').screenshot({path:testInfo.outputPath('layout-android.png')});return;
  }
  await page.locator('#v6-show-layout').click();
  const hud=page.locator('.hud-bottom-left');
  await hud.evaluate(e=>e.scrollTop=e.scrollHeight/2);
  await expect.poll(()=>hud.evaluate(e=>{
   const heading=e.querySelector('.nm-settings-sticky-header'),r=heading.getBoundingClientRect(),h=e.getBoundingClientRect();
   const top=document.elementFromPoint(h.x+h.width/2,h.y+3);
   return {offset:Math.round(r.top-h.top),covered:heading.contains(top)};
  })).toEqual({offset:1,covered:true});
  await hud.screenshot({path:testInfo.outputPath(`layout-${platform}.png`)});
 });
}
test('comfortable study controls fit a narrow panel without changing size between modes',async({page})=>{
 await ready(page,360);
 await page.evaluate(()=>NeuroMapUISkin.set({readability:'comfortable'}));
 await page.locator('#nm-learn-open').click();
 const panel=page.locator('#nm-learn-panel');
 const before=await panel.locator('.nm-learn-tabs').boundingBox();
 await panel.getByRole('button',{name:'Esame',exact:true}).click();
 expect((await panel.locator('.nm-learn-tabs').boundingBox()).height).toBe(before.height);
 expect(await panel.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
});
