const {test,expect}=require('@playwright/test');
const common=[['menu-threshold-slider','distribution'],['threshold-slider','distribution'],
  ['inspector-fontsize-slider','fontSize'],['nm54-wrap-slider','labelWrapChars'],
  ['nm54-map-wrap-slider','defaultLabelWrapChars'],['v5-font-scale','typographyScale'],
  ['nm63-stroke-range','strokeScale'],['img-width-slider','imageWidth'],['nm-distribution-height','continuationHeight'],
  ['nm68-branch-gap','branchGapX'],['nm67-compact-slider','compactness']];
const desktopOnly=[['nm68-text-indent','labelIndent']];
async function open(page,target){
  await page.addInitScript(()=>{if(!localStorage.getItem('nm6_locale'))localStorage.setItem('nm6_locale','it');});
  await page.setViewportSize(target==='android'?{width:390,height:844}:{width:1280,height:900});
  await page.goto(target==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>window.neuroMapApp&&window.nm6ApplyLanguage);
  if(target==='desktop')await page.locator('#nm-caption-font-size').waitFor({state:'attached'});
  await page.evaluate(()=>{
    document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));
    const a=window.neuroMapApp;
    a.importHierarchy({text:'Salva',notes:'Modifica File: user content',children:[{text:'Annulla',notes:'Keep my Italian notes',children:[]},{text:'Second',children:[]}]},{newTab:true});
    a.selectNode(a.state.root.children[0].id);
    window.qaControlNode=a.state.selectedNodeId;
    window.qaReadControl=(field)=>{
      if(field==='continuationHeight')return a.state.root.layoutDistribution?.height;
      if(field==='distribution')return a.state.balanceBias??a.state.thresholdY;
      if(field==='imageWidth')return a.state.images[0].width;
      if(['fontSize','labelWrapChars','labelIndent'].includes(field))return a.state.findNode(window.qaControlNode)[field];
      return a.state[field];
    };
  });
}

async function chooseLanguage(page,target,code){
 if(target==='android'){await page.locator('#nm74-launch').click();await page.locator('#glauka-android-language').selectOption(code);await expect(page.locator('html')).toHaveAttribute('lang',code);await page.locator('#nm74-overlay .nm74-close').click();}
 else {await page.locator('#gl-settings-quick').click();await page.locator('#gl-settings-language').selectOption(code);await expect(page.locator('html')).toHaveAttribute('lang',code);await page.locator('#gl-settings-close').click();}
}

for(const target of ['desktop','android'])test.describe(`${target} controls and language`,()=>{
  const controls=target==='desktop'?[...common,...desktopOnly]:common;
  test.beforeEach(async({page})=>open(page,target));

  test('range inventory includes editor, motion and workspace controls',async({page})=>{
    const ids=await page.locator('input[type=range]').evaluateAll(es=>es.map(e=>e.id).sort());
    const supplemental=['nm-motion-duration','nm-pattern-intensity','nm-workspace-width',...(target==='desktop'?['nm-caption-font-size']:[])];
    expect(ids).toEqual([...controls.map(([id])=>id),...supplemental].sort());
  });

  for(const [id,field] of controls)test(`${id} applies minimum, middle, maximum and supports Undo/Redo`,async({page})=>{
    const result=await page.evaluate(({id,field})=>{
      const a=window.neuroMapApp,el=document.getElementById(id);
      if(field==='distribution')document.querySelector('#nm-layout-modes [data-mode=clockwise]').click();
      if(field==='continuationHeight'){a.state.root.layoutDistribution={enabled:true,height:1000};a.recalculateAndRender();}
      if(field==='imageWidth'){
        a.state.images=[{id:'qa-width',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=',width:135,height:100,mode:'free',worldPos:{x:0,y:0},aspectLocked:true}];
        a.selectImage('qa-width');
      }
      const structure=()=>JSON.stringify(a.state.getAllNodes().map(n=>({id:n.id,parent:n.parentId,text:n.text,notes:n.notes,children:n.children.map(c=>c.id)})));
      const before=structure(),min=Number(el.min),max=Number(el.max),step=Number(el.step)||1;
      const values=[min,min+Math.floor((max-min)/step/2)*step,max];
      const observed=[];
      for(const value of values){
        el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
        el.value=String(value);const expected=Number(el.value)/(field==='typographyScale'?100:1);
        el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
        observed.push({expected,actual:window.qaReadControl(field)});
      }
      a.undo();const undone=window.qaReadControl(field);a.redo();const redone=window.qaReadControl(field);
      return {observed,undone,redone,unchanged:before===structure()};
    },{id,field});
    for(const value of result.observed)expect(value.actual).toBeCloseTo(value.expected,5);
    expect(result.undone).toBeCloseTo(result.observed[1].expected,5);
    expect(result.redone).toBeCloseTo(result.observed[2].expected,5);
    expect(result.unchanged).toBe(true);
    const nodeId=await page.evaluate(()=>{window.neuroMapApp.persistWorkspace();return window.qaControlNode;});
    await page.reload();await page.waitForFunction(()=>window.neuroMapApp?.state?.root);
    const restored=await page.evaluate(({field,nodeId})=>{
      const s=window.neuroMapApp.state;
      if(field==='continuationHeight')return s.root.layoutDistribution?.height;
      if(field==='distribution')return s.balanceBias??s.thresholdY;
      if(field==='imageWidth')return s.images[0].width;
      if(['fontSize','labelWrapChars','labelIndent'].includes(field))return s.findNode(nodeId)[field];
      return s[field];
    },{field,nodeId});
    expect(restored).toBeCloseTo(result.observed[2].expected,5);
  });

  test('keyboard edits stay inside the focused font control without navigating the map',async({page})=>{
    await page.locator(target==='android'?'#glauka-style-open':'#btn-toggle-inspector').click();
    await page.locator('#inspector-sidebar details').evaluateAll(es=>es.forEach(e=>e.open=true));
    const field=page.locator('#glauka-font-size');
    await field.fill('18');await field.press('Tab');await field.focus();await field.press('ArrowUp');await field.press('Tab');
    expect(await page.evaluate(()=>window.qaReadControl('fontSize'))).toBe(18.5);
    expect(await page.evaluate(()=>window.neuroMapApp.state.selectedNodeId)).toBe(await page.evaluate(()=>window.qaControlNode));
    for(const value of ['9','48']){await field.fill(value);await field.press('Tab');expect(await page.evaluate(()=>window.qaReadControl('fontSize'))).toBe(Number(value));}

  });

  test('English covers slider names, tooltips, dialogs and a textarea placeholder',async({page})=>{
    await chooseLanguage(page,target,'en');
    const modifier=await page.evaluate(()=>navigator.platform.includes('Mac')?'⌘':'Ctrl');
    const expected={
      '#nm54-wrap-slider':['aria-label','Maximum characters per line for selected nodes'],
      '#nm54-map-wrap-slider':['aria-label','Default characters per line for the map'],
      '#img-width-slider':['aria-label','Image width'],
      '#inspector-fontsize-slider':['aria-label','Selected node font size'],
      '#v5-font-scale':['aria-label','Map text scale'],
      '#threshold-slider':['aria-label','Branch distribution'],
      '#menu-threshold-slider':['aria-label','Branch distribution'],
      '#nm63-stroke-range':['title','Branch thickness from 50% to 300%'],
      '#quick-paste':['title',target==='android'?'Paste':`Paste (${modifier}+V)`],
      '#find-query':['aria-label','Find nodes'],
      '#paste-modal-textarea':['placeholder','# Central map\n- Main branch 1\n  - Sub-branch 1.1\n  - Sub-branch 1.2\n- Main branch 2']
    };
    if(target==='desktop'){
      expected['#nm68-text-indent']=['aria-label','Indent after the first line'];
      expected['#nm67-compact-slider']=['aria-label','Vertical branch spacing'];
      expected['#nm68-branch-gap']=['title','Horizontal distance between a node and its children'];
      expected['#nm611-autosave-title']=['text','⏱️ Automatic saving'];
      expected['#nm611-audit-title']=['text','✨ AI map review'];
    }else{
      expected['#nm6-plan-title']=['text','Glauka · License'];
      expected['#nm6-license-input']=['placeholder','GLK1.…'];
    }
    const actual=await page.evaluate(selectors=>Object.fromEntries(Object.entries(selectors).map(([selector,[attr]])=>{
      const el=document.querySelector(selector);return [selector,attr==='text'?el.textContent:el.getAttribute(attr)];
    })),expected);
    expect(actual).toEqual(Object.fromEntries(Object.entries(expected).map(([selector,[,value]])=>[selector,value])));
    await expect(page.locator('#menu-undo > span').first()).toHaveText('Undo');
    await expect(page.locator('#btn-cancel-paste')).toHaveText('Cancel');
  });

  test('language round trips persist and never translate map text, notes or edit values',async({page})=>{
    const before=await page.evaluate(()=>{
      const a=window.neuroMapApp;a.state.isDirty=false;a.persistWorkspace();
      document.getElementById('paste-modal-textarea').value='Salva Annulla: my pasted text';
      document.getElementById('ai-explain-text').textContent='Salva';
      return {root:JSON.stringify(a.state.constructor.cloneTree(a.state.root)),undo:a.state.undoStack.length};
    });
    await chooseLanguage(page,target,'en');await expect(page.locator('html')).toHaveAttribute('lang','en');
    await expect(page.locator('#paste-modal-textarea')).toHaveValue('Salva Annulla: my pasted text');
    await expect(page.locator('#ai-explain-text')).toHaveText('Salva');
    await page.reload();await page.waitForFunction(()=>window.neuroMapApp&&window.nm6ApplyLanguage);
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
    await chooseLanguage(page,target,'it');await expect(page.locator('html')).toHaveAttribute('lang','it');
    expect(await page.evaluate(()=>{const a=window.neuroMapApp;return JSON.stringify(a.state.constructor.cloneTree(a.state.root));})).toBe(before.root);
    expect(await page.locator('#find-query').getAttribute('aria-label')).toBe('Cerca nodi');
    await expect(page.locator('#menu-undo > span').first()).toHaveText('Annulla');
    expect(await page.evaluate(()=>window.neuroMapApp.state.isDirty)).toBe(false);
  });

  test('already-open dynamic dialog follows English to Italian and can be cancelled safely',async({page})=>{
    await chooseLanguage(page,target,'en');
    if(target==='android'){
      const before=await page.evaluate(()=>{const a=window.neuroMapApp;window.qaPreview=a.importHierarchyPreview({text:'User title',children:[{text:'My node',children:[]}]},{newTab:true});return a.tabs.length;});
      await expect(page.locator('#nm-android-preview-title')).toHaveText('Import preview · User title');
      await page.evaluate(()=>{return GlaukaI18n.setLanguage('it');});
      await expect(page.locator('#nm-android-preview-title')).toHaveText('Anteprima importazione · User title');
      await expect(page.locator('#nm-android-preview-size option').first()).toHaveText('80 nodi');
      await page.locator('#nm-android-root-preview [data-action=cancel]').click();
      expect(await page.evaluate(async()=>{await window.qaPreview;return window.neuroMapApp.tabs.length;})).toBe(before);
    }else{
      await page.evaluate(()=>window.neuroMapApp.nm611OpenAutosave());
      await expect(page.locator('#nm611-autosave-title')).toHaveText('⏱️ Automatic saving');
      await page.evaluate(()=>{return GlaukaI18n.setLanguage('it');});
      await expect(page.locator('#nm611-autosave-title')).toHaveText('⏱️ Salvataggio automatico');
      await page.locator('#nm611-autosave-close').click();
    }
  });

  test('oversized browser autosave keeps the last valid backup and warns without clearing dirty state',async({page})=>{
    const result=await page.evaluate(()=>{
      const a=window.neuroMapApp;a.persistWorkspace();
      const key='neuromap.workspace.v2',before=localStorage.getItem(key);
      a.state.root.text='Unsaved large map';a.state.isDirty=true;
      a.state.images=[{id:'large',mode:'free',src:'data:image/png;base64,'+'A'.repeat(2700000),width:100,height:100}];
      a.persistWorkspace();
      return {kept:localStorage.getItem(key)===before,dirty:a.state.isDirty,warning:document.getElementById('toast-text').textContent};
    });
    expect(result.kept).toBe(true);expect(result.dirty).toBe(true);expect(result.warning).toMatch(/esporta/i);
  });

  test('browser quota error keeps the previous autosave and gives visible feedback',async({page})=>{
    const result=await page.evaluate(()=>{
      const a=window.neuroMapApp;a.persistWorkspace();const key='neuromap.workspace.v2',before=localStorage.getItem(key);
      a.state.root.text='Unsaved after quota error';a.state.isDirty=true;
      document.getElementById('toast-text').textContent='';
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Simulated quota error','QuotaExceededError');return original.call(this,k,v);};
      try{a.persistWorkspace();}finally{Storage.prototype.setItem=original;}
      return {kept:localStorage.getItem(key)===before,dirty:a.state.isDirty,warning:document.getElementById('toast-text').textContent};
    });
    expect(result.kept).toBe(true);expect(result.dirty).toBe(true);expect(result.warning).toMatch(/esporta/i);
  });
});
