//go:build windows

package main

import (
	"errors"
	"image"
	"runtime"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"
)

var clipboardOwner atomic.Uintptr

func writeClipboardPNG(data []byte, img image.Image) error {
	hwnd := clipboardOwner.Load()
	if hwnd == 0 {
		return errors.New("Finestra Glauka non disponibile per gli appunti")
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	user := syscall.NewLazyDLL("user32.dll")
	kernel := syscall.NewLazyDLL("kernel32.dll")
	alloc := func(data []byte) (uintptr, error) {
		h, _, _ := kernel.NewProc("GlobalAlloc").Call(2, uintptr(len(data)))
		if h == 0 {
			return 0, errors.New("Memoria appunti insufficiente")
		}
		p, _, _ := kernel.NewProc("GlobalLock").Call(h)
		if p == 0 {
			kernel.NewProc("GlobalFree").Call(h)
			return 0, errors.New("Appunti non accessibili")
		}
		copy(unsafe.Slice((*byte)(unsafe.Pointer(p)), len(data)), data)
		kernel.NewProc("GlobalUnlock").Call(h)
		return h, nil
	}
	// Fill the native DIB in-place to avoid retaining an additional Go
	// allocation of up to 160 MB while exporting large mind maps.
	dibSize, err := clipboardDIBSize(img.Bounds())
	if err != nil { return err }
	pngHandle, err := alloc(data)
	if err != nil {
		return err
	}
	defer func() {
		if pngHandle != 0 {
			kernel.NewProc("GlobalFree").Call(pngHandle)
		}
	}()
	dibHandle, _, _ := kernel.NewProc("GlobalAlloc").Call(2, uintptr(dibSize))
	if dibHandle == 0 {
		return errors.New("Memoria appunti insufficiente")
	}
	defer func() {
		if dibHandle != 0 {
			kernel.NewProc("GlobalFree").Call(dibHandle)
		}
	}()
	dibPtr, _, _ := kernel.NewProc("GlobalLock").Call(dibHandle)
	if dibPtr == 0 {
		return errors.New("Appunti non accessibili")
	}
	encodeErr := encodeClipboardDIBV5(unsafe.Slice((*byte)(unsafe.Pointer(dibPtr)), dibSize), img)
	kernel.NewProc("GlobalUnlock").Call(dibHandle)
	if encodeErr != nil { return encodeErr }
	opened := false
	for i := 0; i < 8; i++ {
		ok, _, _ := user.NewProc("OpenClipboard").Call(hwnd)
		if ok != 0 {
			opened = true
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if !opened {
		return errors.New("Appunti occupati. Riprova.")
	}
	defer user.NewProc("CloseClipboard").Call()
	name, _ := syscall.UTF16PtrFromString("PNG")
	format, _, _ := user.NewProc("RegisterClipboardFormatW").Call(uintptr(unsafe.Pointer(name)))
	if format == 0 {
		return errors.New("Formato PNG non disponibile")
	}
	ok, _, _ := user.NewProc("EmptyClipboard").Call()
	if ok == 0 {
		return errors.New("Appunti non disponibili")
	}
	result, _, _ := user.NewProc("SetClipboardData").Call(format, pngHandle)
	if result == 0 {
		return errors.New("Copia PNG non riuscita")
	}
	pngHandle = 0
	result, _, _ = user.NewProc("SetClipboardData").Call(17, dibHandle)
	if result != 0 {
		dibHandle = 0
	}
	return nil
}
