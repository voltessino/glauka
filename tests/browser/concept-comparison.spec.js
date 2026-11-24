const {test,expect}=require('@playwright/test');
test.describe('desktop concept comparison for study',()=>{
  test.beforeEach(async({page})=>{
    await page.setViewportSize({width:1480,height:900});
    await page.goto('http://127.0.0.1:5174/index.html');
    await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapComparison&&
      document.getElementById('nm616-compare-open'));
    await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden')));
  });
  async function setup(page){
    return page.evaluate(()=>{
      const app=window.neuroMapApp;
      app.state.root.children=[];app.state.relationships=[];
      const left=app.state.addChildNode(app.state.root.id,app.layout,'Continuous');
      const right=app.state.addChildNode(app.state.root.id,app.layout,'Fenestrated');
      app.state.addChildNode(left.id,app.layout,'Basal lamina');
      app.state.addChildNode(right.id,app.layout,'Basal lamina');
      app.state.addChildNode(left.id,app.layout,'Endothelium');
      app.state.addChildNode(right.id,app.layout,'Fenestrations');
      app.markChanged();
      app.state.selectedNodeIds=[left.id,right.id];app.state.selectedNodeId=right.id;
      app.state.undoStack=[];app.state.redoStack=[];app.updateStatus();app.requestRender();
      return {left:left.id,right:right.id};
    });
  }
  test('comparison displays two independent columns with truthful identical terms',async({page})=>{
    await setup(page);
    const before=await page.evaluate(()=>({
      root:JSON.stringify(window.neuroMapApp.state.root),
      history:window.neuroMapApp.state.undoStack.length
    }));
    await page.locator('#btn-menu-tools').click();
    await page.locator('#nm-tools-study > summary').click();
    await page.locator('#nm616-compare-open').click();
    await expect(page.locator('#nm616-compare')).toBeVisible();
    await expect(page.locator('#nm616-compare-left h3')).toHaveText('Continuous');
    await expect(page.locator('#nm616-compare-right h3')).toHaveText('Fenestrated');
    await expect(page.locator('#nm616-compare-common-count')).toContainText('1');
    await expect(page.locator('#nm616-compare-left [data-shared=true]')).toHaveCount(1);
    await page.locator('#nm616-compare-swap').click();
    await expect(page.locator('#nm616-compare-left h3')).toHaveText('Fenestrated');
    await page.locator('#nm616-compare-close').click();
    await expect(page.locator('#nm616-compare')).toBeHidden();
    const after=await page.evaluate(()=>({
      root:JSON.stringify(window.neuroMapApp.state.root),
      history:window.neuroMapApp.state.undoStack.length
    }));
    expect(after).toEqual(before);
  });
  test('clicking a compared topic navigates to exactly that original node',async({page})=>{
    await setup(page);
    await page.locator('#btn-menu-tools').click();
    await page.locator('#nm-tools-study > summary').click();
    await page.locator('#nm616-compare-open').click();
    await page.locator('#nm616-compare-left .nm616-compare-item').filter({hasText:'Endothelium'}).click();
    await expect(page.locator('#nm616-compare')).toBeHidden();
    const result=await page.evaluate(()=>{
      const app=window.neuroMapApp;
      return {selected:app.state.findNode(app.state.selectedNodeId).text,
        children:app.state.root.children.length,undo:app.state.undoStack.length};
    });
    expect(result).toEqual({selected:'Endothelium',children:2,undo:0});
  });
  test('comparison uses DOM text, never evaluates user-provided HTML',async({page})=>{
    await setup(page);
    await page.evaluate(()=>{
      const app=window.neuroMapApp;
      app.state.root.children[0].children[0].text='<img src=x onerror=alert(1)>';
      app.recalculateAndRender();
    });
    await page.locator('#btn-menu-tools').click();
    await page.locator('#nm-tools-study > summary').click();
    await page.locator('#nm616-compare-open').click();
    await expect(page.locator('#nm616-compare-left .nm616-compare-item').first()).toContainText('<img src=x onerror=alert(1)>');
    await expect(page.locator('#nm616-compare-left .nm616-compare-item img')).toHaveCount(0);
  });
});
