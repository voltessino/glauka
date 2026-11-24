const {test,expect}=require('@playwright/test');
test.describe('desktop immersive navigation for large mind maps',()=>{
  test.beforeEach(async({page})=>{
    await page.setViewportSize({width:1440,height:900});
    await page.goto('http://127.0.0.1:5174/index.html');
    await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapNavigation&&
      document.getElementById('nm616-navigation')&&document.getElementById('nm616-minimap-shell'));
    await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
    await page.locator('#nm614-open-navigation').click();
  });
  async function sample(page){
    return page.evaluate(()=>{
      const app=window.neuroMapApp;app.state.root.children=[];app.state.root.text='Epithelia';
      const a=app.state.addChildNode(app.state.root.id,app.layout,'Simple epithelia');
      const b=app.state.addChildNode(app.state.root.id,app.layout,'Stratified epithelia');
      const detail=app.state.addChildNode(a.id,app.layout,'Endothelium');
      app.markChanged();app.state.undoStack=[];app.state.redoStack=[];
      app.renderer.camera.zoom=.35;app.updateStatus();app.requestRender();
      return {a:a.id,b:b.id,detail:detail.id,root:app.state.root.id};
    });
  }
  test('navigation has no unsolicited branches and isolates the selected branch reversibly',async({page})=>{
    const ids=await sample(page);
    await expect(page.locator('#nm616-navigation')).toBeVisible();
    await expect(page.locator('#nm616-nav-branches button')).toHaveCount(0);
    await page.evaluate(id=>neuroMapApp.selectNode(id),ids.a);
    const before=await page.evaluate(()=>({
      camera:{...window.neuroMapApp.renderer.camera},
      data:JSON.stringify(window.neuroMapApp.state.root),
      history:window.neuroMapApp.state.undoStack.length
    }));
    await page.locator('#nm616-nav-focus').click();
    await expect(page.locator('#nm616-nav-focus')).toHaveAttribute('aria-pressed','true');
    const focus=await page.evaluate(({a,b})=>{
      const app=window.neuroMapApp;
      return {selected:app.state.selectedNodeId,showA:app.renderer.visualFocusIds.has(a),
        showB:app.renderer.visualFocusIds.has(b)};
    },ids);
    expect(focus).toEqual({selected:ids.a,showA:true,showB:false});
    await page.locator('#nm616-nav-restore').click();
    const after=await page.evaluate(()=>({
      data:JSON.stringify(window.neuroMapApp.state.root),
      history:window.neuroMapApp.state.undoStack.length,
      focus:window.neuroMapApp.renderer.visualFocusIds,
      camera:{...window.neuroMapApp.renderer.camera}
    }));
    expect(after.data).toBe(before.data);
    expect(after.history).toBe(before.history);
    expect(after.focus).toBeNull();
    expect(after.camera).toEqual(before.camera);
  });
  test('mini-map pointer and keyboard navigation do not alter map or Undo',async({page})=>{
    await sample(page);
    const before=await page.evaluate(()=>({
      data:JSON.stringify(window.neuroMapApp.state.root),
      history:window.neuroMapApp.state.undoStack.length,
      camera:{...window.neuroMapApp.renderer.camera}
    }));
    await expect(page.locator('#nm616-minimap-shell')).toBeVisible();
    const map=page.locator('#nm616-map');
    const box=await map.boundingBox();
    await page.mouse.click(box.x+box.width*.73,box.y+box.height*.45);
    const pointerX=await page.evaluate(()=>neuroMapApp.renderer.camera.x);
    await map.focus();await page.keyboard.press('ArrowLeft');
    const after=await page.evaluate(()=>({
      data:JSON.stringify(window.neuroMapApp.state.root),
      history:window.neuroMapApp.state.undoStack.length,
      camera:{...window.neuroMapApp.renderer.camera}
    }));
    expect(after.data).toBe(before.data);
    expect(after.history).toBe(before.history);
    expect(after.camera.x).toBeCloseTo(pointerX+70);
  });
  test('all details remain visible without a redundant display-options panel',async({page})=>{
    const ids=await sample(page);
    await expect(page.locator('#nm616-nav-options')).toBeHidden();
    expect(await page.evaluate(()=>window.neuroMapApp.renderer.semanticZoomEnabled)).toBe(false);
    expect(await page.evaluate(id=>!!window.neuroMapApp.state.findNode(id),ids.detail)).toBe(true);
  });
  test('Focus closes on Escape and switches safely between tabs',async({page})=>{
    const ids=await sample(page);
    await page.evaluate(id=>window.NeuroMapNavigation.enterFocus(window.neuroMapApp,id),ids.a);
    await expect(page.locator('#nm616-nav-focus')).toHaveAttribute('aria-pressed','true');
    await page.locator('#nm616-nav-restore').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#nm614-navigation-flyout')).toBeHidden();
    expect(await page.evaluate(()=>window.neuroMapApp.renderer.visualFocusIds!==null)).toBe(true);
    await page.keyboard.press('Escape');
    await page.locator('#nm614-open-navigation').click();
    await expect(page.locator('#nm616-nav-focus')).toHaveAttribute('aria-pressed','false');
    await page.evaluate(id=>{
      const app=window.neuroMapApp;
      window.NeuroMapNavigation.enterFocus(app,id);
      const other=app.newState('Other');const tab=app.addTab(other,'Other');
      app.activateTab(tab.id);
    },ids.b);
    const focused=await page.evaluate(()=>window.neuroMapApp.renderer.visualFocusIds);
    expect(focused).toBeNull();
  });
});
