package main

import (
 "encoding/json"
 "fmt"
 "os"
 "path/filepath"
 "runtime"
 "strings"
 "sync"
 "testing"
)

func TestApprovedPathsPersistEveryConcurrentGrant(t *testing.T) {
 dir := t.TempDir()
 s := &service{configDir:dir,approvedPaths:make(map[string]bool)}
 const n=64
 var wg sync.WaitGroup
 failures:=make(chan error,n)
 start:=make(chan struct{})
 for i:=0;i<n;i++{
  wg.Add(1)
  go func(i int){
   defer wg.Done()
   <-start
   file:=filepath.Join(dir,fmt.Sprintf("map-%03d.gk",i))
   if err:=s.approvePath(file);err!=nil{failures<-err}
  }(i)
 }
 close(start)
 wg.Wait()
 close(failures)
 for err:=range failures{t.Fatalf("concurrent path persistence failed: %v",err)}
 data,err:=os.ReadFile(filepath.Join(dir,"approved-project-paths.json"))
 if err!=nil{t.Fatal(err)}
 var onDisk map[string]bool
 if err:=json.Unmarshal(data,&onDisk);err!=nil{t.Fatal(err)}
 if len(onDisk)!=n{t.Fatalf("lost persisted approvals: expected %d, got %d",n,len(onDisk))}
 restarted:=&service{configDir:dir}
 restarted.loadPaths()
 for i:=0;i<n;i++{
  name:=filepath.Join(dir,fmt.Sprintf("map-%03d.gk",i))
  if !restarted.authorizedPath(name){t.Fatalf("grant %s lost after restart",name)}
 }
}

func TestApprovedPathsNeverGrantOtherCaseOnCaseSensitiveSystems(t *testing.T) {
 dir:=t.TempDir()
 s:=&service{configDir:dir}
 original:=filepath.Join(dir,"Anatomia.gk")
 if err:=s.approvePath(original);err!=nil{t.Fatal(err)}
 if !s.authorizedPath(original){t.Fatal("approved file not recognized")}
 variant:=filepath.Join(dir,"anatomia.gk")
 if runtime.GOOS=="windows"{
  if !s.authorizedPath(variant){t.Fatal("Windows approval should be case-insensitive")}
 }else if s.authorizedPath(variant){
  t.Fatal("a differently cased path must not inherit an authorization on case-sensitive filesystems")
 }
}

func TestApprovedPathKeyRemovesTraversalSegments(t *testing.T) {
 dir:=t.TempDir()
 input:=filepath.Join(dir,"projects","..","Anatomia.gk")
 key,err:=approvedPathKey(input)
 if err!=nil{t.Fatal(err)}
 if strings.Contains(key,".."){t.Fatalf("unclean authorization key %q",key)}
}
