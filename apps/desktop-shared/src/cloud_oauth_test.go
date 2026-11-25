package main

import (
 "context"
 "encoding/json"
 "io"
 "net/url"
 "time"
 "net/http"
 "net/http/httptest"
 "os"
 "strings"
 "sync"
 "testing"
)

func TestCloudNativeURLsAreStrictlyRestricted(t *testing.T){
 valid:=[]struct{provider,method,url string}{
  {"google","GET","https://www.googleapis.com/drive/v3/files?q=abc"},
  {"google","POST","https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"},
  {"dropbox","POST","https://api.dropboxapi.com/2/files/create_folder_v2"},
  {"dropbox","POST","https://content.dropboxapi.com/2/files/upload"},
  {"dropbox","POST","https://api.dropboxapi.com/2/files/list_folder"},
  {"dropbox","POST","https://api.dropboxapi.com/2/files/list_folder/continue"},
  {"onedrive","GET","https://graph.microsoft.com/v1.0/me/drive/special/approot"},
  {"onedrive","GET","https://graph.microsoft.com/v1.0/me/drive/special/approot/children?$top=200"},
  {"onedrive","PUT","https://graph.microsoft.com/v1.0/me/drive/items/01PARENT:/glw_0123456789abcdef0123456789abcdef__0123456789abcdef0123456789abcdef.glk:/content"},
  {"onedrive","GET","https://graph.microsoft.com/v1.0/me/drive/items/01ITEM/content"},
 }
 for _,v:=range valid {
  if !cloudAllowedRequest(v.provider,v.method,v.url){t.Errorf("rejected expected cloud URL: %s",v.url)}
 }
 invalid:=[]struct{provider,method,url string}{
  {"google","GET","http://www.googleapis.com/drive/v3/files"},
  {"google","GET","https://www.googleapis.com.evil.test/drive/v3/files"},
  {"google","GET","https://www.googleapis.com:443/drive/v3/files"},
  {"google","POST","https://www.googleapis.com/oauth2/v4/token"},
  {"dropbox","GET","https://content.dropboxapi.com/2/files/download"},
  {"dropbox","POST","https://api.dropboxapi.com/2/files/delete_v2"},
  {"dropbox","GET","https://api.dropboxapi.com/2/files/list_folder"},
  {"dropbox","POST","https://api.dropboxapi.com/2/files/list_folder/elsewhere"},
  {"dropbox","POST","https://content.dropboxapi.com/2/files/upload?x=1"},
  {"dropbox","POST","https://evil.test/2/files/upload"},
  {"google","GET","https://www.googleapis.com/drive/v3/files/../oauth2"},
  {"onedrive","GET","http://graph.microsoft.com/v1.0/me/drive/special/approot"},
  {"onedrive","GET","https://graph.microsoft.com.evil.test/v1.0/me/drive/special/approot"},
  {"onedrive","GET","https://graph.microsoft.com/v1.0/me/users/victim/drive/root/children"},
  {"onedrive","GET","https://graph.microsoft.com/v1.0/me/drive/root/children"},
  {"onedrive","POST","https://graph.microsoft.com/v1.0/me/drive/special/approot"},
  {"onedrive","GET","https://graph.microsoft.com/v1.0/me/drive/special/approot/children?$filter=weird"},
  {"onedrive","PUT","https://graph.microsoft.com/v1.0/me/drive/items/01PARENT:/outside.glk:/content"},
 }
 for _,v:=range invalid {
  if cloudAllowedRequest(v.provider,v.method,v.url){t.Errorf("accepted unsafe URL: %s",v.url)}
 }
}
func TestOneDriveRedirectNeverSendsBearerToUntrustedHost(t *testing.T){
 valid:=[]string{
  "https://files.1drv.com/download/abc?token=redacted",
  "https://tenant.sharepoint.com/personal/user/file?token=redacted",
  "https://mystorage.blob.core.windows.net/temporary/download",
 }
 for _,v:=range valid{if !cloudAllowedOneDriveDownload(v){t.Errorf("trusted Graph redirect rejected: %s",v)}}
 invalid:=[]string{
  "http://tenant.sharepoint.com/file",
  "https://sharepoint.com.evil.test/download",
  "https://127.0.0.1/secret",
  "https://user:password@files.1drv.com/file",
  "https://files.1drv.com:8443/file",
 }
 for _,v:=range invalid{if cloudAllowedOneDriveDownload(v){t.Errorf("unsafe signed URL accepted: %s",v)}}
}
func TestCloudHeaderAllowlist(t *testing.T){
 if !cloudAllowedHeaders(map[string]string{"Content-Type":"application/json"}){t.Fatal("valid header rejected")}
 if !cloudAllowedHeaders(map[string]string{"Content-Type":"application/octet-stream","If-None-Match":"*"}){t.Fatal("OneDrive safe upload headers rejected")}
 for _,headers:=range []map[string]string{
  {"Authorization":"Bearer abc"},
  {"Cookie":"session=abc"},
  {"X-Unapproved":"yes"},
  {"Dropbox-API-Arg":`{"path":"/Private/document.glk"}`},
 }{
  if cloudAllowedHeaders(headers){t.Errorf("unsafe cloud headers accepted: %v",headers)}
 }
}
func TestCloudOAuthStateCallbackIsIsolatedFromDesktopSession(t *testing.T){
 svc:=&service{secret:"internal-session-test-token",configDir:t.TempDir()}
 router:=localOnlyHeaders("nonce",svc.routes())
 for _,requestPath:=range []string{
  "/__desktop/cloud/oauth/callback?code=abc&state=forged",
  "/__desktop/cloud/oauth/callback?error=access_denied&state=forged",
 }{
  request:=httptest.NewRequest("GET","http://127.0.0.1:43117"+requestPath,nil)
  request.Header.Set("Sec-Fetch-Site","cross-site")
  recorder:=httptest.NewRecorder()
  router.ServeHTTP(recorder,request)
  if recorder.Code!=http.StatusForbidden{
   t.Errorf("unauthorized callback status: %d",recorder.Code)
  }
 }
 request:=httptest.NewRequest("POST","http://127.0.0.1:43117/__desktop/cloud/auth/start",
  strings.NewReader(`{"provider":"google"}`))
 request.Header.Set("X-NeuroMap-Session","wrong")
 recorder:=httptest.NewRecorder();router.ServeHTTP(recorder,request)
 if recorder.Code!=http.StatusForbidden{t.Fatalf("cloud broker accepted forged session: %d",recorder.Code)}
}
func TestCloudClientIDMustBeConfiguredAndSafe(t *testing.T){
 old:=os.Getenv("GLAUKA_GOOGLE_CLIENT_ID")
 defer os.Setenv("GLAUKA_GOOGLE_CLIENT_ID",old)
 for _,bad:=range []string{"","insecure value","bad"+string(rune(10))+"line","a"}{
  os.Setenv("GLAUKA_GOOGLE_CLIENT_ID",bad)
  if _,_,_,_,err:=cloudProviderConfig("google");err==nil{t.Errorf("invalid client ID accepted: %q",bad)}
 }
 os.Setenv("GLAUKA_GOOGLE_CLIENT_ID","123456-abcd.apps.googleusercontent.com")
 id,_,_,_,err:=cloudProviderConfig("google")
 if err!=nil||id==""{t.Fatalf("valid client ID rejected: %v",err)}
}


func TestCloudOAuthTokenResponseMustBeBearerAndExpire(t *testing.T){
 old:=cloudHTTPClient
 defer func(){cloudHTTPClient=old}()
 t.Setenv("GLAUKA_GOOGLE_CLIENT_ID","example-public-app-123.apps.googleusercontent.com")
 transport:=cloudMockTokenRoundTripper(func(r *http.Request)(*http.Response,error){
  if r.Method!="POST"||r.URL.Host!="oauth2.googleapis.com"{
   t.Errorf("unexpected token exchange endpoint %s",r.URL.String())
  }
  if r.Header.Get("Authorization")!=""{t.Fatal("token request used Basic auth unexpectedly")}
  return &http.Response{StatusCode:200,Body:io.NopCloser(strings.NewReader(
   `{"access_token":"access-123","refresh_token":"refresh-456","token_type":"Bearer","expires_in":3600}`)),
   Header:make(http.Header)},nil
 })
 cloudHTTPClient=&http.Client{Transport:transport}
 token,err:=cloudFormToken(context.Background(),"google",url.Values{
  "grant_type":{"authorization_code"},"code":{"code-example"},"client_id":{"public"},
 })
 if err!=nil{t.Fatalf("OAuth token decode failed: %v",err)}
 if token.Access!="access-123"||token.Refresh!="refresh-456"||token.Expiry.Before(time.Now().Add(59*time.Minute)){
  t.Fatal("OAuth token metadata incorrectly parsed")
 }
}
func TestCloudOAuthErrorNeverExposesProviderResponse(t *testing.T){
 old:=cloudHTTPClient;defer func(){cloudHTTPClient=old}()
 t.Setenv("GLAUKA_DROPBOX_APP_KEY","dropbox-test-public-client")
 cloudHTTPClient=&http.Client{Transport:cloudMockTokenRoundTripper(func(r *http.Request)(*http.Response,error){
  return &http.Response{StatusCode:400,Body:io.NopCloser(strings.NewReader(
   `{"error":"secret-token-do-not-log"}`)),Header:make(http.Header)},nil
 })}
 _,err:=cloudFormToken(context.Background(),"dropbox",url.Values{"grant_type":{"authorization_code"}})
 if err==nil||strings.Contains(err.Error(),"secret-token-do-not-log"){
  t.Fatal("OAuth provider response leaked into application error")
 }
}
type cloudMockTokenRoundTripper func(*http.Request)(*http.Response,error)
func (f cloudMockTokenRoundTripper)RoundTrip(r *http.Request)(*http.Response,error){return f(r)}


func TestCloudPublicOAuthConfigurationOnDisk(t *testing.T){
 dir:=t.TempDir()
 t.Setenv("GLAUKA_GOOGLE_CLIENT_ID","")
 t.Setenv("GLAUKA_DROPBOX_APP_KEY","")
 t.Setenv("GLAUKA_ONEDRIVE_CLIENT_ID","")
 cfg:=cloudPublicOAuthSettings{Google:"1234567890-public.apps.googleusercontent.com",
  Dropbox:"public-dropbox-app",OneDrive:"01234567-89ab-cdef-0123-456789abcdef",DropboxRedirectURI:"http://127.0.0.1:43117/__desktop/cloud/oauth/callback"}
 raw,err:=json.Marshal(cfg)
 if err!=nil{t.Fatal(err)}
 if err:=atomicFile(cloudPublicOAuthPath(dir),raw);err!=nil{t.Fatal(err)}
 loaded,err:=cloudReadPublicOAuth(dir)
 if err!=nil{t.Fatal(err)}
 if loaded.Google!=cfg.Google||loaded.Dropbox!=cfg.Dropbox||loaded.OneDrive!=cfg.OneDrive||
  loaded.DropboxRedirectURI!=cfg.DropboxRedirectURI{t.Fatalf("public OAuth config mismatch: %+v",loaded)}
 id,_,tokenURL,scope,err:=cloudProviderConfigForDir("google",dir)
 if err!=nil||id!=cfg.Google||tokenURL!="https://oauth2.googleapis.com/token"||
  scope!="https://www.googleapis.com/auth/drive.file"{t.Fatal("saved Google Desktop OAuth client not used",err)}
 id,_,tokenURL,_,err=cloudProviderConfigForDir("dropbox",dir)
 if err!=nil||id!=cfg.Dropbox||tokenURL!="https://api.dropboxapi.com/oauth2/token"{
  t.Fatal("saved Dropbox OAuth app key not used",err)
 }
 id,_,tokenURL,scope,err=cloudProviderConfigForDir("onedrive",dir)
 if err!=nil||id!=cfg.OneDrive||tokenURL!="https://login.microsoftonline.com/common/oauth2/v2.0/token"||
  !strings.Contains(scope,"Files.ReadWrite.AppFolder"){
  t.Fatal("saved OneDrive Microsoft client not used",err)
 }
 if got:=cloudPublicCallback(dir);got!=cfg.DropboxRedirectURI{t.Fatalf("wrong Dropbox callback: %q",got)}
}

func TestCloudGoogleDefaultClientIDIsBuiltIn(t *testing.T){
 dir:=t.TempDir()
 t.Setenv("GLAUKA_GOOGLE_CLIENT_ID","")
 id,_,_,scope,err:=cloudProviderConfigForDir("google",dir)
 if err!=nil{t.Fatalf("expected built-in Google Desktop Client ID, got error: %v",err)}
 if id!=defaultGoogleDesktopClientID{t.Fatalf("unexpected default Google Client ID: %q",id)}
 if scope!="https://www.googleapis.com/auth/drive.file"{t.Fatalf("unexpected scope: %q",scope)}
}

func TestCloudGoogleAuthURLIncludesOfflineConsentAndGrantedScopes(t *testing.T){
 raw,err:=cloudBuildAuthURL(
  "google",
  "1234567890-public.apps.googleusercontent.com",
  "https://accounts.google.com/o/oauth2/v2/auth",
  "http://127.0.0.1:43117/__desktop/cloud/oauth/callback",
  "https://www.googleapis.com/auth/drive.file",
  "state-123",
  "challenge-456",
 )
 if err!=nil{t.Fatalf("cloudBuildAuthURL failed: %v",err)}
 parsed,err:=url.Parse(raw)
 if err!=nil{t.Fatalf("invalid generated auth URL: %v",err)}
 q:=parsed.Query()
 if q.Get("access_type")!="offline"{t.Fatalf("expected access_type=offline, got %q",q.Get("access_type"))}
 if q.Get("prompt")!="consent"{t.Fatalf("expected prompt=consent, got %q",q.Get("prompt"))}
 if q.Get("include_granted_scopes")!="true"{t.Fatalf("expected include_granted_scopes=true, got %q",q.Get("include_granted_scopes"))}
}

func TestCloudGoogleClientSecretAndOAuthErrorCode(t *testing.T){
 dir:=t.TempDir()
 t.Setenv("GLAUKA_GOOGLE_CLIENT_ID","1234567890-public.apps.googleusercontent.com")
 t.Setenv("GLAUKA_GOOGLE_CLIENT_SECRET","")
 if err:=cloudSaveGoogleClientSecret(dir,"desktop-secret-example");err!=nil{
  t.Fatalf("cloudSaveGoogleClientSecret failed: %v",err)
 }
 if got:=cloudGoogleClientSecret(dir);got!="desktop-secret-example"{
  t.Fatalf("expected sealed client_secret, got %q",got)
 }

 old:=cloudHTTPClient
 defer func(){cloudHTTPClient=old}()

 cloudHTTPClient=&http.Client{Transport:cloudMockTokenRoundTripper(func(r *http.Request)(*http.Response,error){
  return &http.Response{
   StatusCode:400,
   Body:io.NopCloser(strings.NewReader(`{"error":"invalid_request","error_description":"client_secret is missing. sensitive-detail"}`)),
   Header:make(http.Header),
  },nil
 })}
 _,err:=cloudFormToken(context.Background(),"google",url.Values{"grant_type":{"authorization_code"}},dir)
 if err==nil{t.Fatal("expected error for HTTP 400")}
 if strings.Contains(err.Error(),"sensitive-detail"){t.Fatal("error_description leaked into Go error")}
 if !strings.Contains(err.Error(),"invalid_request"){t.Fatalf("expected safe OAuth error code, got %v",err)}

 initial:=cloudOAuthTokens{
  Access:"old-access",
  Refresh:"refresh-xyz",
  Type:"Bearer",
  Expiry:time.Now().Add(-5*time.Minute),
  ClientID:"1234567890-public.apps.googleusercontent.com",
 }
 if err:=cloudSaveTokens(dir,"google",initial);err!=nil{t.Fatalf("cloudSaveTokens failed: %v",err)}
 var seenSecret string
 cloudHTTPClient=&http.Client{Transport:cloudMockTokenRoundTripper(func(r *http.Request)(*http.Response,error){
  body,err:=io.ReadAll(r.Body)
  if err!=nil{return nil,err}
  form,err:=url.ParseQuery(string(body))
  if err!=nil{return nil,err}
  seenSecret=form.Get("client_secret")
  return &http.Response{
   StatusCode:200,
   Body:io.NopCloser(strings.NewReader(`{"access_token":"new-access","token_type":"Bearer","expires_in":3600}`)),
   Header:make(http.Header),
  },nil
 })}
 var mu sync.Mutex
 refreshed,err:=cloudRefreshToken(dir,"google",&mu)
 if err!=nil{t.Fatalf("cloudRefreshToken failed: %v",err)}
 if seenSecret!="desktop-secret-example"{t.Fatalf("expected client_secret on refresh, got %q",seenSecret)}
 if refreshed.Access!="new-access"||refreshed.Refresh!="refresh-xyz"{t.Fatalf("unexpected refreshed tokens: %+v",refreshed)}
}

func TestCloudGoogleAuthStartRejectsWhenSecretMissing(t *testing.T){
 dir:=t.TempDir()
 t.Setenv("GLAUKA_GOOGLE_CLIENT_ID","1234567890-public.apps.googleusercontent.com")
 t.Setenv("GLAUKA_GOOGLE_CLIENT_SECRET","")
 svc:=&service{secret:"internal-session-test-token",configDir:dir}
 mux:=http.NewServeMux()
 svc.cloudOAuthRoutes(mux)

 statusReq:=httptest.NewRequest("POST","http://127.0.0.1:43117/__desktop/cloud/auth/status",nil)
 statusReq.Header.Set("X-NeuroMap-Session","internal-session-test-token")
 statusRec:=httptest.NewRecorder()
 mux.ServeHTTP(statusRec,statusReq)
 if statusRec.Code!=http.StatusOK{t.Fatalf("status HTTP=%d",statusRec.Code)}
 var statusPayload map[string]any
 if err:=json.Unmarshal(statusRec.Body.Bytes(),&statusPayload);err!=nil{t.Fatal(err)}
 googleCfg,ok:=statusPayload["google"].(map[string]any)
 if !ok{t.Fatalf("missing google status payload: %v",statusPayload)}
 if ready,ok:=googleCfg["secretConfigured"].(bool);!ok||ready{
  t.Fatalf("expected google.secretConfigured=false when missing, got %v",googleCfg)
 }

 startReq:=httptest.NewRequest("POST","http://127.0.0.1:43117/__desktop/cloud/auth/start",
  strings.NewReader(`{"provider":"google"}`))
 startReq.Header.Set("X-NeuroMap-Session","internal-session-test-token")
 startRec:=httptest.NewRecorder()
 mux.ServeHTTP(startRec,startReq)
 if startRec.Code!=http.StatusPreconditionFailed{
  t.Fatalf("expected HTTP 412 when Google client_secret is missing, got %d (%s)",startRec.Code,startRec.Body.String())
 }
}
