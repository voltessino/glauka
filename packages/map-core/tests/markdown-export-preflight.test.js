'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {serializeMarkdown,parseMarkdownExport}=require('..');

function chain(depth){
  const root={text:'Root',children:[]};let parent=root;
  for(let i=0;i<depth;i++){
    const child={text:'Node '+i,children:[]};
    parent.children.push(child);parent=child;
  }
  return root;
}

test('Markdown export is iterative and respects the importer depth limit',()=>{
  const valid=chain(100);
  assert.deepEqual(parseMarkdownExport(serializeMarkdown(valid)),[valid]);
  assert.throws(()=>serializeMarkdown(chain(101)),/100 livelli/);
  assert.throws(()=>serializeMarkdown(chain(20000)),/100 livelli/);
});

test('Markdown export preflight refuses over-limit, cyclic and malformed trees',()=>{
  const broad={text:'Root',children:Array.from({length:3499},(_,i)=>({text:'Node '+i,children:[]}))};
  assert.deepEqual(parseMarkdownExport(serializeMarkdown(broad)),[broad]);
  broad.children.push({text:'Excess',children:[]});
  assert.throws(()=>serializeMarkdown(broad),/3500/);
  const cycle={text:'Root',children:[]};cycle.children.push(cycle);
  assert.throws(()=>serializeMarkdown(cycle),/ciclica/);
  for(const invalid of [null,{text:42},{text:'Bad',children:{}},{text:'Bad',children:[null]},{text:'Bad',children:[[]]}])
    assert.throws(()=>serializeMarkdown(invalid),/non valido|non validi/);
  const alias={text:'Shared',children:[]};
  assert.deepEqual(parseMarkdownExport(serializeMarkdown({text:'Root',children:[alias,alias]})),
    [{text:'Root',children:[alias,alias]}]);
});

test('Markdown export preserves blank labels, surrounding spaces and original line endings',()=>{
  const root={text:'',children:[
    {text:'  leading and trailing  ',children:[]},
    {text:'A\r\nB',children:[]},
    {text:'\r',children:[]},
    {text:'  \n\n  ',children:[]}
  ]};
  const exported=serializeMarkdown(root);
  assert.match(exported,/NeuroMap-Markdown-v2/);
  assert.deepEqual(parseMarkdownExport(exported),[root]);
});

test('1000 seeded legacy Markdown maps round-trip without changing canonical output',()=>{
  let seed=42;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  const labels=['α é 中文','C:\\notes\\new','First\nSecond','Literal \\n','Hash # and - dash','Slash \\\\ end'];
  const make=depth=>({text:labels[next()%labels.length]+' '+next(),
    children:depth<4?Array.from({length:next()%4},()=>make(depth+1)):[]});
  for(let i=0;i<1000;i++){
    const root=make(0),markdown=serializeMarkdown(root);
    assert.deepEqual(parseMarkdownExport(markdown),[root]);
    assert.match(markdown,/^<!-- NeuroMap-Markdown-v1 -->/);
  }
});
