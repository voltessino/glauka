'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../map-style-core');
const colors={default:['#f43f5e','#8b5cf6'],neon:['#00f5d4','#ff007f'],
 forest:['#10b981','#84cc16'],sunset:['#f97316','#eab308'],ocean:['#38bdf8','#6366f1']};
function sample(){
 const root={id:'root',text:'Map',children:[{id:'a',text:'Cardiologia',notes:'🫀',
  children:[{id:'a1',text:'Child',children:[]}]},{id:'b',text:'Research',children:[]}]};
 return {root,selectedNodeId:'a',selectedNodeIds:['a'],branchStyle:'xmind8',
  strokeScale:1,activeThemeId:'default',images:[{attachedNodeId:'a'}],
  relationships:[{fromId:'a',toId:'b'}],undoStack:[],
  pushHistory(){this.undoStack.push({root:JSON.parse(JSON.stringify(this.root)),branchStyle:this.branchStyle,
    strokeScale:this.strokeScale,activeThemeId:this.activeThemeId})},
  undo(){Object.assign(this,this.undoStack.pop())},
  findNode(id){const stack=[this.root];while(stack.length){const n=stack.pop();if(n.id===id)return n;stack.push(...(n.children||[]))}return null}};
}
test('13 unique presets include borderless labels and reject unapproved shapes',()=>{
 assert.equal(C.PRESETS.length,13);assert.equal(new Set(C.PRESETS.map(x=>x.id)).size,13);
 assert.ok(C.PRESETS.every(p=>C.valid(p)));
 assert.equal(C.personal({nodeShape:'javascript:'}),null);
});
test('only selected logical nodes are changed, all attachments preserved',()=>{
 const s=sample(),old=JSON.stringify(s.root),im=JSON.stringify(s.images);
 assert.equal(C.apply(s,C.PRESETS[0],'selection',colors),1);
 assert.equal(s.findNode('a').nodeShape,'pill');assert.equal(s.findNode('a1').nodeShape,undefined);
 assert.equal(s.branchStyle,'xmind8');assert.equal(JSON.stringify(s.images),im);
 s.undo();assert.equal(JSON.stringify(s.root),old);
});
test('global style is one Undo transaction even on deep descendants',()=>{
 const s=sample(),old=JSON.stringify(s.root),p=C.PRESETS.find(x=>x.id==='circuit');
 assert.equal(C.apply(s,p,'map',colors),3);
 assert.equal(s.branchStyle,'thickparents');assert.equal(s.findNode('a1').nodeShape,'circuit');
 assert.equal(s.findNode('a').notes,'🫀');assert.equal(s.undoStack.length,1);
 s.undo();assert.equal(JSON.stringify(s.root),old);
});
test('root-only selection never changes shape; global empty map does',()=>{
 const s=sample();s.root.children=[];s.selectedNodeId='root';s.selectedNodeIds=['root'];
 assert.equal(C.apply(s,C.PRESETS.find(p=>p.id==='minimal'),'selection',colors),0);
 assert.equal(C.apply(s,C.PRESETS.find(p=>p.id==='minimal'),'map',colors),1);
 assert.equal(s.branchStyle,'simple');
});
test('custom preset names and values roundtrip safely',()=>{
 const s=sample();s.findNode('a').nodeShape='hex';
 const value=C.sample(s,'Private ♥');
 assert.equal(C.personal(JSON.stringify(value)).it,'Private ♥');
});
test('1000 profiles preserve logical IDs, notes and Undo after visual changes',()=>{
 let checks=0;
 for(let user=0;user<1000;user++){
  const s=sample(),old=JSON.stringify(s.root),ids=s.root.children.map(x=>x.id);
  const p=C.PRESETS[user%C.PRESETS.length];
  s.selectedNodeId=user%3===0?'a1':'a';s.selectedNodeIds=[s.selectedNodeId];
  assert.ok(C.apply(s,p,user%2?'selection':'map',colors)>0);checks++;
  assert.deepEqual(s.root.children.map(x=>x.id),ids);checks++;
  assert.equal(s.findNode('a').notes,'🫀');checks++;
  s.undo();assert.equal(JSON.stringify(s.root),old);checks++;
 }
 assert.equal(checks,4000);
});