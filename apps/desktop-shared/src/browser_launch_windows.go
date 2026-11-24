//go:build windows

package main

import (
	"encoding/binary"
	"os"
	"runtime"
	"strings"
	"syscall"
	"unsafe"
)

// Ask Windows to show the first app window without activating it. This applies
// only at process startup; subsequent clicks/Alt+Tab behave normally. No topmost
// window or global focus policy is installed, and no other app is reactivated.
func startDesktopBrowser(browser string, args []string) (func(), error) {
	// Chromium reads JSON from CRT fd 3 and writes to fd 4. Supply only these
	// inherited pipe handles; parent endpoints are explicitly non-inheritable.
	var childRead, parentWrite, parentRead, childWrite syscall.Handle
	sa := syscall.SecurityAttributes{Length: uint32(unsafe.Sizeof(syscall.SecurityAttributes{})), InheritHandle: 1}
	if err := syscall.CreatePipe(&childRead, &parentWrite, &sa, 0); err != nil {
		return nil, err
	}
	defer syscall.CloseHandle(childRead)
	if err := syscall.CreatePipe(&parentRead, &childWrite, &sa, 0); err != nil {
		syscall.CloseHandle(parentWrite)
		return nil, err
	}
	defer syscall.CloseHandle(childWrite)
	reader := os.NewFile(uintptr(parentRead), "neuromap-browser-read")
	writer := os.NewFile(uintptr(parentWrite), "neuromap-browser-write")
	cleanup := true
	defer func() {
		if cleanup {
			reader.Close()
			writer.Close()
		}
	}()
	if err := syscall.SetHandleInformation(parentRead, syscall.HANDLE_FLAG_INHERIT, 0); err != nil {
		return nil, err
	}
	if err := syscall.SetHandleInformation(parentWrite, syscall.HANDLE_FLAG_INHERIT, 0); err != nil {
		return nil, err
	}
	args = append(args, "--remote-debugging-pipe")
	application, err := syscall.UTF16PtrFromString(browser)
	if err != nil {
		return nil, err
	}
	quoted := make([]string, 0, len(args)+1)
	for _, arg := range append([]string{browser}, args...) {
		quoted = append(quoted, syscall.EscapeArg(arg))
	}
	command, err := syscall.UTF16PtrFromString(strings.Join(quoted, " "))
	if err != nil {
		return nil, err
	}
	// STARTUPINFO's CRT-reserved fields are hidden in Go's syscall definition.
	type startupWithCRT struct {
		Cb                                                                 uint32
		Reserved, Desktop, Title                                           *uint16
		X, Y, XSize, YSize, XCountChars, YCountChars, FillAttribute, Flags uint32
		ShowWindow, ReservedSize                                           uint16
		ReservedData                                                       *byte
		StdInput, StdOutput, StdErr                                        syscall.Handle
	}
	const count = 5
	block := make([]byte, 4+count+count*int(unsafe.Sizeof(uintptr(0))))
	binary.LittleEndian.PutUint32(block, count)
	for i := 0; i < count; i++ {
		if unsafe.Sizeof(uintptr(0)) == 8 {
			binary.LittleEndian.PutUint64(block[4+count+i*8:], ^uint64(0))
		} else {
			binary.LittleEndian.PutUint32(block[4+count+i*4:], ^uint32(0))
		}
	}
	block[4+3] = 9
	block[4+4] = 9 // CRT FOPEN | FPIPE
	if unsafe.Sizeof(uintptr(0)) == 8 {
		binary.LittleEndian.PutUint64(block[4+count+3*8:], uint64(childRead))
		binary.LittleEndian.PutUint64(block[4+count+4*8:], uint64(childWrite))
	} else {
		binary.LittleEndian.PutUint32(block[4+count+3*4:], uint32(childRead))
		binary.LittleEndian.PutUint32(block[4+count+4*4:], uint32(childWrite))
	}
	startup := startupWithCRT{Cb: uint32(unsafe.Sizeof(syscall.StartupInfo{})), Flags: syscall.STARTF_USESHOWWINDOW, ShowWindow: syscall.SW_SHOWNOACTIVATE, ReservedSize: uint16(len(block)), ReservedData: &block[0]}
	var process syscall.ProcessInformation
	if err := syscall.CreateProcess(application, command, nil, nil, true, 0, nil, nil, (*syscall.StartupInfo)(unsafe.Pointer(&startup)), &process); err != nil {
		return nil, err
	}
	runtime.KeepAlive(block)
	_ = syscall.CloseHandle(process.Thread)
	cleanup = false
	pipe := newBrowserPipe(reader, writer)
	go pipe.start()
	return func() {
		_, _ = syscall.WaitForSingleObject(process.Process, syscall.INFINITE)
		pipe.close()
		_ = syscall.CloseHandle(process.Process)
	}, nil
}
