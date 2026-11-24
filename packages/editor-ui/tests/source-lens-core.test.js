'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../../../apps/desktop-shared/editor/source-lens-core.js');
const citation=(i,extra={})=>({
 id:'src_'+String(i).padStart(10,'0'),kind:'pdf',fileName:'clinical-source.pdf',
 title:'Original study',sha256:'a'.repeat(64),page:1+(i%700),quote:'Quoted evidence '+i,
 createdAt:'2026-10-22T14:00:00.000Z',...extra
});
test('provenance normalization prevents malicious URLs, HTML and invalid IDs',()=>{
 assert.equal(Core.safeUrl('javascript:alert(1)'),'');
 assert.equal(Core.safeUrl('file:///C:/secret.txt'),'');
 assert.equal(Core.safeUrl('data:text/html,Hello'),'');
 assert.equal(Core.safeUrl('https://user:password@example.com/'),'');
 assert.equal(Core.normalize({...citation(1),id:'<script>'}),null);
 assert.equal(Core.normalize({...citation(1),kind:'web',url:'javascript:alert(1)'}),null);
 const web=Core.normalize({...citation(1),kind:'web',url:'https://example.com/study',title:'Study',quote:'Evidence'});
 assert.equal(web.url,'https://example.com/study');
 assert.ok(!Object.hasOwn(web,'fileName'));
});
test('source references retain page, hash and quote, not PDF file bytes',()=>{
 const item=Core.normalize(citation(24));
 assert.equal(item.page,25);
 assert.equal(item.sha256,'a'.repeat(64));
 assert.equal(item.quote,'Quoted evidence 24');
 assert.equal(item.fileName,'clinical-source.pdf');
 assert.ok(!Object.hasOwn(item,'bytes')&&!Object.hasOwn(item,'data'));
});
test('16 citation limit, duplicate suppression, removal and Undo-friendly replacement',()=>{
 const node={id:'node-1',text:'Concept',children:[],sourceRefs:[]};
 for(let i=0;i<16;i++)assert.equal(Core.attach(node,citation(i)),true);
 assert.equal(Core.attach(node,citation(17)),false);
 assert.equal(Core.attach(node,citation(0)),false);
 const previous=JSON.stringify(node);
 assert.equal(Core.detach(node,citation(0).id),true);
 assert.equal(node.sourceRefs.length,15);
 assert.equal(Core.attach(node,citation(17)),true);
 assert.notEqual(JSON.stringify(node),previous);
 assert.equal(node.children.length,0);
});
test('1000 user-created citation references survive a JSON project roundtrip',()=>{
 let checks=0;
 for(let user=0;user<1000;user++){
  const node={id:'node-'+user,notes:'Note '+user,sourceRefs:[]};
  assert.equal(Core.attach(node,citation(user,{quote:'§️ important '+user})),true);checks++;
  const copy=JSON.parse(JSON.stringify(node));
  copy.sourceRefs=Core.normalizeAll(copy.sourceRefs);
  assert.equal(copy.sourceRefs[0].quote,'§️ important '+user);checks++;
  assert.equal(copy.sourceRefs[0].page,1+user%700);checks++;
  assert.equal(copy.id,node.id);checks++;
 }
 assert.equal(checks,4000);
});
test('a different file never replaces the stored citation',()=>{
 const ref={id:'src_abcdefghij',kind:'pdf',fileName:'lezione.pdf',title:'Lezione',
  sha256:'a'.repeat(64),page:12,quote:'cuore'};
 const before=JSON.stringify(ref);
 assert.equal(Core.sameDocument(ref,'a'.repeat(64)),true);
 assert.equal(Core.sameDocument(ref,'b'.repeat(64)),false);
 assert.equal(Core.sameDocument(ref,''),false);
 assert.equal(JSON.stringify(ref),before);
});
test('PDF input constraints and header validation are explicit',async()=>{
 const real=Uint8Array.from([37,80,68,70,45,49,46,55,10,37,69,79,70]);
 const file={name:'test.pdf',size:real.length,type:'application/pdf',arrayBuffer:async()=>real.buffer};
 assert.equal(Core.isPDF(file),true);
 assert.equal(Core.isPDF({...file,name:'danger.svg'}),false);
 assert.equal(Core.isPDF({...file,size:81*1024*1024}),false);
 if(globalThis.crypto?.subtle){
  const sha=await Core.fingerprint(file);
  assert.match(sha,/^[a-f0-9]{64}$/);
  const tampered={...file,arrayBuffer:async()=>Uint8Array.of(0,1,2,3,4,5).buffer};
  await assert.rejects(()=>Core.fingerprint(tampered),/valid PDF header/);
 }
});
