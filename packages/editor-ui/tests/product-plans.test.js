'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
for(const platform of ['desktop-shared','android']){
 function setup(){
  let nativeState={plan:'free'},fail=false;const calls=[];
  const native={productStatus:()=>{if(fail)throw Error('offline');return nativeState;},productActivate:key=>{calls.push(['activate',key]);if(key!=='signed-fixture')throw Error('Invalid signature');return nativeState={plan:'pro',owner:true,previewMode:'full'};},productPreviewMode:mode=>{calls.push(['mode',mode]);if(!nativeState.owner)throw Error('Owner required');return nativeState={...nativeState,plan:mode==='free'?'free':'pro',previewMode:mode};},productLogout:()=>{return nativeState={plan:'free'};}};
  const android=Object.fromEntries(Object.entries(native).map(([key,fn])=>[key,(...args)=>{try{return JSON.stringify(fn(...args));}catch(e){return JSON.stringify({error:e.message});}}]));
  const window=platform==='android'?{NMAndroidAI:android}:{neuromapDesktop:native};
  const context=vm.createContext({window,document:{getElementById:()=>null},nmLocale:()=> 'en',nmT:k=>k,localStorage:{getItem:()=> 'yes'},console});
  // Desktop product licensing was extracted from shell.js into the source
  // staged immediately before it; Android continues to own its local shell.
  const productSource='shell-product-locale.js';
  const shell=fs.readFileSync(path.join(__dirname,'../../../apps',platform,'editor',productSource),'utf8');const start=shell.indexOf('const nativeProduct=');
  const endMarker='window.nmProduct=nmProduct;';
  const end=shell.indexOf(endMarker,start)+endMarker.length;
  assert.ok(start>=0&&end>start+endMarker.length,'product licensing code not found in '+productSource);vm.runInContext(shell.slice(start,end),context);
  return {product:window.nmProduct,calls,fail:()=>{fail=true;}};
 }
 test(platform+' localStorage cannot grant AI, signed native activation and owner previews control access',async()=>{
  const {product,calls}=setup();await product.status();assert.equal(product.guard(),false);await assert.rejects(product.activate('voltes'),/Invalid signature/);assert.equal(product.isPro(),false);
  await product.activate('signed-fixture');assert.equal(product.guard(),true);await product.preview('free');assert.equal(product.guard(),false);await product.status();assert.equal(product.isPro(),false);
  await product.preview('pro');assert.equal(product.guard(),true);await product.logout();assert.equal(product.guard(),false);await assert.rejects(product.preview('pro'),/Owner required/);assert.equal(calls.filter(c=>c[0]==='mode').length,3);
 });
 test(platform+' unavailable native entitlement service cannot grant Pro',async()=>{const fixture=setup();await fixture.product.activate('signed-fixture');fixture.fail();await fixture.product.status();assert.equal(fixture.product.isPro(),false);});
}
