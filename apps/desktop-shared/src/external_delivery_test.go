package main

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "os"
    "path/filepath"
    "strings"
    "testing"
)

func reliableFileRequest(t *testing.T,s *service,endpoint,body string) *httptest.ResponseRecorder {
    t.Helper()
    request:=httptest.NewRequest(http.MethodPost,"/__desktop/external/"+endpoint,strings.NewReader(body))
    request.Header.Set("X-NeuroMap-Session",s.secret)
    request.Header.Set("Content-Type","application/json")
    output:=httptest.NewRecorder()
    s.routes().ServeHTTP(output,request)
    return output
}
func reliableFileService(t *testing.T) (*service,string) {
    t.Helper()
    dir:=t.TempDir()
    filename:=filepath.Join(dir,"Anatomia.gk")
    if err:=os.WriteFile(filename,[]byte("a test mind map"),0600);err!=nil{t.Fatal(err)}
    return &service{secret:"test-local-session",configDir:dir,externalQueue:[]string{filename},
        active:map[string]*activeAIRequest{}},filename
}
func TestExternalReliableDeliveryRequiresAckBeforeDequeue(t *testing.T){
    s,path:=reliableFileService(t)
    first:=reliableFileRequest(t,s,"pending", "{}")
    if first.Code!=200||first.Body.String()!="a test mind map" {
        t.Fatalf("pending read: code=%d body=%q",first.Code,first.Body.String())
    }
    id:=first.Header().Get("X-Glauka-Delivery-ID")
    if len(id)!=43 {t.Fatalf("missing handoff token %q",id)}
    second:=reliableFileRequest(t,s,"pending", "{}")
    if second.Code!=200||second.Header().Get("X-Glauka-Delivery-ID")!=id{
        t.Fatal("unacknowledged file was lost or assigned a different token")
    }
    if len(s.externalQueue)!=1 || s.externalQueue[0]!=path {t.Fatal("read dropped pending document")}
    body,_:=json.Marshal(map[string]string{"id":id,"action":"imported"})
    reply:=reliableFileRequest(t,s,"confirm",string(body))
    if reply.Code!=200||len(s.externalQueue)!=0 {t.Fatal("confirmed import not dequeued")}
    if retry:=reliableFileRequest(t,s,"confirm",string(body));retry.Code!=200{
        t.Fatal("repeated confirmation must be idempotent")
    }
    if empty:=reliableFileRequest(t,s,"pending","{}");empty.Code!=http.StatusNoContent{
        t.Fatal("empty queue must return 204")
    }
}
func TestExternalReliableDeliveryRejectsWrongAck(t *testing.T){
    s,_:=reliableFileService(t)
    pending:=reliableFileRequest(t,s,"pending","{}")
    id:=pending.Header().Get("X-Glauka-Delivery-ID")
    invalid,_:=json.Marshal(map[string]string{"id":strings.Repeat("x",43),"action":"imported"})
    if out:=reliableFileRequest(t,s,"confirm",string(invalid));out.Code!=409{
        t.Fatalf("wrong token accepted (%d)",out.Code)
    }
    if len(s.externalQueue)!=1 {t.Fatal("wrong token discarded a document")}
    req:=httptest.NewRequest(http.MethodPost,"/__desktop/external/confirm",
        bytes.NewBufferString(`{"id":"`+id+`","action":"imported"}`))
    out:=httptest.NewRecorder()
    s.routes().ServeHTTP(out,req)
    if out.Code!=http.StatusForbidden{t.Fatalf("unauthenticated ack accepted: %d",out.Code)}
    if len(s.externalQueue)!=1 {t.Fatal("unauthorized ack discarded a document")}
}
func TestExternalReliableMissingFileCanBeExplicitlySkipped(t *testing.T){
    s,path:=reliableFileService(t)
    if err:=os.Remove(path);err!=nil{t.Fatal(err)}
    pending:=reliableFileRequest(t,s,"pending","{}")
    if pending.Code!=http.StatusConflict || len(s.externalQueue)!=1 {
        t.Fatalf("missing file silently removed: %d",pending.Code)
    }
    id:=pending.Header().Get("X-Glauka-Delivery-ID")
    body,_:=json.Marshal(map[string]string{"id":id,"action":"skip"})
    if reply:=reliableFileRequest(t,s,"confirm",string(body));reply.Code!=200 ||len(s.externalQueue)!=0{
        t.Fatal("explicit Skip did not remove missing document")
    }
}
func TestExternalReliableDeniedAuthorizationDoesNotDequeue(t *testing.T){
    s,path:=reliableFileService(t)
    blocked:=filepath.Join(t.TempDir(),"not-a-directory")
    if err:=os.WriteFile(blocked,[]byte("x"),0600);err!=nil{t.Fatal(err)}
    s.configDir=blocked
    reply:=reliableFileRequest(t,s,"pending","{}")
    if reply.Code!=200 ||reply.Header().Get("X-Glauka-Path-Warning")!="1"||
       len(s.externalQueue)!=1 ||s.externalQueue[0]!=path {
        t.Fatalf("readable file blocked after failed path grant: %d",reply.Code)
    }
    if s.authorizedPath(path) {t.Fatal("failed durable path grant remained active in memory")}
}

func TestFailedExternalFileCanBeDeferredWithoutBlockingOrDroppingOthers(t *testing.T){
 s,missing:=reliableFileService(t);if err:=os.Remove(missing);err!=nil{t.Fatal(err)}
 good:=filepath.Join(t.TempDir(),"valid.gk");if err:=os.WriteFile(good,[]byte("valid content"),0600);err!=nil{t.Fatal(err)};s.externalQueue=append(s.externalQueue,good)
 first:=reliableFileRequest(t,s,"pending","{}");badID:=first.Header().Get("X-Glauka-Delivery-ID")
 second:=reliableFileRequest(t,s,"pending",`{"exclude":["`+badID+`"]}`)
 if second.Code!=200||second.Body.String()!="valid content"{t.Fatalf("bad head blocked later file: %d %s",second.Code,second.Body.String())}
 goodID:=second.Header().Get("X-Glauka-Delivery-ID")
 if out:=reliableFileRequest(t,s,"confirm",`{"id":"`+goodID+`","action":"imported"}`);out.Code!=200{t.Fatalf("later file ACK failed: %d",out.Code)}
 if len(s.externalQueue)!=1||s.externalQueue[0]!=missing{t.Fatal("failed file was silently removed")}
 retry:=reliableFileRequest(t,s,"pending","{}");if retry.Header().Get("X-Glauka-Delivery-ID")!=badID{t.Fatal("deferred delivery lost its stable ID")}
}

func TestExternalStreamKeepsExactBodyLengthAndRetainsOversizedFiles(t *testing.T){
 s,path:=reliableFileService(t)
 data:=bytes.Repeat([]byte("x"),4096)
 if err:=os.WriteFile(path,data,0600);err!=nil{t.Fatal(err)}
 reply:=reliableFileRequest(t,s,"pending","{}")
 if reply.Code!=200||!bytes.Equal(reply.Body.Bytes(),data)||reply.Header().Get("Content-Length")!="4096"||len(s.externalQueue)!=1{t.Fatal("stream was unbounded, truncated or dequeued before ACK")}
 file,err:=os.OpenFile(path,os.O_WRONLY,0600);if err!=nil{t.Fatal(err)}
 if err=file.Truncate((100<<20)+1);err!=nil{t.Fatal(err)};file.Close()
 rejected:=reliableFileRequest(t,s,"pending","{}")
 if rejected.Code!=409||rejected.Body.Len()>4096||len(s.externalQueue)!=1{t.Fatal("oversized file was read or silently discarded")}
}
