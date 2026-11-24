const {test,expect}=require('@playwright/test');

// Browser-level validation of the precise issue reported in the light Compass:
// legacy dark sub-panels, dark native controls and pale text on pale cards.
// No screenshot baseline is accepted from an unreviewed renderer; optional
// screenshots are attached to local Playwright artifacts for human review.
const themes=['prisma','minimal','classic','orbit','aurora','glass','cyber','graphite','neon','purple'];
const light=new Set(['prisma','minimal']);

async function boot(page,width){
 await page.route('**/api/status',route=>route.fulfill({json:{plan:'pro',developer:true,perpetual:true}}));
 await page.setViewportSize({width,height:width===360?850:950});
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.NeuroMapUISkin?.set&&window.neuroMapApp);
 await page.waitForFunction(()=>document.getElementById('nm7-guide-open')?.dataset.nm7Bound==='true');
 await page.waitForFunction(()=>document.querySelector('#nm-view-picker-trigger')&&document.getElementById('nm-learn-open'));
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
 // Materialize the real dynamic elements and their CSS, then close them;
 // subsequent computed-style checks do not depend on animation timing.
 await page.locator('#v6-show-layout').click();
 await page.locator('#nm-view-picker-trigger').click();
 await expect(page.locator('#nm-view-picker-gallery')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.locator('#nm7-guide-open').evaluate(e=>e.click());
 await expect(page.locator('#nm7-guide-dialog')).toBeVisible();
 await page.locator('#nm7-guide-close').click();
 await page.locator('#nm-learn-open').evaluate(e=>e.click());
 await expect(page.locator('#nm-learn-panel')).toBeVisible();
 // The study overlay can cover the right-side Compass trigger. Hide it after
 // mounting CSS; the palette test still reads styles on its actual DOM controls.
 await page.locator('#nm-learn-panel').evaluate(e=>{e.hidden=true});
 await page.locator('#nm614-open-navigation').click();
 await expect(page.locator('#nm614-navigation-flyout')).toBeVisible();
 // Native select probe exercises the SAME live style rules as real quiz fields;
 // use a distinct ID and remove it before every test completes.
 await page.evaluate(()=>{
   const panel=document.getElementById('nm-learn-panel');
   const probe=document.createElement('select');probe.id='glauka-native-scheme-probe';
   const option=document.createElement('option');option.textContent='Sample';
   probe.append(option);panel.append(probe);
 });
}

const check=async(page)=>page.evaluate(()=>{
 const css=el=>getComputedStyle(el);
 const by=id=>document.getElementById(id);
 const token=value=>{
   const s=document.createElement('span');
   s.style.cssText='position:absolute;left:-999999px;background:'+value+';color:'+value;
   document.body.append(s);
   const st=css(s),result={bg:st.backgroundColor,ink:st.color};
   s.remove();return result;
 };
 const background=e=>css(e).backgroundColor;
 const ink=e=>css(e).color;
 const border=e=>css(e).borderTopColor;
 const guide=by('nm7-guide-dialog');
 const notes=document.querySelector('.nm67-notes-modal');
 const view=by('nm-view-picker-gallery');
 const choice=view.querySelector('.nm-view-choice[aria-checked="true"]');
 const inactive=view.querySelector('.nm-view-choice:not([aria-checked="true"])');
 const learn=by('nm-learn-panel');
 const native=by('glauka-native-scheme-probe');
 const compass=by('nm614-navigation-flyout');
 const level=by('nm69-nav-level').closest('.nm69-nav-level');
 const order=by('nm612-nav-order').closest('.nm612-nav-order');
 return {
   palette:{
     surface:token('var(--nm-skin-surface)').bg,
     top:token('var(--nm-skin-top)').bg,
     ink:token('var(--nm-skin-ink)').ink,
     muted:token('var(--nm-skin-muted)').ink,
     action:token('var(--nm-theme-action)').bg,
     actionInk:token('var(--nm-theme-on-action)').ink,
     edge:token('var(--nm-skin-stroke)').bg
   },
   theme:document.body.dataset.nmSkin,
   scheme:css(document.body).colorScheme,
   nativeScheme:css(native).colorScheme,
   compass:{surface:background(compass),label:background(level),order:background(order),
     select:background(by('nm69-nav-level')),orderSelect:background(by('nm612-nav-order'))},
   guide:{surface:background(guide),step:background(guide.querySelector('li')),
     title:ink(guide.querySelector('li strong'))},
   notes:{surface:background(notes),editor:background(by('nm67-notes-editor')),
     preview:background(by('nm67-notes-preview')),label:ink(document.querySelector('.nm67-notes-columns label'))},
   picker:{surface:background(view),choice:background(inactive),selected:background(choice),
     selectedInk:ink(choice),border:border(choice)},
   learn:{surface:background(learn),field:background(native)},
   map:JSON.stringify(neuroMapApp.state.root),
   tabs:neuroMapApp.tabs.length,
   horizontalOverflow:compass.scrollWidth-compass.clientWidth
 };
});

for(const width of [360,1440]){
 test('theme material is consistent across Compass, Ripasso, Guide, Notes and View selector at '+width+'px',async({page},testInfo)=>{
  // Full matrix is 20 palette states per viewport. Optional screenshot runs
  // also capture five dialogs per state, which exceeds the 30s smoke timeout.
  test.setTimeout(process.env.GLAUKA_PALETTE_CAPTURE==='1'?300_000:90_000);
  await boot(page,width);
  const initial=await check(page);
  for(const contrast of ['normal','high'])for(const theme of themes){
   await page.evaluate(([theme,contrast])=>NeuroMapUISkin.set({theme,contrast}),[theme,contrast]);
   await expect(page.locator('body')).toHaveAttribute('data-nm-skin',theme==='classic'?'orbit':theme);
   await expect(page.locator('#nm614-navigation-flyout')).toBeVisible();
   const v=await check(page),p=v.palette,ctx=theme+'/'+contrast+'/'+width;
   expect(v.scheme,ctx+' native theme').toContain(light.has(theme)?'light':'dark');
   expect(v.nativeScheme,ctx+' select theme').toContain(light.has(theme)?'light':'dark');
   expect(v.compass.surface,ctx+' Compass').toBe(p.surface);
   expect(v.compass.label,ctx+' level label flat').toBe('rgba(0, 0, 0, 0)');
   expect(v.compass.order,ctx+' order label flat').toBe('rgba(0, 0, 0, 0)');
   expect(v.compass.select,ctx+' level dropdown').toBe(p.top);
   expect(v.compass.orderSelect,ctx+' order dropdown').toBe(p.top);
   expect(v.guide.surface,ctx+' guide').toBe(p.surface);
   expect(v.guide.step,ctx+' guide step tile').toBe(p.top);
   expect(v.guide.title,ctx+' guide text').toBe(p.ink);
   expect(v.notes.surface,ctx+' note dialog').toBe(p.surface);
   expect(v.notes.editor,ctx+' note editor').toBe(p.top);
   expect(v.notes.preview,ctx+' note preview shell').toBe(p.top);
   expect(v.notes.label,ctx+' note label').toBe(p.muted);
   expect(v.picker.surface,ctx+' view gallery').toBe(p.surface);
   expect(v.picker.choice,ctx+' unselected view tile').toBe(p.top);
   expect(v.picker.selected,ctx+' selected view').toBe(p.action);
   expect(v.picker.selectedInk,ctx+' selected view text').toBe(p.actionInk);
   expect(v.learn.surface,ctx+' study panel').toBe(p.surface);
   expect(v.learn.field,ctx+' native study input').toBe(p.top);
   expect(v.map,ctx+' map unchanged').toBe(initial.map);
   expect(v.tabs,ctx+' tabs unchanged').toBe(initial.tabs);
   expect(v.horizontalOverflow,ctx+' compass overflow').toBeLessThanOrEqual(2);
   if(process.env.GLAUKA_PALETTE_CAPTURE==='1'){
     const folder=theme+'-'+contrast+'-'+width;
     // Capture the actual four surfaces. HTML reports can open these files.
     await page.evaluate(()=>document.getElementById('nm-learn-panel').hidden=false);
     await page.screenshot({path:testInfo.outputPath(folder+'-ripasso.png')});
     await page.evaluate(()=>document.getElementById('nm-learn-panel').hidden=true);
     await page.evaluate(()=>document.getElementById('nm67-notes-overlay').classList.remove('hidden'));
     await page.screenshot({path:testInfo.outputPath(folder+'-notes.png')});
     await page.evaluate(()=>document.getElementById('nm67-notes-overlay').classList.add('hidden'));
     await page.locator('#nm7-guide-open').evaluate(e=>e.click());
     await page.screenshot({path:testInfo.outputPath(folder+'-guide.png')});
     await page.locator('#nm7-guide-close').click();
     await page.locator('#nm-view-picker-trigger').click();
     await page.screenshot({path:testInfo.outputPath(folder+'-views.png')});
     await page.keyboard.press('Escape');
     await expect(page.locator('#nm614-navigation-flyout')).toBeVisible();
     await page.screenshot({path:testInfo.outputPath(folder+'-compass.png')});
   }
  }
  await page.evaluate(()=>document.getElementById('glauka-native-scheme-probe')?.remove());
 });
}
