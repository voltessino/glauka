const {test,expect}=require('@playwright/test');
const desktop=process.env.GLAUKA_DESKTOP_TEST_URL||'http://127.0.0.1:5174/index.html';
async function boot(page){
  await page.setViewportSize({width:1280,height:800});
  await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
  await page.goto(desktop);
  await page.waitForFunction(()=>Boolean(window.neuroMapApp?.nmSettings&&window.NeuroMapLinkedViews));
  await page.evaluate(async()=>{
    await window.GlaukaAppReady;
    window.NeuroMapHome?.close?.();
    document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));
  });
  await page.addStyleTag({content:'*{transition:none!important;animation:none!important;scroll-behavior:auto!important}'});
}
test('switching from compact Inserisci to an alternate view closes the competing panel',async({page})=>{
  await boot(page);
  const insert=page.locator('#nm-insert-panel'),overlay=page.locator('#nm-view-overlay');
  await page.locator('#nm-open-insert').click();
  await expect(insert).toBeVisible();
  await expect(insert.locator('.nm-insert-tool-grid>.nm-insert-tool')).toHaveCount(6);
  await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'orgchart'));
  await expect(overlay).toBeVisible();
  await expect(insert).toBeHidden();
  await page.locator('#nm-view-appearance > summary').click();
  await expect(page.locator('#nm-view-appearance')).toHaveAttribute('open','');
  await page.locator('#nm-view-export-menu > summary').click();
  await expect(page.locator('#nm-view-appearance')).not.toHaveAttribute('open','');
  await expect(page.locator('#nm-view-export-menu')).toHaveAttribute('open','');
  await page.keyboard.press('Escape');
  await expect(page.locator('#nm-view-export-menu')).not.toHaveAttribute('open','');
  await expect(overlay).toBeVisible();
});
test('opening Inserisci closes the linked view without leaving a ghost overlay',async({page})=>{
  await boot(page);
  await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'concept-tree'));
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await page.evaluate(()=>document.getElementById('nm-open-insert').click());
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
  await expect(page.locator('#nm-insert-panel')).toBeVisible();
  await expect(page.locator('#nm-insert-panel .nm-insert-tool-grid>.nm-insert-tool')).toHaveCount(6);
  await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.root.viewMode)).toBe('mindmap');
});
test('shared panel and linked view widths remain isolated while compact toolbox resizes',async({page})=>{
  await boot(page);
  await page.locator('#nm-open-insert').click();
  await page.evaluate(()=>document.body.style.setProperty('--nm-right-panel-width','370px'));
  await expect(page.locator('#nm-insert-panel .nm-insert-tool-grid>.nm-insert-tool')).toHaveCount(6);
  await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'kanban'));
  const state=await page.evaluate(()=>({
    rightWidth:document.body.style.getPropertyValue('--nm-right-panel-width'),
    layoutWidth:document.body.style.getPropertyValue('--nm-layout-panel-width'),
    overlayVisible:!document.getElementById('nm-view-overlay').hidden,
    insertVisible:!document.getElementById('nm-insert-panel').hidden
  }));
  expect(state.rightWidth).toBe('370px');
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await expect(page.locator('#nm-insert-panel')).toBeHidden();
  await expect(page.locator('#nm-view-scroller')).toBeVisible();
});

test('opening Inserisci commits an in-progress alternate-view node edit before hiding the canvas',async({page})=>{
  await boot(page);
  const id=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    let node=app.state.root.children[0];
    if(!node){node=app.state.addChildNode(app.state.root.id);app.markChanged();}
    return node.id;
  });
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'orgchart'));
  const card=page.locator('#nm-view-stage .nm-view-card[data-node-id="'+id+'"]');
  await expect(card).toBeVisible();
  await card.dblclick();
  const editor=card.locator('.nm-view-edit');
  await expect(editor).toBeVisible();
  const text='Testo conservato dopo chiusura della vista';
  await editor.fill(text);
  await page.evaluate(()=>document.getElementById('nm-open-insert').click());
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
  await expect(page.locator('#nm-insert-panel')).toBeVisible();
  await expect.poll(()=>page.evaluate(id=>neuroMapApp.state.findNode(id)?.text,id)).toBe(text);
});

test('switching the secondary view mid-rename commits once and displays the new view',async({page})=>{
  await boot(page);
  const id=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    let node=app.state.root.children[0];
    if(!node){node=app.state.addChildNode(app.state.root.id);app.markChanged();}
    return node.id;
  });
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'orgchart'));
  await page.locator('#nm-view-split').click();
  await page.locator('#nm-dual-picker').selectOption('concept-tree');
  const card=page.locator('#nm-dual-stage .nm-view-card[data-node-id="'+id+'"]');
  await expect(card).toBeVisible();
  await card.dblclick();
  const editor=card.locator('.nm-view-edit');
  await expect(editor).toBeVisible();
  const value='Ramo conservato cambiando la seconda vista';
  await editor.fill(value);
  const history=await page.evaluate(()=>neuroMapApp.state.undoStack?.length);
  // Dispatch the change without clicking another control first: a normal
  // Playwright selectOption would blur and conceal the editor-race regression.
  await page.evaluate(()=>{
    const picker=document.getElementById('nm-dual-picker');
    picker.value='kanban';
    picker.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect.poll(()=>page.evaluate(id=>neuroMapApp.state.findNode(id)?.text,id)).toBe(value);
  await expect(page.locator('#nm-dual-stage .nm-view-edit')).toHaveCount(0);
  await expect(page.locator('#nm-dual-stage .nm-kanban-card[data-node-id="'+id+'"]')).toBeVisible();
  expect(await page.evaluate(()=>neuroMapApp.state.root.viewMode)).toBe('orgchart');
  expect(await page.evaluate(()=>neuroMapApp.state.undoStack?.length)).toBe(history+1);
});

test('denied split preset cannot overwrite saved workspace preferences',async({page})=>{
  await boot(page);
  const result=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    const api=window.NeuroMapWorkspaceLayout;
    const originalClaim=api.claim;
    const owner=app.tabs?.find(tab=>tab.id===app.activeTabId)||app;
    const before=JSON.stringify(owner.viewWorkspace);
    const history=app.state.undoStack.length;
    try{
      api.claim=()=>false; // simulate a protected draft refusing to close
      const picker=document.getElementById('nm-workspace-layouts');
      picker.value='builtin:kanban';
      picker.dispatchEvent(new Event('change',{bubbles:true}));
    }finally{api.claim=originalClaim}
    return {before,after:JSON.stringify(owner.viewWorkspace),
      history,undoStack:app.state.undoStack.length,
      mode:app.state.root.viewMode||'mindmap',
      hidden:document.getElementById('nm-view-overlay').hidden};
  });
  expect(result.before).toBeTruthy();
  expect(result.after).toBe(result.before);
  expect(result.undoStack).toBe(result.history);
  expect(result.mode).toBe('mindmap');
  expect(result.hidden).toBe(true);
});
test('two-alternate-view header changes primary without touching secondary',async({page})=>{
  await boot(page);
  await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'orgchart'));
  await page.locator('#nm-view-split').click();
  await expect(page.locator('#nm-dual-pane')).toBeVisible();
  await expect(page.locator('#nm-dual-picker')).toHaveValue('kanban');
  const before=await page.evaluate(()=>neuroMapApp.state.undoStack.length);
  await page.locator('#nm-view-overlay-picker').evaluate(el=>{el.value='concept-tree';el.dispatchEvent(new Event('change',{bubbles:true}))});
  await expect(page.locator('#nm-view-overlay-picker')).toHaveValue('concept-tree');
  await expect(page.locator('#nm-dual-picker')).toHaveValue('kanban');
  await expect(page.locator('#nm-dual-pane')).toBeVisible();
  expect(await page.evaluate(()=>neuroMapApp.state.root.viewMode)).toBe('concept-tree');
  expect(await page.evaluate(()=>neuroMapApp.state.undoStack.length)).toBe(before+1);
  await page.locator('#nm-view-overlay-picker').evaluate(el=>{el.value='mindmap';el.dispatchEvent(new Event('change',{bubbles:true}))});
  await expect(page.locator('#nm-dual-pane')).toBeHidden();
  await expect(page.locator('#nm-view-overlay-picker')).toHaveValue('kanban');
  expect(await page.evaluate(()=>neuroMapApp.state.root.viewMode)).toBe('mindmap');
});
test('switching the primary mode preserves an in-progress secondary rename',async({page})=>{
  await boot(page);
  const id=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    let node=app.state.root.children[0];
    if(!node){node=app.state.addChildNode(app.state.root.id);app.markChanged();}
    return node.id;
  });
  await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'orgchart'));
  await page.locator('#nm-view-split').click();
  await page.locator('#nm-dual-picker').selectOption('concept-tree');
  const card=page.locator('#nm-dual-stage .nm-view-card[data-node-id="'+id+'"]');
  await expect(card).toBeVisible();
  await card.dblclick();
  const editor=card.locator('.nm-view-edit');
  await expect(editor).toBeVisible();
  const text='Rinomina della vista secondaria conservata';
  await editor.fill(text);
  const before=await page.evaluate(()=>neuroMapApp.state.undoStack.length);
  // Programmatic mode change deliberately keeps focus on the secondary input.
  await page.evaluate(()=>NeuroMapLinkedViews.setMode(neuroMapApp,'timeline'));
  await expect.poll(()=>page.evaluate(id=>neuroMapApp.state.findNode(id)?.text,id)).toBe(text);
  await expect(page.locator('#nm-dual-stage .nm-view-edit')).toHaveCount(0);
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  expect(await page.evaluate(()=>neuroMapApp.state.root.viewMode)).toBe('timeline');
  expect(await page.evaluate(()=>neuroMapApp.state.undoStack.length)).toBe(before+2);
});
test('switching project tabs commits a dual-view rename to the original document',async({page})=>{
  await boot(page);
  const setup=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    let node=app.state.root.children[0];
    if(!node){node=app.state.addChildNode(app.state.root.id);app.markChanged();}
    const originalId=app.activeTabId,originalState=app.state,editedNodeId=node.id;
    app.importHierarchy({text:'Secondo progetto',children:[]},{newTab:true});
    const secondId=app.activeTabId;
    app.activateTab(originalId);
    window.__glaukaTabSwitchOriginalState=originalState;
    return {originalId,secondId,editedNodeId};
  });
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'orgchart'));
  await page.locator('#nm-view-split').click();
  await page.locator('#nm-dual-picker').selectOption('concept-tree');
  const node=page.locator('#nm-dual-stage .nm-view-card[data-node-id="'+setup.editedNodeId+'"]');
  await expect(node).toBeVisible();
  await node.dblclick();
  const input=node.locator('.nm-view-edit');
  await expect(input).toBeVisible();
  await input.fill('Salvato nel progetto originale');
  const before=await page.evaluate(()=>window.__glaukaTabSwitchOriginalState.undoStack.length);
  // Switch programmatically, without blurring the field through mouse focus.
  await page.evaluate(secondId=>window.neuroMapApp.activateTab(secondId),setup.secondId);
  await expect.poll(()=>page.evaluate(id=>window.__glaukaTabSwitchOriginalState.findNode(id)?.text,setup.editedNodeId))
    .toBe('Salvato nel progetto originale');
  expect(await page.evaluate(()=>window.neuroMapApp.activeTabId)).toBe(setup.secondId);
  expect(await page.evaluate(()=>window.__glaukaTabSwitchOriginalState.undoStack.length)).toBe(before+1);
});

test('secondary mode refreshes while primary inline editor remains active',async({page})=>{
  await boot(page);
  const id=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    let node=app.state.root.children[0];
    if(!node){node=app.state.addChildNode(app.state.root.id);app.markChanged();}
    return node.id;
  });
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'orgchart'));
  await page.locator('#nm-view-split').click();
  const primary=page.locator('#nm-view-stage .nm-view-card[data-node-id="'+id+'"]');
  await primary.dblclick();
  const editor=primary.locator('.nm-view-edit');
  await editor.fill('Rinomina principale non ancora confermata');
  await page.evaluate(()=>{
    const picker=document.getElementById('nm-dual-picker');
    picker.value='concept-tree';
    picker.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(page.locator('#nm-dual-stage .nm-tree-card[data-node-id="'+id+'"]')).toBeVisible();
  await expect(editor).toBeVisible(); // switching secondary never discards the edit
  await editor.press('Enter');
  await expect.poll(()=>page.evaluate(id=>neuroMapApp.state.findNode(id)?.text,id))
    .toBe('Rinomina principale non ancora confermata');
});

for(const width of [720,960,1280])test('panel formatting and detached list popup remain scoped at '+width+'px',async({page})=>{
  await boot(page);
  await page.setViewportSize({width,height:800});
  const inspector=page.locator('#inspector-sidebar');
  if(!(await inspector.isVisible()))await page.locator('#btn-toggle-inspector').click();
  await expect(inspector).toBeVisible();
  const list=page.locator('#nm-list-trigger');
  await list.scrollIntoViewIfNeeded();
  await list.click();
  const menu=page.locator('#nm-list-menu');
  await expect(menu).toBeVisible();
  const choiceSizes=await menu.locator('button').evaluateAll(items=>
    items.map(b=>b.getBoundingClientRect().height));
  expect(choiceSizes.length).toBeGreaterThan(0);
  expect(choiceSizes.every(height=>height>=40)).toBe(true);
  const pop=await menu.evaluate(el=>{
    const rect=el.getBoundingClientRect();
    return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,
      width:innerWidth,height:innerHeight};
  });
  expect(pop.left).toBeGreaterThanOrEqual(0);
  expect(pop.right).toBeLessThanOrEqual(pop.width+1);
  expect(pop.top).toBeGreaterThanOrEqual(0);
  expect(pop.bottom).toBeLessThanOrEqual(pop.height+1);
  // Programmatic transitions skip outside-pointerdown; the coordinator must
  // still dismiss this document.body-level popover to avoid ghost windows.
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'orgchart'));
  await expect(menu).toBeHidden();
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await expect(inspector).toBeHidden();
});

test('Word-like formatting toolbar uses compact alignment buttons and swatch grid',async({page})=>{
  await boot(page);
  const inspector=page.locator('#inspector-sidebar');
  if(!(await inspector.isVisible()))await page.locator('#btn-toggle-inspector').click();
  await expect(inspector).toBeVisible();
  const toolbar=page.locator('#nm-text-emphasis');
  await toolbar.scrollIntoViewIfNeeded();
  const format=await toolbar.evaluate(el=>({
    items:[...el.querySelectorAll(':scope > button:not([hidden])')].map(b=>({
      id:b.id,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height
    })),
    overflow:el.scrollWidth-el.clientWidth
  }));
  expect(format.items.length).toBeGreaterThanOrEqual(2);
  for(const item of format.items){
    expect(item.width,item.id).toBeLessThanOrEqual(44);
    expect(item.height,item.id).toBeLessThanOrEqual(46);
    expect(item.height,item.id).toBeGreaterThanOrEqual(36);
  }
  expect(format.overflow).toBeLessThanOrEqual(1);
  const group=page.locator('#nm-text-alignment .nm68-align-buttons');
  await expect(group).toHaveAttribute('role','group');
  const align=group.locator('button[data-nm68-align]');
  await expect(align).toHaveCount(3);
  for(const mode of ['left','center','right']){
    const btn=group.locator('button[data-nm68-align="'+mode+'"]');
    await expect(btn.locator('svg')).toHaveCount(1);
    await expect(btn).toHaveAttribute('aria-label',/.+/);
    const rect=await btn.boundingBox();
    expect(rect.width).toBeLessThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(34);
  }
  const before=await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root));
  const highlight=page.locator('#nm-text-highlight-picker');
  await highlight.locator('summary').click();
  const swatches=highlight.locator('.nm-text-highlight-choices button');
  await expect(swatches).toHaveCount(6);
  const geometry=await swatches.evaluateAll(items=>items.map(el=>({
    height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width
  })));
  expect(geometry.every(x=>x.height>=44&&x.height<=60&&x.width>=44)).toBe(true);
  expect(await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root))).toBe(before);
});

for(const width of [720,1280])test('panel switching never leaves two sizeable tool windows intersecting at '+width+'px',async({page})=>{
  await boot(page);
  await page.setViewportSize({width,height:800});
  const inspect=async()=>{
    const result=await page.evaluate(()=>{
      const ids=[
        '#inspector-sidebar','#nm-insert-panel','#nm-ai-studio','#nm-learn-panel',
        '#nm-knowledge-panel','#image-controls','.hud-bottom-left'
      ];
      const visible=ids.map(selector=>({selector,el:document.querySelector(selector)}))
        .filter(({el})=>el&&!el.hidden&&
          !el.classList.contains('hidden')&&!el.classList.contains('collapsed')&&
          getComputedStyle(el).visibility!=='hidden'&&
          getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().width>8)
        .map(({selector,el})=>({selector,rect:el.getBoundingClientRect().toJSON()}));
      const overlap=[];
      for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
        const a=visible[i],b=visible[j];
        const x=Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left);
        const y=Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top);
        if(x>2&&y>2)overlap.push([a.selector,b.selector,Math.round(x),Math.round(y)]);
      }
      return {visible:visible.map(x=>x.selector),overlap};
    });
    expect(result.overlap,'no colliding panels: '+result.visible.join(', ')).toEqual([]);
  };
  await page.locator('#nm-open-insert').click();
  await expect(page.locator('#nm-insert-panel')).toBeVisible();
  await inspect();
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'orgchart'));
  await expect(page.locator('#nm-insert-panel')).toBeHidden();
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await inspect();
  await page.locator('#nm-open-insert').click();
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
  await expect(page.locator('#nm-insert-panel')).toBeVisible();
  await inspect();
  await page.locator('#btn-toggle-inspector').click();
  await expect(page.locator('#inspector-sidebar')).toBeVisible();
  await expect(page.locator('#nm-insert-panel')).toBeHidden();
  await inspect();
});

for(const width of [720,1280])test('list-format popup near bottom opens upwards without covering its trigger at '+width+'px',async({page})=>{
  await boot(page);
  await page.setViewportSize({width,height:500});
  const inspector=page.locator('#inspector-sidebar');
  if(!(await inspector.isVisible()))await page.locator('#btn-toggle-inspector').click();
  await expect(inspector).toBeVisible();
  await page.locator('#nm-list-trigger').scrollIntoViewIfNeeded();
  // Simulate the precise geometry of a scrolled inspector at the viewport
  // foot. Test the same real click handler; no map or tool state is modified.
  const geometry=await page.evaluate(()=>{
    const trigger=document.getElementById('nm-list-trigger');
    const bottom=innerHeight-38,top=bottom-40;
    const left=innerWidth-74;
    trigger.getBoundingClientRect=()=>({
      top,bottom,left,right:left+66,width:66,height:40,x:left,y:top
    });
    trigger.click();
    const menu=document.getElementById('nm-list-menu');
    const box=menu.getBoundingClientRect();
    return {triggerTop:top,popupTop:box.top,popupBottom:box.bottom,
      popupLeft:box.left,popupRight:box.right,
      viewportWidth:innerWidth,viewportHeight:innerHeight,
      expanded:trigger.getAttribute('aria-expanded')};
  });
  expect(geometry.expanded).toBe('true');
  expect(geometry.popupTop).toBeGreaterThanOrEqual(7);
  expect(geometry.popupBottom).toBeLessThanOrEqual(geometry.triggerTop-4);
  expect(geometry.popupLeft).toBeGreaterThanOrEqual(7);
  expect(geometry.popupRight).toBeLessThanOrEqual(geometry.viewportWidth-7);
  await expect(page.locator('#nm-list-menu')).toBeVisible();
  await page.evaluate(()=>document.querySelector('#nm-list-menu button')?.focus());
  await page.keyboard.press('Escape');
  await expect(page.locator('#nm-list-menu')).toBeHidden();
  await expect(page.locator('#nm-list-trigger')).toHaveAttribute('aria-expanded','false');
});

test('scrolling a formatted panel dismisses the detached palette',async({page})=>{
  await boot(page);
  const inspector=page.locator('#inspector-sidebar');
  if(!(await inspector.isVisible()))await page.locator('#btn-toggle-inspector').click();
  await expect(inspector).toBeVisible();
  const trigger=page.locator('#nm-list-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.locator('#nm-list-menu')).toBeVisible();
  // A queued scroll notification with no movement must not dismiss a menu
  // that has just opened (WebKit delivers such events after scrollIntoView).
  await inspector.evaluate(el=>el.dispatchEvent(new Event('scroll')));
  await expect(page.locator('#nm-list-menu')).toBeVisible();
  // Reproduce a moved anchor independently of the current scroll range.
  await trigger.evaluate(el=>{el.style.transform='translateY(-20px)';document.getElementById('inspector-sidebar').dispatchEvent(new Event('scroll'))});
  await expect(page.locator('#nm-list-menu')).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded','false');
});

test('temporary window shrink keeps both side-panel width preferences',async({page})=>{
  // Desktop width choices are interface preferences, not document changes.
  // Emulate the user maximizing, briefly narrowing and maximizing again.
  await page.addInitScript(()=>{
    localStorage.setItem('nm.workspace.rightPanelWidth.v1','520');
    localStorage.setItem('nm.workspace.layoutPanelWidth.v1','460');
  });
  await boot(page);
  const initial=await page.evaluate(()=>({
    right:document.body.style.getPropertyValue('--nm-inspector-panel-width'),
    layout:document.body.style.getPropertyValue('--nm-layout-panel-width'),
    data:JSON.stringify(window.neuroMapApp.state.createSnapshot())
  }));
  expect(initial.right).toBe('520px');
  expect(initial.layout).toBe('460px');
  await page.setViewportSize({width:560,height:800});
  await expect.poll(()=>page.evaluate(()=>
    document.body.style.getPropertyValue('--nm-inspector-panel-width'))).toBe('380px');
  await expect.poll(()=>page.evaluate(()=>
    document.body.style.getPropertyValue('--nm-layout-panel-width'))).toBe('380px');
  await page.setViewportSize({width:1280,height:800});
  await expect.poll(()=>page.evaluate(()=>
    document.body.style.getPropertyValue('--nm-inspector-panel-width'))).toBe('520px');
  await expect.poll(()=>page.evaluate(()=>
    document.body.style.getPropertyValue('--nm-layout-panel-width'))).toBe('460px');
  const saved=await page.evaluate(()=>({
    right:localStorage.getItem('nm.workspace.rightPanelWidth.v1'),
    layout:localStorage.getItem('nm.workspace.layoutPanelWidth.v1'),
    data:JSON.stringify(window.neuroMapApp.state.createSnapshot())
  }));
  expect(saved.right).toBe('520');
  expect(saved.layout).toBe('460');
  expect(saved.data).toBe(initial.data);
});

test('Radar avoids a wider docked Cloud while Aspetto is already open',async({page})=>{
  await boot(page);
  await page.setViewportSize({width:1280,height:800});
  const inspector=page.locator('#inspector-sidebar');
  if(!(await inspector.isVisible()))await page.locator('#btn-toggle-inspector').click();
  await expect(inspector).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>
    parseFloat(document.body.style.getPropertyValue('--nm-workspace-radar-right'))||0
  )).toBeGreaterThan(0);
  const before=await page.evaluate(()=>({
    data:JSON.stringify(window.neuroMapApp.state.root),
    radar:parseFloat(document.body.style.getPropertyValue('--nm-workspace-radar-right'))||0
  }));
  const expected=await page.evaluate(()=>{
    document.getElementById('gl-cloud-dialog')?.remove();
    // A synthetic *docked card* avoids OAuth or network access. The real
    // workspace-chrome observers still compute the shared Radar clearance.
    const cloud=document.createElement('div');
    cloud.id='gl-cloud-dialog';
    cloud.className='gl-cloud-docked';
    cloud.style.setProperty('position','fixed','important');
    cloud.style.setProperty('inset','0','important');
    cloud.style.setProperty('width','100vw','important');
    cloud.style.setProperty('height','100vh','important');
    cloud.style.setProperty('pointer-events','none','important');
    const card=document.createElement('div');
    card.className='gl-cloud-card';
    card.style.setProperty('position','fixed','important');
    card.style.setProperty('right','72px','important');
    card.style.setProperty('top','100px','important');
    card.style.setProperty('width','520px','important');
    card.style.setProperty('height','570px','important');
    cloud.append(card);document.body.append(cloud);
    return 520+72+12;
  });
  await expect.poll(()=>page.evaluate(()=>
    parseFloat(document.body.style.getPropertyValue('--nm-workspace-radar-right'))
  )).toBeGreaterThanOrEqual(expected);
  expect(expected).toBeGreaterThan(before.radar);
  await page.evaluate(()=>document.getElementById('gl-cloud-dialog')?.remove());
  await expect.poll(()=>page.evaluate(()=>
    parseFloat(document.body.style.getPropertyValue('--nm-workspace-radar-right'))
  )).toBe(before.radar);
  expect(await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root)))
    .toBe(before.data);
});

test('Radar offset follows the painted inspector after a CSS transform',async({page})=>{
  await boot(page);
  await page.setViewportSize({width:1280,height:800});
  const inspector=page.locator('#inspector-sidebar');
  if(!(await inspector.isVisible()))await page.locator('#btn-toggle-inspector').click();
  await expect(inspector).toBeVisible();
  const evaluateClearance=()=>page.evaluate(()=>{
    const panel=document.getElementById('inspector-sidebar');
    const desired=innerWidth-panel.getBoundingClientRect().left+12;
    const actual=Number.parseFloat(document.body.style.getPropertyValue('--nm-workspace-radar-right'));
    return {desired:Math.round(desired),actual:Math.round(actual)};
  });
  await expect.poll(async()=>{const g=await evaluateClearance();return g.actual-g.desired}).toBe(0);
  const snapshot=await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root));
  await inspector.evaluate(el=>{
    el.dataset.nmTestPreviousTransform=el.style.transform;
    el.style.transform='translateX(-95px)';
  });
  // MutationObserver watches style; the Radar must move to the actual
  // painted left boundary rather than recomputing the unchanged CSS right.
  await expect.poll(async()=>{const g=await evaluateClearance();return g.actual-g.desired}).toBe(0);
  const moved=await evaluateClearance();
  await inspector.evaluate(el=>{
    el.style.transform=el.dataset.nmTestPreviousTransform||'';
    delete el.dataset.nmTestPreviousTransform;
  });
  await expect.poll(async()=>{const g=await evaluateClearance();return g.actual-g.desired}).toBe(0);
  const restored=await evaluateClearance();
  expect(moved.desired).toBeGreaterThan(restored.desired+90);
  expect(await page.evaluate(()=>JSON.stringify(window.neuroMapApp.state.root)))
    .toBe(snapshot,'visual panel motion must not edit the map or Undo state');
});
