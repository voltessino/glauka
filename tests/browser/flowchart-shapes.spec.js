'use strict';
const {test,expect}=require('@playwright/test');
// Run locally, not in GitHub Actions:
// npx playwright test tests/browser/flowchart-shapes.spec.js --workers=1
// Tests real Glauka desktop renderer; this file does not contain screenshot mocks.
test.describe('Flowchart: real roles, typed ports, SVG geometry and Undo',()=>{
 test.beforeEach(async({page})=>{
  await page.setViewportSize({width:1480,height:960});
  await page.goto((process.env.GLAUKA_DESKTOP_TEST_URL || 'http://127.0.0.1:5174/index.html'));
  await page.waitForFunction(()=>window.neuroMapApp&&window.NeuroMapLinkedViews&&window.NeuroMapFlowCore);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(el=>el.classList.add('hidden')));
 });
 async function seed(page,cycle=false){
  return page.evaluate(cycle=>{
   const app=window.neuroMapApp,state=app.state;
   state.root.children=[];
   state.relationships=[];
   const entry=state.addChildNode(state.root.id,app.layout,'Avvio procedura');
   const decision=state.addChildNode(state.root.id,app.layout,'Risultato valido?');
   const yes=state.addChildNode(state.root.id,app.layout,'Conferma');
   const no=state.addChildNode(state.root.id,app.layout,'Revisione');
   // Reversed sibling order cannot make No precede Yes in the rendered flow.
   state.addFlowTransition(entry.id,decision.id,'sequence');
   state.addFlowTransition(decision.id,no.id,'no');
   state.addFlowTransition(decision.id,yes.id,'yes');
   if(cycle)state.addFlowTransition(no.id,decision.id,'sequence');
   app.markChanged();
   window.NeuroMapLinkedViews.setMode(app,'flowchart');
   return {entry:entry.id,decision:decision.id,yes:yes.id,no:no.id};
  },cycle);
 }
 test('topology-only start/end capsules and Yes above No with distinct decision outlets',async({page})=>{
  const ids=await seed(page);
  const stage=page.locator('#nm-view-stage');
  const start=stage.locator('.nm-view-card[data-node-id="'+ids.entry+'"]');
  const decision=stage.locator('.nm-view-card[data-node-id="'+ids.decision+'"]');
  const yes=stage.locator('.nm-view-card[data-node-id="'+ids.yes+'"]');
  const no=stage.locator('.nm-view-card[data-node-id="'+ids.no+'"]');
  await expect(start).toHaveClass(/is-flow-terminal/);
  await expect(start.locator('.nm-flow-role-label')).toHaveText('Inizio');
  await expect(decision).toHaveClass(/is-decision/);
  await expect(yes).toHaveClass(/is-flow-terminal/);
  await expect(no).toHaveClass(/is-flow-terminal/);
  const yesBox=await yes.boundingBox(),noBox=await no.boundingBox();
  expect(yesBox.y).toBeLessThan(noBox.y);
  const pathInfo=await page.evaluate(ids=>{
   const app=window.neuroMapApp,lib=window.NeuroMapFlowCore;
   const graph=lib.project(app.state.root,app.state.relationships);
   const by=id=>graph.nodes.find(n=>n.id===id);
   return {yes:lib.ports(by(ids.decision),by(ids.yes),'yes'),
     no:lib.ports(by(ids.decision),by(ids.no),'no'),
     edges:graph.edges.length,roles:graph.nodes.map(n=>[n.id,n.shape])};
  },ids);
  expect(pathInfo.yes.sy).toBeLessThan(pathInfo.no.sy);
  expect(pathInfo.edges).toBe(3);
  await expect(page.locator('#nm-view-lines path[marker-end="url(#nm-flow-process-yes)"]')).toHaveCount(1);
  await expect(page.locator('#nm-view-lines path[marker-end="url(#nm-flow-process-no)"]')).toHaveCount(1);
 });
 test('explicit shape change survives project serialization and one Undo/Redo step',async({page})=>{
  const ids=await seed(page);
  const picker=page.locator('#nm-flow-from'),shape=page.locator('#nm-flow-shape');
  await picker.selectOption(ids.entry);
  await expect(shape).toHaveValue('auto');
  const previous=await page.evaluate(()=>window.neuroMapApp.state.undoStack.length);
  await shape.selectOption('process');
  await expect(page.locator('.nm-view-card[data-node-id="'+ids.entry+'"]')).not.toHaveClass(/is-flow-terminal/);
  const serialized=await page.evaluate(id=>{
   const app=window.neuroMapApp,payload=app.io.buildSerializedProjectPayload();
   return {flowShape:payload.root.children.find(n=>n.id===id).flowShape,
     undo:app.state.undoStack.length,relationships:payload.relationships?.length};
  },ids.entry);
  expect(serialized.flowShape).toBe('process');
  expect(serialized.undo).toBe(previous+1);
  expect(serialized.relationships).toBe(3);
  await page.evaluate(()=>{const app=window.neuroMapApp;app.state.undo();app.recalculateAndRender()});
  await expect(page.locator('.nm-view-card[data-node-id="'+ids.entry+'"]')).toHaveClass(/is-flow-terminal/);
  await page.evaluate(()=>{const app=window.neuroMapApp;app.state.redo();app.recalculateAndRender()});
  await expect(page.locator('.nm-view-card[data-node-id="'+ids.entry+'"]')).not.toHaveClass(/is-flow-terminal/);
 });
 test('explicit Input/Output stay consistent in live, split, and serialized output',async({page})=>{
  const ids=await seed(page);
  const from=page.locator('#nm-flow-from'),shape=page.locator('#nm-flow-shape');
  await from.selectOption(ids.entry);
  await shape.selectOption('input');
  await from.selectOption(ids.yes);
  await shape.selectOption('output');
  const stage=page.locator('#nm-view-stage');
  const input=stage.locator('.nm-view-card[data-node-id="'+ids.entry+'"]');
  const output=stage.locator('.nm-view-card[data-node-id="'+ids.yes+'"]');
  await expect(input).toHaveClass(/is-flow-io/);
  await expect(output).toHaveClass(/is-flow-io/);
  await expect(input.locator('.nm-flow-role-label')).toHaveText('Ingresso');
  await expect(output.locator('.nm-flow-role-label')).toHaveText('Uscita');
  await expect(input).toHaveAttribute('aria-label',/Ingresso · Avvio procedura/);
  const read=await page.evaluate(ids=>{
   const app=window.neuroMapApp,flow=window.NeuroMapFlowCore;
   const graph=flow.project(app.state.root,app.state.relationships);
   const one=graph.nodes.find(node=>node.id===ids.entry);
   const last=graph.nodes.find(node=>node.id===ids.yes);
   const payload=app.io.buildSerializedProjectPayload();
   const source=payload.root.children.find(node=>node.id===ids.entry);
   const target=payload.root.children.find(node=>node.id===ids.yes);
   const css=getComputedStyle(document.querySelector('.nm-view-card[data-node-id="'+ids.entry+'"]'),'::before').clipPath;
   return {roles:[source.flowShape,target.flowShape],edges:graph.edges.length,
    inputPoints:flow.ioPoints(one),outputPoints:flow.ioPoints(last),css};
  },ids);
  expect(read.roles).toEqual(['input','output']);
  expect(read.edges).toBe(3);
  expect(read.inputPoints).toHaveLength(4);
  expect(read.outputPoints).toHaveLength(4);
  expect(read.css).toContain('polygon(');
  // The other view consumes the exact same shape metadata.
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'orgchart'));
  await page.locator('#nm-view-split').click();
  await page.locator('#nm-dual-picker').selectOption('flowchart');
  await expect(page.locator('#nm-dual-stage .nm-view-card[data-node-id="'+ids.yes+'"]')).toHaveClass(/is-flow-io/);
  await expect(page.locator('#nm-dual-stage .nm-view-card[data-node-id="'+ids.yes+'"] .nm-flow-role-label')).toHaveText('Uscita');
 });
 test('cyclic return remains explicit and editable from linked split view',async({page})=>{
  const ids=await seed(page,true);
  const cycle=await page.evaluate(ids=>{
   const app=window.neuroMapApp,flow=window.NeuroMapFlowCore;
   const graph=flow.project(app.state.root,app.state.relationships);
   const by=id=>graph.nodes.find(n=>n.id===id);
   return {hasCycles:graph.hasCycles,path:flow.path(by(ids.no),by(ids.decision),'sequence'),
     edges:graph.edges.length};
  },ids);
  expect(cycle.hasCycles).toBe(true);
  expect(cycle.edges).toBe(4);
  expect((cycle.path.match(/ H/g)||[]).length).toBeGreaterThanOrEqual(3);
  await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,'orgchart'));
  await page.locator('#nm-view-split').click();
  await page.locator('#nm-dual-picker').selectOption('flowchart');
  const source=page.locator('#nm-dual-flow-from'),shape=page.locator('#nm-dual-flow-shape');
  await source.selectOption(ids.no);
  await shape.selectOption('end');
  const end=page.locator('#nm-dual-stage .nm-view-card[data-node-id="'+ids.no+'"]');
  await expect(end).toHaveClass(/is-flow-terminal/);
  await expect(end).toHaveClass(/is-flow-role-conflict/);
  await expect(end.locator('.nm-flow-role-warning')).toHaveAttribute('title',/collegamenti in uscita/);
  expect(await page.evaluate(()=>window.neuroMapApp.state.relationships.length)).toBe(4);
 });

 test('adaptive 100-task stage renders multiple bounded columns with real SVG arrows',async({page})=>{
  await page.evaluate(()=>{
   const app=window.neuroMapApp,state=app.state;
   state.root.children=[{id:'large-flow-start',text:'Start',flowShape:'start',children:[]}];
   state.relationships=[];
   for(let i=0;i<100;i++){
    const id='large-flow-'+i;
    state.root.children.push({id,text:'Task '+i,children:[]});
    state.relationships.push({id:'large-link-'+i,fromId:'large-flow-start',toId:id,kind:'sequence'});
   }
   app.markChanged();
   window.NeuroMapLinkedViews.setMode(app,'flowchart');
  });
  const cards=page.locator('#nm-view-stage .nm-view-card');
  await expect(cards).toHaveCount(101);
  const checks=await page.evaluate(()=>{
   const state=window.neuroMapApp.state,flow=window.NeuroMapFlowCore;
   const graph=flow.project(state.root,state.relationships,{maxCandidates:1200});
   const by=new Map(graph.nodes.map(n=>[n.id,n]));
   const raw=JSON.stringify(state.root.children);
   return {height:graph.height,width:graph.width,
    nodes:graph.nodes.length,edges:graph.edges.length,
    columns:new Set(graph.nodes.filter(n=>n.depth===1).map(n=>n.x)).size,
    path:flow.path(by.get('large-flow-start'),by.get('large-flow-99'),'sequence'),
    originalCount:state.root.children.length,unchanged:JSON.stringify(state.root.children)===raw};
  });
  expect(checks.height).toBeLessThan(2500);
  expect(checks.columns).toBeGreaterThan(1);
  expect(checks.edges).toBe(100);
  expect(checks.originalCount).toBe(101);
  expect(checks.path).toContain(' H');
  await expect(page.locator('#nm-view-lines > path[marker-end="url(#nm-flow-process-sequence)"]')).toHaveCount(100);
 });

 test('five hundred manually marked steps render without invented transitions or micro-cards',async({page})=>{
  await page.evaluate(()=>{
   const app=window.neuroMapApp,state=app.state;
   state.root.children=Array.from({length:500},(_,i)=>({
    id:'manual-step-'+i,text:'Explicit process step '+i,flowShape:'process',children:[]
   }));
   state.relationships=[];
   app.markChanged();
   window.NeuroMapLinkedViews.setMode(app,'flowchart');
  });
  const cards=page.locator('#nm-view-stage .nm-view-card');
  await expect(cards).toHaveCount(500);
  const read=await page.evaluate(()=>{
   const app=window.neuroMapApp,g=window.NeuroMapFlowCore.project(
     app.state.root,app.state.relationships,{maxCandidates:1200});
   return {nodes:g.nodes.length,height:g.height,width:g.width,edges:g.edges.length,
    minWidth:Math.min(...g.nodes.map(n=>n.w)),
    minHeight:Math.min(...g.nodes.map(n=>n.h)),
    canonicalCount:app.state.root.children.length};
  });
  expect(read.nodes).toBe(500);
  expect(read.height).toBeLessThan(2600);
  expect(read.width).toBeLessThanOrEqual(8192);
  expect(read.edges).toBe(0);
  expect(read.minWidth).toBeGreaterThanOrEqual(190);
  expect(read.minHeight).toBeGreaterThanOrEqual(76);
  expect(read.canonicalCount).toBe(500);
 });

});
