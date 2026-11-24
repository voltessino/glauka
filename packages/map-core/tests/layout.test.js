const {test}=require('node:test');
const assert=require('node:assert/strict');
const {splitClockwise,visualOrder}=require('..');
test('unequal branch heights never reorder the source sequence',()=>{
  const nodes=Array.from({length:6},(_,id)=>({id}));
  const result=splitClockwise(nodes,[500,10,400,20,300,30],30,50);
  assert.deepEqual([...result.rightIds,...result.leftIds],nodes.map(n=>n.id));
  assert.ok(result.rightCount>0 && result.leftCount>0);
});
test('noncontiguous XMind side pins win over automatic balancing',()=>{
  const nodes=[{id:'a',sidePinned:'left'},{id:'b',sidePinned:'right'},{id:'c',sidePinned:'left'},{id:'d',sidePinned:'right'}];
  const result=splitClockwise(nodes,[10,300,20,30],10,50);
  assert.deepEqual(result.rightIds,['b','d']);assert.deepEqual(result.leftIds,['a','c']);
  assert.equal(result.H_R,340);assert.equal(result.H_L,40);
  assert.ok(nodes.every(n=>!Object.hasOwn(n,'side')),'source objects must remain untouched');
});
test('distribution slider endpoints put unpinned branches on the requested side',()=>{
  const nodes=[{id:1},{id:2}];
  assert.deepEqual(splitClockwise(nodes,[20,20],0,0).rightIds,[]);
  assert.deepEqual(splitClockwise(nodes,[20,20],0,100).rightIds,[1,2]);
  assert.deepEqual(splitClockwise([],[],10,50).rightIds,[]);
});
test('visual navigation reads right top-down then left bottom-up',()=>{
  const nodes=[{id:'leftTop'},{id:'rightBottom'},{id:'leftBottom'},{id:'rightTop'}];
  const p={leftTop:{x:-20,y:-30},rightBottom:{x:20,y:30},leftBottom:{x:-20,y:30},rightTop:{x:20,y:-30}};
  assert.deepEqual(visualOrder(nodes,{getLayout:id=>p[id]}).map(n=>n.id),['rightTop','rightBottom','leftBottom','leftTop']);
});
