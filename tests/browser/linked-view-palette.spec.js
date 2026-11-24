const {test,expect}=require('@playwright/test');
const {openDocument}=require('../../scripts/dev/capture-website-localized.cjs');
function rgb(value){return value.match(/[\d.]+/g).slice(0,3).map(Number)}
function luminance(value){return rgb(value).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0)}
for(const language of ['it','en'])for(const scheme of ['light','dark'])test(`${language} ${scheme}: relationship chips follow the view palette`,async({browser},testInfo)=>{
 const {page}=await openDocument(browser,language,`docs/examples/website/views-${language}.glauka.json`,'http://127.0.0.1:5174/index.html');
 try{for(const [mode,preset,selector]of [['flowchart','blueprint','.nm-flow-pill'],['concept-network','cluster','.nm-network-link-item']]){
  await page.evaluate(({mode,preset,scheme})=>{
   const app=neuroMapApp;
   if(mode==='concept-network')app.state.addRelationship(app.state.root.children[0].children[0].id,app.state.root.children[1].children[0].id,document.documentElement.lang==='en'?'supports':'sostiene');
   app.state.root.viewAppearance=NeuroMapViewAppearance.update(app.state.root.viewAppearance,mode,{preset,background:scheme==='light'?'#ffffff':'#10192e',surface:scheme==='light'?'#f5f3ff':'#263856',text:scheme==='light'?'#16243d':'#f4f7ff'});
   NeuroMapLinkedViews.setMode(app,mode);NeuroMapLinkedViews.refresh(app);
  },{mode,preset,scheme});
  const chip=page.locator('#nm-view-overlay '+selector).first();await expect(chip).toBeVisible();
  const style=await chip.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,color:s.color,control:s.getPropertyValue('--nm-view-control').trim()}});
  const lum=luminance(style.background),ink=luminance(style.color);const contrast=(Math.max(lum,ink)+.05)/(Math.min(lum,ink)+.05);
  if(scheme==='light')expect(lum,JSON.stringify(style)).toBeGreaterThan(.9);
  if(scheme==='dark')expect(lum).toBeLessThan(.15);
  expect(contrast,JSON.stringify(style)).toBeGreaterThanOrEqual(4.5);
  expect(style.control).not.toBe('');
  await page.locator('#nm-view-overlay').screenshot({path:testInfo.outputPath(`${language}-${scheme}-${mode}.png`)});
 }}finally{await page.close()}
});
