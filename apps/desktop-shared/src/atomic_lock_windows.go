//go:build windows

package main

import (
	"crypto/sha256"
	"fmt"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"unsafe"
)

var atomicKernel32 = syscall.NewLazyDLL("kernel32.dll")
var atomicCreateMutex = atomicKernel32.NewProc("CreateMutexW")
var atomicWaitMutex = atomicKernel32.NewProc("WaitForSingleObject")
var atomicReleaseMutex = atomicKernel32.NewProc("ReleaseMutex")
var atomicCloseMutex = atomicKernel32.NewProc("CloseHandle")

// The replacement fallback temporarily moves the original aside. A per-path
// OS mutex coordinates that transaction across app instances. Windows releases
// an abandoned mutex when a process dies, unlike a persistent lock-file flag.
func lockAtomicReplacement(path string) (func(), error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256([]byte(strings.ToLower(filepath.Clean(absolute))))
	name, err := syscall.UTF16PtrFromString(fmt.Sprintf("Local\\NeuroMapFile-%x", sum))
	if err != nil {
		return nil, err
	}
	// A Windows mutex belongs to a thread, so acquisition and release must stay
	// on the same OS thread even if the Go scheduler moves other goroutines.
	runtime.LockOSThread()
	handle, _, callErr := atomicCreateMutex.Call(0, 0, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		runtime.UnlockOSThread()
		return nil, fmt.Errorf("create file replacement mutex: %v", callErr)
	}
	result, _, waitErr := atomicWaitMutex.Call(handle, 10000)
	if result != 0 && result != 0x80 { // WAIT_OBJECT_0 or WAIT_ABANDONED
		atomicCloseMutex.Call(handle)
		runtime.UnlockOSThread()
		return nil, fmt.Errorf("file replacement is busy or unavailable (wait=%d): %v", result, waitErr)
	}
	return func() { atomicReleaseMutex.Call(handle); atomicCloseMutex.Call(handle); runtime.UnlockOSThread() }, nil
}
