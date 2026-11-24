'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const composeAppSource=require('./helpers/compose-app-source.cjs');
const source=composeAppSource('desktop-shared');
const start=source.indexOf('      createFloatingTopicAt(worldX,worldY) {');
const end=source.indexOf('\n      showContextMenu(',start);
assert.ok(start>=0&&end>start,'floating topic method not found in editor');
const method=new Function('return ({'+source.slice(start,end)+'}).createFloatingTopicAt')();
function fixture(){
 const root={id:'root',text:'Root',children:[]},updates={history:0,changed:0,edited:0};
 let next=0;
 const app={
  state:{root,selectedNodeId:'root',selectedNodeIds:[],
   pushHistory(){updates.history++},generateId(){return 'free-'+(++next)}},
  markChanged(){updates.changed++},editSelected(){updates.edited++}
 };
 return {app,updates};
}
test('canvas free-topic insertion uses exact world position and creates one undo snapshot',()=>{
 const {app,updates}=fixture();
 const result=method.call(app,352,-211);
 assert.equal(result.id,'free-1');
 assert.equal(app.state.root.children.length,1);
 assert.equal(app.state.root.children[0],result);
 assert.deepEqual(result.floatingPosition,{x:352,y:-211});
 assert.equal(result.isFloating,true);
 assert.equal(result.parentId,'root');
 assert.deepEqual(app.state.selectedNodeIds,['free-1']);
 assert.equal(updates.history,1);assert.equal(updates.changed,1);assert.equal(updates.edited,1);
});
test('invalid coordinates are ignored without touching history or the logical map',()=>{
 const {app,updates}=fixture();
 assert.equal(method.call(app,NaN,20),null);
 assert.equal(method.call(app,200,Infinity),null);
 assert.equal(updates.history,0);
 assert.equal(app.state.root.children.length,0);
});
test('double-click on a blank canvas shares the same insertion path',()=>{
 assert.match(source,/this\.createFloatingTopicAt\(where\.x,where\.y\)/);
});
