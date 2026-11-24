package main

// Restricted authenticated HTTP transport for Glauka's app-owned cloud files.
// Access/refresh tokens remain exclusively in the native process.
import (
 "bytes"
 "context"
 "encoding/base64"
 "encoding/json"
 "io"
 "net/http"
 "net/url"
 "regexp"
 "strings"
 "time"
)

// 12 MiB binary payload expands to 16 MiB when encoded as base64 in JSON.
const cloudMaxRequest=18 << 20
const cloudMaxResponse=14 << 20

type cloudTransportInput struct {
 Provider string `json:"provider"`
 Method string `json:"method"`
 URL string `json:"url"`
 Headers map[string]string `json:"headers"`
 Base64 string `json:"base64"`
 Format string `json:"format"`
}
func cloudAllowedRequest(provider,method,raw string)bool{
 u,err:=url.Parse(raw)
 if err!=nil||u.Scheme!="https"||u.User!=nil||u.Port()!=""||
  u.Fragment!=""||u.RawPath!=""||u.Opaque!="" {return false}
 if strings.Contains(u.EscapedPath(),"%")||strings.Contains(u.Path,".."){return false}
 switch provider{
 case "google":
  if u.Hostname()!="www.googleapis.com"{return false}
  if method!="GET"&&method!="POST"{return false}
  return u.Path=="/drive/v3/files"||strings.HasPrefix(u.Path,"/drive/v3/files/")||
   u.Path=="/upload/drive/v3/files"||strings.HasPrefix(u.Path,"/upload/drive/v3/files/")
 case "onedrive":
  if u.Hostname()!="graph.microsoft.com"||u.User!=nil{return false}
  if method!="GET"&&method!="PUT"{return false}
  if method=="GET"&&u.Path=="/v1.0/me/drive/special/approot"&&u.RawQuery==""{return true}
  if method=="GET"&&u.Path=="/v1.0/me/drive/special/approot/children"{
   vals,err:=url.ParseQuery(u.RawQuery)
   if err!=nil{return false}
   for key:=range vals{
    if key!="$select"&&key!="$top"&&key!="$skiptoken"{return false}
   }
   return true
  }
  if method=="GET"&&u.RawQuery==""{
   return regexp.MustCompile(`^/v1[.]0/me/drive/items/[A-Za-z0-9!._-]{1,180}/content$`).MatchString(u.Path)
  }
  if method=="PUT"&&u.RawQuery==""{
   return regexp.MustCompile(`^/v1[.]0/me/drive/items/[A-Za-z0-9!._-]{1,180}:/glw_[a-f0-9]{32}__[a-f0-9]{32}[.]glk:/content$`).MatchString(u.Path)
  }
  return false
 case "dropbox":
  if method!="POST"{return false}
  if u.RawQuery!=""{return false}
  switch u.Hostname(){
  case "api.dropboxapi.com":
   return u.Path=="/2/files/create_folder_v2"||u.Path=="/2/files/get_metadata"||
    u.Path=="/2/files/list_folder"||u.Path=="/2/files/list_folder/continue"
  case "content.dropboxapi.com":
   return u.Path=="/2/files/upload"||u.Path=="/2/files/download"
  }
 }
 return false
}
// Exclude ambiguous or escaping path segments before sending native cloud
// commands. A simple /Glauka/ prefix is insufficient for /Glauka/../other.
func cloudAllowedDropboxPath(path string) bool {
 if path!="/Glauka"&&!strings.HasPrefix(strings.ToLower(path),"/glauka/"){return false}
 if strings.ContainsRune(path,'\\')||strings.ContainsRune(path,0)||strings.ContainsRune(path,13)||strings.ContainsRune(path,10)||strings.Contains(path,"//"){return false}
 for _,segment:=range strings.Split(path,"/"){
  if segment=="."||segment==".."{return false}
 }
 return true
}
// OneDrive /content redirects to a time-limited Microsoft download host.
 // Validate the host and follow without forwarding the OAuth bearer token.
func cloudAllowedOneDriveDownload(raw string)bool{
 u,err:=url.Parse(raw)
 if err!=nil||u.Scheme!="https"||u.Host==""||u.User!=nil||u.Port()!=""||u.Fragment!=""{return false}
 host:=strings.ToLower(u.Hostname())
 for _,suffix:=range []string{".1drv.com",".sharepoint.com",".sharepoint-df.com",".onedrive.com",".blob.core.windows.net"}{
  if strings.HasSuffix(host,suffix)&&len(host)>len(suffix){return true}
 }
 return false
}
func cloudAllowedHeaders(headers map[string]string)bool{
 if len(headers)>8{return false}
 for key,value:=range headers {
  k:=strings.ToLower(key)
  if k!="content-type"&&k!="accept"&&k!="dropbox-api-arg"&&k!="if-none-match"{return false}
  if (strings.ContainsRune(value,rune(13))||strings.ContainsRune(value,rune(10)))||len(value)>4096{return false}
  if k=="dropbox-api-arg"{
   // An App Folder already constrains provider permissions; never permit
   // uploads outside the intended Glauka subfolder within that sandbox.
   var q struct{Path string `json:"path"`}
   if json.Unmarshal([]byte(value),&q)!=nil||!cloudAllowedDropboxPath(q.Path){return false}
  }
 }
 return true
}
func (s *service) cloudTransportRoutes(mux *http.ServeMux){
 mux.HandleFunc("/__desktop/cloud/request",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  var q cloudTransportInput
  if !readJSON(w,r,&q,cloudMaxRequest+4096){return}
  if len(q.URL)>2048||!cloudAllowedRequest(q.Provider,q.Method,q.URL)||
   !cloudAllowedHeaders(q.Headers){
   responseJSON(w,403,response{Message:"Cloud endpoint or header not authorized"});return
  }
  if q.Format!="json"&&q.Format!="bytes"&&q.Format!="multipart"{
   responseJSON(w,400,response{Message:"Invalid cloud response format"});return
  }
  // Dropbox RPC paths are never taken from arbitrary user input. Keep every
  // app-folder operation inside Glauka rather than merely relying on scope.
  if q.Provider=="dropbox"&&strings.HasPrefix(q.URL,"https://api.dropboxapi.com/2/files/"){
   var destination struct{Path string `json:"path"`}
   raw,er:=base64.StdEncoding.DecodeString(q.Base64)
   if er!=nil||json.Unmarshal(raw,&destination)!=nil{
    responseJSON(w,400,response{Message:"Invalid Dropbox metadata operation"});return
   }
   if strings.HasSuffix(q.URL,"/create_folder_v2")&&destination.Path!="/Glauka"{
    responseJSON(w,403,response{Message:"Invalid Dropbox folder"});return
   }
   if strings.HasSuffix(q.URL,"/get_metadata")&&!cloudAllowedDropboxPath(destination.Path){
    responseJSON(w,403,response{Message:"Outside Glauka folder"});return
   }
   if strings.HasSuffix(q.URL,"/list_folder")&&destination.Path!="/Glauka"{
    responseJSON(w,403,response{Message:"Dropbox discovery restricted to Glauka"});return
   }
   if strings.HasSuffix(q.URL,"/list_folder/continue"){
    var cursor struct{Cursor string `json:"cursor"`}
    if json.Unmarshal(raw,&cursor)!=nil||len(cursor.Cursor)<1||len(cursor.Cursor)>2048{
     responseJSON(w,400,response{Message:"Invalid Dropbox discovery cursor"});return
    }
   }
  }
  body,err:=base64.StdEncoding.DecodeString(q.Base64)
  if err!=nil||len(body)>12<<20{
   responseJSON(w,400,response{Message:"Cloud body exceeds 12 MiB"});return
  }
  token,err:=cloudRefreshToken(s.configDir,q.Provider,&cloudCredentialMu)
  if err!=nil{
   responseJSON(w,401,response{Message:"Cloud account not connected or authorization expired"});return
  }
  ctx,cancel:=context.WithTimeout(r.Context(),65*time.Second)
  defer cancel()
  native,err:=http.NewRequestWithContext(ctx,q.Method,q.URL,bytes.NewReader(body))
  if err!=nil{responseJSON(w,400,response{Message:"Invalid cloud request"});return}
  native.Header.Set("Authorization","Bearer "+token.Access)
  for key,value:=range q.Headers{native.Header.Set(key,value)}
  native.Header.Set("Accept","application/json")
  // The default OAuth HTTP client intentionally refuses redirects. Graph
  // uses a signed Microsoft CDN URL for /content, which we follow explicitly
  // with NO Authorization header after a strict destination check.
  client:=cloudHTTPClient
  if q.Provider=="onedrive"{
   graphClient:=*cloudHTTPClient // Retain configured transport and native TLS policy.
   graphClient.Timeout=65*time.Second
   graphClient.CheckRedirect=func(*http.Request,[]*http.Request)error{return http.ErrUseLastResponse}
   client=&graphClient
  }
  resp,err:=client.Do(native)
  if err!=nil{responseJSON(w,502,response{Message:"Cloud service unavailable"});return}
  if q.Provider=="onedrive"&&q.Method=="GET"&&strings.HasSuffix(native.URL.Path,"/content")&&
   (resp.StatusCode==302||resp.StatusCode==307){
   location:=resp.Header.Get("Location")
   _=resp.Body.Close()
   if !cloudAllowedOneDriveDownload(location){
    responseJSON(w,502,response{Message:"OneDrive download location not trusted"});return
   }
   download,er:=http.NewRequestWithContext(ctx,"GET",location,nil)
   if er!=nil{responseJSON(w,502,response{Message:"Invalid OneDrive download"});return}
   // Important: download.Header has no bearer token.
   resp,err=client.Do(download)
   if err!=nil{responseJSON(w,502,response{Message:"OneDrive download unavailable"});return}
  }
  defer resp.Body.Close()
  data,err:=io.ReadAll(io.LimitReader(resp.Body,cloudMaxResponse+1))
  if err!=nil||len(data)>cloudMaxResponse{
   responseJSON(w,502,response{Message:"Cloud response exceeds limit"});return
  }
  result:=map[string]any{"status":resp.StatusCode}
  if q.Format=="bytes"&&resp.StatusCode>=200&&resp.StatusCode<300{
   result["bytesBase64"]=base64.StdEncoding.EncodeToString(data)
  }else{
   var structured any
   if json.Unmarshal(data,&structured)==nil{result["json"]=structured}
  }
  // Never forward provider request headers, Set-Cookie, Authorization or
  // token-related error messages to JavaScript.
  responseJSON(w,200,result)
 })
}
