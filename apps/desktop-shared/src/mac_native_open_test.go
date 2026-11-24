package main

import (
    "bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestMacNativeOpenUsesLiteralJSONPathsAndDeduplicates(t *testing.T) {
	if runtime.GOOS == "windows" { t.Skip("Windows does not allow newlines in filenames") }
	dir := t.TempDir()
	path := filepath.Join(dir, "a quote \" and newline\nproject.gk")
	if err := os.WriteFile(path, []byte("{}"), 0600); err != nil { t.Fatal(err) }
	event, err := json.Marshal(map[string]string{"path": path})
	if err != nil { t.Fatal(err) }
	service := &service{}
	service.readMacNativeOpens(strings.NewReader(string(event)+"\n"+string(event)+"\n"))
	if len(service.externalQueue)!=1 || service.externalQueue[0]!=path {
		t.Fatalf("expected exactly one literal filepath, got %#v", service.externalQueue)
	}
}

func TestMacNativeOpenRejectsInvalidAndOversizedFiles(t *testing.T) {
	dir := t.TempDir()
	good := filepath.Join(dir, "ok.gk")
	badExt := filepath.Join(dir, "script.sh")
	large := filepath.Join(dir, "oversized.xmind")
	if err := os.WriteFile(good, []byte("{}"), 0600); err != nil { t.Fatal(err) }
	if err := os.WriteFile(badExt, []byte("ignored"), 0600); err != nil { t.Fatal(err) }
	handle, err := os.Create(large)
	if err != nil { t.Fatal(err) }
	if err := handle.Truncate(101<<20); err != nil { t.Fatal(err) }
	if err := handle.Close(); err != nil { t.Fatal(err) }
	s := &service{}
	for _, path := range []string{"relative.gk", badExt, large, filepath.Join(dir, "missing.gk")} {
		if s.queueMacNativeOpen(path) { t.Fatalf("unexpected acceptance: %q",path) }
	}
	if !s.queueMacNativeOpen(good) || len(s.externalQueue)!=1 { t.Fatal("expected valid file") }
}

func TestMacNativeOpenQueueBounded(t *testing.T) {
	s := &service{}
	dir := t.TempDir()
	for i:=0;i<65;i++ {
		path:=filepath.Join(dir,strings.Repeat("n",i+1)+".gk")
		if err:=os.WriteFile(path, []byte("{}"),0600); err!=nil { t.Fatal(err) }
		accepted:=s.queueMacNativeOpen(path)
		if accepted!=(i<64) { t.Fatalf("entry %d acceptance = %v",i,accepted) }
	}
	if len(s.externalQueue)!=64 { t.Fatalf("queue size: %d",len(s.externalQueue)) }
}

func TestMacDocumentOpenAcknowledgesAcceptedAndRejectedFiles(t *testing.T) {
    dir := t.TempDir()
    valid := filepath.Join(dir, "map.gk")
    if err := os.WriteFile(valid, []byte("{}"), 0600); err != nil { t.Fatal(err) }
    const id1 = "550e8400-e29b-41d4-a716-446655440000"
    const id2 = "550e8400-e29b-41d4-a716-446655440001"
    var output bytes.Buffer
    s := &service{}
    s.readMacNativeOpensWithReplies(strings.NewReader(
        `{"id":"`+id1+`","path":`+mustJSONFilePath(t, valid)+`}`+"\n"+
        `{"id":"`+id2+`","path":"relative/map.gk"}`+"\n",
    ), &output)
    decoder := json.NewDecoder(&output)
    var accepted, rejected macOpenReply
    if err:=decoder.Decode(&accepted); err!=nil{t.Fatal(err)}
    if err:=decoder.Decode(&rejected); err!=nil{t.Fatal(err)}
    if accepted.ID!=id1 || !accepted.OK || accepted.Reason!="" {
        t.Fatalf("unexpected accepted acknowledgement %#v",accepted)
    }
    if rejected.ID!=id2 || rejected.OK || rejected.Reason!="invalid" {
        t.Fatalf("unexpected rejected acknowledgement %#v",rejected)
    }
    if len(s.externalQueue)!=1 || s.externalQueue[0]!=valid {
        t.Fatalf("unacknowledged or invalid path entered queue: %#v",s.externalQueue)
    }
}

func TestMacDocumentOpenFullQueueRespondsBusy(t *testing.T) {
    dir := t.TempDir()
    path := filepath.Join(dir, "extra.xmind")
    if err := os.WriteFile(path, []byte("map"), 0600); err!=nil { t.Fatal(err) }
    service := &service{externalQueue: make([]string,64)}
    for i:=range service.externalQueue {service.externalQueue[i]="/already-queued/"+strings.Repeat("a",i+1)+".gk"}
    const id="550e8400-e29b-41d4-a716-446655440000"
    var output bytes.Buffer
    service.readMacNativeOpensWithReplies(strings.NewReader(
        `{"id":"`+id+`","path":`+mustJSONFilePath(t,path)+`}`+"\n"),&output)
    var reply macOpenReply
    if err:=json.Unmarshal(bytes.TrimSpace(output.Bytes()), &reply);err!=nil{t.Fatal(err)}
    if reply.ID!=id || reply.OK || reply.Reason!="busy" {t.Fatalf("unexpected full queue reply %#v",reply)}
    if len(service.externalQueue)!=64 {t.Fatalf("full queue was changed")}
}

func mustJSONFilePath(t *testing.T, path string) string {
    t.Helper()
    encoded,err:=json.Marshal(path)
    if err!=nil{t.Fatal(err)}
    return string(encoded)
}

func TestMacDocumentOpenSameIDCannotImportDifferentFile(t *testing.T) {
    dir := t.TempDir()
    first:=filepath.Join(dir,"first.gk")
    second:=filepath.Join(dir,"second.gk")
    for _,path:=range []string{first,second}{
        if err:=os.WriteFile(path,[]byte("{}"),0600);err!=nil{t.Fatal(err)}
    }
    const id="550e8400-e29b-41d4-a716-446655440000"
    req:=func(path string)string{
        return `{"id":"`+id+`","path":`+mustJSONFilePath(t,path)+`}`+"\n"
    }
    var output bytes.Buffer
    s:=&service{}
    s.readMacNativeOpensWithReplies(strings.NewReader(req(first)+req(second)),&output)
    decoder:=json.NewDecoder(&output)
    var one,two macOpenReply
    if err:=decoder.Decode(&one);err!=nil{t.Fatal(err)}
    if err:=decoder.Decode(&two);err!=nil{t.Fatal(err)}
    if !one.OK || two.OK || two.Reason!="invalid" || len(s.externalQueue)!=1 ||
       s.externalQueue[0]!=first {
        t.Fatalf("reused UUID changed imported path: one=%+v two=%+v queue=%#v",one,two,s.externalQueue)
    }
}
