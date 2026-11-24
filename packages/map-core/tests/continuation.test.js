const {test}=require('node:test');
const assert=require('node:assert/strict');
const {splitClockwise,planContinuation,continuationSettings}=require('..');
const leaf=id=>({id,text:id,children:[]});
const tree=(count=20)=>({id:'root',text:'Fegato',children:[{id:'ittero',children:[{id:'chirurgico',children:[{id:'clinico',children:Array.from({length:count},(_,i)=>leaf('leaf'+i))}]}]}]});
const plan=root=>planContinuation(root,()=>40,{height:160,gap:10,primaryGap:20,bias:50});
test('Auto always starts an unpinned first primary on the right',()=>{
 for(const height of [1,40,5000])assert.deepEqual(splitClockwise([leaf('first')],[height],20,50).rightIds,['first']);
 assert.deepEqual(splitClockwise([{...leaf('first'),sidePinned:'left'}],[40],20,50).leftIds,['first']);
});
test('deep overflow replicates only ancestor paths, without changing the logical tree',()=>{
 const root=tree(),before=JSON.stringify(root),result=plan(root);
 assert.equal(JSON.stringify(root),before);assert.equal(result.pages.length,7);
 assert.deepEqual(result.pages.map(p=>p.side),['right','left','right','left','right','left','right']);
 assert.deepEqual(result.pages.flatMap(p=>p.units),Array.from({length:20},(_,i)=>'leaf'+i));
 for(const page of result.pages){assert.ok(page.height<=page.capacity);let n=page.roots[0];assert.equal(n.logicalId,'ittero');n=n.children[0];assert.equal(n.logicalId,'chirurgico');n=n.children[0];assert.equal(n.logicalId,'clinico');assert.ok(n.children.length<=3);}
});
test('append at the end preserves all previous page assignments and remains deterministic',()=>{
 const root=tree(13),before=plan(root);root.children[0].children[0].children[0].children.push(leaf('new'));
 const after=plan(root),mapping=p=>Object.fromEntries(p.pages.flatMap(x=>x.units.map(id=>[id,x.index])));
 const a=mapping(after);for(const[id,page]of Object.entries(mapping(before)))assert.equal(a[id],page);
 assert.deepEqual(after,plan(root));
});
test('distribution and spacing change real capacity predictably, endpoints never switch to the forbidden side',()=>{
 const root=tree(12);
 for(const bias of [0,25,50,75,100]){
  const result=planContinuation(root,()=>40,{height:160,gap:10,bias});
  for(const page of result.pages){assert.equal(page.capacity,160*2*(page.side==='right'?bias:100-bias)/100);assert.ok(page.height<=page.capacity);}
  if(bias===0)assert.ok(result.pages.every(p=>p.side==='left'));
  if(bias===100)assert.ok(result.pages.every(p=>p.side==='right'));
 }
 const packed=plan(root),spaced=planContinuation(root,()=>40,{height:160,gap:30,bias:50});
 assert.ok(spaced.pages.length>packed.pages.length);
});
test('collapsed branches are single units and a tall label extends rather than truncates a page',()=>{
 const root=tree();root.children[0].collapsed=true;const result=plan(root);assert.equal(result.pages.length,1);assert.deepEqual(result.pages[0].units,['ittero']);
 const tall=planContinuation({id:'root',children:[leaf('big'),leaf('small')]},n=>n.id==='big'?420:40,{height:160});
 assert.equal(tall.pages[0].height,420);assert.equal(tall.pages[1].side,'left');
});
test('explicit side pins survive continuation and malformed settings are normalized',()=>{
 const root={id:'root',children:[{...leaf('left'),sidePinned:'left'},{...leaf('right'),sidePinned:'right'}]};
 assert.deepEqual(plan(root).pages.map(p=>p.side),['left','right']);
 assert.deepEqual(continuationSettings({enabled:'yes',height:-10}),{enabled:false,height:160});
});
test('asymmetric attached-image envelopes contribute to the same subtree-height formula',()=>{
 const root={id:'root',children:[{id:'parent',children:[leaf('a'),leaf('b')]}]};
 const result=planContinuation(root,n=>n.id==='parent'?{height:40,top:134,bottom:20}:40,{height:160,gap:10});
 assert.equal(result.pages[0].height,154);assert.equal(result.pages.length,2);
 const roomy=planContinuation(root,n=>n.id==='parent'?{height:40,top:134,bottom:20}:40,{height:200,gap:10});assert.equal(roomy.pages[0].height,179);
});
test('the saved baseline is a real lower bound and heights can grow beyond 4000',()=>{
 const config=continuationSettings({enabled:true,height:1,minimumHeight:1200,initialOrder:true,anchorSides:{a:'left',b:'right',invalid:'else'}});
 assert.equal(config.height,1200);assert.deepEqual(config.anchorSides,{a:'left',b:'right'});
 assert.equal(continuationSettings({height:14000}).height,14000);
});
