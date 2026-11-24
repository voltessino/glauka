'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const K=require('../../../apps/desktop-shared/editor/knowledge-db-core.js');
function fixture(){
 const root={id:'root',text:'Health',children:[
  {id:'a',text:'Circulation',children:[],notes:'Existing note'},
  {id:'b',text:'Kidney',children:[],notes:''}
 ]};
 const state={root,history:[],findNode(id){
  const todo=[this.root];while(todo.length){const n=todo.pop();if(n.id===id)return n;todo.push(...(n.children||[]))}
  return null;
 },pushHistory(){this.history.push(JSON.stringify(this.root))},
 addChildNode(id,layout,label){const p=this.findNode(id);if(!p)return null;this.pushHistory();
  const node={id:'new_'+this.root.children.length,text:label,children:[]};p.children.push(node);return node}
 };
 return state;
}
test('tags normalize Unicode, strip #, dedupe case-insensitively and cap 16',()=>{
 const input=Array.from({length:30},(_,i)=>'#Tag'+i);
 assert.equal(K.tags(input).length,16);
 assert.deepEqual(K.tags(['#René','rene\u0301','   Anatomia ','<script>', 'Anatomia']),['René','Anatomia']);
});
test('unknown/suspicious field keys and prototype-pollution keys are rejected',()=>{
 assert.equal(K.key('__proto__'),'');
 assert.equal(K.key('constructor'),'');
 assert.equal(K.key('prototype'),'');
 assert.equal(K.key('valid_name'),'valid_name');
 const hostile=JSON.parse('{"__proto__":{"type":"text","value":"x"},"normal":{"type":"text","value":"ok"}}');
 const fields=K.fields(hostile);
 assert.equal(Object.getPrototypeOf(fields),null);
 assert.equal(Object.prototype.hasOwnProperty.call(fields,'__proto__'),false);
 assert.equal(fields.normal.value,'ok');
});
test('typed fields validate finite numbers and real ISO dates',()=>{
 assert.equal(K.typed('number','0.4').value,0.4);
 assert.equal(K.typed('number','Infinity'),null);
 assert.equal(K.typed('number','NaN'),null);
 assert.equal(K.typed('date','2026-02-30'),null);
 assert.equal(K.typed('date','2024-02-29').value,'2024-02-29');
 assert.equal(K.typed('boolean','false').value,false);
 assert.equal(K.typed('boolean','typo'),null);
 assert.equal(K.typed('boolean',''),null);
 assert.equal(K.typed('boolean',0).value,false);
});
test('editing metadata changes only original node and creates one Undo snapshot',()=>{
 const s=fixture();
 const data={tags:['Study'],fields:{difficulty:{type:'number',value:2}}};
 assert.equal(K.update(s,'a',data),true);
 assert.equal(K.update(s,'a',data),false);
 assert.equal(s.history.length,1);
 assert.equal(s.findNode('b').knowledge,undefined);
 assert.equal(K.normalize(s.findNode('a').knowledge).fields.difficulty.value,2);
});
test('template preserves authored Markdown and does not reapply destructively',()=>{
 const s=fixture(),note=s.findNode('a').notes;
 assert.equal(K.applyTemplate(s,'a','clinical',{today:'2026-10-23'}),true);
 assert.equal(s.findNode('a').notes,note);
 assert.equal(K.applyTemplate(s,'a','clinical',{today:'2026-10-23'}),false);
 assert.equal(s.history.length,1);
 assert.ok(K.normalize(s.findNode('a').knowledge).tags.includes('Clinica'));
});
test('empty node receives template Markdown once',()=>{
 const s=fixture();
 assert.equal(K.applyTemplate(s,'b','study'),true);
 assert.match(s.findNode('b').notes,/## Fonti/);
 assert.equal(K.applyTemplate(s,'b','study'),false);
 assert.equal(s.history.length,1);
});
test('daily notes are idempotent by exact date and do not duplicate saved concepts',()=>{
 const s=fixture(),first=K.createDaily(s,null,'2026-10-23');
 const second=K.createDaily(s,null,'2026-10-23');
 assert.equal(first.created,true);assert.equal(second.created,false);
 assert.equal(first.node.id,second.node.id);
 assert.equal(s.history.length,1);
 assert.equal(K.normalize(first.node.knowledge).dailyKey,'2026-10-23');
 assert.equal(s.root.children.length,3);
});
test('invalid daily date rejects without mutating the map',()=>{
 const s=fixture(),original=JSON.stringify(s.root);
 assert.throws(()=>K.createDaily(s,null,'2026-02-30'),/date/);
 assert.equal(JSON.stringify(s.root),original);
});
test('tag, title, field and due-date filtered views stay read-only',()=>{
 const s=fixture();
 K.update(s,'a',{tags:['Physiology'],fields:{course:{type:'text',value:'Anatomy'}}});
 s.findNode('a').dueDate='2026-10-24';
 const before=JSON.stringify(s.root),index=K.rows([{id:'tab',state:s}]);
 const q=K.filter(index,{tag:'physiology',field:'course',value:'Anatomy',order:'due'});
 assert.equal(q.total,1);assert.equal(q.items[0].nodeId,'a');
 assert.equal(JSON.stringify(s.root),before);
});
test('queries report partial results when a cap is reached',()=>{
 const s=fixture(),index=K.rows([{id:'a',state:s}],{limit:2});
 assert.equal(index.records.length,2);assert.equal(index.partial,true);
 const q=K.filter(index,{max:1});
 assert.equal(q.partial,true);
});
test('custom field cap normalizes untrusted structures without prototype injection',()=>{
 const values=Object.fromEntries(Array.from({length:100},(_,i)=>['key'+i,{type:'number',value:i}]));
 const result=K.fields(values);
 assert.equal(Object.keys(result).length,20);
 assert.equal(result.key0.value,0);
});
test('create daily note honors 3500 node limit',()=>{
 const s=fixture(),root=s.root;
 root.children=Array.from({length:3499},(_,i)=>({id:'a'+i,text:'N',children:[]}));
 assert.throws(()=>K.createDaily(s,null,'2026-10-23'),/3500/);
 assert.equal(s.history.length,0);
});

test('templates preserve the field cap even on maps already holding 20 properties',()=>{
 const s=fixture(),n=s.findNode('a');
 n.knowledge={fields:Object.fromEntries(Array.from({length:20},(_,i)=>['custom'+i,{type:'text',value:'keep'}]))};
 K.applyTemplate(s,'a','clinical');
 assert.equal(Object.keys(n.knowledge.fields).length,20);
 assert.equal(n.knowledge.fields.custom19.value,'keep');
 assert.equal(K.applyTemplate(s,'a','clinical'),false);
});
