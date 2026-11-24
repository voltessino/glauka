//go:build windows

package main

import (
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

func runningInStorePackage() bool {
	proc := syscall.NewLazyDLL("kernel32.dll").NewProc("GetCurrentPackageFullName")
	var length uint32
	result, _, _ := proc.Call(uintptr(unsafe.Pointer(&length)), 0)
	// APPMODEL_ERROR_NO_PACKAGE: this process is the normal EXE, not an MSIX.
	if result == 15700 || length == 0 || length > 2048 {
		return false
	}
	buffer := make([]uint16, length)
	result, _, _ = proc.Call(uintptr(unsafe.Pointer(&length)), uintptr(unsafe.Pointer(&buffer[0])))
	return result == 0 && syscall.UTF16ToString(buffer) != ""
}

func oldUnpackagedInstall() bool {
	local := os.Getenv("LOCALAPPDATA")
	if local == "" {
		return false
	}
	matches, err := filepath.Glob(filepath.Join(local, "Programs", "Glauka", "Glauka-*.exe"))
	if err != nil {
		return false
	}
	for _, match := range matches {
		if !strings.Contains(strings.ToLower(match), "windowsapps") {
			return true
		}
	}
	return false
}
