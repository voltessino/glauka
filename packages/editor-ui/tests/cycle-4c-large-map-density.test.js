"use strict";
/* Cycle 4C: large documents keep every real card readable and finite.
   Overlapping connectors are allowed. Overlapping cards are not. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const view=require("../view-core");
const work=require("../work-core");
const network=require("../concept-network");
const flow=require("../flow-core");

function tree(count){
  const nodes=[{id:"n0",text:"Radice Città",children:[]}];
  for(let i=1;i<count;i++){
    const node={id:"n"+i,text:i%5===0?("Architettura del ramo "+i+" — èà"):("Nodo "+i),children:[]};
    nodes[Math.floor((i-1)/3)].children.push(node);
    nodes.push(node);
  }
  return nodes[0];
}
function cardsCollide(nodes){
  const hits=[];
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j];
    const gapX=Math.abs(a.x-b.x)-(a.w+b.w)/2;
    const gapY=Math.abs(a.y-b.y)-(a.h+b.h)/2;
    if(gapX<-0.5&&gapY<-0.5)hits.push([a.id,b.id]);
  }
  return hits;
}
function finite(graph){
  assert.ok(Number.isFinite(graph.width)&&graph.width>0);
  assert.ok(Number.isFinite(graph.height)&&graph.height>0);
  assert.ok(graph.nodes.every(node=>[node.x,node.y,node.w,node.h].every(Number.isFinite)&&node.w>0&&node.h>0));
  assert.equal(new Set(graph.nodes.map(node=>node.id)).size,graph.nodes.length);
}

test("orgchart and concept tree keep 150 and 500 cards apart",()=>{
  for(const count of [150,500]){
    const source=tree(count);
    const before=JSON.stringify(source);
    for(const mode of ["orgchart","concept-tree"]){
      const graph=view.project(source,mode,{maxNodes:800});
      finite(graph);
      assert.equal(graph.nodes.length,count);
      assert.deepEqual(cardsCollide(graph.nodes),[]);
    }
    assert.equal(JSON.stringify(source),before);
  }
});

test("kanban keeps uneven columns ordered and timeline ignores undated tasks",()=>{
  const root={id:"root",text:"Lavoro",children:[]};
  const statuses=["unassigned","todo","doing","done"];
  for(let i=0;i<500;i++){
    const task={id:"t"+i,text:i%4===0?("Titolo lungo del compito "+i+" città"):("Task "+i),children:[]};
    if(i%3!==0)task.taskStatus=statuses[i%4];
    if(i%2===0)task.dueDate="2026-11-"+String((i%27)+1).padStart(2,"0");
    root.children.push(task);
  }
  const before=JSON.stringify(root);
  const board=work.project(root,"kanban",{maxNodes:800});
  finite(board);
  assert.equal(board.nodes.length,500);
  assert.equal(board.columns.reduce((sum,column)=>sum+column.count,0),500);
  assert.deepEqual(cardsCollide(board.nodes),[]);
  const dated=work.project(root,"timeline",{maxNodes:800});
  finite(dated);
  assert.ok(dated.nodes.length<500);
  assert.ok(dated.nodes.every(node=>node.startDate||node.dueDate));
  assert.deepEqual(cardsCollide(dated.nodes),[]);
  const blank={id:"root",text:"Senza date",children:[{id:"a",text:"Solo titolo",children:[]}]};
  const empty=work.project(blank,"timeline");
  assert.equal(empty.nodes.length,0);
  assert.equal(empty.empty,true);
  assert.equal(JSON.stringify(root),before);
});

test("a saved network position stays put and a flowchart invents no steps",()=>{
  const source=tree(40);
  source.children[0].networkPosition={x:640,y:420};
  const before=JSON.stringify(source);
  const graph=network.project(source,[],{maxNodes:80});
  const pinned=graph.nodes.find(node=>node.id===source.children[0].id);
  assert.equal(pinned.x,640);
  assert.equal(pinned.y,420);
  assert.equal(pinned.manual,true);
  finite(graph);
  assert.equal(JSON.stringify(source),before);

  const steps=tree(30);
  const links=[{id:"one",fromId:"n1",toId:"n2",kind:"yes"},{id:"two",fromId:"n2",toId:"n4",kind:"no"}];
  const diagram=flow.project(steps,links,{maxCandidates:80});
  assert.deepEqual(diagram.edges.map(edge=>edge.kind),["yes","no"]);
  assert.equal(diagram.nodes.length,3);
  assert.equal(flow.project(steps,[],{maxCandidates:80}).nodes.length,0);
});
