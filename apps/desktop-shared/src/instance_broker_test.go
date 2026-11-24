package main

import (
 "bytes"
 "encoding/json"
 "io"
 "net"
 "net/http"
 "net/http/httptest"
 "net/url"
 "os"
 "path/filepath"
 "strconv"
 "testing"
)

func submitInstanceFile(t *testing.T,s *service,path,token string) *httptest.ResponseRecorder {
 t.Helper()
 body,_:=json.Marshal(map[string]string{"path":path})
 req:=httptest.NewRequest(http.MethodPost,"/__desktop/external/submit",bytes.NewReader(body))
 req.Header.Set("X-Glauka-IPC",token)
 out:=httptest.NewRecorder()
 s.routes().ServeHTTP(out,req)
 return out
}
func TestInstanceBrokerRejectsUnauthenticatedAndUnsupportedDocuments(t *testing.T){
 dir:=t.TempDir()
 s:=&service{secret:"ui-token",ipcToken:"ipc-abcdefghijklmnopqrstuvwxyz0123456789",configDir:dir,active:map[string]*activeAIRequest{}}
 file:=filepath.Join(dir,"anatomia.gk")
 if err:=os.WriteFile(file,[]byte("Anatomia"),0600);err!=nil{t.Fatal(err)}
 if res:=submitInstanceFile(t,s,file,"");res.Code!=http.StatusForbidden{t.Fatalf("missing token: %d",res.Code)}
 if res:=submitInstanceFile(t,s,file,"incorrect");res.Code!=http.StatusForbidden{t.Fatalf("invalid token: %d",res.Code)}
 bad:=filepath.Join(dir,"script.exe")
 if err:=os.WriteFile(bad,[]byte("bad"),0600);err!=nil{t.Fatal(err)}
 if res:=submitInstanceFile(t,s,bad,s.ipcToken);res.Code!=http.StatusBadRequest{t.Fatalf("unsupported: %d",res.Code)}
 if len(s.externalQueue)!=0{t.Fatal("invalid submission added file to queue")}
 empty:=&service{secret:"desktop-ui-session",configDir:dir,active:map[string]*activeAIRequest{}}
 if res:=submitInstanceFile(t,empty,"","");res.Code!=http.StatusForbidden{t.Fatalf("empty IPC secret accepted: %d",res.Code)}
}
func TestInstanceBrokerMultipleExplorerOpensDoNotLoseOrDuplicateFiles(t *testing.T){
 dir:=t.TempDir()
 s:=&service{secret:"desktop-ui-session",ipcToken:"ipc-abcdefghijklmnopqrstuvwxyz0123456789",configDir:dir,active:map[string]*activeAIRequest{}}
 a:=filepath.Join(dir,"a.gk")
 b:=filepath.Join(dir,"b.xmind")
 for _,name:=range []string{a,b}{if err:=os.WriteFile(name,[]byte(filepath.Base(name)),0600);err!=nil{t.Fatal(err)}}
 for _,p:=range []string{a,a,b}{
  if res:=submitInstanceFile(t,s,p,s.ipcToken);res.Code!=http.StatusOK{t.Fatalf("submit %s: %d",p,res.Code)}
 }
 if len(s.externalQueue)!=2{t.Fatalf("expected two pending unique opens, got %d",len(s.externalQueue))}
 for _,p:=range []string{a,b}{
  req:=httptest.NewRequest(http.MethodPost,"/__desktop/external/read",bytes.NewReader([]byte("{}")))
  req.Header.Set("X-NeuroMap-Session",s.secret)
  out:=httptest.NewRecorder();s.routes().ServeHTTP(out,req)
  if out.Code!=http.StatusOK||string(out.Body.Bytes())!=filepath.Base(p){
   t.Fatalf("wrong queued file: status=%d body=%q",out.Code,out.Body.String())
  }
 }
 req:=httptest.NewRequest(http.MethodPost,"/__desktop/external/read",bytes.NewReader([]byte("{}")))
 req.Header.Set("X-NeuroMap-Session",s.secret)
 out:=httptest.NewRecorder();s.routes().ServeHTTP(out,req)
 if out.Code!=http.StatusNoContent{t.Fatalf("queue not empty: %d",out.Code)}
}
func TestInstanceHandoffKeepsMainSessionSecretPrivate(t *testing.T){
 dir:=t.TempDir()
 s:=&service{secret:"high-trust-ui-token",ipcToken:"ipc-abcdefghijklmnopqrstuvwxyz0123456789",configDir:dir,active:map[string]*activeAIRequest{}}
 server:=httptest.NewServer(localOnlyHeaders("nonce",s.routes()))
 defer server.Close()
 parsed,err:=url.Parse(server.URL)
 if err!=nil{t.Fatal(err)}
 _,portText,err:=net.SplitHostPort(parsed.Host)
 if err!=nil{t.Fatal(err)}
 port,err:=strconv.Atoi(portText)
 if err!=nil{t.Fatal(err)}
 if err:=writeInstanceEndpoint(dir,port,s.ipcToken);err!=nil{t.Fatal(err)}
 data,err:=os.ReadFile(instanceRecordPath(dir))
 if err!=nil{t.Fatal(err)}
 if bytes.Contains(data,[]byte(s.secret)){t.Fatal("UI session secret leaked to IPC record")}
 target:=filepath.Join(dir,"test.gk")
 if err:=os.WriteFile(target,[]byte("contents"),0600);err!=nil{t.Fatal(err)}
 if err:=forwardToRunningInstance(dir,target);err!=nil{t.Fatal(err)}
 if len(s.externalQueue)!=1||s.externalQueue[0]!=target{t.Fatalf("handoff failed: %v",s.externalQueue)}
 removeInstanceEndpoint(dir,"incorrect")
 if _,err:=os.Stat(instanceRecordPath(dir));err!=nil{t.Fatal("wrong instance removed endpoint")}
 removeInstanceEndpoint(dir,s.ipcToken)
 if _,err:=os.Stat(instanceRecordPath(dir));!os.IsNotExist(err){t.Fatal("endpoint not removed")}
 // An IPC credential must never authorize reading the queue.
 req,_:=http.NewRequest(http.MethodPost,server.URL+"/__desktop/external/read",bytes.NewReader([]byte("{}")))
 req.Header.Set("X-Glauka-IPC",s.ipcToken)
 response,err:=http.DefaultClient.Do(req)
 if err!=nil{t.Fatal(err)}
 defer response.Body.Close()
 _,_=io.Copy(io.Discard,response.Body)
 if response.StatusCode!=http.StatusForbidden{t.Fatalf("IPC token granted document read: %d",response.StatusCode)}
}

func TestCommandLinePreservesAllSupportedDocumentsAndTheirOrder(t *testing.T){
 dir:=t.TempDir();a:=filepath.Join(dir,"A 中文.gk");b:=filepath.Join(dir,"B.xmind");c:=filepath.Join(dir,"C.md")
 paths:=forwardedPaths([]string{"glauka",a,b,a,"ignored.exe",c})
 if len(paths)!=3||paths[0]!=a||paths[1]!=b||paths[2]!=c{t.Fatalf("multi-argument open lost documents: %v",paths)}
 if len(forwardedPaths([]string{"glauka","--test-server",a}))!=0{t.Fatal("test-server flags forwarded user documents")}
}
func TestInstanceBatchContinuesAfterAMissingFile(t *testing.T){
 dir:=t.TempDir();s:=&service{secret:"qa-ui",ipcToken:"ipc-abcdefghijklmnopqrstuvwxyz0123456789",configDir:dir,active:map[string]*activeAIRequest{}}
 server:=httptest.NewServer(localOnlyHeaders("nonce",s.routes()));defer server.Close();u,_:=url.Parse(server.URL);_,p,_:=net.SplitHostPort(u.Host);port,_:=strconv.Atoi(p)
 if err:=writeInstanceEndpoint(dir,port,s.ipcToken);err!=nil{t.Fatal(err)}
 good:=filepath.Join(dir,"valid.gk");if err:=os.WriteFile(good,[]byte("valid"),0600);err!=nil{t.Fatal(err)}
 sent,err:=forwardPathsToRunningInstance(dir,[]string{filepath.Join(dir,"missing.gk"),good})
 if sent!=1||err==nil||len(s.externalQueue)!=1||s.externalQueue[0]!=good{t.Fatalf("missing file blocked valid Explorer open: sent=%d error=%v queue=%v",sent,err,s.externalQueue)}
}
