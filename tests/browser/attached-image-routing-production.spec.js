const {test,expect}=require('@playwright/test');
for(const [platform,url]of [['desktop',process.env.GLAUKA_DESKTOP_URL||'http://127.0.0.1:5174/index.html'],['android',process.env.GLAUKA_ANDROID_URL||'http://127.0.0.1:5173/app/index.html']])
for(const width of [390,1440])for(const style of ['xmind8','buzan','thickparents'])test(`${platform}: attached pictures keep ${style} branches clear at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(url);await page.waitForFunction(()=>window.neuroMapApp?.renderer);
 const result=await page.evaluate(async style=>{
  const app=neuroMapApp;
  app.importHierarchy({text:'Picture routing regression',children:[{text:'Main branch',children:Array.from({length:5},(_,i)=>({text:'Topic '+i,children:[{text:'Notes '+i,children:[]}]}))}]},{newTab:true});
  const parent=app.state.root.children[0],child=parent.children[0];
  app.state.addImageItem({id:'regression-picture',src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="260" height="156"><rect width="260" height="156" fill="#7654cc"/></svg>'),width:260,height:156,naturalWidth:260,naturalHeight:156,mode:'attached',attachedNodeId:child.id,offset:{dx:80,dy:-130},frame:'none',borderRadius:0});
  document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));
  app.state.root.layoutMode="balanced";app.state.root.layoutBalanceMode="geometry";
  const collisions=[];
  for(const side of ['left','right'])for(const scale of [.5,1.5,3]){
   parent.sidePinned=side;app.state.branchStyle=style;app.state.strokeScale=scale;app.recalculateAndRender();
   if(child.side!==side)throw Error("Side pin was not applied: "+child.side+" expected "+side);
   const g=app.renderer.computeBranchGeometry(parent,child,0,parent.children.length);
   for(const other of parent.children.slice(1)){
    const rect=app.layout.getLayout(other.id);
    for(let i=1;i<200;i++){
     const t=i/200,u=1-t,x=u*u*u*g.startX+3*u*u*t*g.cp1x+3*u*t*t*g.cp2x+t*t*t*g.endX,y=u*u*u*g.startY+3*u*u*t*g.cp1y+3*u*t*t*g.cp2y+t*t*t*g.endY;
     const r=style==='xmind8'?1.7*scale/2:(g.startWidth*(1-t)+g.endWidth*t)/2;
     if(x+r>rect.x-rect.width/2&&x-r<rect.x+rect.width/2&&y+r>rect.y-rect.height/2&&y-r<rect.y+rect.height/2){collisions.push({side,scale,label:other.text});break;}
    }
   }
  }
  let nodes=0;const pending=[app.state.root];while(pending.length){const n=pending.pop();nodes++;pending.push(...(n.children||[]));}
  return {collisions,nodes,images:app.state.images.length};
 },style);
 expect(result.nodes).toBe(12);expect(result.images).toBe(1);expect(result.collisions).toEqual([]);
});
