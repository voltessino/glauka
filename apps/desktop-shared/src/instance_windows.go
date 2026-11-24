//go:build windows

package main

import (
	"crypto/sha256"
	"fmt"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

var instanceKernel32 = syscall.NewLazyDLL("kernel32.dll")
var instanceCreateMutex = instanceKernel32.NewProc("CreateMutexW")
var instanceCloseHandle = instanceKernel32.NewProc("CloseHandle")

// A kernel mutex outlives launcher races and disappears automatically on crashes.
// Scope it to this user's application directory and edition; never use a global lock.
func acquireAppInstance(dir string, developer bool) (bool, func(), error) {
	absolute, err := filepath.Abs(dir)
	if err != nil {
		return false, nil, err
	}
	edition := "standard"
	if developer {
		edition = "developer"
	}
	hash := sha256.Sum256([]byte(strings.ToLower(filepath.Clean(absolute)) + "|" + edition))
	ptr, err := syscall.UTF16PtrFromString(fmt.Sprintf("Local\\GlaukaInstance-%x", hash[:16]))
	if err != nil {
		return false, nil, err
	}
	handle, _, callErr := instanceCreateMutex.Call(0, 0, uintptr(unsafe.Pointer(ptr)))
	if handle == 0 {
		return false, nil, fmt.Errorf("mutex Glauka non disponibile: %v", callErr)
	}
	return callErr != syscall.ERROR_ALREADY_EXISTS, func() { instanceCloseHandle.Call(handle) }, nil
}

var appUser32 = syscall.NewLazyDLL("user32.dll")
var appEnumWindows = appUser32.NewProc("EnumWindows")
var appGetWindowText = appUser32.NewProc("GetWindowTextW")
var appGetClassName = appUser32.NewProc("GetClassNameW")
var appIsWindowVisible = appUser32.NewProc("IsWindowVisible")
var appShowWindowAsync = appUser32.NewProc("ShowWindowAsync")
var appSetForegroundWindow = appUser32.NewProc("SetForegroundWindow")

// Restore the existing Glauka Chromium app window when Explorer delegates a
// second launch. Never bring an unrelated foreground window to the front.
func focusExistingGlaukaWindow(developer bool) {
	target := "Glauka"
	if developer {
		target = "Glauka — Developer"
	}
	callback := syscall.NewCallback(func(hwnd uintptr, _ uintptr) uintptr {
		visible, _, _ := appIsWindowVisible.Call(hwnd)
		if visible == 0 {
			return 1
		}
		var class [128]uint16
		if n, _, _ := appGetClassName.Call(hwnd, uintptr(unsafe.Pointer(&class[0])), uintptr(len(class))); n == 0 || (syscall.UTF16ToString(class[:]) != "webview" && !strings.HasPrefix(syscall.UTF16ToString(class[:]), "Chrome_WidgetWin_")) {
			return 1
		}
		var title [260]uint16
		if n, _, _ := appGetWindowText.Call(hwnd, uintptr(unsafe.Pointer(&title[0])), uintptr(len(title))); n == 0 {
			return 1
		}
		name := syscall.UTF16ToString(title[:])
		if name != target && !strings.HasPrefix(name, target+" -") && !strings.HasPrefix(name, target+" —") {
			return 1
		}
		appShowWindowAsync.Call(hwnd, 9) // SW_RESTORE; no forced always-on-top flag.
		appSetForegroundWindow.Call(hwnd)
		return 0
	})
	appEnumWindows.Call(callback, 0)
}
