"use strict";
/* F10 opt-in browser evidence: actual Glauka editor, no fake diagram images.
 * npx playwright test tests/browser/orgchart-professional.spec.js --workers=1
 */
const {test,expect}=require("@playwright/test");
test.use({viewport:{width:1500,height:940},deviceScaleFactor:2});
async function boot(page){
 await page.addInitScript(()=>localStorage.setItem("nm6_welcome_seen","1"));
 await page.goto(process.env.GLAUKA_DESKTOP_TEST_URL||
   "http://127.0.0.1:5174/index.html");
 await page.waitForFunction(()=>Boolean(window.neuroMapApp?.state?.root&&
   window.NeuroMapLinkedViews&&window.NeuroMapViewCore));
 await page.evaluate(()=>{
  window.NeuroMapHome?.close?.();
  document.querySelectorAll(".nm6-shade").forEach(x=>x.classList.add("hidden"));
 });
 const result=await page.evaluate(()=>{
  const app=window.neuroMapApp,s=app.state;
  s.root.text="Direzione Generale";s.root.children=[];
  s.images=[];
  const groups=["Ricerca","Sviluppo","Progetti","Design","Qualità","Formazione"];
  let featured=null;
  for(let i=0;i<groups.length;i++){
    const group=s.addChildNode(s.root.id,app.layout,groups[i]);
    for(let j=0;j<9;j++){
      const member=s.addChildNode(group.id,app.layout,groups[i]+" · Team "+(j+1));
      if(i===0&&j===0)featured=member.id;
    }
  }
  // This PNG is explicitly attached to one genuine node as user content.
  const src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9N9tMAAAAASUVORK5CYII=";
  s.images.push({id:"orgchart-example-image",src,width:40,height:40,
    mode:"attached",attachedNodeId:featured,offset:{dx:0,dy:0},
    worldPos:{x:0,y:0},zLayer:"front",aspectLocked:true});
  app.markChanged();
  window.NeuroMapLinkedViews.setMode(app,"orgchart");
  return {featured,expected:61,canonical:JSON.stringify({
    children:s.root.children,images:s.images})};
 });
 await expect(page.locator("#nm-view-overlay")).toBeVisible();
 await expect(page.locator("#nm-view-stage .nm-orgchart-card")).toHaveCount(result.expected);
 return result;
}
test("F10 org chart: readable cards, authentic image and non-destructive search",async({page},info)=>{
 const demo=await boot(page);
 const stage=page.locator("#nm-view-stage");
 await expect(stage.locator(".nm-orgchart-mark")).toHaveCount(61);
 await expect(stage.locator(".nm-orgchart-meta")).toHaveCount(61);
 await expect(stage.locator("img.nm-orgchart-mark")).toHaveCount(1);
 const featured=stage.locator(".nm-orgchart-card").filter({
   has:page.locator("img.nm-orgchart-mark")
 });
 await expect(featured).toHaveCount(1);
 expect(await featured.getAttribute("data-node-id")).toBe(demo.featured);
 const search=page.locator("#nm-orgchart-search");
 await expect(search).toBeVisible();
 await search.fill("ricerca");
 await expect(stage.locator(".nm-orgchart-dimmed")).toHaveCount(51);
 await search.fill("");
 await expect(stage.locator(".nm-orgchart-dimmed")).toHaveCount(0);
 const canonical=await page.evaluate(()=>JSON.stringify({
  children:window.neuroMapApp.state.root.children,
  images:window.neuroMapApp.state.images
 }));
 expect(canonical).toBe(demo.canonical);
 await page.locator("#nm-view-zoom-fit").click();
 await expect(stage).toHaveAttribute("data-org-detail","overview");
 await info.attach("f10-orgchart-overview.png",{
  body:await page.locator("#nm-view-overlay").screenshot(),contentType:"image/png"});
 await page.locator("#nm-view-zoom-reset").click();
 await expect(stage).toHaveAttribute("data-org-detail","detail");
 const cards=await stage.locator(".nm-orgchart-card").evaluateAll(nodes=>nodes
  .filter(n=>n.getBoundingClientRect().width>0).slice(0,40)
  .map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,
    w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));
 expect(cards.every(r=>r.w>30&&r.h>20)).toBe(true);
 await info.attach("f10-orgchart-detail.png",{
  body:await page.locator("#nm-view-overlay").screenshot(),contentType:"image/png"});
});
test("F10 split view keeps identical org metadata and search behavior",async({page})=>{
 await boot(page);
 await page.evaluate(()=>window.NeuroMapLinkedViews.setMode(window.neuroMapApp,"mindmap"));
 await page.locator("#v6-show-layout").click();
 await page.locator("#nm-view-split").click();
 await expect(page.locator("#nm-view-overlay")).toBeVisible();
 await expect(page.locator("#nm-view-stage .nm-orgchart-card")).toHaveCount(61);
 await expect(page.locator("#nm-orgchart-search")).toBeVisible();
 await page.locator("#nm-orgchart-search").fill("formazione");
 await expect(page.locator("#nm-view-stage .nm-orgchart-dimmed")).toHaveCount(51);
 await page.locator("#nm-orgchart-search").fill("");
 await expect(page.locator("#nm-view-stage .nm-orgchart-dimmed")).toHaveCount(0);
});
