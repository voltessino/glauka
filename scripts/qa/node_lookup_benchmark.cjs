'use strict';
// Real state lookup implementations; 10k is a model probe, not a supported UI import.
const fs=require('node:fs'),path=require('node:path'),Core=require('../../packages/map-core');
const output=process.argv[2];if(!output||fs.existsSync(output)||!global.gc)throw Error('node --expose-gc SCRIPT NEW_OUTPUT.json');
const rows=[];
for(const platform of ['desktop-shared','android']){
 const source=fs.readFileSync(path.join(__dirname,'../../apps',platform,'editor/state.js'),'utf8');
 const State=new Function('NeuroMapCore',source+';return MindMapStateMachine;')(Core);
 for(const count of [100,1000,3000,10000]){
  const root={id:'root',children:Array.from({length:20},(_,i)=>({id:'branch-'+i,children:[]}))};
  for(let i=21;i<count;i++)root.children[i%20].children.push({id:'node-'+i,children:[]});
  const nodes=[],pending=[root];while(pending.length){const n=pending.pop();nodes.push(n);for(let i=n.children.length-1;i>=0;i--)pending.push(n.children[i])}
  const state=Object.create(State.prototype);state.root=root;const ids=nodes.slice(-Math.min(256,nodes.length)).map(n=>n.id);
  const lookup=Core.findNodesById?()=>Core.findNodesById(root,ids).filter(Boolean):()=>ids.map(id=>state.findNode(id)).filter(Boolean);
  lookup();global.gc();const heapBefore=process.memoryUsage().heapUsed,times=[],cpu=process.cpuUsage();
  for(let i=0;i<20;i++){const t=performance.now(),found=lookup();times.push(performance.now()-t);if(found.length!==ids.length||found.some((n,j)=>n.id!==ids[j]))throw Error('Wrong lookup result')}
  const used=process.cpuUsage(cpu);global.gc();times.sort((a,b)=>a-b);
  rows.push({platform,nodes:nodes.length,selected:ids.length,medianMs:(times[9]+times[10])/2,p95Ms:times[18],cpuMs:(used.user+used.system)/1000,heapBefore,heapAfter:process.memoryUsage().heapUsed});
 }
}
fs.writeFileSync(output,JSON.stringify({method:'Node real state implementations before; shared batch helper when available after. No global index. Twenty synchronous samples; post-GC JS heap. 10k model only; UI security limit unchanged.',rows},null,2));
