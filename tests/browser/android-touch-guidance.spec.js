'use strict';
const {test,expect}=require('@playwright/test');
const {chooseTool}=require('./android-tools-helper');
const locales=['it','en','de','es','fr','pt','ar','zh-CN'];
test.use({hasTouch:true});
async function boot(page,code='it',width=360){
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto('http://127.0.0.1:5173/app/index.html');
 await page.waitForFunction(()=>window.neuroMapApp&&window.GlaukaTouchGuidance&&document.documentElement.hasAttribute('data-glauka-ready'));
 await page.evaluate(async code=>{await GlaukaAppReady;document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));await GlaukaI18n.setLanguage(code);neuroMapApp.importHierarchy({text:'Touch map',children:[{text:'First',children:[]},{text:'Second',children:[]}]},{newTab:true});neuroMapApp.selectNode(neuroMapApp.state.root.children[0].id);},code);
}
async function visibleInstructions(page){
 const bad=await page.evaluate(()=>{
  const bad=[],skip='script,style,svg,input,textarea,select,[contenteditable],[data-glauka-user-content],[data-glauka-physical-keyboard],.nm75-preview,.nm-kn-authored,code,pre';
  const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],.hidden');
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(w.nextNode()){const n=w.currentNode,e=n.parentElement;if(e&&!e.closest(skip)&&visible(e)&&GlaukaTouchGuidance.desktopPattern.test(n.nodeValue))bad.push(n.nodeValue.trim());}
  for(const e of document.querySelectorAll('[title],[aria-label],[placeholder]'))if(visible(e)&&!e.closest(skip))for(const a of ['title','aria-label','placeholder']){const t=e.getAttribute(a)||'';if(GlaukaTouchGuidance.desktopPattern.test(t))bad.push(a+': '+t);}
  return [...new Set(bad)];
 });
 expect(bad).toEqual([]);
}
async function command(page,query){
 await page.locator('#glauka-options-open').tap();
 const label=await page.evaluate(()=>GlaukaI18n.pair('Tutti i comandi','All commands'));
 await page.getByRole('button',{name:label,exact:true}).tap();
 await page.locator('#nm-android-command-query').fill(query);
}
for(const code of locales)for(const width of [320,360,768])test(`Android touch guidance ${code} ${width}px: style, commands and search`,async({page})=>{
 await boot(page,code,width);
 await visibleInstructions(page);
 await page.locator('#glauka-style-open').tap();
 await expect(page.locator('#inspector-sidebar')).toBeVisible();
 await visibleInstructions(page);
 const box=await page.locator('#inspector-sidebar').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
 await page.locator('#glauka-style-scrim').tap({position:{x:3,y:3}});
 await command(page,'shortcuts');
 await expect(page.locator('.nm-android-command-item')).toHaveCount(0);
 await expect(page.locator('#shortcuts-panel')).toBeHidden();
 await page.locator('#nm-android-command-query').fill('select all');
 await expect(page.locator('.nm-android-command-item')).toHaveCount(1);
 await visibleInstructions(page);
 await page.locator('.nm-android-command-item').tap();
 expect(await page.evaluate(()=>neuroMapApp.state.selectedNodeIds.slice().sort())).toEqual(await page.evaluate(()=>neuroMapApp.state.root.children.map(n=>n.id).sort()));
 await command(page,'search maps');await page.locator('.nm-android-command-item').tap();
 await expect(page.locator('#spotlight-count')).toHaveText(await page.evaluate(()=>GlaukaTouchGuidance.text('search')));
 await visibleInstructions(page);
 await page.locator('#find-query').fill('First');
 await expect(page.locator('#spotlight-count')).toHaveText(await page.evaluate(()=>GlaukaI18n.translate('1 risultati · 1 schede')));
 await page.evaluate(()=>GlaukaI18n.setLanguage('it'));
 await expect(page.locator('#spotlight-count')).toHaveText('1 risultati · 1 schede');
 await page.evaluate(code=>GlaukaI18n.setLanguage(code),code);
 await expect(page.locator('#spotlight-count')).toHaveText(await page.evaluate(()=>GlaukaI18n.translate('1 risultati · 1 schede')));
});
for(const code of locales)test(`Android ${code}: wiki and properties use actual touch Undo`,async({page})=>{
 test.setTimeout(60000);await boot(page,code);
 await page.locator('#nm74-launch').tap();
 await chooseTool(page,'.nm74-tab[data-section="wiki"]');
 await page.locator('.nm75-panel textarea').fill('Author text: Ctrl+Z / Shift+Clic');
 const save=await page.evaluate(()=>GlaukaI18n.pair('Salva nota · Undo','Save note · Undo'));
 await page.getByRole('button',{name:save,exact:true}).tap();
 await expect(page.locator('.nm75-status')).toHaveText(await page.evaluate(()=>GlaukaTouchGuidance.message('noteSaved')));
 await visibleInstructions(page);
 expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).notes)).toBe('Author text: Ctrl+Z / Shift+Clic');
 await page.locator('.nm74-close').tap();await page.locator('#glauka-undo').tap();
 expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).notes||'')).toBe('');
 await page.locator('#nm74-launch').tap();await chooseTool(page,'.nm74-tab[data-section="database"]');
 await expect(page.locator('.nm76-panel > p.nm76-muted').first()).toHaveText(await page.evaluate(()=>GlaukaTouchGuidance.message('props')));
 await page.locator('.nm76-panel input').first().fill('TouchTag');
 const props=await page.evaluate(()=>GlaukaI18n.pair('Salva proprietà','Save properties'));
 await page.getByRole('button',{name:props,exact:true}).tap();await visibleInstructions(page);
 expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).knowledge.tags)).toContain('TouchTag');
 await page.locator('.nm74-close').tap();await page.locator('#glauka-undo').tap();
 expect(await page.evaluate(()=>neuroMapApp.state.findNode(neuroMapApp.state.selectedNodeId).knowledge?.tags||[])).toEqual([]);
});
test('Android physical keyboard handlers and authored content remain intact',async({page})=>{
 await boot(page);
 await page.evaluate(()=>{neuroMapApp.state.root.text='Ctrl+Z / Shift+Clic';neuroMapApp.markChanged();});
 await page.locator('#mindmap-canvas').tap({position:{x:10,y:300}});
 await page.keyboard.press('Control+a');
 expect(await page.evaluate(()=>neuroMapApp.state.selectedNodeIds.length)).toBe(2);
 await page.evaluate(async()=>{await GlaukaI18n.setLanguage('fr');GlaukaTouchGuidance.apply();});
 expect(await page.evaluate(()=>neuroMapApp.state.root.text)).toBe('Ctrl+Z / Shift+Clic');
});
test('desktop keeps its keyboard help and does not load Android presentation overrides',async({page})=>{
 await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp);
 expect(await page.evaluate(()=>typeof window.GlaukaTouchGuidance)).toBe('undefined');
 expect(await page.locator('#shortcuts-panel').textContent()).toContain('Ctrl');
});

for(const code of locales)test(`Android ${code}: drawing instructions point to the existing finish button`,async({page})=>{
 await boot(page,code);
 await page.locator('#glauka-add-open').tap();
 const label=await page.evaluate(()=>GlaukaI18n.pair('Disegna a mano libera','Draw freehand'));
 await page.getByRole('button',{name:label,exact:true}).tap();
 await expect(page.locator('[data-glauka-touch-key="drawing"]')).toHaveText(await page.evaluate(()=>GlaukaTouchGuidance.text('drawing')));
 await visibleInstructions(page);
 await page.locator('#nm-draw-done').tap();
 await expect(page.locator('#nm-draw-done')).toBeHidden();
});
test('Android relationship touch delete and header Undo preserve the relationship',async({page})=>{
 await boot(page);
 const point=await page.evaluate(()=>{
  const a=neuroMapApp,c=a.state.root.children;
  a.state.addRelationship(c[0].id,c[1].id,'Touch relation');a.markChanged();
  const curve=a.renderer.computeRelationshipCurve(a.layout.getLayout(c[0].id),a.layout.getLayout(c[1].id));
  return a.renderer.worldToScreen(curve.labelX,curve.labelY);
 });
 await page.touchscreen.tap(point.x,point.y);
 await page.locator('#glauka-style-open').tap();
 await expect(page.locator('#v5-relation-panel')).toBeVisible();
 await visibleInstructions(page);await page.locator('#v5-rel-delete').tap();
 expect(await page.evaluate(()=>neuroMapApp.state.relationships.length)).toBe(0);
 await page.locator('#glauka-style-scrim').tap({position:{x:3,y:3}});
 await page.locator('#glauka-undo').tap();
 expect(await page.evaluate(()=>neuroMapApp.state.relationships.map(r=>r.label))).toEqual(['Touch relation']);
});
