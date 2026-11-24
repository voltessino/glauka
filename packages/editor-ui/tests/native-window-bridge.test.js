const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('native bridge sends ordered close leases with keepalive and restores BFCache pages',()=>{
 const requests=[],events={},docEvents={};const lifecycle=()=>requests.filter(r=>!r.url.endsWith('/window/live'));let timer,starts=0;
 const window={addEventListener:(k,fn)=>events[k]=fn},document={hidden:false,addEventListener:(k,fn)=>docEvents[k]=fn};
 const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/src/bridge.js'),'utf8').replace('{{TOKEN}}','qa-session').replace('{{DEV_EDITION}}','true');
 vm.runInNewContext(source,{window,document,crypto:{randomUUID:()=> 'page-id'},TextEncoder,setInterval:fn=>{timer=fn;starts++;return starts},clearInterval:()=>{},fetch:async(url,options)=>{requests.push({url,...options,body:JSON.parse(options.body)});return {ok:true,json:async()=>({})}}});
 assert.equal(lifecycle()[0].body.state,'open');document.hidden=true;docEvents.visibilitychange();events.pagehide();timer();assert.equal(lifecycle().length,3);
 assert.equal(lifecycle()[2].url,'/__desktop/window/closed');assert.equal(lifecycle()[2].keepalive,true);assert.equal(lifecycle()[2].headers['X-NeuroMap-Session'],'qa-session');
 events.pageshow({persisted:true});assert.equal(lifecycle()[3].body.state,'open');assert.ok(requests.every((r,i)=>r.body.sequence===i+1));assert.equal(starts,2);
});
test('older WebKit gets a random window identity and BFCache does not signal final close',()=>{
 const requests=[],events={};const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/src/bridge.js'),'utf8').replace('{{TOKEN}}','qa-session').replace('{{DEV_EDITION}}','true');
 vm.runInNewContext(source,{window:{addEventListener:(k,f)=>events[k]=f},document:{hidden:false,addEventListener(){}},crypto:{getRandomValues:bytes=>bytes.fill(17)},Uint8Array,TextEncoder,setInterval:()=>1,clearInterval(){},fetch:async(url,o)=>{requests.push({url,body:JSON.parse(o.body)});return {ok:true,json:async()=>({})}}});
 assert.equal(requests[0].body.windowId,'11'.repeat(16));events.pagehide({persisted:true});const eventsOnly=requests.filter(r=>!r.url.endsWith('/window/live'));assert.equal(eventsOnly[1].url,'/__desktop/heartbeat');assert.equal(eventsOnly[1].body.hidden,true);events.pageshow({persisted:true});assert.equal(requests.filter(r=>!r.url.endsWith('/window/live'))[2].body.state,'open');
});
