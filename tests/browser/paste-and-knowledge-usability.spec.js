const {test,expect}=require('@playwright/test');

// UI regressions based on the Oct 24 screenshots. No GitHub Actions required:
// npx playwright test tests/browser/paste-and-knowledge-usability.spec.js
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto('http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?._nmKnowledge?.open);
});

for(const width of [320,390,700,1200]){
 test('paste actions stay inside the dialog at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:760});
  await page.evaluate(()=>document.getElementById('paste-modal').classList.remove('hidden'));
  const result=await page.locator('#paste-modal').evaluate(modal=>{
   const card=modal.querySelector('.modal-card'),parent=card.getBoundingClientRect();
   return {
    cardRight:parent.right,screenWidth:innerWidth,
    buttons:[...modal.querySelectorAll('.modal-actions button')].map(b=>{
     const rect=b.getBoundingClientRect();
     return {left:rect.left,right:rect.right,inside:rect.left>=parent.left-1&&rect.right<=parent.right+1,
       textFits:b.scrollWidth<=b.clientWidth+1};
    })
   };
  });
  expect(result.cardRight).toBeLessThanOrEqual(width+1);
  expect(result.buttons).toHaveLength(5);
  for(const button of result.buttons){
   expect(button.inside).toBe(true);
   expect(button.textFits).toBe(true);
  }
  await expect(page.locator('#paste-modal')).toHaveAttribute('aria-modal','true');
 });
}

test('Knowledge shows six illustrated tabs and useful contextual explanations',async({page})=>{
 const before=await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root));
 await page.evaluate(()=>neuroMapApp._nmKnowledge.open('outline'));
 const panel=page.locator('#nm-knowledge-panel');
 await expect(panel.locator('[role=tab]')).toHaveCount(6);
 await expect(panel.locator('.nm-kn-tabs svg')).toHaveCount(6);
 const help=panel.locator('.nm-kn-help-toggle');
 await help.click();
 await expect(help).toHaveAttribute('aria-expanded','true');
 await expect(panel.locator('.nm-kn-guide')).toBeVisible();
 await panel.locator('.nm-kn-picker>summary').click();
 await panel.getByRole('tab',{name:'Scrivi appunti',exact:true}).click();
 await expect(panel.locator('.nm-kn-intro')).toContainText('appunti');
 await expect(panel.locator('.nm-kn-guide')).toContainText('JSONL');
 expect(await page.evaluate(()=>JSON.stringify(neuroMapApp.state.root))).toBe(before);
});

test('Document finds late chapters and edits the original with undo',async({page})=>{
 await page.evaluate(()=>{
  const app=neuroMapApp;
  for(let i=0;i<128;i++)app.state.addChildNode(app.state.root.id,app.layout,'UIChapter '+i);
  app.markChanged();app._nmKnowledge.open('document');
 });
 const panel=page.locator('#nm-knowledge-panel');
 const search=panel.locator('#nm-kn-document-search');
 await expect(search).toBeVisible();
 await search.fill('UIChapter 127');
 await expect(panel.locator('.nm-kn-chapter')).toHaveCount(1);
 await panel.locator('.nm-kn-chapter').click();
 const id=await page.evaluate(()=>neuroMapApp.state.selectedNodeId);
 await panel.locator('#nm-kn-chapter-title').fill('QA capitolo modificato');
 await panel.getByRole('button',{name:'Salva capitolo'}).click();
 expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,id)).toBe('QA capitolo modificato');
 await page.evaluate(()=>neuroMapApp.undo());
 expect(await page.evaluate(id=>neuroMapApp.state.findNode(id).text,id)).toBe('UIChapter 127');
});
