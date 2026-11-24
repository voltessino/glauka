//go:build windows

package main

import (
	"errors"
	"fmt"
	"syscall"
	"unsafe"
)

type dpapiBlob struct {
	size uint32
	data *byte
}

func protectSecret(data []byte, decrypt bool) ([]byte, error) {
	if len(data) == 0 {
		return []byte{}, nil
	}
	var in dpapiBlob
	in.size = uint32(len(data))
	in.data = &data[0]
	var out dpapiBlob
	var name string
	if decrypt {
		name = "CryptUnprotectData"
	} else {
		name = "CryptProtectData"
	}
	dll := syscall.NewLazyDLL("crypt32.dll")
	proc := dll.NewProc(name)
	// CryptUnprotectData(DATA_BLOB*,LPWSTR*,DATA_BLOB*,PVOID*,CRYPTPROTECT_PROMPTSTRUCT*,DWORD,DATA_BLOB*)
	// CryptProtectData(DATA_BLOB*,LPCWSTR,DATA_BLOB*,PVOID*,CRYPTPROTECT_PROMPTSTRUCT*,DWORD,DATA_BLOB*)
	r1, _, callErr := proc.Call(uintptr(unsafe.Pointer(&in)), 0, 0, 0, 0, 1, uintptr(unsafe.Pointer(&out)))
	if r1 == 0 {
		return nil, fmt.Errorf("Windows DPAPI: %w", callErr)
	}
	defer syscall.NewLazyDLL("kernel32.dll").NewProc("LocalFree").Call(uintptr(unsafe.Pointer(out.data)))
	if out.size == 0 {
		return []byte{}, nil
	}
	if out.size > 8192 {
		return nil, errors.New("DPAPI: chiave troppo grande")
	}
	return append([]byte(nil), unsafe.Slice(out.data, out.size)...), nil
}
