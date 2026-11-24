'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../../../apps/desktop-shared/editor/native-open-core.js');
const source=fs.readFileSync(path.resolve(__dirname,'../../../apps/desktop-shared/src/bridge.js'),'utf8').replace("'{{TOKEN}}'","'qa-session'").replace('{{DEV_EDITION}}','false');
function scenario({unreadable=false,skip=false}={}){
 const ids=['A'.repeat(43),'B'.repeat(43)],queue=[...ids],acks=[],imports=[],prompts=[],notices=[],memory=new Map();let finish;
 const completed=new Promise(r=>finish=r),response=(status,body={},headers={})=>({status,ok:status>=200&&status<300,headers:{get:k=>headers[k]||null},json:async()=>body,arrayBuffer:async()=>new Uint8Array([123,125]).buffer});
 const window={GlaukaNativeOpen:core,addEventListener(){},focus(){},sessionStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},confirm:()=>{prompts.push([...imports]);return skip},neuroMapApp:{showToast:t=>notices.push(t),v6ReportNativeOpen:finishReport=>finish(finishReport)}};
 const fetch=async(url,options)=>{
  if(url.endsWith('/external/pending')){const exclude=JSON.parse(options.body).exclude||[],id=queue.find(id=>!exclude.includes(id));if(!id)return response(204);const name=id===ids[0]?'bad.gk':'good.gk';const headers={'X-Glauka-Delivery-ID':id,'X-NeuroMap-Filename':Buffer.from(name).toString('base64url'),'X-NeuroMap-Path':Buffer.from('/maps/'+name).toString('base64url')};return response(id===ids[0]&&unreadable?409:200,{message:'not accessible'},headers)}
  if(url.endsWith('/external/confirm')){const body=JSON.parse(options.body);acks.push(body);queue.splice(queue.indexOf(body.id),1);return response(200)}
  return response(200);
 };
 vm.runInNewContext(source,{window,document:{hidden:false,addEventListener(){}},fetch,setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,crypto:{randomUUID:()=> '550e8400-e29b-41d4-a716-446655440000'},TextEncoder,TextDecoder,Uint8Array,Date,atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),console:{warn(){}}});
 window.neuromapDesktop.onExternalFile(async file=>{if(file.filename==='bad.gk')throw Error('corrupt map');imports.push(file.filename);return {status:'opened'}});
 return {completed,queue,acks,imports,prompts,notices,ids};
}
test('a parse failure stays queued while the same poll opens later valid documents',{timeout:2000},async()=>{
 const h=scenario(),report=await h.completed;assert.deepEqual(h.imports,['good.gk']);assert.deepEqual(h.queue,[h.ids[0]]);assert.deepEqual(h.acks,[{id:h.ids[1],action:'imported'}]);assert.deepEqual([report.opened,report.failed],[1,1]);assert.ok(h.notices.some(n=>n.includes('corrupt map')));
});
test('an inaccessible document is offered Skip only after other files opened',{timeout:2000},async()=>{
 const h=scenario({unreadable:true,skip:true}),report=await h.completed;assert.deepEqual(h.prompts,[['good.gk']]);assert.deepEqual(h.queue,[]);assert.deepEqual(h.acks.map(a=>a.action),['imported','skip']);assert.deepEqual([report.opened,report.failed],[1,1]);
});
test('declining Skip never discards the inaccessible file or blocks valid documents',{timeout:2000},async()=>{
 const h=scenario({unreadable:true,skip:false});await h.completed;assert.deepEqual(h.imports,['good.gk']);assert.deepEqual(h.queue,[h.ids[0]]);assert.equal(h.acks.length,1);
});
