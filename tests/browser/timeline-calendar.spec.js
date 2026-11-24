'use strict';
const {test,expect}=require('@playwright/test');
// Browser-only gate. No HTML mocks; do not treat test presence as a passed test.
// Local: npx playwright test tests/browser/timeline-calendar.spec.js --workers=1
test.describe('Timeline: real calendar scales and dated dependencies',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1420,height:960});
  await page.goto((process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html'));
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapLinkedViews&&
    window.NeuroMapViewAppearance&&window.NeuroMapWorkCore);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden')));
 });
 async function seed(page){
  return page.evaluate(()=>{
   const app=window.neuroMapApp,state=app.state;
   state.root.children=[];
   const start=state.addChildNode(state.root.id,app.layout,'Preparazione');
   const same=state.addChildNode(state.root.id,app.layout,'Studio pilota');
   const later=state.addChildNode(state.root.id,app.layout,'Pubblicazione');
   state.setNodeWorkMetadata(start.id,{startDate:'2026-11-03',dueDate:'2026-11-06'});
   state.setNodeWorkMetadata(same.id,{startDate:'2026-11-03'});
   state.setNodeWorkMetadata(later.id,{dueDate:'2026-12-29'});
   state.setNodeTaskDependencies(start.id,[later.id]); // deliberate backward temporal dependency
   window.NeuroMapLinkedViews.setMode(app,'timeline');
   app.markChanged();
   return {start:start.id,same:same.id,later:later.id};
  });
 }
 test('Day/week/month picker changes dated geometry, persists and supports Undo',async({page})=>{
  const ids=await seed(page);
  const scale=page.locator('#nm-work-time-scale');
  await expect(scale).toHaveValue('auto');
  const original=await page.locator('#nm-view-stage').evaluate(el=>el.offsetWidth);
  await scale.selectOption('days');
  await expect(scale).toHaveValue('days');
  await expect.poll(()=>page.evaluate(()=>window.neuroMapApp.state.root.viewAppearance.modes.timeline.timeScale)).toBe('days');
  const dayWidth=await page.locator('#nm-view-stage').evaluate(el=>el.offsetWidth);
  expect(dayWidth).toBeGreaterThan(original);
  const saved=await page.evaluate(()=>window.neuroMapApp.io.buildSerializedProjectPayload());
  expect(saved.root.viewAppearance.modes.timeline.timeScale).toBe('days');
  expect(saved.root.children.find(n=>n.id===ids.start).startDate).toBe('2026-11-03');
  await scale.selectOption('months');
  const monthWidth=await page.locator('#nm-view-stage').evaluate(el=>el.offsetWidth);
  expect(monthWidth).toBeLessThan(dayWidth);
  await page.evaluate(()=>{const app=window.neuroMapApp;app.state.undo();app.recalculateAndRender()});
  await expect(scale).toHaveValue('days');
  await page.evaluate(()=>{const app=window.neuroMapApp;app.state.redo();app.recalculateAndRender()});
  await expect(scale).toHaveValue('months');
 });
 test('Same-day event grouping and backward dependency warning render in actual SVG',async({page})=>{
  await seed(page);
  const groups=page.locator('#nm-view-stage .nm-timeline-concurrent');
  await expect(groups).toHaveCount(2);
  expect(await groups.allTextContents()).toEqual(['1/2','2/2']);
  const dependency=page.locator('#nm-view-lines path[aria-label*="Possibile conflitto"]');
  await expect(dependency).toHaveCount(1);
  await expect(dependency).toHaveAttribute('stroke-dasharray','6 4');
  await expect(dependency.locator('title')).toContainText('Possibile conflitto');
  const routing=await dependency.getAttribute('d');
  expect((routing.match(/ H/g)||[]).length).toBeGreaterThanOrEqual(3);
 });
 test('Split Timeline shares calendar setting but preserves independent pane zoom',async({page})=>{
  await seed(page);
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'kanban'));
  await page.locator('#nm-view-split').click();
  await page.locator('#nm-dual-picker').selectOption('timeline');
  const zoom=page.locator('#nm-dual-zoom-status');
  const zoomBefore=await zoom.textContent();
  const scale=page.locator('#nm-dual-time-scale');
  await expect(scale).toHaveValue('auto');
  await scale.selectOption('weeks');
  await expect(scale).toHaveValue('weeks');
  await expect.poll(()=>page.evaluate(()=>window.neuroMapApp.state.root.viewAppearance.modes.timeline.timeScale)).toBe('weeks');
  expect(await zoom.textContent()).toBe(zoomBefore);
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'timeline'));
  await expect(page.locator('#nm-work-time-scale')).toHaveValue('weeks');
 });
});
