/* Unretouched English anatomy capture. Run serve.py macos --port 5174 first. */
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const { chromium } = require('@playwright/test');
(async () => {
  const source = 'docs/examples/website/anatomia-en.glauka.json';
  const destination = 'apps/website/home-review/assets/examples/anatomia-mappa-en.png';
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:2000,height:1250},deviceScaleFactor:2});
    await page.addInitScript(() => { localStorage.setItem('nm6_welcome_seen','1'); localStorage.setItem('nm6_locale','en'); });
    await page.goto('http://127.0.0.1:5174/index.html');
    await page.waitForFunction(() => window.neuroMapApp?.renderer && window.NM615);
    await page.evaluate(async json => {
      const app = neuroMapApp;
      await app.importFile(new File([json], 'anatomia-en.glauka.json'), {newTab:true});
      NM615.setTheme('white'); NeuroMapUISkin.set({theme:'minimal'});
      document.querySelectorAll('.nm6-shade').forEach(e => e.classList.add('hidden'));
      app.state.selectedImageId=null;
      app.recalculateAndRender(); app.fitToScreen(); app.requestRender();
      await document.fonts.ready;
    }, fs.readFileSync(source,'utf8'));
    const close=page.locator('#nm616-map-close'); if(await close.isVisible()) await close.click();
    await page.waitForTimeout(2200);
    const geometry = await page.evaluate(() => {
      const app=neuroMapApp, rect=app.renderer.canvas.getBoundingClientRect();
      return {camera:app.renderer.camera,rect:{x:rect.x,y:rect.y},nodes:app.state.getAllNodesIncludingCollapsed().map(n => ({id:n.id,text:n.text,box:(({x,y,width,height})=>({x,y,width,height}))(app.layout.nodeLayoutMap.get(n.id))}))};
    });
    await page.screenshot({path:destination});
    const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    fs.writeFileSync('apps/website/home-review/assets/examples/anatomia-en-provenance.json',JSON.stringify({source,sourceSha256:sha(source),image:destination,width:4000,height:2500,sha256:sha(destination),editorSourceRevision:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),capture:'Actual Glauka editor, original document translated; no image editing or text overlays.',geometry},null,2)+'\n');
    const original = JSON.parse(fs.readFileSync('docs/examples/website/anatomia.glauka.json'));
    const translated = JSON.parse(fs.readFileSync(source));
    const labels = new Map();
    function pair(a,b) { labels.set(a.text,b.text); (a.children||[]).forEach((c,i)=>pair(c,b.children[i])); }
    pair(original.root,translated.root);
    const aiFile='apps/website/home-review/ai-map.js';
    let ai=fs.readFileSync(aiFile,'utf8');
    const englishNodes={};
    for (const [,id,text] of ai.matchAll(/n\("([^"]+)", "([^"]+)"/g)) {
      const name=labels.get(text), node=geometry.nodes.find(n=>n.text===name), box=node.box, z=geometry.camera.zoom;
      englishNodes[id]={name,box:[(box.x-box.width/2)*z*2+geometry.camera.x*2,(box.y-box.height/2)*z*2+geometry.camera.y*2,box.width*z*2,box.height*z*2].map(v=>Math.round(v*100)/100)};
    }
    if(Object.keys(englishNodes).length!==55) throw Error('Expected 55 English hotspots');
    ai=ai.replace(/var englishNodes = [\s\S]*?;\n    root.GlaukaAiMap.nodes.forEach/, 'var englishNodes = '+JSON.stringify(englishNodes,null,2)+';\n    root.GlaukaAiMap.nodes.forEach');
    fs.writeFileSync(aiFile,ai);
    console.log('Captured 55 English nodes and matching hotspots.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
