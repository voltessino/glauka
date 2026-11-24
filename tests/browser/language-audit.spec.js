const {test,expect}=require('@playwright/test');
const fixture=require('./fixtures/ui-language.json');
const exclusions='[data-glauka-user-content],script,style,textarea,code,pre,.tab-item,.tabs-list,.ctx-header-node,#status-selected-node,.nm6-skiptranslate,.v4-explain-text,#nm67-notes-preview,.flash-heading,.spotlight-main,.spotlight-path,.spotlight-tab,.nm-android-preview-card strong';
for(const target of ['desktop','android'])test.describe(`${target} complete mounted UI language inventory`,()=>{
  test.beforeEach(async({page})=>{
    await page.setViewportSize({width:1280,height:900});
    await page.goto(target==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
    await page.waitForFunction(()=>window.neuroMapApp&&window.nm6ApplyLanguage);
    await page.evaluate(()=>window.GlaukaAppReady);
    await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
  });
  test('every mounted label and attribute matches the reviewed IT/EN inventory, including hidden panels',async({page})=>{
    const result=await page.evaluate(async exclusions=>{
      const canonical=s=>s.replace(/⌘\+/g,'Ctrl+').replace(/[ \t]+/g,' ').trim();
      const change=async code=>{await GlaukaI18n.setLanguage(code);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));};
      await new Promise(resolve=>{const start=performance.now();const tick=()=>{const state=document.getElementById('nm-save-status')?.dataset.recovery;if(state==='ready'||state==='error'||performance.now()-start>2500)resolve();else requestAnimationFrame(tick);};tick();});
      await change('it');
      // Track the owning element, not a body-wide child index shifted by SVGs.
      const textNodes=element=>[...element.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE);
      const identify=element=>{const button=element.parentElement;if(element.matches('span')&&button?.matches('button[id]')&&button.querySelectorAll(':scope > span').length===1)return {element,controlId:button.id};return {element};};
      const read=entry=>{const element=entry.element.isConnected?entry.element:entry.controlId?document.getElementById(entry.controlId)?.querySelector(':scope > span'):null;if(!element)return null;return entry.kind==='text'?textNodes(element)[entry.textIndex]?.nodeValue?.trim():element.getAttribute(entry.kind);};
      const entries=[],walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      while(walk.nextNode()){const node=walk.currentNode,it=node.nodeValue.trim();if(it&&/[a-zA-ZÀ-ÿ]{2}/.test(it)&&!node.parentElement.closest(exclusions))entries.push({...identify(node.parentElement),textIndex:textNodes(node.parentElement).indexOf(node),it,kind:'text'});}
      for(const node of document.querySelectorAll('[title],[placeholder],[aria-label]'))if(!node.closest(exclusions.replace('textarea,','')))for(const kind of ['title','placeholder','aria-label']){const it=node.getAttribute(kind);if(it&&/[a-zA-ZÀ-ÿ]{2}/.test(it))entries.push({element:node,it,kind});}
      await change('en');
      const pairs=entries.map(entry=>[canonical(entry.it),canonical(read(entry)||'MISSING')]);
      await change('it');
      const changedBack=entries.filter(entry=>canonical(entry.it)!==canonical(read(entry)||'')).map(entry=>({it:entry.it,actual:read(entry)}));
      return {pairs,changedBack};
    },exclusions);
    const normalize=s=>s.replace(/⌘\+/g,'Ctrl+').replace(/[ \t]+/g,' ').trim();
    const expected=Object.fromEntries(Object.entries(fixture[target]).map(([it,en])=>[normalize(it),Array.isArray(en)?en.map(normalize):normalize(en)]));
    const missing=result.pairs.filter(([it])=>!Object.hasOwn(expected,it));
    expect(missing,'New UI phrases must be reviewed and added to the inventory').toEqual([]);
    const wrong=result.pairs.filter(([it,en])=>Object.hasOwn(expected,it)&&!(Array.isArray(expected[it])?expected[it]:[expected[it]]).includes(en));
    expect(wrong).toEqual([]);expect(result.changedBack).toEqual([]);
    expect(result.pairs.length).toBeGreaterThan(target==='desktop'?650:430);
  });
  if(target==='desktop')test('Mac Command shortcut descriptions translate Enter and keep the platform modifier',async({page})=>{
    await page.addInitScript(()=>Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'}));
    await page.reload();await page.waitForFunction(()=>window.neuroMapApp&&window.nm6ApplyLanguage);
    await page.evaluate(async ()=>{await GlaukaI18n.setLanguage('en');});
    await expect(page.locator('#spotlight-count')).toHaveText('⌘+F / ⌘+K · ↑↓ · Enter · Esc');
    await page.evaluate(async ()=>{await GlaukaI18n.setLanguage('it');});
    await expect(page.locator('#spotlight-count')).toHaveText('⌘+F / ⌘+K · ↑↓ · Invio · Esc');
  });
  test('search results retain user text even when it matches a UI label',async({page})=>{
    await page.evaluate(async ()=>{const a=window.neuroMapApp;a.importHierarchy({text:'Salva',children:[{text:'Annulla',children:[]}]},{newTab:true});a.openFind();document.getElementById('find-query').value='Salva';a.updateFindResults();await GlaukaI18n.setLanguage('en');});
    await expect(page.locator('.spotlight-main')).toHaveText('Salva');
    await expect(page.locator('.spotlight-tab')).toHaveText('Salva');
    await expect(page.locator('#spotlight-count')).toContainText('results');
  });
  test('dynamic success and failure messages translate while filenames remain untouched',async({page})=>{
    await page.evaluate(async ()=>{await GlaukaI18n.setLanguage('en');window.neuroMapApp.showToast('Salvato su disco: Salva.neuromap','AZIONE');});
    await expect(page.locator('#toast-text')).toHaveText('Saved to disk: Salva.neuromap');
    await page.evaluate(()=>window.neuroMapApp.showToast('Esportato elenco indentato Markdown (.md)','EXPORT MD'));
    await expect(page.locator('#toast-text')).toHaveText('Indented Markdown outline exported (.md)');
    await page.evaluate(()=>window.neuroMapApp.showToast('Autosalvataggio su disco non riuscito: esporta un backup JSON','ATTENZIONE'));
    await expect(page.locator('#toast-text')).toHaveText('Disk autosave failed: export a JSON backup');
  });
  if(target==='android')test('import preview keeps user titles and follows the selected language',async({page})=>{
    await page.evaluate(async ()=>{const a=window.neuroMapApp;window.qaPreview=a.importHierarchyPreview({text:'Salva',children:[{text:'Annulla',children:[]}]},{newTab:true});await GlaukaI18n.setLanguage('en');});
    await expect(page.locator('.nm-android-preview-card strong')).toHaveText('1. Salva');
    await page.locator('#nm-android-root-preview [data-action=cancel]').click();await page.evaluate(()=>window.qaPreview);
  });
});
