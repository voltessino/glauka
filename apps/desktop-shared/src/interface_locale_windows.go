//go:build windows

package main

import "syscall"

func defaultInterfaceLocale() string {
	id, _, _ := syscall.NewLazyDLL("kernel32.dll").NewProc("GetUserDefaultUILanguage").Call()
	if code := map[uintptr]string{0x10: "it", 0x09: "en", 0x07: "de", 0x0a: "es", 0x0c: "fr", 0x16: "pt", 0x01: "ar", 0x04: "zh-CN"}[id&0x3ff]; code != "" {
		return code
	}
	return "en"
}
