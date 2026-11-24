const {test,expect}=require('@playwright/test');
test.describe('desktop linked views',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1350,height:900});
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&document.getElementById('nm-view-picker')&&window.NeuroMapViewCore);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(x=>x.classList.add('hidden')));
 });
 test('organigram is a real linked view: edit once and preserve undo/redo and original node IDs',async({page})=>{
  const ids=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.children=[];app.state.root.text='Research';
   const a=app.state.addChildNode(app.state.root.id,app.layout,'Biology');
   const b=app.state.addChildNode(app.state.root.id,app.layout,'Chemistry');
   app.markChanged();app.state.undoStack=[];app.state.redoStack=[];
   window.NeuroMapLinkedViews.setMode(app,'orgchart');
   return {root:app.state.root.id,a:a.id,b:b.id};
  });
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await expect(page.locator('#nm-view-stage .nm-view-card')).toHaveCount(3);
  await expect(page.locator('#nm-view-picker')).toHaveValue('orgchart');
  const card=page.locator('.nm-view-card').filter({hasText:'Biology'});
  await card.dblclick();
  const edit=page.locator('.nm-view-edit');
  await expect(edit).toBeVisible();
  await edit.fill('Cell biology');
  await edit.press('Enter');
  await expect(page.locator('.nm-view-card').filter({hasText:'Cell biology'})).toBeVisible();
  const result=await page.evaluate(({a,b})=>{
   const app=window.neuroMapApp;
   const before={mode:app.state.root.viewMode,childIds:app.state.root.children.map(x=>x.id),text:app.state.findNode(a).text,
    projectView:app.state.createSnapshot().root.viewMode,serializedView:app.io.buildSerializedProjectPayload().root.viewMode};
   app.state.undo();app.recalculateAndRender();
   const undone=app.state.findNode(a).text;
   app.state.redo();app.recalculateAndRender();
   return {before,undone,redone:app.state.findNode(a).text,untouchedSibling:app.state.findNode(b).text};
  },ids);
  expect(result.before).toEqual({mode:'orgchart',childIds:[ids.a,ids.b],text:'Cell biology',projectView:'orgchart',serializedView:'orgchart'});
  expect(result.undone).toBe('Biology');
  expect(result.redone).toBe('Cell biology');
  expect(result.untouchedSibling).toBe('Chemistry');
 });
 test('concept tree uses the same hierarchy, supports adding children, and returns to mind map',async({page})=>{
  const original=await page.evaluate(()=>{
   const app=window.neuroMapApp;
   app.state.root.children=[];
   const a=app.state.addChildNode(app.state.root.id,app.layout,'Process');
   app.markChanged();
   window.NeuroMapLinkedViews.setMode(app,'concept-tree');
   return {root:app.state.root.id,a:a.id};
  });
  await expect(page.locator('#nm-view-overlay-picker')).toHaveValue('concept-tree');
  const node=page.locator('.nm-view-card[data-node-id="'+original.a+'"]');
  await node.locator('.nm-view-add').click();
  await expect(page.locator('#nm-view-stage .nm-view-card')).toHaveCount(3);
  const add=page.locator('.nm-view-edit');
  await expect(add).toBeVisible();
  await add.fill('New linked activity');await add.press('Enter');
  const result=await page.evaluate(({a})=>{
   const app=window.neuroMapApp;
   return {children:app.state.findNode(a).children.map(n=>n.text),links:app.state.relationships.length,
    projected:window.NeuroMapViewCore.project(app.state.root,'concept-tree').nodes.map(n=>n.id)};
  },original);
  expect(result.children).toEqual(['New linked activity']);
  expect(result.projected).toHaveLength(3);
  expect(result.links).toBe(0);
  await page.locator('#nm-view-back').click();
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
  await expect(page.locator('#nm-view-picker')).toHaveValue('mindmap');
  expect(await page.evaluate(()=>window.neuroMapApp.state.root.children[0].children[0].text)).toBe('New linked activity');
 });
 test('linked view remains attached to its tab and never overwrites the original mind-map layout',async({page})=>{
  const original=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    app.state.root.layoutMode='columns';
    const first=app.activeTabId;
    window.NeuroMapLinkedViews.setMode(app,'orgchart');
    const other=app.newState('Other map');
    const second=app.addTab(other,'Other map');
    return {first,second:second.id};
  });
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
  await expect(page.locator('#nm-view-picker')).toHaveValue('mindmap');
  await page.evaluate(id=>window.neuroMapApp.activateTab(id),original.first);
  await expect(page.locator('#nm-view-overlay')).toBeVisible();
  await expect(page.locator('#nm-view-picker')).toHaveValue('orgchart');
  const first=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    const before=app.state.root.layoutMode;
    window.NeuroMapLinkedViews.setMode(app,'mindmap');
    return {before,after:app.state.root.layoutMode,mode:app.state.root.viewMode};
  });
  expect(first).toEqual({before:'columns',after:'columns',mode:'mindmap'});
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
 });
 test('renaming a node survives switching tabs while typing',async({page})=>{
  const initial=await page.evaluate(()=>{
    const app=window.neuroMapApp;
    app.state.root.children=[];
    const n=app.state.addChildNode(app.state.root.id,app.layout,'Draft name');
    app.markChanged();window.NeuroMapLinkedViews.setMode(app,'orgchart');
    return {tab:app.activeTabId,node:n.id};
  });
  const target=page.locator('.nm-view-card[data-node-id="'+initial.node+'"]');
  await target.dblclick();
  await page.locator('.nm-view-edit').fill('Saved on first tab');
  await page.evaluate(()=>{
    const app=window.neuroMapApp;
    app.addTab(app.newState('Second tab'),'Second tab');
  });
  await expect(page.locator('#nm-view-overlay')).toBeHidden();
  const correct=await page.evaluate(({tab,node})=>{
    const app=window.neuroMapApp;
    const secondText=app.state.root.text;
    app.activateTab(tab);
    return {first:app.state.findNode(node).text,secondText,view:app.state.root.viewMode};
  },initial);
  expect(correct).toEqual({first:'Saved on first tab',secondText:'Second tab',view:'orgchart'});
 });
 test('renaming is committed before switching between different linked views',async({page})=>{
  const initial=await page.evaluate(()=>{
    const app=window.neuroMapApp;app.state.root.children=[];
    const n=app.state.addChildNode(app.state.root.id,app.layout,'Before');
    app.markChanged();window.NeuroMapLinkedViews.setMode(app,'orgchart');
    return n.id;
  });
  await page.locator('.nm-view-card[data-node-id="'+initial+'"]').dblclick();
  await page.locator('.nm-view-edit').fill('After');
  await page.locator('#nm-view-overlay-picker-trigger').click();
  await page.locator('#nm-view-overlay-picker-gallery [data-view="concept-tree"]').click();
  await expect(page.locator('#nm-view-overlay-picker')).toHaveValue('concept-tree');
  await expect(page.locator('.nm-view-card[data-node-id="'+initial+'"]')).toContainText('After');
  expect(await page.evaluate(id=>window.neuroMapApp.state.findNode(id).text,initial)).toBe('After');
 });
 test('two views have different geometry but no copies of source data',async({page})=>{
  const result=await page.evaluate(()=>{
   const app=window.neuroMapApp,root=app.state.root;
   const before=JSON.stringify(root);
   const vertical=window.NeuroMapViewCore.project(root,'orgchart');
   const horizontal=window.NeuroMapViewCore.project(root,'concept-tree');
   return {sameIds:JSON.stringify(vertical.nodes.map(n=>n.id))===JSON.stringify(horizontal.nodes.map(n=>n.id)),
    unchanged:before===JSON.stringify(root),different:vertical.mode!==horizontal.mode};
  });
  expect(result).toEqual({sameIds:true,unchanged:true,different:true});
 });
});
