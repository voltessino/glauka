'use strict';
const {test,describe}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Transfer=require('../transfer');
const Lan=require('../lan-host');

const sha256=async str=>crypto.createHash('sha256').update(str,'utf8').digest('hex');
const MAP='018f3a5e-0000-7000-8000-000000000001';
const PC='018f3a5e-0000-7000-8000-0000000000aa';
const PHONE='018f3a5e-0000-7000-8000-0000000000bb';
const CLOCK=Date.parse('2026-11-06T21:00:00.000Z');

function project(){
  return {
    schema:'NeuroMapArchitect-SingleTab-v6',
    savedAt:'2026-11-06T20:00:00.000Z',
    activeThemeId:'graphite',
    thresholdY:480,balanceBias:50,compactness:100,branchGapX:150,
    root:{
      id:'map-root',text:'Mappa Centrale',color:'#6441df',viewMode:'kanban',
      notes:'Nota radice',children:[
        {id:'branch-a',text:'Strategia',color:'#6441df',notes:'Dettaglio',children:[]},
        {id:'branch-b',text:'Obiettivi Q4',color:'#0ea5e9',children:[]}
      ]
    },
    images:[{id:'img-1',name:'schema.svg',mime:'image/svg+xml',data:'<svg xmlns="http://www.w3.org/2000/svg"/>'}],
    relationships:[{id:'rel-1',fromId:'branch-a',toId:'branch-b',label:'segue'}],
    studyCards:[{id:'card-1',sourceNodeId:'branch-a',front:'Domanda',back:'Risposta'}]
  };
}

describe('F11.1 copy, file and inbox',()=>{
  test('a prepared copy keeps ids, notes, svg, cards and does not mutate the open map',async()=>{
    const open=project();
    const before=JSON.stringify(open);
    const copy=await Transfer.prepareCopy(open,{mapId:MAP,deviceId:PC,sha256,createdAt:'2026-11-06T21:00:00.000Z'});
    assert.equal(JSON.stringify(open),before);
    assert.equal(copy.preview.title,'Mappa Centrale');
    assert.equal(copy.preview.nodes,3);
    assert.equal(copy.preview.images,1);
    assert.equal(copy.handoff.manifest.mapId,MAP);
    const file=Transfer.sealFile(copy.handoff);
    const opened=await Transfer.openFile(file,sha256);
    assert.equal(opened.project.root.color,'#6441df');
    assert.equal(opened.project.root.viewMode,'kanban');
    assert.equal(opened.project.root.children[0].notes,'Dettaglio');
    assert.equal(opened.project.images[0].data.includes('<svg'),true);
    assert.equal(opened.project.studyCards[0].back,'Risposta');
    assert.equal(opened.project.relationships[0].label,'segue');
    assert.deepEqual(opened.project.root.children.map(n=>n.id),['branch-a','branch-b']);
  });

  test('a damaged file and a workspace are refused',async()=>{
    const copy=await Transfer.prepareCopy(project(),{mapId:MAP,deviceId:PC,sha256,createdAt:'2026-11-06T21:00:00.000Z'});
    const env=JSON.parse(Transfer.sealFile(copy.handoff));
    env.bytes=env.bytes.replace('Mappa Centrale','Mappa Alterata');
    await assert.rejects(()=>Transfer.openFile(JSON.stringify(env),sha256),/integrity/);
    await assert.rejects(()=>Transfer.prepareCopy({schema:'NeuroMapArchitect-SingleTab-v6',tabs:[],root:{id:'a',text:'A',children:[]}},
      {mapId:MAP,deviceId:PC,sha256}),/workspace/);
  });

  test('inbox opens a new copy, rename stays cosmetic, and nothing is replaced',async()=>{
    const copy=await Transfer.prepareCopy(project(),{mapId:MAP,deviceId:PC,sha256,createdAt:'2026-11-06T21:00:00.000Z'});
    const verified=await Transfer.openFile(Transfer.sealFile(copy.handoff),sha256);
    const inbox=Transfer.createInbox();
    const first=inbox.receive(verified);
    const second=inbox.receive(verified);
    assert.equal(first.duplicate,false);
    assert.equal(second.duplicate,true);
    const renamed=inbox.rename(first.id,'Copia sul telefono');
    assert.equal(renamed.displayName,'Copia sul telefono');
    assert.equal(verified.project.root.text,'Mappa Centrale');
    const opened=inbox.accept(first.id,copy.handoff.manifest);
    assert.equal(opened.action,'open-new');
    assert.equal(opened.mayReplace,false);
    assert.equal(opened.project.root.id,'map-root');
    assert.equal(opened.project.root.color,'#6441df');
    inbox.reject(second.id);
    assert.equal(inbox.list().some(row=>row.id===second.id&&row.status==='rejected'),true);
    assert.throws(()=>inbox.accept(second.id),/pending/);
    inbox.remove(second.id);
    assert.equal(inbox.list().some(row=>row.id===second.id),false);
  });
});

describe('F11.2 pairing',()=>{
  test('both screens share a code and a wrong code releases no bytes',async()=>{
    const sender=await Transfer.createSender({project:project(),mapId:MAP,deviceId:PC,sha256,now:()=>CLOCK});
    const receiver=await Transfer.createReceiver();
    await receiver.takeQr(sender.qr(),()=>CLOCK);
    await sender.hello(receiver.helloBody(),()=>CLOCK);
    assert.equal(sender.confirmCode,receiver.confirmCode);
    assert.match(sender.confirmCode,/^\d{6}$/);
    await assert.rejects(()=>sender.chunk(0,'000000'),/not approved|Codes/);
    await assert.rejects(()=>sender.approve('000000'),/Codes/);
    await sender.approve(receiver.confirmCode);
    await receiver.approve(sender.confirmCode);
    let last=await sender.chunk(0,receiver.confirmCode);
    await receiver.takeChunk(last);
    for(let index=1;index<last.total;index++){
      last=await sender.chunk(index,sender.confirmCode);
      await receiver.takeChunk(last);
    }
    const verified=await receiver.finish(sha256);
    assert.equal(verified.project.root.text,'Mappa Centrale');
    assert.equal(verified.project.root.color,'#6441df');
    await assert.rejects(()=>sender.hello(receiver.helloBody(),()=>CLOCK),/already used/);
  });

  test('an expired QR and a cancel do not deliver the map',async()=>{
    const sender=await Transfer.createSender({project:project(),mapId:MAP,deviceId:PC,sha256,now:()=>CLOCK,ttlMs:1000});
    const receiver=await Transfer.createReceiver();
    await assert.rejects(()=>receiver.takeQr(sender.qr(),()=>CLOCK+5000),/expired/);
    const live=await Transfer.createSender({project:project(),mapId:MAP,deviceId:PHONE,sha256,now:()=>CLOCK});
    const other=await Transfer.createReceiver();
    await other.takeQr(live.qr(),()=>CLOCK);
    await live.hello(other.helloBody(),()=>CLOCK);
    assert.equal(live.cancel(),'cancelled');
    await assert.rejects(()=>live.chunk(0,live.confirmCode),/not approved|cancelled/);
  });
});

describe('F11.2 loopback socket',()=>{
  test('PC to phone transfers one map on 127.0.0.1 and then stops listening',async()=>{
    const sender=await Transfer.createSender({project:project(),mapId:MAP,deviceId:PC,sha256,now:()=>CLOCK,ttlMs:120000});
    const host=Lan.createLanHost(sender);
    try{
      const address=await host.address();
      assert.equal(address.host,'127.0.0.1');
      const origin='http://127.0.0.1:'+address.port;
      const qr=await host.qr();
      assert.equal(JSON.parse(qr).n.p,address.port);
      const verified=await Lan.receiveOverLan(origin,qr,sha256,{
        now:()=>CLOCK,
        confirm:async shown=>{
          assert.equal(shown,sender.confirmCode);
          await sender.approve(shown);
          return shown;
        }
      });
      assert.equal(verified.project.root.text,'Mappa Centrale');
      assert.equal(verified.project.images[0].name,'schema.svg');
      assert.equal(verified.project.studyCards[0].front,'Domanda');
      await Lan.post(origin,'/f11/v1/decision',{decision:'accept'});
    }finally{await host.stop();}
    const address=await host.address();
    await assert.rejects(()=>Lan.post('http://127.0.0.1:'+address.port,'/f11/v1/hello',{token:'x'}),/ECONNREFUSED|socket/);
  });

  test('a wrong code and a second hello are refused without the map',async()=>{
    const sender=await Transfer.createSender({project:project(),mapId:MAP,deviceId:PC,sha256,now:()=>CLOCK});
    const host=Lan.createLanHost(sender);
    try{
      const origin='http://127.0.0.1:'+(await host.address()).port;
      const receiver=await Transfer.createReceiver();
      await receiver.takeQr(await host.qr(),()=>CLOCK);
      await Lan.post(origin,'/f11/v1/hello',receiver.helloBody());
      await assert.rejects(()=>Lan.post(origin,'/f11/v1/hello',receiver.helloBody()),error=>error.status===409);
      await assert.rejects(()=>Lan.post(origin,'/f11/v1/chunk',{index:0,code:'000000'}));
    }finally{await host.stop();}
  });

  test('binding beyond loopback requires an explicit choice',()=>{
    assert.throws(()=>Lan.createLanHost({},{host:'0.0.0.0'}),/lan:true/);
  });

  test('password-protected .glk files encrypt with AES-GCM and reject wrong passwords',async()=>{
    const copy=await Transfer.prepareCopy(project(),{mapId:MAP,deviceId:PC,sha256,createdAt:new Date(CLOCK).toISOString()});
    const locked=await Transfer.sealPasswordFile(copy.handoff,'segreto-glauka-2026');
    assert.equal(Transfer.isPasswordFile(locked),true);
    assert.equal(locked.includes('Mappa Centrale'),false);
    await assert.rejects(()=>Transfer.openPasswordFile(locked,'sbagliata',sha256),/Password errata/);
    const verified=await Transfer.openPasswordFile(locked,'segreto-glauka-2026',sha256);
    assert.equal(verified.project.root.text,'Mappa Centrale');
  });

  test('deriveLanChannel matches 6-digit code across peers and detects MITM pin mismatch',async()=>{
    const copy=await Transfer.prepareCopy(project(),{mapId:MAP,deviceId:PC,sha256,createdAt:new Date(CLOCK).toISOString()});
    const a=await Transfer.pairKeys(),b=await Transfer.pairKeys();
    const chA=await Transfer.deriveLanChannel(a.privateKey,b.publicJwk,'deadbeef'.repeat(8),'sess-1');
    const chB=await Transfer.deriveLanChannel(b.privateKey,a.publicJwk,'deadbeef'.repeat(8),'sess-1');
    const mitm=await Transfer.deriveLanChannel(b.privateKey,a.publicJwk,'cafebabe'.repeat(8),'sess-1');
    assert.equal(chA.confirmCode,chB.confirmCode);
    assert.notEqual(chA.confirmCode,mitm.confirmCode);
    const chunks=await chA.encryptProject(copy.handoff);
    const opened=await chB.decryptChunks(chunks,sha256);
    assert.equal(opened.project.root.text,'Mappa Centrale');
  });
});
