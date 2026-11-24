package main

// Native durable cache for the optional Glauka Cloud Sync engine. This file
// NEVER reads OAuth tokens and never accepts arbitrary paths from web content.
// Remote OAuth transport stays disabled until platform keychain integrations
// and registered provider clients have been validated.

import (
 "encoding/json"
 "crypto/sha256"
 "encoding/hex"
 "time"
 "errors"
 "io"
 "net/http"
 "os"
 "path/filepath"
 "regexp"
 "strings"
)

var cloudDocumentID = regexp.MustCompile("^[A-Za-z0-9_-]{8,110}$")

const cloudIndexLimit = 2 << 20

func cloudReadRegular(path string, limit int64) ([]byte,error) {
 if limit<1 {return nil,errors.New("Cloud read limit invalid")}
 // Lstat refuses symlinks. After opening, SameFile rejects replacing this
 // path with another inode (or a symlink) between the check and the open.
 before,err:=os.Lstat(path)
 if err!=nil{return nil,err}
 if !before.Mode().IsRegular()||before.Size()>limit{return nil,errors.New("Cloud data invalid or too large")}
 file,err:=os.Open(path)
 if err!=nil{return nil,err}
 defer file.Close()
 after,err:=file.Stat()
 if err!=nil{return nil,err}
 if !after.Mode().IsRegular()||after.Size()>limit||!os.SameFile(before,after){
  return nil,errors.New("Cloud file changed or exceeded limit")
 }
 // The file may grow after Stat: never use unbounded os.ReadFile on native
 // storage. A single extra byte distinguishes a full-sized file from overflow.
 data,err:=io.ReadAll(io.LimitReader(file,limit+1))
 if err!=nil{return nil,err}
 if int64(len(data))>limit{return nil,errors.New("Cloud file exceeds read limit")}
 // A truncated in-place writer must not surface a partial cloud index or
 // project as a successful read. Atomic writers normally avoid this race.
 if int64(len(data))!=after.Size(){
  return nil,errors.New("Cloud file changed during read")
 }
 return data,nil
}
func validCloudRoot(data json.RawMessage) bool {
 if len(data)<2||data[0]!='{'{return false}
 var node struct {
  Text *string `json:"text"`
  Children json.RawMessage `json:"children"`
 }
 if json.Unmarshal(data,&node)!=nil||node.Text==nil{return false}
 if len(node.Children)>0&&node.Children[0]!='['&&string(node.Children)!="null"{return false}
 return true
}
func validCloudPayload(data string) bool {
 if len(data)<2||len(data)>maxWorkspace{return false}
 var doc struct {
  Root json.RawMessage `json:"root"`
  Tabs []json.RawMessage `json:"tabs"`
 }
 if json.Unmarshal([]byte(data),&doc)!=nil{return false}
 if len(doc.Root)>0&&!validCloudRoot(doc.Root){return false}
 if doc.Tabs!=nil{
  if len(doc.Tabs)==0||len(doc.Tabs)>100{return false}
  for _,raw:=range doc.Tabs{
   var tab struct{
    Root json.RawMessage `json:"root"`
    Images json.RawMessage `json:"images"`
    Relationships json.RawMessage `json:"relationships"`
   }
   if len(raw)<2||raw[0]!='{'||json.Unmarshal(raw,&tab)!=nil||
      !validCloudRoot(tab.Root){return false}
   for _,meta:=range []json.RawMessage{tab.Images,tab.Relationships}{
    if len(meta)>0&&meta[0]!='['&&string(meta)!="null"{return false}
   }
  }
 }
 return len(doc.Root)>0||len(doc.Tabs)>0
}
func (s *service) cloudLocalRoutes(mux *http.ServeMux){
 folder:=filepath.Join(s.configDir,"cloud-sync")
 documents:=filepath.Join(folder,"documents")
 mux.HandleFunc("/__desktop/cloud/workspace/protect",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  var input struct{ExpectedHash string `json:"expectedHash"`}
  if !readJSON(w,r,&input,512){return}
  if len(input.ExpectedHash)!=64||!regexp.MustCompile("^[0-9a-f]{64}$").MatchString(input.ExpectedHash){
   responseJSON(w,400,response{Message:"Invalid workspace fingerprint"});return
  }
  s.workspaceMu.Lock()
  defer s.workspaceMu.Unlock()
  original,_,err:=readRecovery(filepath.Join(s.configDir,"workspace-autosave.json"))
  if err!=nil||!validCloudPayload(string(original)){
   responseJSON(w,409,response{Message:"Cannot preserve current local workspace"});return
  }
  fingerprint:=sha256.Sum256(original)
  if hex.EncodeToString(fingerprint[:])!=input.ExpectedHash{
   responseJSON(w,409,response{Message:"Local workspace changed during cloud review"});return
  }
  label:="workspace-before-cloud-"+time.Now().UTC().Format("20060102T150405.000000000")+".json"
  backup:=filepath.Join(folder,"recovery",label)
  if err:=atomicFile(backup,original);err!=nil{
   responseJSON(w,500,response{Message:"Cannot preserve local workspace before cloud import"});return
  }
  responseJSON(w,200,map[string]any{"saved":true,"backupName":label})
 })

 mux.HandleFunc("/__desktop/cloud/index/read",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  data,err:=cloudReadRegular(filepath.Join(folder,"index.json"),cloudIndexLimit)
  if errors.Is(err,os.ErrNotExist){responseJSON(w,200,response{});return}
  if err!=nil{responseJSON(w,500,response{Message:"Cloud index unavailable"});return}
  responseJSON(w,200,response{JSON:string(data)})
 })
 mux.HandleFunc("/__desktop/cloud/index/write",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  var input struct{JSON string `json:"json"`}
  if !readJSON(w,r,&input,cloudIndexLimit+4096){return}
  var doc struct {
   Version int `json:"version"`
   Documents map[string]json.RawMessage `json:"documents"`
  }
  if len(input.JSON)>cloudIndexLimit||json.Unmarshal([]byte(input.JSON),&doc)!=nil||
   doc.Version!=1||doc.Documents==nil||len(doc.Documents)>1000{
   responseJSON(w,400,response{Message:"Invalid cloud index"});return
  }
  for id:=range doc.Documents{if !cloudDocumentID.MatchString(id){
   responseJSON(w,400,response{Message:"Invalid cloud document ID"});return
  }}
  if err:=atomicFile(filepath.Join(folder,"index.json"),[]byte(input.JSON));err!=nil{
   responseJSON(w,500,response{Message:"Could not persist cloud queue"});return
  }
  responseJSON(w,200,response{Saved:true})
 })
 mux.HandleFunc("/__desktop/cloud/documents/list",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  entries,err:=os.ReadDir(documents)
  if errors.Is(err,os.ErrNotExist){responseJSON(w,200,map[string]any{"ids":[]string{}});return}
  if err!=nil{responseJSON(w,500,response{Message:"Cannot list cloud documents"});return}
  ids:=make([]string,0)
  for _,entry:=range entries {
   if len(ids)>=1000{break}
   n:=entry.Name()
   if !entry.IsDir()&&strings.HasSuffix(n,".json"){
    id:=strings.TrimSuffix(n,".json")
    if cloudDocumentID.MatchString(id){ids=append(ids,id)}
   }
  }
  responseJSON(w,200,map[string]any{"ids":ids})
 })
 mux.HandleFunc("/__desktop/cloud/document/read",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  var input struct{ID string `json:"id"`}
  if !readJSON(w,r,&input,1024){return}
  if !cloudDocumentID.MatchString(input.ID){responseJSON(w,400,response{Message:"Invalid document ID"});return}
  data,err:=cloudReadRegular(filepath.Join(documents,input.ID+".json"),maxWorkspace)
  if errors.Is(err,os.ErrNotExist){responseJSON(w,200,response{});return}
  if err!=nil{responseJSON(w,500,response{Message:"Cannot read local cloud document"});return}
  responseJSON(w,200,response{JSON:string(data)})
 })
 mux.HandleFunc("/__desktop/cloud/document/write",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  var input struct{
   ID string `json:"id"`
   JSON string `json:"json"`
  }
  if !readJSON(w,r,&input,maxWorkspace+4096){return}
  if !cloudDocumentID.MatchString(input.ID)||!validCloudPayload(input.JSON){
   responseJSON(w,400,response{Message:"Invalid cloud document"});return
  }
  if err:=atomicFile(filepath.Join(documents,input.ID+".json"),[]byte(input.JSON));err!=nil{
   responseJSON(w,500,response{Message:"Could not persist local cloud document"});return
  }
  responseJSON(w,200,response{Saved:true})
 })
 // Future provider transport MUST be native and authenticated. Never expose a
 // bearer token from an endpoint to JavaScript, and do not use this route as a
 // generic network proxy (SSRF).
 mux.HandleFunc("/__desktop/cloud/provider/status",func(w http.ResponseWriter,r *http.Request){
  if !s.secure(w,r){return}
  responseJSON(w,200,map[string]any{"connected":false,"available":false,"status":"native_vault_not_configured"})
 })
}

