const {test,expect}=require('@playwright/test');
async function openAndroid(page){
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:5173/app/index.html');
  await page.waitForFunction(()=>window.neuroMapApp && window.neuroMapApp.importHierarchyPreview);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
}
test('Android XMind side pins, visual order and 25% distribution',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await openAndroid(page);
  const result=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    const json=[{rootTopic:{title:'Root',children:{attached:[{title:'Left',side:'left'},{title:'Right',side:'right'}]}}}];
    const root=app.io.parseXMindJsonToHierarchy(JSON.stringify(json),new Map());
    app.importHierarchy(root,{newTab:true});
    const nodes=app.state.root.children;
    return {nodes:nodes.map(n=>({text:n.text,side:n.side,pin:n.sidePinned,x:app.layout.getLayout(n.id).x})),step:document.getElementById('threshold-slider').step};
  });
  expect(result.step).toBe('25');expect(result.nodes[0].side).toBe('left');expect(result.nodes[0].x).toBeLessThan(0);
  expect(result.nodes[1].side).toBe('right');expect(result.nodes[1].x).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
test('Android previews all XMind nodes and supports cancellation before replacing tabs',async({page})=>{
  await openAndroid(page);
  await page.evaluate(()=>{
    const root={text:'Large XMind',children:Array.from({length:301},(_,i)=>({text:'Node '+i,children:[],sidePinned:i%2?'left':'right'}))};
    window.beforeTabs=window.neuroMapApp.tabs.length;
    window.importPromise=window.neuroMapApp.importHierarchyPreview(root,{newTab:true});
  });
  await expect(page.locator('#nm-android-root-preview')).toBeVisible();
  await page.selectOption('#nm-android-preview-size','80');
  await expect(page.locator('.nm-android-preview-card')).toHaveCount(4);
  await page.click('[data-action="cancel"]');
  expect(await page.evaluate(async()=>({count:await window.importPromise,tabs:window.neuroMapApp.tabs.length,before:window.beforeTabs}))).toEqual(expect.objectContaining({count:0}));
  expect(await page.evaluate(()=>window.neuroMapApp.tabs.length===window.beforeTabs)).toBe(true);
  await page.evaluate(()=>{
    const root={text:'Large XMind',children:Array.from({length:301},(_,i)=>({text:'Node '+i,children:[]}))};
    window.importPromise=window.neuroMapApp.importHierarchyPreview(root,{newTab:true});
  });
  await page.selectOption('#nm-android-preview-size','125');
  await expect(page.locator('.nm-android-preview-card')).toHaveCount(3);
  await page.click('[data-action="create"]');
  expect(await page.evaluate(()=>window.importPromise)).toBe(304); // 301 topics + 3 page roots.
});
test('Android boundary labels persist in snapshots and theme survives reload',async({page})=>{
  await openAndroid(page);
  await page.evaluate(()=>{const a=window.neuroMapApp;a.importHierarchy({text:'Study',children:[{text:'Heart',children:[]}]},{newTab:true});a.selectNode(a.state.root.children[0].id);});
  await page.evaluate(()=>{const a=neuroMapApp;a.state.findNode(a.state.selectedNodeId).boundary={enabled:true,title:''};a.markChanged();document.getElementById('nm-boundary-edit').click();});await page.fill('#nm-boundary-title-input','Cardiology');await page.locator('#nm-boundary-title-input').press('Enter');
  expect(await page.evaluate(()=>{const a=window.neuroMapApp;return a.state.constructor.cloneTree(a.state.root).children[0].boundary.title;})).toBe('Cardiology');
  await page.click('#glauka-style-open');
  await page.locator('#inspector-sidebar .glauka-map-background > summary').click();await page.locator('#nm-map-background-trigger').click();
  await page.getByRole('radio',{name:'Carta',exact:true}).click();await page.reload();
  await page.waitForFunction(()=>window.neuroMapApp);
  expect(await page.evaluate(()=>document.documentElement.dataset.nmTheme)).toBe('paper');
});
test('desktop editor initializes using the same shared core',async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp && window.NeuroMapCore);
  const result=await page.evaluate(()=>{
    const a=window.neuroMapApp;
    a.importHierarchy({text:'Shared',children:[{text:'Left',sidePinned:'left',children:[]},{text:'Right',sidePinned:'right',children:[]}]},{newTab:true});
    return a.state.root.children.map(n=>n.side);
  });
  expect(result).toEqual(['left','right']);
});
test('Android touch controls follow the selected language',async({page})=>{
  await openAndroid(page);
  await page.evaluate(async ()=>{await GlaukaI18n.setLanguage('en');});
  await expect(page.locator('#nm-boundary-edit')).toHaveText('✎ Boundary title');
  await expect(page.locator('#glauka-edit')).toHaveAccessibleName('Edit');await expect(page.locator('#glauka-edit')).toBeVisible();
  await page.click('#glauka-style-open');
  await page.locator('#inspector-sidebar .glauka-map-background > summary').click();await page.locator('#nm-map-background-trigger').click();
  await expect(page.getByRole('radiogroup',{name:'Map background'})).toBeVisible();
});
test('Android JSON restore preserves the 0% distribution endpoint',async({page})=>{
  await openAndroid(page);
  const bias=await page.evaluate(async()=>{
    const file=new File([JSON.stringify({root:{text:'Zero distribution',children:[{text:'Child',children:[]}]},thresholdY:0})],'restore.json',{type:'application/json'});
    await window.neuroMapApp.importFile(file,{newTab:true});
    return window.neuroMapApp.state.thresholdY;
  });
  expect(bias).toBe(0);
});
