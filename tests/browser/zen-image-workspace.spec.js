const {test,expect}=require('@playwright/test');
test.describe('desktop Zen, contextual actions and image preview',()=>{
  test.beforeEach(async({page})=>{
    await page.setViewportSize({width:1440,height:900});
    await page.goto('http://127.0.0.1:5174/index.html');
    await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapPresentation&&
      document.getElementById('nm616-zen-switch')&&document.getElementById('nm616-context'));
    await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden')));
  });
  test('Zen hides heavy interface but preserves active map, camera and Undo',async({page})=>{
    const original=await page.evaluate(()=>{
      const app=window.neuroMapApp;
      return {root:JSON.stringify(app.state.root),camera:{...app.renderer.camera},undo:app.state.undoStack.length};
    });
    await page.locator('#btn-menu-view').click();await page.locator('#nm616-zen-switch').click();
    await expect(page.locator('body')).toHaveClass(/nm616-zen/);
    await expect(page.locator('.top-chrome')).toBeHidden();
    await expect(page.locator('#nm616-zen-exit')).toBeVisible();
    await page.locator('#nm616-zen-exit').click();
    await expect(page.locator('body')).not.toHaveClass(/nm616-zen/);
    await expect(page.locator('.top-chrome')).toBeVisible();
    const after=await page.evaluate(()=>{
      const app=window.neuroMapApp;
      return {root:JSON.stringify(app.state.root),camera:{...app.renderer.camera},undo:app.state.undoStack.length};
    });
    expect(after).toEqual(original);
  });
  test('selected concept displays breadcrumbs, actions and parent navigation',async({page})=>{
    const ids=await page.evaluate(()=>{
      const app=window.neuroMapApp;app.state.root.children=[];
      const parent=app.state.addChildNode(app.state.root.id,app.layout,'Cardiovascular system');
      const child=app.state.addChildNode(parent.id,app.layout,'Arteries');
      app.markChanged();app.state.undoStack=[];
      app.selectNode(child.id);return {parent:parent.id,child:child.id};
    });
    await page.locator('#nm614-open-navigation').click();
    await expect(page.locator('#nm616-context')).toBeVisible();
    await expect(page.locator('#nm616-context-path')).toContainText('Cardiovascular system');
    await expect(page.locator('#nm616-context-path')).toContainText('Arteries');
    await expect(page.locator('#nm616-context-actions')).toBeHidden();
    await page.locator('#nm616-context-path .nm616-crumb').filter({hasText:'Cardiovascular system'}).click();
    expect(await page.evaluate(()=>window.neuroMapApp.state.selectedNodeId)).toBe(ids.parent);
    expect(await page.evaluate(()=>window.neuroMapApp.state.undoStack.length)).toBe(0);
  });
  test('images open in large overlay, zoom and close without resizing map assets',async({page})=>{
    const imageId=await page.evaluate(()=>{
      const app=window.neuroMapApp;
      const item={id:'test-image-zoom',src:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
        mode:'free',worldPos:{x:240,y:180},width:180,height:125,caption:'Histology example'};
      app.state.images.push(item);app.recalculateAndRender();
      app.selectImage(item.id);
      return item.id;
    });
    await expect(page.locator('#nm616-image-preview')).toBeVisible();await page.waitForFunction(id=>window.neuroMapApp.state.findImage(id)?.naturalWidth===1,imageId);
    const original=await page.evaluate(id=>{
      const app=window.neuroMapApp,image=app.state.findImage(id);
      return {width:image.width,height:image.height,source:image.src,undo:app.state.undoStack.length};
    },imageId);
    await page.locator('#nm616-image-preview').click();
    await expect(page.locator('#nm616-lightbox')).toBeVisible();
    await expect(page.locator('#nm616-image-caption')).toHaveText('Histology example');
    const plus=page.getByRole('button',{name:'Ingrandisci anteprima',exact:true});
    await plus.click();
    await expect(page.locator('#nm616-image-zoom-percent')).not.toHaveText('100%');
    await page.locator('#nm616-image-close').click();
    await expect(page.locator('#nm616-lightbox')).toBeHidden();
    const after=await page.evaluate(id=>{
      const app=window.neuroMapApp,image=app.state.findImage(id);
      return {width:image.width,height:image.height,source:image.src,undo:app.state.undoStack.length};
    },imageId);
    expect(after).toEqual(original);
  });
  test('malformed image URLs are rejected without showing an overlay',async({page})=>{
    const result=await page.evaluate(()=>{
      const api=window.NeuroMapPresentation;
      return {bad:api.safeImageSource('javascript:alert(1)'),html:api.safeImageSource('data:text/html,bad')};
    });
    expect(result).toEqual({bad:null,html:null});
  });
});
