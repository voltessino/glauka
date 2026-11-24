'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.resolve(__dirname,'../../../apps/desktop-shared/src/bridge.js'),'utf8')
    .replace("'{{TOKEN}}'","'test-ui-session'")
    .replace('{{DEV_EDITION}}','false');

function harness({importError=null,firstAckFails=false,invalidFile=false,skip=false}={}){
    const id='A'.repeat(43);
    const timers=[],states={pending:true,acks:[],imports:[],notices:[],reads:0},memory=new Map();
    let now=100000,failedAck=false;
    const response=(status,body,extra={})=>({
        status,ok:status>=200&&status<300,
        headers:{get:k=>extra[k]||null},
        json:async()=>body,
        arrayBuffer:async()=>Uint8Array.from([65,66,67]).buffer
    });
    const window={
        addEventListener(){},focus(){},
        sessionStorage:{getItem:key=>memory.get(key)||null,setItem:(key,val)=>memory.set(key,val)},
        neuroMapApp:{showToast:text=>states.notices.push(text)}
    };
    const fetch=async(url,options)=>{
        if(url.endsWith('/external/pending')){
            states.reads++;
            if(!states.pending)return response(204,{});
            if(invalidFile)return response(409,{message:'missing file'},
                {'X-Glauka-Delivery-ID':id});
            return response(200,{},{
                'X-Glauka-Delivery-ID':id,
                'X-NeuroMap-Filename':'bWFwLmdr',
                'X-NeuroMap-Path':'L3RtcC9tYXAuZ2s'
            });
        }
        if(url.endsWith('/external/confirm')){
            const {id:sent,action}=JSON.parse(options.body);
            states.acks.push({id:sent,action});
            if(firstAckFails&&!failedAck){
                failedAck=true;
                return response(503,{message:'temporary failure'});
            }
            states.pending=false;
            return response(200,{ok:true});
        }
        return response(200,{});
    };
    const globals={
        window,document:{hidden:false,addEventListener(){}},
        setInterval(callback,ms){timers.push({callback,ms});return timers.length;},
        clearInterval(){},
        setTimeout,clearTimeout,fetch,crypto:{randomUUID:()=> '550e8400-e29b-41d4-a716-446655440000'},
        TextEncoder,TextDecoder,Uint8Array,
        Date:{now:()=>now},
        atob:(input)=>Buffer.from(input,'base64').toString('binary'),
        btoa:(input)=>Buffer.from(input,'binary').toString('base64'),
        console:{warn(){}}
    };
    window.confirm=()=>skip;
    vm.runInNewContext(source,globals,{filename:'production-bridge.js'});
    window.neuromapDesktop.onExternalFile(async payload=>{
        states.imports.push({filename:payload.filename,path:payload.path,bytes:[...payload.bytes]});
        if(importError)throw importError;
        return true;
    });
    async function tick(afterMs=1000){
        now+=afterMs;
        const poll=timers.find(t=>t.ms===900);
        assert.ok(poll);
        await poll.callback();
        await new Promise(resolve=>setImmediate(resolve));
    }
    return {states,tick,memory};
}
test('shared Mac/Windows external imports ACK only after success',async()=>{
    const h=harness();
    await h.tick();
    assert.equal(h.states.imports.length,1);
    assert.deepEqual(h.states.imports[0].bytes,[65,66,67]);
    assert.equal(h.states.acks.length,1);
    assert.equal(h.states.acks[0].action,'imported');
    assert.equal(h.states.pending,false);
});
test('a rejected import is not acknowledged or silently discarded',async()=>{
    const h=harness({importError:new Error('invalid map')});
    await h.tick();
    assert.equal(h.states.imports.length,1);
    assert.equal(h.states.acks.length,0);
    assert.equal(h.states.pending,true);
    assert.ok(h.states.notices.some(x=>x.includes('invalid map')));
});
test('a failed ACK retries without importing the same document twice',async()=>{
    const h=harness({firstAckFails:true});
    await h.tick();
    assert.equal(h.states.imports.length,1);
    assert.equal(h.states.acks.length,1);
    await h.tick(6000);
    assert.equal(h.states.imports.length,1);
    assert.equal(h.states.acks.length,2);
    assert.equal(h.states.pending,false);
});
test('unreadable files can only be dropped after explicit Skip',async()=>{
    const h=harness({invalidFile:true,skip:true});
    await h.tick();
    assert.equal(h.states.imports.length,0);
    assert.equal(h.states.acks.length,1);
    assert.equal(h.states.acks[0].action,'skip');
});
