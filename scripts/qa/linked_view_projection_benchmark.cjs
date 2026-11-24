// Run from repository root with --expose-gc and an optional baseline Git revision.
const fs=require('fs'),vm=require('vm'),cp=require('child_process'),{performance}=require('perf_hooks');
const root=process.cwd(),files=['view-core','concept-network','flow-core','work-core'];
function load(rev){return Object.fromEntries(files.map(name=>{const box={module:{exports:{}},exports:{}};vm.runInNewContext(rev?cp.execFileSync('git',['show',rev+':packages/editor-ui/'+name+'.js'],{encoding:'utf8'}):fs.readFileSync('packages/editor-ui/'+name+'.js','utf8'),box);return[name,box.module.exports]}))}
const baseline=process.argv[2]||'origin/main';
const versions={baseline:load(baseline),candidate:load(null)},rows=[];
for(const size of [10,100,500,1000]){
 const rootNode={id:'root',text:'Benchmark',children:[]};for(let i=1;i<size;i++){const n={id:'n'+i,parentId:i<=8?'root':'n'+(1+(i-9)%8),text:'Concept '+i,taskStatus:['todo','doing','done'][i%3],startDate:'2026-11-'+String(1+i%20).padStart(2,'0'),dueDate:'2026-11-'+String(2+i%20).padStart(2,'0'),children:[]};if(i<=8)rootNode.children.push(n);else rootNode.children[(i-9)%8].children.push(n)}
 const rels=Array.from({length:Math.max(0,size-2)},(_,i)=>({id:'r'+i,fromId:'n'+(i+1),toId:'n'+(i+2),kind:'sequence',label:''}));
 for(const [version,libs]of Object.entries(versions))for(const mode of ['orgchart','concept-tree','concept-network','flowchart','kanban','timeline']){
  const project=()=>mode==='concept-network'?libs['concept-network'].project(rootNode,rels):mode==='flowchart'?libs['flow-core'].project(rootNode,rels,{maxCandidates:1200}):['kanban','timeline'].includes(mode)?libs['work-core'].project(rootNode,mode):libs['view-core'].project(rootNode,mode);
  const before=JSON.stringify(rootNode);try{
   project();const values=[];global.gc?.();const heapBefore=process.memoryUsage().heapUsed;
   for(let i=0;i<15;i++){const t=performance.now();project();values.push(performance.now()-t)}global.gc?.();values.sort((a,b)=>a-b);
   if(JSON.stringify(rootNode)!==before)throw Error('Canonical data mutated');
   rows.push({version,size,mode,samples:15,medianMs:values[7],p95Ms:values[14],retainedHeapBytes:process.memoryUsage().heapUsed-heapBefore});
  }catch(e){rows.push({version,size,mode,limit:e.message})}
 }
}
console.log(JSON.stringify({node:process.version,baseline:cp.execFileSync('git',['rev-parse',baseline],{encoding:'utf8'}).trim(),candidate:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),kind:'Actual Node core projection benchmark, not browser frame rate; heap deltas are noisy short-run observations',rows},null,2));
