const {test,expect}=require('@playwright/test');
const desktop=process.env.GLAUKA_DESKTOP_TEST_URL||'http://127.0.0.1:5174/index.html';

async function boot(page,width=1280){
  await page.setViewportSize({width,height:900});
  await page.addInitScript(()=>{
    localStorage.setItem('nm6_welcome_seen','1');
    localStorage.removeItem('nm_ui_skin_v1');
    localStorage.removeItem('nm_orbit_desktop_ui_v1');
    window.__nmThemeSamples=[];
    const sample=()=>{
      const body=document.body;
      if(!body)return;
      window.__nmThemeSamples.push(body.dataset.nmSkin||'');
    };
    document.addEventListener('DOMContentLoaded',sample);
    addEventListener('load',sample);
    window.neuromapDesktop={productStatus:async()=>({plan:'pro'}),readWorkspace:async()=>null,readEditorPreferences:async()=>null,readAISettings:async()=>null,readAISecret:async()=>({}),writeWorkspace:async()=>true,onExternalFile:()=>{}};
  });
  await page.goto(desktop);
  await page.waitForFunction(()=>window.NeuroMapHome&&window.neuroMapApp&&document.body.classList.contains('nm-workspace-v2'));
  await page.addStyleTag({content:'*{transition:none!important;animation:none!important}'});
}

test('the first paint stays on the light theme and shows 1.0.4',async({page})=>{
  await boot(page);
  const state=await page.evaluate(()=>({
    skin:document.body.dataset.nmSkin,
    samples:window.__nmThemeSamples,
    version:typeof NM_PRODUCT_VERSION==='string'?NM_PRODUCT_VERSION:'',
    bg:getComputedStyle(document.body).backgroundColor
  }));
  expect(state.skin).toBe('prisma');
  expect(state.samples.every(skin=>skin==='prisma'||skin==='')).toBe(true);
  expect(state.version).toBe('1.0.4');
  expect(state.bg).not.toBe('rgb(15, 23, 42)');
  expect(state.bg).not.toBe('rgb(16, 27, 47)');
});

for(const width of [1280,760]){
  test('layout, format and study panels keep their title and buttons at '+width,async({page})=>{
    await boot(page,width);
    await page.locator('#v6-show-layout').click();
    const layout=page.locator('.hud-bottom-left');
    await expect(layout).toBeVisible();
    const openBox=await layout.boundingBox();
    const grip=page.locator('.nm-panel-resize-handle[data-nm-size-scope="layout"]');
    await expect(grip).toHaveCount(1);
    const gripBox=await grip.boundingBox();
    expect(gripBox.y).toBeGreaterThanOrEqual(openBox.y-1);
    expect(gripBox.y+gripBox.height).toBeLessThanOrEqual(openBox.y+openBox.height+2);
    expect(gripBox.x+gripBox.width).toBeLessThanOrEqual(openBox.x+openBox.width+2);
    expect(gripBox.x).toBeGreaterThanOrEqual(openBox.x+openBox.width-3);
    const gripStyle=await grip.evaluate(el=>{
      const s=getComputedStyle(el);
      return {width:s.width,padding:s.paddingLeft+' '+s.paddingRight,margin:s.marginLeft,border:s.borderLeftWidth,box:s.boxSizing};
    });
    expect(gripStyle).toEqual({width:'2px',padding:'0px 0px',margin:'0px',border:'0px',box:'border-box'});
    expect(Math.abs(gripBox.width-2)).toBeLessThanOrEqual(0.6);
    expect(Math.abs((gripBox.x+gripBox.width)-(openBox.x+openBox.width))).toBeLessThanOrEqual(1);
    const star=page.locator('#nm-settings-defaults-layout');
    await expect(star).toBeVisible();
    const starInside=await page.evaluate(()=>{
      const panel=document.querySelector('.hud-bottom-left');
      const button=document.getElementById('nm-settings-defaults-layout');
      const panelBox=panel.getBoundingClientRect();
      const starBox=button.getBoundingClientRect();
      const scrollbar=Math.max(0,panel.offsetWidth-panel.clientWidth);
      return starBox.right<=panelBox.right-scrollbar+1&&starBox.left>=panelBox.left-1&&starBox.top>=panelBox.top-1&&starBox.bottom<=panelBox.bottom+1&&panel.scrollWidth<=panel.clientWidth+1;
    });
    expect(starInside).toBe(true);
    const title=layout.locator('.hud-title');
    const openTitle=await title.evaluate(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      const header=el.closest('.hud-header')||el.parentElement;
      const panel=el.closest('.hud-bottom-left');
      const hs=getComputedStyle(header),ps=getComputedStyle(panel);
      return {weight:s.fontWeight,left:r.left,panel:panel.getBoundingClientRect().left,headerPad:hs.paddingLeft,panelPad:ps.paddingLeft,headerMargin:getComputedStyle(header.parentElement).marginLeft};
    });
    await layout.locator('.nm-panel-header-actions button').first().click();
    await expect(layout).toHaveClass(/nm-panel-compact/);
    await expect(grip).toBeHidden();
    const compact=await layout.evaluate(el=>{
      const r=el.getBoundingClientRect();
      return {top:r.top,height:r.height,bottom:r.bottom};
    });
    expect(compact.height).toBeLessThan(80);
    expect(compact.top).toBeLessThan(220);
    const compactTitle=await title.evaluate(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      const header=el.closest('.hud-header')||el.parentElement;
      const panel=el.closest('.hud-bottom-left');
      const hs=getComputedStyle(header),ps=getComputedStyle(panel);
      return {weight:s.fontWeight,left:r.left,panel:panel.getBoundingClientRect().left,headerPad:hs.paddingLeft,panelPad:ps.paddingLeft,headerMargin:getComputedStyle(header.parentElement).marginLeft};
    });
    expect(Number(compactTitle.weight)).toBeGreaterThanOrEqual(700);
    expect(Math.abs(compactTitle.left-openTitle.left),JSON.stringify({open:openTitle,compact:compactTitle})).toBeLessThan(2);
    await layout.locator('.nm-panel-header-actions button').first().click();
    await expect(layout).not.toHaveClass(/nm-panel-compact/);
    await layout.locator('.nm-panel-header-actions button').last().click();
    await expect(layout).toBeHidden();

    await page.locator('#btn-toggle-inspector').click();
    const format=page.locator('#inspector-sidebar');
    await expect(format).toBeVisible();
    const formatTitle=format.locator('.inspector-title').first();
    const formatOpen=await formatTitle.evaluate(el=>{const r=el.getBoundingClientRect();return r.left-el.closest('#inspector-sidebar').getBoundingClientRect().left});
    await format.locator('.nm-panel-header-actions button').first().click();
    await expect(format).toHaveClass(/nm-panel-compact/);
    const formatCompact=await formatTitle.evaluate(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return {weight:Number(s.fontWeight),inset:r.left-el.closest('#inspector-sidebar').getBoundingClientRect().left};
    });
    expect(formatCompact.weight).toBeGreaterThanOrEqual(700);
    expect(Math.abs(formatCompact.inset-formatOpen),JSON.stringify(formatCompact)).toBeLessThan(2);
    await format.locator('.nm-panel-header-actions button').first().click();
    await expect(format).not.toHaveClass(/nm-panel-compact/);
    await format.locator('.nm-panel-header-actions button').last().click();
    await expect(format).toBeHidden();

    await page.locator('#nm-learn-open').click();
    const learn=page.locator('#nm-learn-panel');
    await expect(learn).toBeVisible();
    const learnTitle=learn.locator('header strong').first();
    const learnOpen=await learnTitle.evaluate(el=>{const r=el.getBoundingClientRect();return r.left-el.closest('#nm-learn-panel').getBoundingClientRect().left});
    await learn.locator('.nm-panel-header-actions button').first().click();
    await expect(learn).toHaveClass(/nm-panel-compact/);
    const learnCompact=await learnTitle.evaluate(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return {weight:Number(s.fontWeight),inset:r.left-el.closest('#nm-learn-panel').getBoundingClientRect().left};
    });
    expect(learnCompact.weight).toBeGreaterThanOrEqual(700);
    expect(Math.abs(learnCompact.inset-learnOpen),JSON.stringify(learnCompact)).toBeLessThan(2);
    await learn.locator('.nm-panel-header-actions button').first().click();
    await expect(learn).not.toHaveClass(/nm-panel-compact/);
    await learn.locator('.nm-panel-header-actions button').last().click();
    await expect(learn).toBeHidden();

    await page.locator('#btn-ai-settings').click();
    const ai=page.locator('#nm-ai-studio');
    await expect(ai).toBeVisible();
    const contained=await ai.evaluate(el=>{
      const panel=el.getBoundingClientRect();
      const controls=[...el.querySelectorAll('#nm-ai-connections-open,.nm-ai-service-summary,.nm-ai-header-actions button')];
      return controls.every(node=>{
        const box=node.getBoundingClientRect();
        return box.width>0&&box.left>=panel.left-1&&box.right<=panel.right+1&&box.top>=panel.top-1&&box.bottom<=panel.bottom+1;
      });
    });
    expect(contained).toBe(true);
  });
}
