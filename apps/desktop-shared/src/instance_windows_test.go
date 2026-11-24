//go:build windows

package main

import "testing"

func TestWindowsGlaukaMutexAllowsOnlyOneOwner(t *testing.T){
 dir:=t.TempDir()
 first,closeFirst,err:=acquireAppInstance(dir,false)
 if err!=nil{t.Fatal(err)}
 if !first{t.Fatal("first launcher must own the instance")}
 second,closeSecond,err:=acquireAppInstance(dir,false)
 if err!=nil{closeFirst();t.Fatal(err)}
 if second{closeSecond();closeFirst();t.Fatal("second launcher unexpectedly became owner")}
 closeSecond()
 closeFirst()
 third,closeThird,err:=acquireAppInstance(dir,false)
 if err!=nil{t.Fatal(err)}
 defer closeThird()
 if !third{t.Fatal("new launch after exit must become owner")}
}
