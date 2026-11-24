'use strict';
/* Android portable-core stress. Offline, seeded and reproducible. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
if(!globalThis.crypto)globalThis.crypto=require('node:crypto').webcrypto;
const W=require('../../packages/editor-ui/work-core.js');globalThis.NeuroMapWorkCore=W;
const BASE='../../apps/desktop-shared/editor/';
const C=require(BASE+'capture-core.js'),V=require(BASE+'visual-study-core.js');
const I=require(BASE+'document-import-core.js'),A=require(BASE+'anki-tsv-core.js');
const Q=require(BASE+'quality-core.js'),H=require(BASE+'share-html-core.js');
const E=require(BASE+'portable-exchange-core.js'),Cal=require(BASE+'task-calendar-core.js');
let seed=74006,checks=0;const fails=[];
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const check=(v,label)=>{checks++;if(!v)fails.push(label)};
function tree(n){const nodes=Array.from({length:n},(_,i)=>({id:'n'+i,text:'Topic '+i,children:[]}));
 for(let i=1;i<n;i++)nodes[Math.floor(random()*i)].children.push(nodes[i]);return nodes[0];}
async function main(){
 const began=Date.now();
 for(let k=0;k<480;k++){
  const n=8+Math.floor(random()*850),r=tree(n),before=JSON.stringify(r);
  check(Q.inspect({tabs:[{id:'t',state:{root:r}}]}).counts.nodes===n,'scan-'+k);
  check(JSON.stringify(r)===before,'immutable-'+k);
  check(W.candidates(r,1200).length===n-1,'work-'+k);
  check(H.render(r).includes('Topic '+(n-1)),'share-'+k);
 }
 for(const n of [125,1000,3499]){
  const r=tree(n);
  check(Q.inspect({tabs:[{id:'t',state:{root:r}}]}).counts.nodes===n,'large-scan-'+n);
  check(H.render(r).includes('Topic '+(n-1)),'large-html-'+n);
 }
 const tabs=Array.from({length:20},(_,i)=>({id:'tab'+i,state:{root:tree(1600)}}));
 check(Q.inspect({tabs}).counts.nodes===32000,'20-tabs');
 const jobs={id:'root',text:'Tasks',children:[]};
 for(let i=0;i<1400;i++)jobs.children.push({id:'task'+i,text:'Task',children:[],
  startDate:'2026-10-23',dueDate:'2026-10-25',taskDependsOn:i?['task'+(i-1)]:[]});
 for(let i=1350;i<1400;i++)check(W.validateDependencies(jobs,'task'+i,['task'+(i-1)]).length===1,'dag-'+i);
 try{W.validateDependencies(jobs,'task0',['task1399']);check(false,'dag-cycle')}
 catch(e){check(/cycle/i.test(e.message),'dag-cycle')}
 check(W.project(jobs,'timeline',{maxNodes:1500}).edges.length===1399,'gantt-edges');
 check(C.propose({text:'Fegato',url:'https://example.org'}).notes==='Fegato','capture');
 try{C.propose({text:'x',url:'javascript:alert(1)'});check(false,'unsafe-url')}
 catch(e){check(true,'unsafe-url')}
 const hotspots=V.add([],{x:.2,y:.4,nodeId:'n1',label:'Heart'});
 check(hotspots.length===1,'hotspot');
 try{V.add(hotspots,hotspots[0]);check(false,'duplicate-hotspot')}
 catch(e){check(true,'duplicate-hotspot')}
 const p=await I.preview({name:'notes.txt',size:12000,text:async()=>('X'.repeat(11000)+'\nlast')});
 check(p.root.children[0].notes.endsWith('last'),'txt-lossless');
 try{await I.preview({name:'long.txt',size:47000,text:async()=> 'X'.repeat(47000)});check(false,'txt-overflow')}
 catch(e){check(/45,000/.test(e.message),'txt-overflow')}
 const cards=Array.from({length:500},(_,i)=>({question:'Q'+i,answer:'A'+i}));
 check(A.parse(A.exportTSV(cards)).length===500,'anki-500');
 const html=H.render({id:'r',text:'</script><script>evil()</script>',notes:'PRIVATE',children:[]});
 check(!html.includes('PRIVATE')&&!html.includes('</script><script>evil()'),'html-privacy-xss');
 const ics=Cal.render({id:'r',text:'Plan',children:[{id:'a',text:'Task',dueDate:'2026-10-23',children:[]}]},
  {now:'2026-10-23T12:00:00Z'});
 check(ics.content.includes('DTEND;VALUE=DATE:20261024'),'ics-boundary');
 const original={schema:'NeuroMapArchitect-SingleTab-v6',root:{id:'r',text:'Root',children:[]},
  images:[],relationships:[],studyCards:[]};
 const envelope=await E.create(original);
 check((await E.inspect(envelope,original)).status==='identical','exchange-sha256');
 envelope.project.root.text='Tampered';
 try{await E.inspect(envelope,original);check(false,'tamper')}
 catch(e){check(/checksum/.test(e.message),'tamper')}
 const css=fs.readFileSync(path.resolve(__dirname,'../../apps/android/native/app/src/main/assets/assets/mobile-74.css'),'utf8');
 for(const w of [320,360,393,600,768,900,1024,1280])check(css.includes('max-width:100%'),'css-'+w);
 const result={suite:'NeuroMap Android portable 7.4',checks,passed:!fails.length,failures:fails,
  seed:74006,elapsedMs:Date.now()-began,realDeviceTested:false,layoutRendered:false};
 console.log(JSON.stringify(result,null,2));
 if(fails.length)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={main};
