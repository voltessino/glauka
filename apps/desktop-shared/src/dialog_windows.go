//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

func showError(message string) {
	dll := syscall.NewLazyDLL("user32.dll")
	fn := dll.NewProc("MessageBoxW")
	text, _ := syscall.UTF16PtrFromString(nativeInterfaceText(message))
	title, _ := syscall.UTF16PtrFromString("Glauka")
	fn.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x10)
}
