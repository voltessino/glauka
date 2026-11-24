package main

import (
 "bytes"
 "fmt"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

// 1,000 independent synthetic people, each with a distinct project path.
func TestTimeMachineThousandIndependentPersonas(t *testing.T) {
 home:=t.TempDir()
 cfg:=filepath.Join(home,"config")
 for i:=0;i<1000;i++ {
  dir:=filepath.Join(home,fmt.Sprintf("user-%04d",i))
  if err:=os.MkdirAll(dir,0700);err!=nil{t.Fatal(err)}
  ext:=".neuromap";if i%2==1{ext=".xmind"}
  name:=fmt.Sprintf("map-%d",i);if i%13==0{name=fmt.Sprintf("Mappa à Δ %d",i)}
  project:=filepath.Join(dir,name+ext)
  old:=[]byte(fmt.Sprintf("{\"root\":{\"id\":\"r-%d\",\"notes\":\"🌱\",\"children\":[]}}",i))
  if ext==".xmind"{old=[]byte(fmt.Sprintf("PK\x03\x04binary%x",i))}
  next:=[]byte(fmt.Sprintf("changed-%d",i))
  if i%19==0{next=old}
  if i%29==0 {
   first,err:=stageProjectRevision(cfg,project,next)
   if err!=nil||first!=""{t.Fatalf("user %d initial: %q %v",i,first,err)}
  }
  if err:=os.WriteFile(project,old,0600);err!=nil{t.Fatal(err)}
  version,err:=stageProjectRevision(cfg,project,next)
  if err!=nil{t.Fatalf("user %d archive: %v",i,err)}
  if bytes.Equal(old,next){if version!=""{t.Fatalf("user %d duplicate archive",i)};continue}
  if version==""{t.Fatalf("user %d no archived revision",i)}
  original,err:=readProjectRevision(cfg,project,version)
  if err!=nil||!bytes.Equal(original,old){t.Fatalf("user %d archive differs",i)}
  if err:=os.WriteFile(project,next,0600);err!=nil{t.Fatal(err)}
  recovered,err:=recoverProjectRevision(cfg,project,version)
  if err!=nil{t.Fatalf("user %d recover: %v",i,err)}
  data,err:=os.ReadFile(recovered)
  if err!=nil||!bytes.Equal(data,old){t.Fatalf("user %d recovered mismatch",i)}
  current,err:=os.ReadFile(project)
  if err!=nil||!bytes.Equal(current,next){t.Fatalf("user %d original changed",i)}
  if _,err:=recoverProjectRevision(cfg,project,version);!os.IsExist(err){t.Fatalf("user %d overwrite allowed: %v",i,err)}
  if err:=pruneProjectRevisions(cfg,project);err!=nil{t.Fatal(err)}
  versions,err:=listProjectRevisions(cfg,project)
  if err!=nil||len(versions)!=1{t.Fatalf("user %d retention: %v",i,err)}
  if strings.HasPrefix(filepath.Base(recovered),"../"){t.Fatal("unsafe path")}
 }
}
