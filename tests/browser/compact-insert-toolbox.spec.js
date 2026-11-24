const {test,expect}=require('@playwright/test');
const url=()=>process.env.GLAUKA_DESKTOP_TEST_URL||'http://127.0.0.1:5174/index.html';
async function boot(page,{width=360,theme='prisma',language='it'}={}){
 await page.setViewportSize({width:1100,height:900});
 await page.addInitScript(({theme,language})=>{localStorage.setItem('nm6_welcome_seen','1');localStorage.setItem('nm6_locale',language);localStorage.setItem('nm_ui_skin_v1',JSON.stringify({theme,contrast:'normal',readability:'compact'}));localStorage.setItem('nm.insert.recent.v1',JSON.stringify(['nm-insert-wordart','nm-insert-image']));},{theme,language});
 await page.goto(url());await page.waitForFunction(()=>window.neuroMapApp?.nmSettings&&window.NeuroMapCreative);
 await page.evaluate(async({width,language})=>{await window.GlaukaAppReady;await GlaukaI18n.setLanguage(language);document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));document.body.style.setProperty('--nm-insert-panel-width',width+'px');},{width,language});
 await page.addStyleTag({content:'*{transition:none!important;animation:none!important;scroll-behavior:auto!important}'});
 await open(page);
}
async function open(page){if(await page.locator('#nm-insert-panel').isHidden())await page.locator('#nm-open-insert').click();}
for(const width of [320,360,400])for(const theme of ['prisma','graphite'])for(const language of ['it','en'])test(`compact toolbox ${width} ${theme} ${language}`,async({page},info)=>{
 await boot(page,{width,theme,language});const panel=page.locator('#nm-insert-panel');
 await expect(panel.locator('.nm-insert-tool-grid>.nm-insert-tool')).toHaveCount(6);
 const geometry=await panel.evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,overflow:e.scrollWidth-e.clientWidth,buttons:[...e.querySelectorAll('.nm-insert-tool')].map(b=>({id:b.id,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,overflow:b.scrollWidth-b.clientWidth,svgs:b.querySelectorAll('svg').length,title:b.title,name:b.getAttribute('aria-label')}))}));
 expect(geometry.width).toBe(width);expect(geometry.height).toBeLessThan(600);expect(geometry.overflow).toBeLessThanOrEqual(1);
 for(const b of geometry.buttons){expect(b.overflow,b.id).toBeLessThanOrEqual(1);expect(b.height,b.id).toBeGreaterThanOrEqual(b.id==='nm-drawing-open'?36:44);expect(b.height,b.id).toBeLessThanOrEqual(56);expect(b.svgs,b.id).toBe(1);expect(b.title).toBeTruthy();expect(b.name).toBeTruthy();}
 await expect(panel.locator('.nm-insert-benefit:visible,.nm-task-command-hint:visible')).toHaveCount(0);
 const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()));
 await page.mouse.move(0,0);await panel.screenshot({path:info.outputPath('insert-'+width+'-'+theme+'-'+language+'.png')});
 await expect(panel.locator('#nm-insert-shortcuts')).toBeHidden();
 await panel.locator('#nm-shapes-picker>summary').click();await expect(panel.locator('.nm-insert-shape-tile')).toHaveCount(18);
 const header=await panel.locator('header').boundingBox();await panel.locator('.nm-panel-body').evaluate(e=>e.scrollTop=1000);expect((await panel.locator('header').boundingBox()).y).toBe(header.y);
 await panel.locator('.nm-panel-preview-toggle').click();await expect(panel.locator('.nm-panel-body')).toBeHidden();await panel.locator('.nm-panel-preview-toggle').click();
 await panel.locator('.nm-panel-header-actions button').last().click();await expect(panel).toBeHidden();await open(page);
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.createSnapshot()))).toBe(before);
 await page.evaluate(async language=>GlaukaI18n.setLanguage(language==='it'?'en':'it'),language);
 await expect(panel.locator('.nm-insert-tool-grid>button>svg')).toHaveCount(6);
});
test('all six content launchers invoke real image, library, online, WordArt, chart and formula flows',async({page})=>{
 await boot(page);
 const chooser=page.waitForEvent('filechooser');await page.locator('#nm-insert-image').click();
 await (await chooser).setFiles({name:'pixel.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64')});
 await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.images.length)).toBe(1);
 await open(page);await page.locator('#nm-insert-gallery').click();await expect(page.locator('#nm-creative-library-hub')).toBeVisible();await page.locator('#nm-creative-library-hub-close').click();
 await open(page);await page.locator('#btn-illustrate').click();await expect(page.locator('#nm54-illustration-modal')).toBeVisible();await page.locator('#nm54-close').click();
 for(const [command,input,save] of [['wordart','#nm-wordart-text','#nm-wordart-save'],['chart',null,'#nm-chart-save'],['formula','#nm-formula-source','#nm-formula-insert']]){
  await open(page);await page.locator('#nm-insert-'+command).click();
  if(input)await page.locator(input).fill(command==='formula'?'x^2':'Compact title');
  await expect(page.locator(save)).toBeEnabled();await page.locator(save).click();
 }
 expect(await page.evaluate(()=>neuroMapApp.state.images.map(i=>i.graphic?.kind||'image'))).toEqual(['image','wordart','chart','formula']);
 const saved=await page.evaluate(async()=>{const a=neuroMapApp;const payload=a.io.buildSerializedProjectPayload();const before=JSON.stringify(payload.images);const count=await a.importFiles([new File([JSON.stringify(payload)],'toolbox.gk',{type:'application/json'})],true);return{count,before,after:JSON.stringify(a.state.images)}});
 expect(saved.count).toBe(1);expect(saved.after).toBe(saved.before);
});
test('shape palette keeps all clicks and real drag/drop with Undo/Redo',async({page})=>{
 await boot(page);await page.locator('#nm-shapes-picker>summary').click();
 const ids=await page.locator('#nm-insert-shapes .nm-insert-shape-tile').evaluateAll(es=>es.map(e=>e.id));
 for(const id of ids){await open(page);await page.locator('#'+id).click();}
 expect(await page.evaluate(()=>neuroMapApp.state.images.length)).toBe(18);
 await page.evaluate(()=>{neuroMapApp.state.undo();neuroMapApp.recalculateAndRender()});expect(await page.evaluate(()=>neuroMapApp.state.images.length)).toBe(17);
 await page.evaluate(()=>{neuroMapApp.state.redo();neuroMapApp.recalculateAndRender()});expect(await page.evaluate(()=>neuroMapApp.state.images.length)).toBe(18);
 await open(page);
 await page.locator('#nm-insert-shape-rect').dragTo(page.locator('#mindmap-canvas'),{targetPosition:{x:200,y:250}});
 await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.images.length)).toBe(19);
});
test('all six drawing tools and settings keep existing active state and drawing callbacks',async({page})=>{
 await boot(page);
 await open(page);
 await expect(page.locator('#nm-insert-create .nm-insert-drawing > #nm-drawing-open')).toBeVisible();
 await expect(page.locator('#nm-insert-panel #nm-insert-ink-tools,#nm-insert-panel #nm-ink-style')).toHaveCount(0);
 const tools=['select','pen','pencil','lasso','eraser','highlight'];
 await page.locator('#nm-drawing-open').click();
 await expect(page.locator('#nm-drawing-toolbar')).toBeVisible();
 expect(await page.locator('#nm-drawing-toolbar .nm-drawing-tools > button').evaluateAll(nodes=>nodes.map(node=>node.id))).toEqual([...tools.map(id=>'nm-draw-'+id),'nm-draw-text','glauka-shapes-trigger']);
 await expect(page.locator('#nm-draw-lasso ellipse')).toHaveCount(1);
 for(const tool of tools){
  await page.locator('#nm-draw-'+tool).click();
  await expect(page.locator('#nm-drawing-toolbar')).toBeVisible();expect(await page.evaluate(()=>neuroMapApp._nmDraw.tool)).toBe(tool);
  await expect(page.locator('#nm-draw-'+tool)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#nm-text-tool-'+tool)).toHaveAttribute('aria-pressed','true');
 }
 await page.locator('#nm-draw-pen').click();await expect(page.locator('#nm-text-tool-pen')).toHaveAttribute('aria-pressed','true');
 await page.mouse.move(180,240);await page.mouse.down();await page.mouse.move(210,260,{steps:5});await page.mouse.move(240,240,{steps:5});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>neuroMapApp.state.images.length)).toBe(1);
 await page.evaluate(()=>NeuroMapCreativeModules.drawing.stopDrawing(neuroMapApp));await expect(page.locator('#nm-insert-ink-tools [aria-pressed=true]')).toHaveCount(0);
 await open(page);await page.locator('#nm-drawing-open').click();await expect(page.locator('#nm-drawing-toolbar')).toBeVisible();
});
test('recent metadata remains stored without restoring the removed duplicate toolbar',async({page})=>{
 await boot(page);await expect(page.locator('#nm-insert-shortcuts')).toBeHidden();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('nm.insert.recent.v1')))).toContain('nm-insert-wordart');
 await page.locator('#nm-insert-wordart').focus();await page.keyboard.press('Enter');await expect(page.locator('#nm-wordart-dialog')).toBeVisible();
});

for(const width of [320,400])test('shape library keeps Word-like compact icon tiles at '+width+'px',async({page})=>{
 await boot(page,{width,theme:'graphite',language:'it'});
 const panel=page.locator('#nm-insert-panel');
 await panel.locator('#nm-shapes-picker > summary').click();
 const tiles=panel.locator('#nm-insert-shapes .nm-insert-shape-tile');
 await expect(tiles).toHaveCount(18);
 const geometry=await panel.evaluate(el=>{
  const tiles=[...el.querySelectorAll('#nm-insert-shapes .nm-insert-shape-tile')];
  const shapes=el.querySelector('#nm-insert-shapes');
  return {
   panelOverflow:el.scrollWidth-el.clientWidth,
   shapeOverflow:shapes.scrollWidth-shapes.clientWidth,
   tiles:tiles.map(tile=>({
    width:tile.getBoundingClientRect().width,
    height:tile.getBoundingClientRect().height,
    hasName:!!tile.getAttribute('aria-label'),
    previewHeight:tile.querySelector('.nm-insert-shape-preview')?.getBoundingClientRect().height||0,
    icon:tile.querySelector('svg')!==null
   }))
  };
 });
 expect(geometry.panelOverflow).toBeLessThanOrEqual(1);
 expect(geometry.shapeOverflow).toBeLessThanOrEqual(1);
 for(const tile of geometry.tiles){
  expect(tile.width).toBeGreaterThanOrEqual(40);
  expect(tile.height).toBeGreaterThanOrEqual(50);
  expect(tile.height).toBeLessThanOrEqual(72);
  expect(tile.previewHeight).toBeLessThanOrEqual(26);
  expect(tile.icon).toBe(true);
  expect(tile.hasName).toBe(true);
 }
});
