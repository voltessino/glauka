/* F11.2 — optional local transfer socket.
 * Nothing listens until start(). The default bind is loopback.
 * A LAN address is used only when the caller passes lan:true.
 */
'use strict';
const http=require('http');
const Transfer=require('./transfer');

const MAX_BODY=26*1024*1024;

function readBody(req){
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0;
    req.on('data',chunk=>{
      size+=chunk.length;
      if(size>MAX_BODY){reject(Error('Body too large'));req.destroy();return;}
      chunks.push(chunk);
    });
    req.on('end',()=>{
      try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'));}
      catch(error){reject(error);}
    });
    req.on('error',reject);
  });
}
function send(res,status,body){
  const raw=JSON.stringify(body);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'content-length':Buffer.byteLength(raw)});
  res.end(raw);
}
function createLanHost(sender,{host='127.0.0.1',port=0,lan=false}={}){
  if(!sender)throw Error('Missing sender');
  if(lan!==true&&host!=='127.0.0.1'&&host!=='localhost')
    throw Error('LAN bind requires an explicit lan:true');
  let server=null,closed=false;
  const close=()=>new Promise(resolve=>{
    if(!server||closed){closed=true;resolve();return;}
    closed=true;server.close(()=>resolve());
  });
  async function handle(req,res){
    try{
      if(req.method!=='POST'){send(res,404,{error:'Not found'});return;}
      const body=await readBody(req);
      if(req.url==='/f11/v1/hello'){
        const result=await sender.hello(body);
        send(res,200,result);return;
      }
      if(req.url==='/f11/v1/chunk'){
        const chunk=await sender.chunk(body.index,body.code);
        send(res,200,chunk);return;
      }
      if(req.url==='/f11/v1/decision'){
        const state=sender.decide(body.decision);
        send(res,200,{state});
        if(state==='accepted'||state==='rejected'||state==='cancelled')close();
        return;
      }
      send(res,404,{error:'Not found'});
    }catch(error){
      const message=String(error.message||error);
      const status=/expired/i.test(message)?410:/already used/i.test(message)?409:
        /token|code|not approved/i.test(message)?403:400;
      if(!res.headersSent)send(res,status,{error:message});
    }
  }
  server=http.createServer(handle);
  const started=new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,host,()=>{
      const address=server.address();
      resolve({host:address.address,port:address.port});
    });
  });
  return Object.freeze({
    ready:started,
    async address(){return started;},
    qr:async()=>{const address=await started;return sender.qr({host:address.address==='::1'?'127.0.0.1':address.host,port:address.port});},
    stop:close
  });
}
function post(origin,path,body){
  const url=new URL(path,origin);
  const raw=JSON.stringify(body);
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:url.hostname,port:url.port,path:url.pathname,method:'POST',
      headers:{'content-type':'application/json','content-length':Buffer.byteLength(raw)}},res=>{
      const chunks=[];
      res.on('data',chunk=>chunks.push(chunk));
      res.on('end',()=>{
        const text=Buffer.concat(chunks).toString('utf8');
        let parsed=null;try{parsed=JSON.parse(text);}catch{parsed={error:text};}
        if(res.statusCode!==200)reject(Object.assign(Error(parsed.error||'Transfer failed'),{status:res.statusCode,body:parsed}));
        else resolve(parsed);
      });
    });
    req.on('error',reject);req.end(raw);
  });
}
async function receiveOverLan(origin,qr,sha256,{now,confirm}={}){
  const receiver=await Transfer.createReceiver();
  await receiver.takeQr(qr,now);
  await post(origin,'/f11/v1/hello',receiver.helloBody());
  const typed=await confirm(receiver.confirmCode);
  if(typed!==receiver.confirmCode)throw Error('Codes do not match');
  await receiver.approve(typed);
  let guard=0;
  for(;;){
    const chunk=await post(origin,'/f11/v1/chunk',{index:guard,code:typed});
    const progress=await receiver.takeChunk(chunk);
    guard++;
    if(progress.received===progress.total)break;
    if(guard>progress.total+1)throw Error('Transfer did not finish');
  }
  return receiver.finish(sha256);
}
module.exports={createLanHost,receiveOverLan,post};
