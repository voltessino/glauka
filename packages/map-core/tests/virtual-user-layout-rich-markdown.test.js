'use strict';
/* Reproducible, deterministic virtual-user cases. Not physical-device or GUI tests.
 * Pure map core is consumed by Windows, macOS and Android editor bundles.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {splitClockwise,splitFluid,serializeMarkdown,parseMarkdownExport,wrapLabelText,validateWorkspaceTabs}=require('..');

function randomFor(seed){
 return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}

test('1000 seeded profiles preserve every pinned branch in 10000 layout calculations',()=>{
 let calculations=0;
 for(let user=0;user<1000;user++){
  const next=randomFor((user+1)*3571+0x12be9);
  const nodes=Array.from({length:1+Math.floor(next()*70)},(_,i)=>({
   id:'u'+user+'-n'+i,sidePinned:next()<.16?'left':next()<.24?'right':null
  }));
  const heights=nodes.map(()=>12+Math.floor(next()*220));
  const snapshot=JSON.stringify(nodes);
  const ids=new Set(nodes.map(n=>n.id));
  for(const bias of [0,20,50,80,100]){
   for(const result of [splitClockwise(nodes,heights,10,bias),splitFluid(nodes,heights,10)]){
    calculations++;
    const placed=[...result.rightIds,...result.leftIds];
    assert.equal(placed.length,nodes.length,'lost branch for user '+user);
    assert.equal(new Set(placed).size,nodes.length,'duplicate branch for user '+user);
    assert.ok(placed.every(id=>ids.has(id)),'changed branch identity');
    assert.equal(result.rightCount+result.leftCount,nodes.length);
    assert.ok(result.splitIndex>=0&&result.splitIndex<=nodes.length);
    for(const n of nodes){
     if(n.sidePinned==='left')assert.ok(result.leftIds.includes(n.id),'lost left pin');
     if(n.sidePinned==='right')assert.ok(result.rightIds.includes(n.id),'lost right pin');
    }
   }
  }
  assert.equal(JSON.stringify(nodes),snapshot,'layout must not mutate source branch order');
 }
 assert.equal(calculations,10000);
});

test('1000 seeded rich Markdown maps round-trip without losing hierarchy, notes or font styles',()=>{
 let checkedNodes=0;
 for(let user=0;user<1000;user++){
  const next=randomFor((user+1)*3571+0x12be9);
  const root={text:'Mappa '+user+' — € α',children:[]};
  if(user%3===0)root.notes='Nota 🍋\nseconda riga';
  const all=[root];
  for(let i=0;i<1+Math.floor(next()*30);i++){
   const parent=all[Math.floor(next()*all.length)];
   const n={text:'Concetto '+i+' / test '+user+(i%6===0?' [a] \\ b':''),children:[]};
   if(i%4===0)n.fontWeight=700;
   if(i%5===0)n.fontItalic=true;
   if(i%7===0)n.notes='Descrizione '+user+':'+i+'\ncon *simboli*';
   parent.children.push(n);all.push(n);
  }
  const before=JSON.stringify(root);
  const restored=parseMarkdownExport(serializeMarkdown(root));
  assert.deepEqual(restored,[root],'round-trip failed for user '+user);
  assert.equal(JSON.stringify(root),before,'export must not mutate workspace');
  checkedNodes+=all.length;
  assert.ok(wrapLabelText('Studiare il concetto '+user+' con parole e simboli',18).length>0);
 }
 assert.ok(checkedNodes>=1000);
});

test('1000 multi-tab workspaces survive validation and reject corrupt backup data atomically',()=>{
 let checked=0,rejected=0;
 for(let user=0;user<1000;user++){
  const next=randomFor((user+1)*5879+0xa11ce);
  const tabCount=1+Math.floor(next()*20);
  const children=1+Math.floor(next()*20);
  const tabs=Array.from({length:tabCount},(_,i)=>({
   id:'tab-'+user+'-'+i,
   root:{id:'root',text:'Scheda '+i,children:Array.from({length:children},(_,j)=>({
    id:'child-'+j,text:'Concetto '+j,children:[]
   }))},
   images:[{id:'image',attachedNodeId:'child-0'}],
   relationships:[],studyCards:[],learningAttempts:[]
  }));
  const snapshot=JSON.stringify(tabs);
  assert.equal(validateWorkspaceTabs(tabs),tabCount*(1+children));
  assert.equal(JSON.stringify(tabs),snapshot,'preflight changed an accepted workspace');
  checked++;
  const repeatedId=JSON.parse(snapshot);
  repeatedId.at(-1).root.children[0].id='root';
  const rejectedBefore=JSON.stringify(repeatedId);
  assert.throws(()=>validateWorkspaceTabs(repeatedId),/ID/);
  assert.equal(JSON.stringify(repeatedId),rejectedBefore,'preflight changed a rejected workspace');
  rejected++;
  const badMetadata=JSON.parse(snapshot);
  badMetadata.at(-1).images=[null];
  assert.throws(()=>validateWorkspaceTabs(badMetadata),/Metadati/);
  rejected++;
 }
 assert.equal(checked,1000);
 assert.equal(rejected,2000);
});
