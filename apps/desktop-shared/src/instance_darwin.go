//go:build darwin

package main

import (
    "errors"
    "os"
    "path/filepath"
    "syscall"
)

// An advisory lock is held for the entire lifetime of the Swift-hosted Go
// backend. The stable lock file must not be removed: deleting a held lock
// could let two launchers lock different inodes and overwrite user projects.
func acquireAppInstance(dir string, developer bool) (bool, func(), error) {
    if err := os.MkdirAll(dir,0700); err != nil {return false,nil,err}
    path := filepath.Join(dir, "glauka-mac-instance.lock")
    file, err := os.OpenFile(path,os.O_CREATE|os.O_RDWR,0600)
    if err != nil {return false,nil,err}
    if err := syscall.Flock(int(file.Fd()),syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
        _ = file.Close()
        if errors.Is(err,syscall.EWOULDBLOCK)||errors.Is(err,syscall.EAGAIN) {
            return false,func(){},nil
        }
        return false,nil,err
    }
    release:=func(){_ = syscall.Flock(int(file.Fd()),syscall.LOCK_UN);_ = file.Close()}
    return true,release,nil
}

// Finder dispatch is handled by Cocoa/LaunchServices; the Go instance never
// invokes a different user's window or guesses a running application's PID.
func focusExistingGlaukaWindow(developer bool) {}
