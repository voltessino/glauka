package main

// The desktop OAuth broker never returns access/refresh tokens to JavaScript.
// Tokens are sealed with Windows DPAPI / macOS Keychain-derived AES-GCM using
// protectSecret. The local OAuth callback is single-use and CSRF-state bound.
import (
 "context"
 "crypto/rand"
 "crypto/sha256"
 "crypto/subtle"
 "encoding/base64"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "net/http"
 "net/url"
 "os"
 "os/exec"
 "path/filepath"
 "regexp"
 "runtime"
 "strings"
 "sync"
 "time"
)

var cloudClientIDPattern=regexp.MustCompile("^[A-Za-z0-9._-]{6,250}$")

const defaultGoogleDesktopClientID="853375558787-det33paij7euu7d03vagea1lkq8d2rb2.apps.googleusercontent.com"

// Optional build-time secret injected only via -ldflags "-X main.embeddedGoogleClientSecret=..."
// during private release builds; never commit secrets in source control.
var embeddedGoogleClientSecret=""

type cloudOAuthPending struct {
 provider,clientID,verifier,state,redirect string
 expires time.Time
}
type cloudOAuthTokens struct {
 Access string `json:"access_token"`
 Refresh string `json:"refresh_token"`
 Type string `json:"token_type"`
 Expiry time.Time `json:"expiry"`
 ClientID string `json:"client_id"`
}
type cloudAuthState struct {
 mu sync.Mutex
 pending *cloudOAuthPending
}

var cloudCredentialMu sync.Mutex

func cloudProviderConfig(provider string)(clientID,authorizeURL,tokenURL,scope string,err error){
 switch provider {
 case "google":
  clientID=strings.TrimSpace(os.Getenv("GLAUKA_GOOGLE_CLIENT_ID"))
  authorizeURL="https://accounts.google.com/o/oauth2/v2/auth"
  tokenURL="https://oauth2.googleapis.com/token"
  scope="https://www.googleapis.com/auth/drive.file"
 case "dropbox":
  clientID=strings.TrimSpace(os.Getenv("GLAUKA_DROPBOX_APP_KEY"))
  authorizeURL="https://www.dropbox.com/oauth2/authorize"
  tokenURL="https://api.dropboxapi.com/oauth2/token"
  scope="files.content.read files.content.write files.metadata.read files.metadata.write"
 case "onedrive":
  clientID=strings.TrimSpace(os.Getenv("GLAUKA_ONEDRIVE_CLIENT_ID"))
  authorizeURL="https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
  tokenURL="https://login.microsoftonline.com/common/oauth2/v2.0/token"
  scope="offline_access Files.ReadWrite.AppFolder"
 default:return "","","","",errors.New("provider non supportato")
 }
 if !cloudClientIDPattern.MatchString(clientID) {
  return "","","","",errors.New("client ID OAuth non configurato")
 }
 return
}

type cloudPublicOAuthSettings struct {
 Google string `json:"google"`
 Dropbox string `json:"dropbox"`
 OneDrive string `json:"onedrive"`
 DropboxRedirectURI string `json:"dropboxRedirectURI"`
}
func cloudPublicOAuthPath(dir string)string{return filepath.Join(dir,"cloud-sync","public-oauth-clients.json")}
func cloudReadPublicOAuth(dir string)(cloudPublicOAuthSettings,error){
 var current cloudPublicOAuthSettings
 data,err:=cloudReadRegular(cloudPublicOAuthPath(dir),4096)
 if errors.Is(err,os.ErrNotExist){return current,nil}
 if err!=nil{return current,err}
 if err=json.Unmarshal(data,&current);err!=nil{return cloudPublicOAuthSettings{},errors.New("Invalid public OAuth settings")}
 return current,nil
}
func cloudProviderConfigForDir(provider,dir string)(clientID,authorizeURL,tokenURL,scope string,err error){
 clientID,authorizeURL,tokenURL,scope,err=cloudProviderConfig(provider)
 if err==nil{return}
 cfg,readErr:=cloudReadPublicOAuth(dir)
 if readErr!=nil{return "","","","",readErr}
 switch provider{
 case "google":
  clientID=strings.TrimSpace(cfg.Google)
  if clientID==""{clientID=defaultGoogleDesktopClientID}
  authorizeURL="https://accounts.google.com/o/oauth2/v2/auth"
  tokenURL="https://oauth2.googleapis.com/token"
  scope="https://www.googleapis.com/auth/drive.file"
 case "dropbox":
  clientID=strings.TrimSpace(cfg.Dropbox)
  authorizeURL="https://www.dropbox.com/oauth2/authorize"
  tokenURL="https://api.dropboxapi.com/oauth2/token"
  scope="files.content.read files.content.write files.metadata.read files.metadata.write"
 case "onedrive":
  clientID=strings.TrimSpace(cfg.OneDrive)
  authorizeURL="https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
  tokenURL="https://login.microsoftonline.com/common/oauth2/v2.0/token"
  scope="offline_access Files.ReadWrite.AppFolder"
 default:return "","","","",errors.New("provider non supportato")
 }
 if !cloudClientIDPattern.MatchString(clientID){return "","","","",errors.New("client ID OAuth non configurato")}
 return clientID,authorizeURL,tokenURL,scope,nil
}
func cloudPublicCallback(dir string)string{
 cfg,err:=cloudReadPublicOAuth(dir)
 if err!=nil{return ""}
 return strings.TrimSpace(cfg.DropboxRedirectURI)
}

func cloudCryptoRandom(n int)(string,error){
 b:=make([]byte,n)
 if _,err:=rand.Read(b);err!=nil{return "",err}
 return base64.RawURLEncoding.EncodeToString(b),nil
}
func cloudSealedPath(dir,provider string)string{
 return filepath.Join(dir,"cloud-sync","oauth-"+provider+".vault")
}
func cloudGoogleClientSecretPath(dir string)string{
 return filepath.Join(dir,"cloud-sync","oauth-google-client.vault")
}
func cloudGoogleClientSecret(configDir string)string{
 if env:=strings.TrimSpace(os.Getenv("GLAUKA_GOOGLE_CLIENT_SECRET"));env!=""{
  return env
 }
 if configDir!=""{
  file:=cloudGoogleClientSecretPath(configDir)
  st,err:=os.Lstat(file)
  if err==nil&&st.Mode().IsRegular()&&st.Size()<=4096{
   if sealed,err:=os.ReadFile(file);err==nil{
    if raw,err:=protectSecret(sealed,true);err==nil{
     if s:=strings.TrimSpace(string(raw));s!=""{return s}
    }
   }
  }
 }
 return strings.TrimSpace(embeddedGoogleClientSecret)
}
func cloudSaveGoogleClientSecret(configDir,secret string)error{
 secret=strings.TrimSpace(secret)
 if secret==""{return nil}
 if len(secret)>512{return errors.New("client secret troppo lungo")}
 sealed,err:=protectSecret([]byte(secret),false)
 if err!=nil{return errors.New("archivio segreti non disponibile")}
 return atomicFile(cloudGoogleClientSecretPath(configDir),sealed)
}
func cloudReadTokens(configDir,provider string)(cloudOAuthTokens,error){
 var value cloudOAuthTokens
 if provider!="google"&&provider!="dropbox"&&provider!="onedrive"{return value,errors.New("provider non valido")}
 file:=cloudSealedPath(configDir,provider)
 st,err:=os.Lstat(file)
 if err!=nil{return value,err}
 if !st.Mode().IsRegular()||st.Size()>16384{return value,errors.New("credenziali non valide")}
 sealed,err:=os.ReadFile(file)
 if err!=nil{return value,err}
 raw,err:=protectSecret(sealed,true)
 if err!=nil{return value,errors.New("credenziali non sbloccabili")}
 if len(raw)>12000||json.Unmarshal(raw,&value)!=nil||
  value.Access==""||value.Refresh==""||value.ClientID==""{
  return cloudOAuthTokens{},errors.New("credenziali incomplete")
 }
 return value,nil
}
func cloudSaveTokens(configDir,provider string,t cloudOAuthTokens)error{
 if provider!="google"&&provider!="dropbox"&&provider!="onedrive"||t.Access==""||t.Refresh==""||t.ClientID==""{
  return errors.New("credenziali incomplete")
 }
 serialized,err:=json.Marshal(t)
 if err!=nil{return err}
 sealed,err:=protectSecret(serialized,false)
 if err!=nil{return errors.New("archivio segreti non disponibile")}
 return atomicFile(cloudSealedPath(configDir,provider),sealed)
}
var cloudHTTPClient=&http.Client{
 Timeout:20*time.Second,
 CheckRedirect:func(*http.Request,[]*http.Request)error{
  return errors.New("OAuth redirect HTTP non autorizzato")
 },
}
type cloudOAuthError struct{
 Status int
 Code string
}
func (e *cloudOAuthError)Error()string{
 if e.Code!=""{return fmt.Sprintf("provider OAuth HTTP %d (%s)",e.Status,e.Code)}
 return fmt.Sprintf("provider OAuth HTTP %d",e.Status)
}
func cloudSafeOAuthErrorCode(body []byte)string{
 var payload struct{
  Error string `json:"error"`
 }
 if json.Unmarshal(body,&payload)!=nil{return ""}
 switch strings.TrimSpace(payload.Error){
 case "invalid_request","invalid_client","invalid_grant","unauthorized_client","access_denied","unsupported_grant_type","invalid_scope":
  return strings.TrimSpace(payload.Error)
 default:
  return ""
 }
}
func cloudFormToken(ctx context.Context,provider string,values url.Values,configDir ...string)(cloudOAuthTokens,error){
 var tokenURL string
 var err error
 if len(configDir)>0{_,_,tokenURL,_,err=cloudProviderConfigForDir(provider,configDir[0])
 }else{_,_,tokenURL,_,err=cloudProviderConfig(provider)}
 if err!=nil{return cloudOAuthTokens{},err}
 req,err:=http.NewRequestWithContext(ctx,"POST",tokenURL,strings.NewReader(values.Encode()))
 if err!=nil{return cloudOAuthTokens{},err}
 req.Header.Set("Content-Type","application/x-www-form-urlencoded")
 response,err:=cloudHTTPClient.Do(req)
 if err!=nil{return cloudOAuthTokens{},errors.New("provider OAuth non raggiungibile")}
 defer response.Body.Close()
 if response.StatusCode!=200{
  errBody,_:=io.ReadAll(io.LimitReader(response.Body,4096))
  return cloudOAuthTokens{},&cloudOAuthError{Status:response.StatusCode,Code:cloudSafeOAuthErrorCode(errBody)}
 }
 limited,err:=io.ReadAll(io.LimitReader(response.Body,16385))
 if err!=nil||len(limited)>16384{return cloudOAuthTokens{},errors.New("risposta OAuth non valida")}
 var reply struct{
  AccessToken string `json:"access_token"`
  RefreshToken string `json:"refresh_token"`
  TokenType string `json:"token_type"`
  ExpiresIn int64 `json:"expires_in"`
 }
 if json.Unmarshal(limited,&reply)!=nil||reply.AccessToken==""||
  (reply.TokenType!=""&&!strings.EqualFold(reply.TokenType,"bearer"))||
  reply.ExpiresIn<=0||reply.ExpiresIn>86400{
  return cloudOAuthTokens{},errors.New("risposta OAuth incompleta")
 }
 return cloudOAuthTokens{
  Access:reply.AccessToken,Refresh:reply.RefreshToken,Type:"Bearer",
  Expiry:time.Now().Add(time.Duration(reply.ExpiresIn)*time.Second),
 },nil
}
func cloudOpenBrowser(raw string)error{
 // Only provider-generated HTTPS OAuth URLs reach this helper, never a URL
 // supplied by an arbitrary web page or cloud response.
 u,err:=url.Parse(raw)
 if err!=nil||u.Scheme!="https"||(u.Host!="accounts.google.com"&&u.Host!="www.dropbox.com"&&u.Host!="login.microsoftonline.com"){
  return errors.New("URL OAuth non autorizzato")
 }
 switch runtime.GOOS{
 case "windows":return exec.Command("rundll32","url.dll,FileProtocolHandler",raw).Start()
 case "darwin":return exec.Command("open",raw).Start()
 default:return errors.New("OAuth native disponibile solo per Windows e macOS")
 }
}
func cloudLoopbackHost(host string)bool{
 parsed,err:=url.Parse("http://"+host)
 if err!=nil{return false}
 return parsed.Hostname()=="127.0.0.1" && parsed.Port()!=""
}
// Revocation is best effort: always clear local credentials even if the
// network is down, and report revoked=false so UI never claims remote success.
func cloudRevoke(ctx context.Context,provider string,t cloudOAuthTokens)bool{
 var req *http.Request
 var err error
 if provider=="google"{
  values:=url.Values{"token":{t.Refresh}}
  req,err=http.NewRequestWithContext(ctx,"POST","https://oauth2.googleapis.com/revoke",
   strings.NewReader(values.Encode()))
  if err==nil{req.Header.Set("Content-Type","application/x-www-form-urlencoded")}
 }else if provider=="dropbox"{
  req,err=http.NewRequestWithContext(ctx,"POST","https://api.dropboxapi.com/2/auth/token/revoke",nil)
  if err==nil{req.Header.Set("Authorization","Bearer "+t.Access)}
 }else{return false} // No Microsoft token-specific revoke API: remove the local vault.
 if err!=nil{return false}
 reply,err:=cloudHTTPClient.Do(req)
 if err!=nil{return false}
 defer reply.Body.Close()
 return reply.StatusCode>=200&&reply.StatusCode<300
}

func (s *service) cloudOAuthRoutes(mux *http.ServeMux) {
 auth:=&cloudAuthState{}
 mux.HandleFunc("/__desktop/cloud/auth/status",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  result:=map[string]any{"supported":runtime.GOOS=="windows"||runtime.GOOS=="darwin"}
  for _,p:=range []string{"google","dropbox","onedrive"}{
   _,_,_,_,err:=cloudProviderConfigForDir(p,s.configDir)
   if err!=nil{result[p]=map[string]any{"configured":false,"connected":false};continue}
   cloudCredentialMu.Lock()
   t,er:=cloudReadTokens(s.configDir,p)
   cloudCredentialMu.Unlock()
   result[p]=map[string]any{"configured":true,"connected":er==nil,"expiresAt":func()int64{
    if er!=nil{return 0};return t.Expiry.Unix()
   }()}
  }
  responseJSON(w,200,result)
 })
 mux.HandleFunc("/__desktop/cloud/auth/public-config",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  if !cloudLoopbackHost(r.Host){responseJSON(w,403,response{Message:"Invalid loopback host"});return}
  cfg,err:=cloudReadPublicOAuth(s.configDir)
  if err!=nil{responseJSON(w,500,response{Message:"Cloud settings unavailable"});return}
  responseJSON(w,200,map[string]any{"google":cfg.Google,"dropbox":cfg.Dropbox,"onedrive":cfg.OneDrive,
   "googleSecretConfigured":cloudGoogleClientSecret(s.configDir)!="",
   "dropboxRedirectURI":cfg.DropboxRedirectURI,
   "callback":"http://"+r.Host+"/__desktop/cloud/oauth/callback"})
 })
 mux.HandleFunc("/__desktop/cloud/auth/public-config/write",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  if !cloudLoopbackHost(r.Host){responseJSON(w,403,response{Message:"Invalid loopback host"});return}
  var input struct{
   Provider string `json:"provider"`
   ClientID string `json:"clientID"`
   ClientSecret string `json:"clientSecret"`
   RedirectURI string `json:"redirectURI"`
  }
  if !readJSON(w,r,&input,4096){return}
  input.ClientID=strings.TrimSpace(input.ClientID)
  if !cloudClientIDPattern.MatchString(input.ClientID)||
   (input.Provider!="google"&&input.Provider!="dropbox"&&input.Provider!="onedrive"){
   responseJSON(w,400,response{Message:"Invalid OAuth public client ID"});return
  }
  if input.Provider=="google"&&!strings.HasSuffix(input.ClientID,".apps.googleusercontent.com"){
   responseJSON(w,400,response{Message:"Google requires a Desktop OAuth Client ID"});return
  }
  if input.Provider=="onedrive"&&!regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`).MatchString(input.ClientID){
   responseJSON(w,400,response{Message:"OneDrive requires a Microsoft Entra application (client) UUID"});return
  }
  expected:="http://"+r.Host+"/__desktop/cloud/oauth/callback"
  if input.Provider=="dropbox"&&input.RedirectURI!=expected{
   responseJSON(w,400,response{Message:"Dropbox callback must match the native loopback URL"});return
  }
  if _,err:=cloudReadTokens(s.configDir,input.Provider);err==nil{
   responseJSON(w,409,response{Message:"Disconnect existing account before changing OAuth client"});return
  }
  cfg,err:=cloudReadPublicOAuth(s.configDir)
  if err!=nil{responseJSON(w,500,response{Message:"Cloud settings unavailable"});return}
  if input.Provider=="google"{
   cfg.Google=input.ClientID
   if err:=cloudSaveGoogleClientSecret(s.configDir,input.ClientSecret);err!=nil{
    responseJSON(w,500,response{Message:"Google client secret could not be saved"});return
   }
  }else if input.Provider=="onedrive"{cfg.OneDrive=input.ClientID
  }else{cfg.Dropbox=input.ClientID;cfg.DropboxRedirectURI=input.RedirectURI}
  payload,err:=json.Marshal(cfg)
  if err!=nil{responseJSON(w,500,response{Message:"Could not serialize cloud settings"});return}
  if err:=atomicFile(cloudPublicOAuthPath(s.configDir),payload);err!=nil{
   responseJSON(w,500,response{Message:"Cloud settings could not be saved"});return
  }
  responseJSON(w,200,map[string]any{"configured":true})
 })

 mux.HandleFunc("/__desktop/cloud/auth/start",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  if runtime.GOOS!="windows"&&runtime.GOOS!="darwin"{
   responseJSON(w,501,response{Message:"OS credential vault unavailable"});return
  }
  if !cloudLoopbackHost(r.Host){responseJSON(w,403,response{Message:"Invalid loopback host"});return}
  var request struct{Provider string `json:"provider"`}
  if !readJSON(w,r,&request,1024){return}
  clientID,endpoint,_,scope,err:=cloudProviderConfigForDir(request.Provider,s.configDir)
  if err!=nil{responseJSON(w,412,response{Message:"Configure the provider client ID first"});return}
  callback:="http://"+r.Host+"/__desktop/cloud/oauth/callback"
  if request.Provider=="dropbox"&&os.Getenv("GLAUKA_DROPBOX_REDIRECT_URI")!=callback&&cloudPublicCallback(s.configDir)!=callback{
   responseJSON(w,412,response{Message:"Register the exact Dropbox loopback callback before connecting"});return
  }
  state,err:=cloudCryptoRandom(32);if err!=nil{responseJSON(w,500,response{Message:"Secure random unavailable"});return}
  verifier,err:=cloudCryptoRandom(48);if err!=nil{responseJSON(w,500,response{Message:"Secure random unavailable"});return}
  digest:=sha256.Sum256([]byte(verifier))
  challenge:=base64.RawURLEncoding.EncodeToString(digest[:])
  auth.mu.Lock()
  if auth.pending!=nil&&time.Now().Before(auth.pending.expires){
   auth.mu.Unlock();responseJSON(w,409,response{Message:"Authorization already in progress"});return
  }
  auth.pending=&cloudOAuthPending{
   provider:request.Provider,clientID:clientID,verifier:verifier,
   state:state,redirect:callback,expires:time.Now().Add(5*time.Minute),
  }
  auth.mu.Unlock()
  authURL,err:=cloudBuildAuthURL(request.Provider,clientID,endpoint,callback,scope,state,challenge)
  if err!=nil{responseJSON(w,500,response{Message:"OAuth endpoint invalid"});return}
  if err:=cloudOpenBrowser(authURL);err!=nil{
   auth.mu.Lock();auth.pending=nil;auth.mu.Unlock()
   responseJSON(w,500,response{Message:"Could not open the system browser"});return
  }
  responseJSON(w,200,map[string]any{"started":true,"provider":request.Provider})
 })
 mux.HandleFunc("/__desktop/cloud/oauth/callback",func(w http.ResponseWriter,r *http.Request){
  w.Header().Set("Cache-Control","no-store")
  w.Header().Set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; form-action 'none'")
  w.Header().Set("X-Content-Type-Options","nosniff")
  if r.Method!="GET"||!cloudLoopbackHost(r.Host){
   http.Error(w,"OAuth callback denied",403);return
  }
  state:=r.URL.Query().Get("state")
  code:=r.URL.Query().Get("code")
  auth.mu.Lock()
  pending:=auth.pending
  valid:=pending!=nil && len(state)==len(pending.state)&&
   subtle.ConstantTimeCompare([]byte(state),[]byte(pending.state))==1 &&
   time.Now().Before(pending.expires)&&pending.redirect=="http://"+r.Host+r.URL.Path
  if valid{auth.pending=nil}
  auth.mu.Unlock()
  if !valid{http.Error(w,"Authorization expired or invalid",403);return}
  if r.URL.Query().Get("error")!=""||len(code)<4||len(code)>4096{
   http.Error(w,"Authorization cancelled",400);return
  }
  cloudCredentialMu.Lock()
  defer cloudCredentialMu.Unlock()
  ctx,cancel:=context.WithTimeout(r.Context(),20*time.Second)
  defer cancel()
  values:=url.Values{
   "grant_type":{"authorization_code"},"code":{code},
   "client_id":{pending.clientID},"redirect_uri":{pending.redirect},
   "code_verifier":{pending.verifier},
  }
  if pending.provider=="google"{
   if secret:=cloudGoogleClientSecret(s.configDir);secret!=""{values.Set("client_secret",secret)}
  }
  t,err:=cloudFormToken(ctx,pending.provider,values,s.configDir)
  if err!=nil{
   var oauthErr *cloudOAuthError
   if errors.As(err,&oauthErr)&&pending.provider=="google"&&(oauthErr.Code=="invalid_request"||oauthErr.Code=="invalid_client")&&cloudGoogleClientSecret(s.configDir)==""{
    http.Error(w,"Google OAuth token exchange failed ("+oauthErr.Error()+"): Desktop OAuth client_secret is missing",502);return
   }
   http.Error(w,"OAuth token exchange failed ("+err.Error()+")",502);return
  }
  if t.Refresh==""{
   http.Error(w,"Could not establish offline access: provider did not return a refresh_token",502);return
  }
  t.ClientID=pending.clientID
  if err:=cloudSaveTokens(s.configDir,pending.provider,t);err!=nil{
   http.Error(w,"Could not secure cloud credentials",500);return
  }
  w.Header().Set("Content-Type","text/html; charset=utf-8")
  _,_=w.Write([]byte("<!doctype html><html lang='it'><meta charset='utf-8'><title>Glauka</title><body><h1>Glauka · Account collegato</h1><p>Puoi tornare all'app. Questa pagina non contiene token.</p></body></html>"))
 })
 mux.HandleFunc("/__desktop/cloud/auth/disconnect",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  var req struct{Provider string `json:"provider"`}
  if !readJSON(w,r,&req,1024){return}
  if req.Provider!="google"&&req.Provider!="dropbox"&&req.Provider!="onedrive"{
   responseJSON(w,400,response{Message:"Unknown provider"});return
  }
  cloudCredentialMu.Lock()
  previous,tokenErr:=cloudReadTokens(s.configDir,req.Provider)
  revoked:=false
  if tokenErr==nil{
   ctx,cancel:=context.WithTimeout(r.Context(),12*time.Second)
   revoked=cloudRevoke(ctx,req.Provider,previous)
   cancel()
  }
  err:=os.Remove(cloudSealedPath(s.configDir,req.Provider))
  cloudCredentialMu.Unlock()
  if err!=nil&&!errors.Is(err,os.ErrNotExist){
   responseJSON(w,500,response{Message:"Unable to disconnect"});return
  }
  auth.mu.Lock()
  if auth.pending!=nil&&auth.pending.provider==req.Provider{auth.pending=nil}
  auth.mu.Unlock()
  responseJSON(w,200,map[string]any{"connected":false,"revoked":revoked})
 })
 // Internal native refresh is ready for the transport, but never publish
 // the access token through the /__desktop JSON API.
 _=auth
}
func cloudBuildAuthURL(provider,clientID,endpoint,callback,scope,state,challenge string)(string,error){
 u,err:=url.Parse(endpoint)
 if err!=nil{return "",err}
 q:=u.Query()
 q.Set("client_id",clientID);q.Set("response_type","code")
 q.Set("redirect_uri",callback);q.Set("scope",scope);q.Set("state",state)
 q.Set("code_challenge_method","S256");q.Set("code_challenge",challenge)
 if provider=="google"{
  q.Set("access_type","offline")
  q.Set("prompt","consent")
  q.Set("include_granted_scopes","true")
 }else if provider=="dropbox"{
  q.Set("token_access_type","offline")
 }
 u.RawQuery=q.Encode()
 return u.String(),nil
}
func cloudRefreshToken(configDir,provider string,guard *sync.Mutex)(cloudOAuthTokens,error){
 guard.Lock()
 defer guard.Unlock()
 t,err:=cloudReadTokens(configDir,provider)
 if err!=nil{return t,err}
 if time.Now().Before(t.Expiry.Add(-time.Minute)){return t,nil}
 form:=url.Values{
  "grant_type":{"refresh_token"},"refresh_token":{t.Refresh},
  "client_id":{t.ClientID},
 }
 if provider=="google"{
  if secret:=cloudGoogleClientSecret(configDir);secret!=""{form.Set("client_secret",secret)}
 }
 ctx,cancel:=context.WithTimeout(context.Background(),20*time.Second)
 defer cancel()
 refreshed,err:=cloudFormToken(ctx,provider,form,configDir)
 if err!=nil{return cloudOAuthTokens{},err}
 refreshed.ClientID=t.ClientID
 // Providers may omit refresh_token in a refresh response.
 if refreshed.Refresh==""{refreshed.Refresh=t.Refresh}
 if err:=cloudSaveTokens(configDir,provider,refreshed);err!=nil{return cloudOAuthTokens{},err}
 return refreshed,nil
}
