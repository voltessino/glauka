/* NeuroMap 7 — stack-safe JSON serialization for exceptionally deep maps.
 * Shallow/normal files use native JSON.stringify unchanged. Only stack-overflow
 * cases use compact iterative JSON to avoid quadratic pretty-print indentation.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.NeuroMapSafeJSON=api;
})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
function normalized(value,key){
  return value&&typeof value==='object'&&typeof value.toJSON==='function'
    ?value.toJSON(key):value;
}
function omitted(value){
  return value===undefined||typeof value==='function'||typeof value==='symbol';
}
function stringifyIterative(value){
  const chunks=[],active=new Set();
  const queue=[{kind:'value',value,key:'',ready:false}];
  while(queue.length){
    const step=queue.pop();
    if(step.kind==='value'){
      const current=step.ready?step.value:normalized(step.value,step.key);
      if(current===null){chunks.push('null');continue;}
      const type=typeof current;
      if(type!=='object'){
        const encoded=JSON.stringify(current);
        if(encoded===undefined)return undefined;
        chunks.push(encoded);continue;
      }
      // JSON's boxed primitive handling is not equivalent to a plain object.
      const tag=Object.prototype.toString.call(current);
      if(tag==='[object Number]'||tag==='[object String]'||tag==='[object Boolean]'||
         tag==='[object BigInt]'){
        chunks.push(JSON.stringify(current));continue;
      }
      if(active.has(current))throw new TypeError('Converting circular structure to JSON');
      active.add(current);
      if(Array.isArray(current)){
        chunks.push('[');
        queue.push({kind:'array',value:current,index:0,length:current.length});
      }else{
        chunks.push('{');
        queue.push({kind:'object',value:current,keys:Object.keys(current),index:0,first:true});
      }
      continue;
    }
    if(step.kind==='array'){
      if(step.index>=step.length){
        chunks.push(']');active.delete(step.value);continue;
      }
      if(step.index)chunks.push(',');
      const index=step.index++,current=normalized(step.value[index],String(index));
      queue.push(step);
      if(omitted(current)){chunks.push('null');continue;}
      queue.push({kind:'value',value:current,ready:true});
      continue;
    }
    if(step.kind==='object'){
      let found=false;
      while(step.index<step.keys.length){
        const key=step.keys[step.index++];
        const current=normalized(step.value[key],key);
        if(omitted(current))continue;
        if(!step.first)chunks.push(',');
        chunks.push(JSON.stringify(key),':');
        step.first=false;found=true;
        queue.push(step);
        queue.push({kind:'value',value:current,ready:true});
        break;
      }
      if(!found){chunks.push('}');active.delete(step.value);}
    }
  }
  return chunks.join('');
}
function stringify(value,space){
  try{return JSON.stringify(value,null,space);}
  catch(error){
    // Do not conceal application bugs, BigInt errors, or cyclic objects.
    if(!error||!['RangeError','InternalError'].includes(error.name)||
       !/stack|recursion|depth/i.test(String(error.message)))throw error;
    return stringifyIterative(value);
  }
}
return Object.freeze({stringify,stringifyIterative});
});
