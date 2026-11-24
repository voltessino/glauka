//go:build windows

package main

import (
	"errors"
	"fmt"
	webview "github.com/jchv/go-webview2"
	"github.com/jchv/go-webview2/webviewloader"
	"path/filepath"
	"runtime"
	"syscall"
	"unsafe"
)

// Win32 RECT accompanying WM_DPICHANGED. The recommended rectangle uses
// native screen pixels, not CSS pixels; Windows should never stretch Glauka
// after dragging its WebView2 window to a different-DPI monitor.
type dpiSuggestedRect struct {
	left, top, right, bottom int32
}

// Resource IDs are assigned by goversioninfo. Adding the DPI manifest moved
// the icon group from 1 to 2; discover it instead of loading a stale fixed ID.
func nativeWindowIconID() uint {
	module, _, _ := syscall.NewLazyDLL("kernel32.dll").NewProc("GetModuleHandleW").Call(0)
	var iconID uint
	callback := syscall.NewCallback(func(_ uintptr, _ uintptr, name uintptr, _ uintptr) uintptr {
		if name > 0 && name <= 0xffff {
			iconID = uint(name)
			return 0
		}
		return 1
	})
	syscall.NewLazyDLL("kernel32.dll").NewProc("EnumResourceNamesW").Call(module, 14, callback, 0) // RT_GROUP_ICON
	runtime.KeepAlive(callback)
	return iconID
}

// Glauka owns the HWND and taskbar identity. WebView2 is an embedded runtime;
// no Edge browser window, browser app profile or debugging pipe is launched.
func runNativeDesktop(address, configDir string) error {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	appID := "Glauka.Desktop"
	if developerEdition() {
		appID += ".Developer"
	}
	id, _ := syscall.UTF16PtrFromString(appID)
	syscall.NewLazyDLL("shell32.dll").NewProc("SetCurrentProcessExplicitAppUserModelID").Call(uintptr(unsafe.Pointer(id)))
	if version, err := webviewloader.GetInstalledVersion(); err != nil || version == "" {
		return errors.New("Installa Microsoft WebView2 Runtime per aprire Glauka: https://developer.microsoft.com/microsoft-edge/webview2/")
	}
	profile := "webview-profile"
	if developerEdition() {
		profile += "-developer"
	}
	title := "Glauka"
	if developerEdition() {
		title += " — Developer"
	}
	screen := syscall.NewLazyDLL("user32.dll").NewProc("GetSystemMetrics")
	sw, _, _ := screen.Call(0)
	sh, _, _ := screen.Call(1)
	width, height := uint(1180), uint(760)
	if sw > 0 && uint(sw)*9/10 < width {
		width = uint(sw) * 9 / 10
	}
	if sh > 0 && uint(sh)*9/10 < height {
		height = uint(sh) * 9 / 10
	}
	view := webview.NewWithOptions(webview.WebViewOptions{DataPath: filepath.Join(configDir, profile), AutoFocus: true, Debug: false, WindowOptions: webview.WindowOptions{Title: title, Width: width, Height: height, IconId: nativeWindowIconID(), Center: true}})
	if view == nil {
		return errors.New("Impossibile inizializzare la finestra Glauka. Installa Microsoft WebView2 Runtime, quindi riapri Glauka.")
	}
	defer view.Destroy()
	view.SetSize(min(720, int(width)), min(480, int(height)), webview.HintMin)
	hwnd := uintptr(view.Window())
	clipboardOwner.Store(hwnd)
	defer clipboardOwner.Store(0)
	user := syscall.NewLazyDLL("user32.dll")
	oldProc, _, getErr := user.NewProc("GetWindowLongPtrW").Call(hwnd, ^uintptr(3))
	if oldProc == 0 {
		return fmt.Errorf("Impossibile leggere la procedura della finestra Windows: %v", getErr)
	}
	closing := false
	closePending := false
	closeSequence := 0
	const closeTimerID = uintptr(0x474C4155)
	stopCloseTimer := func() { user.NewProc("KillTimer").Call(hwnd, closeTimerID) }
	if err := view.Bind("glaukaCloseAnswered", func(id int, approved bool) {
		view.Dispatch(func() {
			// Ignore late replies from an abandoned close attempt.
			if closing || !closePending || id != closeSequence {
				return
			}
			closePending = false
			stopCloseTimer()
			if approved {
				closing = true
				user.NewProc("PostMessageW").Call(hwnd, 0x10, 0, 0)
			}
		})
	}); err != nil {
		return err
	}
	// A hung WebView2 must not trap the native window. The longer timeout
	// avoids interrupting a legitimate Save/Discard decision. Never force-close
	// without explicit confirmation, since unsaved work may be lost.
	confirmForcedClose := func() {
		message, _ := syscall.UTF16PtrFromString("Glauka non risponde alla richiesta di chiusura.\n\nVuoi terminare l'app senza attendere? Le modifiche non salvate potrebbero andare perse.\n\nScegli No per mantenere Glauka aperta.")
		caption, _ := syscall.UTF16PtrFromString("Glauka — chiusura in attesa")
		// MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2: the safe default is No.
		reply, _, _ := user.NewProc("MessageBoxW").Call(hwnd,
			uintptr(unsafe.Pointer(message)), uintptr(unsafe.Pointer(caption)), 0x134)
		closePending = false
		closeSequence++
		stopCloseTimer()
		if reply == 6 {
			closing = true
			user.NewProc("PostMessageW").Call(hwnd, 0x10, 0, 0)
		}
	}
	// Keep the themed Save / Discard / Cancel lifecycle before destroying the HWND.
	callback := syscall.NewCallback(func(h, msg, w, l uintptr) uintptr {
		if msg == 0x02E0 && l != 0 { // WM_DPICHANGED
			// PerMonitorV2 sends the recommended physical-pixel window rect.
			// Resizing produces WM_SIZE for the WebView2 host; the browser then
			// updates CSS viewport and devicePixelRatio instead of bitmap scaling.
			rect := (*dpiSuggestedRect)(unsafe.Pointer(l))
			width, height := int64(rect.right)-int64(rect.left), int64(rect.bottom)-int64(rect.top)
			if width > 0 && height > 0 {
				user.NewProc("SetWindowPos").Call(h, 0,
					uintptr(int64(rect.left)), uintptr(int64(rect.top)),
					uintptr(width), uintptr(height), 0x0014) // SWP_NOZORDER | SWP_NOACTIVATE
			}
			return 0
		}
		if msg == 0x0113 && w == closeTimerID && closePending { // WM_TIMER
			confirmForcedClose()
			return 0
		}
		if msg == 0x10 && !closing { // WM_CLOSE
			if closePending {
				// Second click on X offers an immediate native escape hatch.
				confirmForcedClose()
				return 0
			}
			closePending = true
			closeSequence++
			request := fmt.Sprintf("Promise.resolve(window.NeuroMapLifecycle?window.NeuroMapLifecycle.requestClose():true).then(ok=>glaukaCloseAnswered(%d,!!ok)).catch(err=>{console.error(err);glaukaCloseAnswered(%d,false)})", closeSequence, closeSequence)
			timer, _, _ := user.NewProc("SetTimer").Call(hwnd, closeTimerID, 90000, 0)
			if timer == 0 {
				confirmForcedClose()
				return 0
			}
			view.Eval(request)
			return 0
		}
		result, _, _ := user.NewProc("CallWindowProcW").Call(oldProc, h, msg, w, l)
		return result
	})
	installed, _, setErr := user.NewProc("SetWindowLongPtrW").Call(hwnd, ^uintptr(3), callback)
	if installed == 0 {
		return fmt.Errorf("Impossibile inizializzare la gestione della finestra Windows: %v", setErr)
	}
	view.Navigate(address)
	view.Run()
	stopCloseTimer()
	runtime.KeepAlive(callback)
	return nil
}
