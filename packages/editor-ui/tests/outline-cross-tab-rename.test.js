'use strict';
const composeKnowledgeUi=()=>{
  const dir=path.join(__dirname,'../../../apps/desktop-shared/editor');
  return fs.readFileSync(path.join(dir,'knowledge-ui.js'),'utf8').replace(/\r\n?/g,'\n')
    .replace('/* @neuromap-knowledge-ui-draw */\n',
      fs.readFileSync(path.join(dir,'knowledge-ui-draw.js'),'utf8').replace(/\r\n?/g,'\n'));
};

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const text=composeKnowledgeUi();
const a=text.indexOf('  function beginEdit(row,button){');
const b=text.indexOf('  function editSelected()',a);
assert.ok(a>=0&&b>a,'original Outline editor not found');
const editorSource=text.slice(a,b);
function scenario(id){
 const listeners={};
 let field;
 const create=()=>{
  field={value:'',addEventListener(type,callback){listeners[type]=callback},
   focus(){},select(){}};
  return field;
 };
 const st=(label)=>({root:{id,text:label},updates:0,isDirty:false,
  updateNodeText(nodeId,value){if(nodeId!==id)return false;
   this.updates++;this.root.text=value;return true}});
 const A=st('Source A'),B=st('Source B');
 const app={tabs:[{id:'a',state:A},{id:'b',state:B}],activeTabId:'a',state:A,
  marks:0,saves:0,renders:0,markChanged(){this.marks++},
  scheduleSave(){this.saves++},renderTabBar(){this.renders++}};
 const ui={request(){}};
 const edit=new Function('create','app','state','let editing=null;\n'+editorSource+'\nreturn beginEdit;')(create,app,ui);
 const button={replaceWith(input){field=input}};
 const begin=()=>edit({id,text:'Source A'},button);
 return {A,B,app,ui,listeners,begin,field:()=>field};
}
test('1000 tab-switch races never rename the wrong map even with identical node IDs',()=>{
 for(let user=0;user<1000;user++){
  const id='shared-node-'+user,x=scenario(id);
  x.begin();x.field().value='Edited source '+user;
  x.app.activeTabId='b';x.app.state=x.B;
  x.listeners.blur();
  assert.equal(x.A.root.text,'Edited source '+user);
  assert.equal(x.B.root.text,'Source B');
  assert.equal(x.A.isDirty,true);
  assert.equal(x.app.saves,1);
  assert.equal(x.app.marks,0);
 }
});
test('on active tab the Outline rename still uses existing markChanged/Undo path',()=>{
 const x=scenario('n');x.begin();x.field().value='Edited here';
 x.listeners.blur();
 assert.equal(x.A.root.text,'Edited here');
 assert.equal(x.app.marks,1);
 assert.equal(x.app.saves,0);
});
test('close old tab before editor blur discards orphaned input',()=>{
 const x=scenario('n');x.begin();x.field().value='Should not survive';
 x.app.tabs.shift();x.app.activeTabId='b';x.app.state=x.B;
 x.listeners.blur();
 assert.equal(x.A.root.text,'Source A');assert.equal(x.B.root.text,'Source B');
 assert.equal(x.app.saves,0);
});
test('Escape cancels and subsequent blur cannot reapply a cancelled rename',()=>{
 const x=scenario('n');x.begin();x.field().value='Bad edit';
 x.listeners.keydown({key:'Escape',stopPropagation(){},preventDefault(){}});
 x.listeners.blur();
 assert.equal(x.A.root.text,'Source A');assert.equal(x.app.marks,0);
});
