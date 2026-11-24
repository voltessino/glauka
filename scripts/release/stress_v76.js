'use strict';
/* Deterministic source-level stress for NeuroMap 7.6 Knowledge Database. */
async function run(K){
 const failed=[];let checks=0,seed=7602026;
 const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 function ok(value,name){checks++;if(!value)failed.push(name)}
 const begin=Date.now(),metrics=[];
 for(let j=0;j<600;j++){
  const size=8+Math.floor(rand()*700),nodes=Array.from({length:size},(_,i)=>({
   id:'n'+i,text:'Concept '+i,notes:'',children:[],
   knowledge:{tags:i%3===0?['Study','Anatomy']:['Notes'],
    fields:{priority:{type:'number',value:i%5}},dailyKey:''}
  }));
  for(let i=1;i<size;i++)nodes[Math.floor(rand()*i)].children.push(nodes[i]);
  const root=nodes[0],before=JSON.stringify(root);
  const idx=K.rows([{id:'tab',state:{root}}]);
  ok(idx.records.length===size,'tree-count-'+j);
  ok(!idx.partial,'tree-cap-'+j);
  ok(JSON.stringify(root)===before,'tree-read-only-'+j);
  const a=K.filter(idx,{tag:'Study',field:'priority',value:'2',max:200});
  ok(a.items.every(x=>x.tags.includes('Study')&&String(x.fields.priority.value).includes('2')),'filter-'+j);
 }
 const tabs=Array.from({length:20},(_,i)=>({id:'tab'+i,state:{root:{
  id:'root'+i,text:'Project '+i,notes:'',children:Array.from({length:1800},(_,j)=>({
   id:'node'+i+'_'+j,text:'Study item '+j,notes:'Small note',children:[],
   knowledge:{tags:j%2===0?['Diario','Review']:['Review'],fields:{course:{type:'text',value:'Biology'}},dailyKey:j===0?'2026-10-23':''}
  }))
 }}}));
 const beginHuge=Date.now(),all=K.rows(tabs);
 ok(all.records.length===36020,'36k-nodes');
 ok(!all.partial,'36k-complete');
 const daily=K.filter(all,{tag:'Diario',order:'daily',max:1000});
 ok(daily.total===18000,'18k-tagged');
 ok(daily.items.length===1000&&daily.partial,'limit-visible-list');
 metrics.push({case:'20-tabs-36020-nodes',ms:Date.now()-beginHuge,records:all.records.length});
 const one={root:{id:'root',text:'Root',notes:'Existing',children:[]},history:0,findNode(id){return id==='root'?this.root:null},pushHistory(){this.history++},addChildNode(id,engine,text){this.pushHistory();const n={id:'child_'+this.root.children.length,text,children:[]};this.root.children.push(n);return n}};
 ok(K.applyTemplate(one,'root','clinical')===true,'apply-template');
 ok(one.root.notes==='Existing','non-destructive-notes');
 ok(K.applyTemplate(one,'root','clinical')===false,'template-idempotent');
 const old=JSON.stringify(one.root);
 ok(K.update(one,'root',{tags:['Study'],fields:{difficulty:{type:'number',value:2}}}),'metadata-update');
 ok(JSON.stringify(one.root)!==old,'metadata-persist-change');
 const first=K.createDaily(one,null,'2026-10-23'),next=K.createDaily(one,null,'2026-10-23');
 ok(first.created&&!next.created&&first.node===next.node,'daily-idempotence');
 ok(K.key('__proto__')===''&&K.key('constructor')==='','prototype-keys');
 ok(K.typed('date','2026-02-30')===null,'invalid-date');
 ok(K.typed('number','Infinity')===null,'invalid-numeric');
 ok(K.tags(Array.from({length:200},(_,i)=>'Tag'+i)).length===16,'bounded-tags');
 const massive=Object.fromEntries(Array.from({length:100},(_,i)=>['property'+i,{type:'text',value:'x'}]));
 ok(Object.keys(K.fields(massive)).length===20,'bounded-fields');
 return {suite:'NeuroMap 7.6 Knowledge Database stress',seed:7602026,checks,passed:failed.length===0,failed,metrics,elapsedMs:Date.now()-begin,fullNodeSuiteExecuted:false,nativeGUIExecuted:false};
}
if(typeof module==='object'&&module.exports)module.exports={run};
if(typeof require==='function'&&require.main===module)
 run(require('../../apps/desktop-shared/editor/knowledge-db-core.js')).then(result=>{
  console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
 }).catch(e=>{console.error(e);process.exitCode=1});
