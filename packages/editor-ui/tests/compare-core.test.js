const {test}=require('node:test');
const assert=require('node:assert/strict');
const c=require('../compare-core');
function tree(){return {id:'root',text:'Map',children:[
  {id:'a',text:'Continuous capillaries',children:[
    {id:'x',text:'Endothelium',children:[]},
    {id:'y',text:'Basal lamina',children:[{id:'deep',text:'Discontinuous',children:[]}]}
  ]},
  {id:'b',text:'Fenestrated capillaries',children:[
    {id:'v',text:'endothélium',children:[]},
    {id:'w',text:'Fenestrations',children:[]},
    {id:'u',text:'Basal  lamina',children:[]}
  ]}
]}}
test('comparison preserves source exactly and distinguishes shared exact labels',()=>{
 const root=tree(),saved=JSON.stringify(root);
 const result=c.compare(root,'a','b');
 assert.deepEqual(result.common.map(x=>x.key),['endothelium','basal lamina']);
 assert.equal(result.left.uniqueCount,1);
 assert.equal(result.right.uniqueCount,1);
 assert.equal(result.mode,'exact-labels');
 assert.equal(JSON.stringify(root),saved);
});
test('pair selection prioritizes Ctrl multiselection then adjacent siblings',()=>{
 const root=tree();
 assert.deepEqual(c.choosePair(root,['a','b'],'b'),{leftId:'a',rightId:'b',source:'multi-selection'});
 assert.deepEqual(c.choosePair(root,['a'],'a'),{leftId:'a',rightId:'b',source:'adjacent-sibling'});
 assert.deepEqual(c.choosePair(root,[],'root'),{leftId:'a',rightId:'b',source:'primary-siblings'});
});
test('deep comparison is explicit and bounded; collapsed nodes stay hidden',()=>{
 const root=tree();
 assert.equal(c.compare(root,'a','b').left.items.some(x=>x.id==='deep'),true);
 assert.equal(c.compare(root,'a','b',{maxDepth:1}).left.items.some(x=>x.id==='deep'),false);
 root.children[0].children[1].collapsed=true;
 assert.equal(c.compare(root,'a','b').left.items.some(x=>x.id==='deep'),false);
 assert.equal(c.list(root.children[0],{maxItems:1}).truncated,true);
});
test('invalid choices and graph cycles fail safely',()=>{
 const root=tree();
 assert.throws(()=>c.compare(root,'a','a'),/two different/);
 assert.throws(()=>c.compare(root,'missing','b'),/two different/);
 root.children[0].children.push(root);
 assert.throws(()=>c.catalog(root),/Invalid or cyclic/);
});
test('arbitrary strings remain data, never HTML or scripts',()=>{
 const root=tree();
 root.children[0].children[0].text='<img src=x onerror=alert(1)>';
 const result=c.compare(root,'a','b');
 assert.equal(result.left.items[0].text,'<img src=x onerror=alert(1)>');
 assert.equal(result.common.some(x=>x.label.includes('<img')),false);
});
