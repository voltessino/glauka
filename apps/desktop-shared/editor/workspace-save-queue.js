/* NeuroMap Desktop local workspace autosave serialization.
 * One native disk write at a time. While a write is pending, keep only the
 * newest queued snapshot. Older pending callers settle with that newest write.
 * Browser-only and project file saves use their existing independent paths.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.NeuroMapWorkspaceWriteQueue=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create(write){
    if(typeof write!=='function')throw new TypeError('workspace writer must be a function');
    let active=false,pending=null,idleWaiters=[];
    function notifyIdle(){if(active||pending)return;for(const resolve of idleWaiters.splice(0))resolve();}
    function drain(){
      if(active)return;
      active=true;
      // Microtask start lets several synchronous edits collapse into one write.
      void Promise.resolve().then(async()=>{
        try{
          while(pending){
            const job=pending;
            pending=null;
            try{
              await write(job.json);
              for(const settle of job.waiters)settle.resolve(true);
            }catch(error){
              for(const settle of job.waiters)settle.reject(error);
            }
          }
        }finally{
          active=false;
          if(pending)drain();else notifyIdle();
        }
      });
    }
    return Object.freeze({
      write(json){
        if(typeof json!=='string')return Promise.reject(new TypeError('workspace must be serialized JSON'));
        return new Promise((resolve,reject)=>{
          if(pending){
            // An older pending value must never be persisted after the newest
            // request. Its promise is satisfied by the newest durable snapshot.
            pending.json=json;
            pending.waiters.push({resolve,reject});
          }else pending={json,waiters:[{resolve,reject}]};
          drain();
        });
      },
      isIdle(){return !active&&!pending;},
      whenIdle(){return !active&&!pending?Promise.resolve():new Promise(resolve=>idleWaiters.push(resolve));}
    });
  }
  return Object.freeze({create});
});
