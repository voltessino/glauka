'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/editor/text-import.js'),'utf8');
const start=source.indexOf('function nm66ParseIndentedForest(');
const end=source.indexOf('\nfunction nm66ForestAsText(',start);
assert.ok(start>=0&&end>start,'plain text parser not found');
const parse=new Function('NeuroMapCore',source.slice(start,end)+'\nreturn nm66ParseIndentedForest;')({
 parseMarkdownOutline(){throw Error('Tab-indented plaintext must not be parsed as Markdown');}
});
function flatten(roots){
 const stack=[...roots],names=[];
 while(stack.length){
  const node=stack.pop();names.push(node.text);
  for(let i=node.children.length-1;i>=0;i--)stack.push(node.children[i]);
 }
 return names;
}
test('large alternating indentation preserves every line exactly once',()=>{
 const lines=['Root'];
 for(let i=0;i<3000;i++)
  lines.push((i%3===0?'\t':i%3===1?'\t\t':'  ')+
   (i%17===0?'1) Numero ':i%19===0?'-> ':'Node ')+i);
 const roots=parse(lines.join('\n'));
 const all=flatten(roots);
 assert.equal(roots.length,1);
 assert.equal(all.length,3001);
 assert.equal(new Set(all).size,3001);
 assert.ok(all.includes('1) Numero 0'));
 assert.ok(all.includes('-> 19'));
});
test('blank and Unicode labels remain intact without silent truncation',()=>{
 const input='Radice\n\tStroma\n\t\tf.ne\n\t\t\ttrofismo\n\t\t(adenomeri + dotti)\n\t\t→ LOBULI\n';
 const out=parse(input),names=flatten(out);
 assert.deepEqual(names,['Radice','Stroma','f.ne','trofismo','(adenomeri + dotti)','→ LOBULI']);
 assert.equal(out[0].children[0].children.length,3);
});
