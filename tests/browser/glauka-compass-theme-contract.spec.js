const {test,expect}=require('@playwright/test');

const skins=['prisma','classic','orbit','aurora','glass','cyber','minimal','graphite','neon','purple'];

async function boot(page,width){
 await page.setViewportSize({width,height:width<600?850:950});
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.NeuroMapUISkin?.set&&window.neuroMapApp);
 await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden')));
 await page.locator('#nm614-open-navigation').click();
 await expect(page.locator('#nm614-navigation-flyout')).toBeVisible();
 await expect(page.locator('#nm616-nav-focus')).toBeVisible();
}

const check=async page=>page.evaluate(()=>{
 const css=el=>getComputedStyle(el);
 const color=value=>{
   const probe=document.createElement('span');
   probe.style.cssText='position:absolute;left:-99999px;background:'+value+';color:'+value;
   document.body.append(probe);
   const s=css(probe);
   const result={bg:s.backgroundColor,fg:s.color};
   probe.remove();return result;
 };
 const theme=css(document.body),ink=color('var(--nm-skin-ink)').fg;
 const muted=color('var(--nm-skin-muted)').fg;
 const focus=color('var(--nm-theme-focus)').fg;
 const action=color('var(--nm-theme-action)').bg;
 const onAction=color('var(--nm-theme-on-action)').fg;
 const surface=color('var(--nm-skin-surface)').bg;
 const control=color('var(--nm-skin-top)').bg;
 const fly=document.getElementById('nm614-navigation-flyout');
 const compass=document.getElementById('nm614-open-navigation');
 const active=document.getElementById('nm616-nav-focus');
 const navigation=document.getElementById('nm616-navigation');
 const selector=document.getElementById('nm69-nav-level');
 const order=document.getElementById('nm612-nav-order');
 const levelLabel=selector.closest('label.nm69-nav-level');
 const orderLabel=order.closest('label.nm612-nav-order');
 const navHeading=document.getElementById('nm616-nav-caption');
 const tip=document.querySelector('#nm614-navigation-flyout .nm614-nav-hint');
 const map=document.getElementById('nm616-minimap-shell');
 return {
  skin:document.body.dataset.nmSkin,
  expected:{ink,muted,focus,action,onAction,surface,control},
  actual:{
   flyBackground:css(fly).backgroundColor,flyInk:css(fly).color,
   compassBorder:css(compass).borderTopColor,
   activeBackground:css(active).backgroundColor,activeInk:css(active).color,
   navInk:css(navigation).color,
   selectorInk:css(selector).color,selectorBackground:css(selector).backgroundColor,
   orderInk:css(order).color,orderBackground:css(order).backgroundColor,
   levelWrapper:{background:css(levelLabel).backgroundColor,border:css(levelLabel).borderTopStyle,
     shadow:css(levelLabel).boxShadow,ink:css(levelLabel).color},
   orderWrapper:{background:css(orderLabel).backgroundColor,border:css(orderLabel).borderTopStyle,
     shadow:css(orderLabel).boxShadow,ink:css(orderLabel).color},
   hintInk:css(tip).color,
   navCaptionInk:css(navHeading).color,
   mapInk:css(map).color
  },
  flatContainers:[...fly.querySelectorAll('div, section, nav, details, header, footer')]
   .map(el=>({name:el.id||el.className||el.tagName,background:css(el).backgroundColor,shadow:css(el).boxShadow})),
  crumb:(()=>{
   const path=document.getElementById('nm616-context-path');
   const probe=document.createElement('button');probe.type='button';probe.className='nm616-crumb';
   probe.textContent='Test ancestor';path.append(probe);
   const style=css(probe);
   const result={background:style.backgroundColor,color:style.color,border:style.borderTopColor};
   probe.remove();return result;
  })(),
  flyWidth:fly.scrollWidth-fly.clientWidth,
  root:JSON.stringify(neuroMapApp.state.root),
  tabCount:neuroMapApp.tabs.length
 };
});

for(const width of [360,1440]){
 test('Compass, labels, selectors and selected actions follow each skin at '+width+'px',async({page})=>{
  await boot(page,width);
  const initial=await check(page);
  for(const contrast of ['normal','high']){
   for(const skin of skins){
    await page.evaluate(([theme,contrast])=>NeuroMapUISkin.set({theme,contrast}),[skin,contrast]);
    await expect(page.locator('body')).toHaveAttribute('data-nm-skin',skin==='classic'?'orbit':skin);
    const sample=await check(page);
    const {expected:e,actual:a}=sample;
    expect(a.flyBackground,skin+' '+contrast+' flyout background').toBe(e.surface);
    expect(a.flyInk,skin+' '+contrast+' flyout ink').toBe(e.ink);
    expect(a.activeBackground,skin+' '+contrast+' focus action').toBe(e.action);
    expect(a.activeInk,skin+' '+contrast+' focus ink').toBe(e.onAction);
    expect(a.navInk,skin+' '+contrast+' navigation ink').toBe(e.ink);
    expect(a.selectorInk,skin+' '+contrast+' select label').toBe(e.ink);
    expect(a.selectorBackground,skin+' '+contrast+' select surface').toBe(e.control);
    expect(a.orderBackground,skin+' '+contrast+' order select surface').toBe(e.control);
    expect(a.orderInk,skin+' '+contrast+' order select ink').toBe(e.ink);
    for(const [name,w] of [['level',a.levelWrapper],['order',a.orderWrapper]]){
      expect(w.background,skin+' '+contrast+' '+name+' wrapper background').toBe('rgba(0, 0, 0, 0)');
      expect(w.border,skin+' '+contrast+' '+name+' wrapper border').toBe('none');
      expect(w.shadow,skin+' '+contrast+' '+name+' wrapper shadow').toBe('none');
      expect(w.ink,skin+' '+contrast+' '+name+' label ink').toBe(e.muted);
    }
    expect(a.hintInk,skin+' '+contrast+' hint').toBe(e.muted);
    expect(a.navCaptionInk,skin+' '+contrast+' caption').toBe(e.muted);
    expect(a.mapInk,skin+' '+contrast+' minimap shell').toBe(e.ink);
    expect(sample.root,skin+' changed map root').toBe(initial.root);
    expect(sample.tabCount,skin+' changed tabs').toBe(initial.tabCount);
    expect(sample.flatContainers.length,skin+' structural controls').toBeGreaterThan(4);
    const isHeading=name=>/nm-side-panel-heading|nm614-fly-title/.test(String(name));
    for(const container of sample.flatContainers.filter(item=>!isHeading(item.name))){
     expect(container.background,skin+' '+contrast+' nested surface '+container.name).toBe('rgba(0, 0, 0, 0)');
     expect(container.shadow,skin+' '+contrast+' nested shadow '+container.name).toBe('none');
    }
    for(const heading of sample.flatContainers.filter(item=>isHeading(item.name))){
     expect(heading.background,skin+' '+contrast+' heading surface '+heading.name).toBe(e.surface);
     expect(heading.shadow,skin+' '+contrast+' heading shadow '+heading.name).toBe('none');
    }
    expect(sample.crumb.background,skin+' '+contrast+' breadcrumb background').toBe('rgba(0, 0, 0, 0)');
    expect(sample.crumb.color,skin+' '+contrast+' selected breadcrumb text').toBe(e.ink);
    expect(sample.crumb.border,skin+' '+contrast+' breadcrumb border').toBe('rgba(0, 0, 0, 0)');
    expect(sample.flyWidth,skin+' overflow').toBeLessThanOrEqual(2);
   }
  }
  await page.evaluate(()=>NeuroMapUISkin.set({theme:'prisma',contrast:'normal'}));
  const compass=page.locator('#nm614-open-navigation');
  await expect(compass).toHaveAttribute('aria-expanded','true');
  const expanded=await check(page);
  expect(expanded.actual.compassBorder).toBe(expanded.expected.focus);
  await compass.click();
  await expect(page.locator('#nm614-navigation-flyout')).toBeHidden();
 });
}

test('navigation keeps focus indicators, accessible name and correct brand',async({page})=>{
 await boot(page,1440);
 await page.evaluate(()=>NeuroMapUISkin.set({theme:'prisma',contrast:'high'}));
 const compass=page.locator('#nm614-open-navigation');
 expect(await compass.evaluate(el=>el.closest('nav').getAttribute('aria-label'))).toBe('Strumenti rapidi Glauka');
 await page.locator('#nm616-nav-focus').focus();
 await page.keyboard.press('Tab');
 const status=await page.evaluate(()=>({
  focusVisible:document.activeElement.matches(':focus-visible'),
  outline:getComputedStyle(document.activeElement).outlineStyle,
  label:document.activeElement.getAttribute('aria-label')||document.activeElement.textContent.trim()
 }));
 expect(status.focusVisible).toBe(true);
 expect(status.outline).not.toBe('none');
 expect(status.label.length).toBeGreaterThan(0);
});

test('previously saved cyan is preserved, while new choices survive reload',async({page})=>{
 await page.addInitScript(()=>{
  if(sessionStorage.getItem('glauka-theme-migration-seeded'))return;
  sessionStorage.setItem('glauka-theme-migration-seeded','1');
  localStorage.setItem('nm_orbit_desktop_ui_v1',JSON.stringify({enabled:true,accent:'cyan',density:'comfortable'}));
  localStorage.setItem('nm_ui_skin_v1',JSON.stringify({theme:'cyber',contrast:'normal',readability:'standard'}));
  // A saved cyan value might be a conscious user preference: preserve it.
 });
 await boot(page,1440);
 expect(await page.evaluate(()=>NeuroMapOrbit.get().accent)).toBe('cyan');
 await expect(page.locator('body')).toHaveAttribute('data-nm-orbit-accent','cyan');
 const focus=await check(page);
 expect(focus.actual.activeBackground).toBe(focus.expected.action);
 await page.evaluate(()=>NeuroMapOrbit.set({accent:'amber'}));
 await expect(page.locator('body')).toHaveAttribute('data-nm-orbit-accent','amber');
 await page.reload();
 await page.waitForFunction(()=>window.NeuroMapOrbit?.get&&window.NeuroMapUISkin?.get);
 expect(await page.evaluate(()=>NeuroMapOrbit.get().accent)).toBe('amber');
 await page.evaluate(()=>NeuroMapOrbit.set({accent:'auto'}));
 await expect(page.locator('body')).toHaveAttribute('data-nm-orbit-accent','auto');
});

test('Blue Original and Orbit use their own real palette, not the generic fallback',async({page})=>{
 await boot(page,1440);
 for(const theme of ['classic','orbit']){
  await page.evaluate(theme=>NeuroMapUISkin.set({theme}),theme);
  const colors=await page.evaluate(()=>{
   const st=getComputedStyle(document.body);
   return {surface:st.getPropertyValue('--nm-skin-surface').trim(),
    top:st.getPropertyValue('--nm-skin-top').trim(),
    ink:st.getPropertyValue('--nm-skin-ink').trim()};
  });
  expect(colors,theme).toEqual({surface:'#07142f',top:'#0c214a',ink:'#f4f7ff'});
 }
 await page.evaluate(()=>NeuroMapUISkin.set({theme:'prisma'}));
 expect(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--nm-skin-surface').trim())).toBe('#ffffff');
});

test('Command deck and its search controls change palette when the interface theme changes',async({page})=>{
 await boot(page,1440);
 const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
 await page.evaluate(()=>NeuroMapOrbit.openDeck());
 await expect(page.locator('#nm-orbit-command-overlay')).toBeVisible();
 for(const theme of ['prisma','cyber','graphite','classic']){
  await page.evaluate(theme=>NeuroMapUISkin.set({theme}),theme);
  const result=await page.evaluate(()=>{
   const style=getComputedStyle(document.body);
   const dialog=getComputedStyle(document.querySelector('#nm-orbit-command-dialog'));
   const search=getComputedStyle(document.querySelector('#nm-orbit-command-search'));
   const heading=getComputedStyle(document.querySelector('#nm-orbit-command-results .nm-orbit-command-group'));
   const expected=style.getPropertyValue('--nm-skin-ink').trim();
   return {
    dialogColor:dialog.color,
    searchColor:search.color,
    headingColor:heading.color,
    expected,
    action:style.getPropertyValue('--nm-theme-focus').trim()
   };
  });
  expect(result.dialogColor).toBe(result.searchColor);
  expect(result.headingColor).not.toBe('');
 }
 await page.evaluate(()=>NeuroMapOrbit.closeDeck());
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
});
