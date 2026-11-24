const {test,expect}=require('@playwright/test');
for(const platform of ['desktop','android'])test(`${platform}: real OPML export and import preserve labels and child order`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto(platform==='android'?'http://127.0.0.1:5173/app/index.html':'http://127.0.0.1:5174/index.html');
 await page.waitForFunction(()=>window.neuroMapApp?.io&&window.NeuroMapCore?.serializeOPML);
 const result=await page.evaluate(async()=>{
  const a=neuroMapApp;a.importHierarchy({text:'❷ A & <B>',children:[{text:'First "child"',children:[]},{text:'Second 中文',children:[]}]},{newTab:true});
  const before=JSON.stringify(a.state.createSnapshot()),download=a.io.triggerDownload;let blob,filename,ok;
  try{a.io.triggerDownload=(value,name)=>{blob=value;filename=name;return true};ok=await a.io.exportOPML()}finally{a.io.triggerDownload=download}
  const xml=await blob.text(),valid=!new DOMParser().parseFromString(xml,'text/xml').querySelector('parsererror');
  const unchanged=before===JSON.stringify(a.state.createSnapshot());
  const opened=await a.importFiles([new File([xml],filename,{type:blob.type})],true);
  return{ok,valid,unchanged,opened,text:a.state.root.text,children:a.state.root.children.map(n=>n.text),mime:blob.type};
 });
 expect(result).toEqual({ok:true,valid:true,unchanged:true,opened:1,text:'❷ A & <B>',children:['First "child"','Second 中文'],mime:'text/x-opml;charset=utf-8'});
});
