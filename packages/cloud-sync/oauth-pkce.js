/* OAuth 2.0 PKCE S256 authorization coordinator.
 * Refresh/access tokens NEVER enter JavaScript; the native broker exchanges
 * authorization codes and keeps all credentials in the OS secret store.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GlaukaCloudOAuth=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const profiles=Object.freeze({
  google:Object.freeze({
   endpoint:'https://accounts.google.com/o/oauth2/v2/auth',
   scope:'https://www.googleapis.com/auth/drive.file'
  }),
  dropbox:Object.freeze({
   endpoint:'https://www.dropbox.com/oauth2/authorize',
   scope:'files.content.read files.content.write files.metadata.read files.metadata.write'
  })
 });
 function base64url(bytes){
  let text='';for(const byte of bytes)text+=String.fromCharCode(byte);
  return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
 }
 async function pkce(random,subtle){
  if(!random||!subtle?.digest)throw Error('Secure OS random generator and SHA-256 required');
  const key=new Uint8Array(32),stateBytes=new Uint8Array(32);
  random(key);random(stateBytes);
  const verifier=base64url(key);
  const sha=new Uint8Array(await subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  return {verifier,challenge:base64url(sha),state:base64url(stateBytes)};
 }
 function createBroker({native,random,subtle}={}){
  if(typeof native?.openBrowser!=='function'||typeof native?.exchangeCode!=='function'||
    typeof native?.disconnect!=='function')throw Error('Secure native OAuth broker unavailable');
  let pending=null;
  async function connect({provider,clientId,redirectUri}){
   if(pending)throw Error('Authorization already in progress');
   if(!profiles[provider]||!clientId||!redirectUri)throw Error('OAuth configuration missing');
   // Native validates callback scheme/domain ownership and registered client
   // type: loopback desktop, verified Android App Link on Android.
   if(!native.isAllowedRedirect?.(provider,redirectUri))throw Error('Untrusted OAuth callback');
   const p=await pkce(random,subtle);
   const u=new URL(profiles[provider].endpoint);
   u.searchParams.set('client_id',clientId);
   u.searchParams.set('response_type','code');
   u.searchParams.set('redirect_uri',redirectUri);
   u.searchParams.set('scope',profiles[provider].scope);
   u.searchParams.set('state',p.state);
   u.searchParams.set('code_challenge_method','S256');
   u.searchParams.set('code_challenge',p.challenge);
   if(provider==='google'){
    u.searchParams.set('access_type','offline');
    u.searchParams.set('prompt','consent');
   }else u.searchParams.set('token_access_type','offline');
   pending={provider,clientId,redirectUri,...p};
   try{await native.openBrowser(u.toString());}
   catch(error){pending=null;throw error}
   return {provider,started:true};
  }
  async function complete({code,state,error}){
   if(!pending)throw Error('No authorization in progress');
   const data=pending;pending=null;
   if(error)throw Error('OAuth authorization cancelled or denied');
   if(typeof code!=='string'||code.length<4||code.length>4096||
      typeof state!=='string'||state!==data.state)throw Error('Invalid OAuth state');
   // Native will validate provider, callback, response, token type and scopes;
   // it must store tokens in Windows Credential Manager / macOS Keychain /
   // Android Keystore BEFORE reporting connected=true to the web content.
   await native.exchangeCode({
    provider:data.provider,clientId:data.clientId,redirectUri:data.redirectUri,
    code,verifier:data.verifier
   });
   return {provider:data.provider,connected:true};
  }
  async function disconnect(provider){
   if(!profiles[provider])throw Error('Unsupported provider');
   await native.disconnect(provider);
   return {provider,connected:false};
  }
  function cancel(){pending=null}
  return Object.freeze({connect,complete,disconnect,cancel});
 }
 return Object.freeze({profiles,pkce,createBroker});
});
