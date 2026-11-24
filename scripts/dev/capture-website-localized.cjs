/* Authentic localized website captures. Start serve.py macos on :5174 first.
 * Usage: node scripts/dev/capture-website-localized.cjs --lang it|en [--only views|examples]
 * No overlays, mocked editor controls, image editing or external AI requests.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require('@playwright/test');
const ROOT = path.resolve(__dirname, '../..');
const MODES = [
  ['mindmap', 'mindmap'], ['orgchart', 'orgchart'], ['tree', 'concept-tree'],
  ['network', 'concept-network'], ['flow', 'flowchart'], ['kanban', 'kanban'], ['timeline', 'timeline']
];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const flatten = n => [n, ...(n.children || []).flatMap(flatten)];
function pngInfo(file) {
  const b = fs.readFileSync(file);
  if (b.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw Error('Invalid PNG: '+file);
  return {width:b.readUInt32BE(16), height:b.readUInt32BE(20), bytes:b.length, sha256:sha(file)};
}
async function openDocument(browser, language, source, url) {
  const page = await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2,locale:language==='en'?'en-GB':'it-IT'});
  await page.route('**/*', route => route.request().url().startsWith(new URL(url).origin+'/') ? route.continue() : route.abort());
  await page.addInitScript(lang => {
    localStorage.setItem('nm6_locale',lang);
    localStorage.setItem('nm6_welcome_seen','1');
  }, language);
  await page.goto(url);
  await page.waitForFunction(() => window.neuroMapApp?.renderer && window.NeuroMapLinkedViews && window.GlaukaI18n?.ready);
  const project = JSON.parse(fs.readFileSync(path.join(ROOT,source),'utf8'));
  await page.evaluate(async ({project,language,source}) => {
    for(const [mode,style] of Object.entries(project.root.viewAppearance?.modes||{})) {
      if(!NeuroMapViewAppearance.presetsFor(mode).includes(style.preset))throw Error('Invalid fixture appearance preset: '+mode+' / '+style.preset);
    }
    await GlaukaI18n.setLanguage(language);
    await neuroMapApp.importFile(new File([JSON.stringify(project)],'website.glauka.json'),{newTab:true});
    const isProject = source.includes('project-');
    const targetTheme = isProject ? (project.activeThemeId || 'midnight') : 'white';
    const targetSkin = isProject && targetTheme !== 'white' ? 'slate' : 'minimal';
    NM615.setTheme(targetTheme); NeuroMapUISkin.set({theme:targetSkin});
    document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));
    neuroMapApp.state.selectedImageId=null;
    neuroMapApp.recalculateAndRender(); neuroMapApp.fitToScreen(); neuroMapApp.requestRender();
    await document.fonts.ready;
  },{project,language,source});
  const close=page.locator('#nm616-map-close'); if(await close.isVisible())await close.click();
  await page.waitForFunction(lang=>document.documentElement.lang===lang,language);
  await page.waitForTimeout(400); // finish native editor panel/layout transitions
  const state = await page.evaluate(() => ({locale:GlaukaI18n.locale(),language:document.documentElement.lang,labels:neuroMapApp.state.getAllNodesIncludingCollapsed().map(n=>({id:n.id,text:n.text})),canvasId:neuroMapApp.renderer.canvas.id,uiText:['file','edit','insert','view','tools','help'].map(id=>document.getElementById('btn-menu-'+id)?.textContent.trim()).join(' | ')}));
  if(state.language!==language || state.locale!==language) throw Error('Editor locale mismatch');
  const expected=flatten(project.root);
  if(state.labels.length!==expected.length||expected.some(n=>!state.labels.some(s=>s.id===n.id&&s.text===n.text))) throw Error('Imported fixture differs from source');
  return {page,project,state};
}
async function captureLanguage(language, {browser,only,url='http://127.0.0.1:5174/index.html'}={}) {
  if(!['it','en'].includes(language))throw Error('Use --lang it or --lang en');
  if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Capture only a local editor');
  const own=!browser;
  browser ||= await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
  const manifest={kind:'authentic-glauka-localized-capture',language,captureScriptSha256:sha(__filename),sourceRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),capturedAt:new Date().toISOString(),viewport:{width:1600,height:1000,deviceScaleFactor:2},browserVersion:browser.version(),assets:[]};
  async function record(page,target,relative,source,extra={},clip=null) {
    const file=path.join(ROOT,relative);fs.mkdirSync(path.dirname(file),{recursive:true});
    await (clip?page:target).screenshot({path:file,...(clip?{clip}:{}),animations:'disabled'});
    manifest.assets.push({file:relative,source,sourceSha256:sha(path.join(ROOT,source)),...pngInfo(file),...extra});
  }
  try {
    if(only!=='examples') {
      const source=`docs/examples/website/views-${language}.glauka.json`;
      const {page,state}=await openDocument(browser,language,source,url);
      try {for(const [name,mode] of MODES) {
        await page.evaluate(mode => NeuroMapLinkedViews.setMode(neuroMapApp,mode),mode);
        if(mode==='mindmap') {
          await page.evaluate(()=>{neuroMapApp.fitToScreen();neuroMapApp.requestRender()});
          await page.waitForTimeout(100);
          const framing=await page.evaluate(()=>{
            const app=neuroMapApp,camera=app.renderer.camera;
            const nodes=app.state.getAllNodesIncludingCollapsed().map(n=>app.layout.getLayout(n.id));
            const left=Math.min(...nodes.map(n=>(n.x-n.width/2)*camera.zoom+camera.x))-34;
            const top=Math.min(...nodes.map(n=>(n.y-n.height/2)*camera.zoom+camera.y))-34;
            const right=Math.max(...nodes.map(n=>(n.x+n.width/2)*camera.zoom+camera.x))+34;
            const bottom=Math.max(...nodes.map(n=>(n.y+n.height/2)*camera.zoom+camera.y))+34;
            if(left<0||top<0||right>innerWidth||bottom>innerHeight)throw Error('Mind map bounds exceed the actual viewport');
            return {x:left,y:top,width:right-left,height:bottom-top};
          });
          await record(page,page.locator('#'+state.canvasId),`apps/website/home-review/assets/views/${language}/view-${name}.png`,source,{view:mode,editorLanguage:state.language,labels:state.labels,captureRegion:'Actual mind map Canvas, framed around all nodes; no image editing',clip:framing},framing);
        } else {
          await page.locator('#nm-view-overlay').waitFor({state:'visible'});
          await page.waitForFunction(mode=>document.getElementById('nm-view-overlay').dataset.viewMode===mode,mode);
          await page.locator('#nm-view-zoom-fit').click();
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const evidence=await page.locator('#nm-view-overlay').evaluate(el=>{
            const viewport=el.querySelector('#nm-view-scroller').getBoundingClientRect();
            const cards=[...el.querySelectorAll('#nm-view-stage .nm-view-card')].map(c=>{const r=c.getBoundingClientRect();return {text:c.innerText,x:r.x,y:r.y,width:r.width,height:r.height,visible:r.left>=viewport.left-1&&r.top>=viewport.top-1&&r.right<=viewport.right+1&&r.bottom<=viewport.bottom+1}});
            const r=el.getBoundingClientRect();
            const bottom=Math.max(...cards.map(c=>c.y+c.height));
            return {uiText:el.innerText,cards,clip:{x:r.x,y:r.y,width:r.width,height:Math.min(r.height,Math.max(400,bottom-r.y+24))}};
          });
          if(mode==='concept-tree') {
            // Capture the real tree viewport rather than a mostly empty wide overlay.
            // This crops the browser capture, never edits or reconstructs the image.
            const scroller=await page.locator('#nm-view-scroller').boundingBox();
            evidence.clip={x:scroller.x,y:scroller.y,width:Math.min(scroller.width,Math.max(800,Math.max(...evidence.cards.map(c=>c.x+c.width))-scroller.x+24)),height:Math.min(scroller.height,Math.max(320,Math.max(...evidence.cards.map(c=>c.y+c.height))-scroller.y+24))};
          }
          if(!evidence.cards.length||evidence.cards.some(c=>!c.visible))throw Error('Clipped cards: '+language+' '+mode);
          await record(page,page.locator('#nm-view-overlay'),`apps/website/home-review/assets/views/${language}/view-${name}.png`,source,{view:mode,editorLanguage:state.language,labels:state.labels,...evidence,captureRegion:mode==='concept-tree'?'Actual concept-tree viewport; toolbar and unused margins excluded':'Actual linked-view overlay and toolbar; blank area below last card excluded'},evidence.clip);
        }
      }} finally {await page.close()}
    }
    if(only!=='views')for(const name of ['matematica','project']) {
      const source=`docs/examples/website/${name==='matematica'?(language==='it'?'matematica':'matematica-en'):'project-'+language}.glauka.json`;
      const {page,state}=await openDocument(browser,language,source,url);
      try {await record(page,page.locator('#'+state.canvasId),`apps/website/home-review/assets/examples/${language}/${name}.png`,source,{subject:name,editorLanguage:state.language,labels:state.labels,uiText:state.uiText,captureRegion:'Actual editor viewport at Canvas bounds, including overlapping editor controls'});}finally{await page.close()}
    }
    const first=manifest.assets.find(asset=>asset.view==='mindmap');
    if(first) {
      const html=path.join(ROOT,'apps/website/home-review',language==='en'?'home-en.html':'index.html');
      const text=fs.readFileSync(html,'utf8');
      fs.writeFileSync(html,text.replace(/(<img width=")\d+(" height=")\d+(" id="current-view-image")/, '$1'+first.width+'$2'+first.height+'$3'));
    }
    const dest=path.join(ROOT,`apps/website/home-review/assets/localized-${language}${only?'-'+only:''}-provenance.json`);
    fs.writeFileSync(dest,JSON.stringify(manifest,null,2)+'\n');
    return manifest;
  } finally {if(own)await browser.close()}
}
module.exports={captureLanguage,openDocument,pngInfo,MODES};
if(require.main===module) {
  const arg=key=>process.argv[process.argv.indexOf(key)+1];
  const lang=process.argv.includes('--lang')?arg('--lang'):null;
  const only=process.argv.includes('--only')?arg('--only'):undefined;
  if(only&&!['views','examples'].includes(only))throw Error('Use --only views or examples');
  captureLanguage(lang,{only}).then(m=>console.log(`${m.language}: ${m.assets.length} authentic captures`)).catch(e=>{console.error(e);process.exitCode=1});
}
