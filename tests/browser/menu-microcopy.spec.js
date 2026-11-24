const {test,expect}=require('@playwright/test');

test('desktop four menus: compact labels, real statuses and separate workspace exports',async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>!!window.NeuroMapMenuUX && !!window.neuroMapApp);
  const menus=await page.evaluate(()=>{
    const result={};
    for(const key of ['file','edit','insert','view']){
      const el=document.getElementById('dropdown-'+key);
      result[key]={
        labels:[...el.querySelectorAll('.dropdown-item')].map(b=>(b.querySelector('span')?.textContent || b.textContent).trim()),
        badges:[...el.querySelectorAll('.counter-pill')].map(s=>s.textContent.trim()),
        sections:[...el.querySelectorAll('.dropdown-section-title')].map(s=>s.textContent.trim()),
        exportTab:[...el.querySelectorAll('.export-subgrid [data-export]')].map(b=>b.dataset.export),
        exportWorkspace:[...el.querySelectorAll('.nm-ux-workspace-grid [data-export]')].map(b=>b.dataset.export)
      };
    }
    return result;
  });
  expect(menus.file.labels.slice(0,8)).toEqual([
    'Nuova scheda','Duplica scheda','Apri file...','Apri file recenti','Salva','Salva con nome...','Salva tutto il workspace','Salvataggio automatico...'
  ]);
  expect(menus.file.sections).toEqual(['Progetto','Importa','Esporta scheda','Esporta workspace (tutte le schede)','Scheda attiva']);
  expect(menus.file.exportTab).toEqual(['png','svg','pdf','md','opml','json']);
  expect(menus.file.exportWorkspace).toEqual(['batch-workspace-json','batch-md']);
  expect(menus.file.badges).toEqual(['Disattivato']);
  for(const [name,menu]of Object.entries(menus)){
    expect(menu.labels.every(label=>label && !/[\r\n]/.test(label))).toBeTruthy();
    if(name!=='file')expect(menu.badges).toEqual([]);
  }
  await expect(page.locator('#menu-new-map')).toHaveClass(/nm-ux-warning/);
  await expect(page.locator('#menu-close-tab')).toHaveClass(/nm-ux-danger/);
  await expect(page.locator('#menu-invert-branch kbd')).toHaveCount(0);
  await page.evaluate(()=>document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden')));
  await page.locator('#btn-menu-file').click();
  await expect(page.locator('#dropdown-file .export-subgrid')).toBeHidden();
  await expect(page.locator('#dropdown-file .nm-ux-workspace-grid')).toBeHidden();
  await page.locator('#nm-export-launch').click();
  const hub=page.locator('.nm-export-dialog');
  await expect(hub).toBeVisible();
  for(const name of ['Questa','Selezionate','Tutte'])await expect(hub.getByRole('button',{name,exact:true})).toBeVisible();
  await expect(hub.locator('#nm-export-format option')).toHaveText(['Markdown · .md','Testo · .txt','OPML · .opml','FreeMind / Freeplane · .mm','HTML · .html','Word · .docx','PDF documento · .pdf','PDF grafico · mappa mentale','JSON · .json','Glauka · .neuromap','SVG · .svg','PNG · mappa mentale']);
  await hub.getByRole('button',{name:'Chiudi',exact:true}).click();
  await page.evaluate(()=>{localStorage.setItem(NM611.optionsKey,JSON.stringify({minutes:5}));NeuroMapMenuUX.refresh()});
  await expect(page.locator('#nm-ux-autosave-state')).toHaveText('5 min');
});

test('desktop menu language and width: English, no two-line items',async({page})=>{
  await page.goto('http://127.0.0.1:5174/index.html');
  await page.waitForFunction(()=>!!window.NeuroMapMenuUX && !!window.neuroMapApp);
  await page.evaluate(async ()=>{document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));await GlaukaI18n.setLanguage('en');});
  await expect(page.locator('#menu-new-tab span')).toHaveText('New tab');
  await expect(page.locator('#menu-save-all-tabs span')).toHaveText('Save entire workspace');
  await expect(page.locator('#menu-close-tab span')).toHaveText('Close tab');
  await page.setViewportSize({width:1024,height:768});
  await page.locator('#btn-menu-file').click();
  const sizes=await page.locator('#dropdown-file').evaluate(panel=>({
    scrollWidth:panel.scrollWidth,clientWidth:panel.clientWidth,
    itemHeights:[...panel.querySelectorAll('.dropdown-item')].map(el=>el.getBoundingClientRect().height)
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth+1);
  expect(sizes.itemHeights.every(x=>x<42)).toBeTruthy();

  // Verify "Open recent files" submenu shows at most 10 files sorted descending by updatedAt
  await page.evaluate(()=>{
    window.neuroMapApp._nmAtlasArchive=Array.from({length:12},(_,i)=>({
      key:'file:/maps/project-'+i+'.gk',
      filePath:'C:\\Maps\\project-'+i+'.gk',
      originSheetIndex:0,
      title:'Project '+i,
      updatedAt:1700000000000+(i*60000)
    }));
  });
  await page.locator('#menu-open-recent').hover();
  const submenu=page.locator('#nm-recent-submenu');
  await expect(submenu).toBeVisible();
  await expect(submenu.locator('.nm-recent-item')).toHaveCount(10);
  const titles=await submenu.locator('.nm-recent-title').allTextContents();
  expect(titles[0]).toBe('Project 11');
  expect(titles[9]).toBe('Project 2');
});
