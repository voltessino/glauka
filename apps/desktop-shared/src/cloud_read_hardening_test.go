package main

import (
 "encoding/json"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func TestCloudReadRegularBoundsAndSymlinkProtection(t *testing.T) {
 dir:=t.TempDir()
 file:=filepath.Join(dir,"index.json")
 data:=[]byte("{\"version\":1}")
 if err:=os.WriteFile(file,data,0600);err!=nil{t.Fatal(err)}
 if got,err:=cloudReadRegular(file,int64(len(data)));err!=nil||string(got)!=string(data){
  t.Fatalf("valid read failed: %q, %v",got,err)
 }
 if got,err:=cloudReadRegular(file,int64(len(data)-1));err==nil||got!=nil{
  t.Fatalf("oversized read accepted: %q, %v",got,err)
 }
 if _,err:=cloudReadRegular(file,0);err==nil{t.Fatal("zero read limit accepted")}
 if _,err:=cloudReadRegular(filepath.Join(dir,"missing"),100);!os.IsNotExist(err){
  t.Fatalf("missing file must preserve ErrNotExist: %v",err)
 }
 if _,err:=cloudReadRegular(dir,100);err==nil{t.Fatal("directory accepted as a cloud data file")}
 symlink:=filepath.Join(dir,"linked.json")
 if err:=os.Symlink(file,symlink);err==nil {
  if _,err=cloudReadRegular(symlink,100);err==nil{t.Fatal("symlink accepted as cloud data")}
 }else{t.Logf("symlink unavailable on this platform: %v",err)}
}

func TestCloudDropboxPathsCannotEscapeProjectFolder(t *testing.T) {
 for _,p:=range []string{"/Glauka","/Glauka/study","/glauka/sub/document.gk","/GLAUKA/A-1"} {
  if !cloudAllowedDropboxPath(p){t.Errorf("rejected valid cloud path %q",p)}
 }
 for _,p:=range []string{"", "/", "/Glaukaish", "/private", "/Glauka/../private",
  "/Glauka/./file","/Glauka//file","/Glauka/folder/../../secret",
  "/Glauka/folder\\file","/Glauka/file\rline","/Glauka/file\nline","/Glauka/file\x00line"} {
  if cloudAllowedDropboxPath(p){t.Errorf("accepted forbidden cloud path %q",p)}
  input,_:=json.Marshal(map[string]string{"path":p})
  if cloudAllowedHeaders(map[string]string{"Dropbox-API-Arg":string(input)}){
   t.Errorf("accepted forbidden Dropbox-API-Arg: %q",p)
  }
 }
 good,_:=json.Marshal(map[string]string{"path":"/Glauka/notes.gk"})
 if !cloudAllowedHeaders(map[string]string{"Dropbox-API-Arg":string(good)}){
  t.Fatal("valid Dropbox file rejected")
 }
 if !strings.Contains(string(good),"Glauka"){t.Fatal("test setup invalid")}
}

func TestCloudPayloadRejectsInvalidRootsAndTabs(t *testing.T) {
 for _,good:=range []string{
  `{"root":{"text":"A","children":[]}}`,
  `{"version":3,"tabs":[{"id":"a","root":{"text":"Map","children":[]},"images":[],"relationships":[]}]}`,
  `{"tabs":[{"root":{"text":""}}]}`,
  `{"tabs":[{"root":{"text":"Legacy","children":null},"images":null,"relationships":null}]}`,
 } {
  if !validCloudPayload(good){t.Fatalf("valid cloud document rejected: %s",good)}
 }
 for _,bad:=range []string{
  `{}`,
  `{"root":null}`,
  `{"root":"not-a-tree"}`,
  `{"root":{"children":[]}}`,
  `{"root":{"text":"A","children":{}}}`,
  `{"tabs":[]}`,
  `{"tabs":[null]}`,
  `{"tabs":[{"root":{}}]}`,
  `{"tabs":[{"root":{"text":"A"},"images":{}}]}`,
  `{"tabs":[{"root":{"text":"A"},"relationships":"not-an-array"}]}`,
  `{"tabs":[{"root":null}]}`,
 } {
  if validCloudPayload(bad){t.Fatalf("invalid cloud document accepted: %s",bad)}
 }
}
