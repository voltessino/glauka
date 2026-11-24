'use strict';
async function run(K){
 const failures=[],start=Date.now();let checks=0,seed=7502026;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 function ok(v,name){checks++;if(!v)failures.push(name);}
 for(let i=0;i<500;i++){
  const n=8+Math.floor(random()*650);
  const nodes=Array.from({length:n},(_,j)=>({id:'n'+j,text:'Topic '+j,notes:'',children:[]}));
  for(let j=1;j<n;j++)nodes[Math.floor(random()*j)].children.push(nodes[j]);
  const root=nodes[0],source=nodes[1],target=nodes[n-1];
  source.notes=K.format({rootId:root.id,nodeId:target.id,title:target.text});
  const before=JSON.stringify(root),idx=K.index([{id:'tab',state:{root}}]);
  ok(idx.forward('tab',source.id).length===1,'forward-'+i);
  ok(idx.backlinks('tab',target.id).length===1,'backward-'+i);
  ok(JSON.stringify(root)===before,'nonmutating-'+i);
  target.text='New '+i;
  ok(K.index([{id:'tab',state:{root}}]).forward('tab',source.id)[0].target.title==='New '+i,'rename-'+i);
 }
 const tabs=Array.from({length:20},(_,i)=>({id:'tab_'+i,state:{root:{
  id:'root_'+i,text:'Map',children:Array.from({length:1800},(_,j)=>({
   id:'id'+j,text:'Node '+i+'-'+j,
   notes:j===10?K.format({rootId:'root_'+((i+1)%20),nodeId:'id11',title:'Across'}):'',
   children:[]
  }))
 }}}));
 const idx=K.index(tabs);
 ok(idx.records.length===36020,'36k-count');
 ok(!idx.partial,'36k-full-index');
 for(let i=0;i<20;i++){
  ok(idx.forward('tab_'+i,'id10')[0].target.tabId==='tab_'+((i+1)%20),'cross-'+i);
  ok(idx.backlinks('tab_'+((i+1)%20),'id11').length===1,'back-'+i);
 }
 const duplicate=K.index([tabs[0],{id:'duplicate',state:{root:tabs[0].state.root}},tabs[1]]);
 ok(duplicate.resolve({kind:'id',rootId:'root_0',nodeId:'id10'}).status==='ambiguous','duplicate-root');
 const source=K.format({rootId:'src',nodeId:'a',title:'A'});
 const external=K.format({rootId:'other',nodeId:'b',title:'B'});
 const tick=String.fromCharCode(96);
 const markdown=source+'\n'+external+'\n'+tick.repeat(3)+'\n'+source+'\n'+tick.repeat(3);
 const output=K.remapInternal(markdown,'src','dst',new Map([['a','fresh']]));
 ok(output.startsWith('[[nm:dst/fresh|A]]'),'mapped-link');
 ok(output.includes(external),'external-link-preserved');
 ok(output.includes(tick.repeat(3)+'\n'+source),'code-fence-preserved');
 ok(K.parse('[[A]] '.repeat(300)).links.length===64,'bounded-links');
 return {suite:'NeuroMap 7.5 WikiLinks',checks,passed:!failures.length,failures,seed:7502026,
  elapsedMs:Date.now()-start,nativeGUIVerified:false};
}
if(typeof module==='object'&&module.exports)module.exports={run};
if(typeof require==='function'&&require.main===module){
 run(require('../../apps/desktop-shared/editor/wiki-links-core.js')).then(r=>{
  console.log(JSON.stringify(r,null,2));if(!r.passed)process.exitCode=1;
 }).catch(e=>{console.error(e);process.exitCode=1});
}
