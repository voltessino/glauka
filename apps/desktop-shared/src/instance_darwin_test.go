//go:build darwin

package main

import "testing"

func TestMacSingletonLockProtectsOneEdition(t *testing.T) {
    dir:=t.TempDir()
    first,release,err:=acquireAppInstance(dir,false)
    if err!=nil||!first{t.Fatalf("first Mac launcher should own its data: %v",err)}
    second,otherRelease,err:=acquireAppInstance(dir,false)
    if err!=nil||second{
        release()
        t.Fatalf("second Mac backend must not write the same workspace: %v",err)
    }
    if otherRelease!=nil {otherRelease()}
    release()
    third,thirdRelease,err:=acquireAppInstance(dir,false)
    if err!=nil||!third{t.Fatalf("lock not released after previous backend closed: %v",err)}
    thirdRelease()
}
func TestMacSingletonAllowsSeparateDeveloperDataDirectory(t *testing.T){
    publicDir:=t.TempDir()
    developerDir:=t.TempDir()
    first,unlockPublic,err:=acquireAppInstance(publicDir,false)
    if err!=nil||!first{t.Fatal(err)}
    defer unlockPublic()
    developer,unlockDeveloper,err:=acquireAppInstance(developerDir,true)
    if err!=nil||!developer{t.Fatal("developer backend unexpectedly shares release lock",err)}
    unlockDeveloper()
}
