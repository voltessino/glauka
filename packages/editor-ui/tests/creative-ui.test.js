const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('./helpers/compose-creative-core.cjs')();
test('node URL cache reuses parsing and invalidates both editable link fields',()=>{
 let calls=0;
 const sandbox={NeuroMapCreativeCore:{url(value){calls++;return core.url(value);}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../creative-ui'),'utf8'),sandbox);
 const url=sandbox.NeuroMapCreativeModules.ui.nodeURL;
 const node={text:'https://example.org/a'};
 assert.equal(url(node),'https://example.org/a');
 for(let i=0;i<100;i++)assert.equal(url(node),'https://example.org/a');
 assert.equal(calls,1);
 node.text='https://example.org/b';assert.equal(url(node),'https://example.org/b');
 node.text='A label';node.linkUrl='https://example.org/c';assert.equal(url(node),'https://example.org/c');
 node.linkUrl='javascript:alert(1)';assert.equal(url(node),'');
 assert.equal(url(null),'');
});
