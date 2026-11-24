//go:build windows

package main

import (
	"fmt"
	"runtime"
	"sync"
	"syscall"
	"unsafe"
)

// Modern shell dialogs directly: no PowerShell, CLR or hidden topmost window.
var (
	pickerOle          = syscall.NewLazyDLL("ole32.dll")
	pickerInitialize   = pickerOle.NewProc("CoInitializeEx")
	pickerUninitialize = pickerOle.NewProc("CoUninitialize")
	pickerCreate       = pickerOle.NewProc("CoCreateInstance")
	pickerFree         = pickerOle.NewProc("CoTaskMemFree")
	pickerUser         = syscall.NewLazyDLL("user32.dll")
	pickerForeground   = pickerUser.NewProc("GetForegroundWindow")
	pickerIsWindow     = pickerUser.NewProc("IsWindow")
	pickerWindowProcess = pickerUser.NewProc("GetWindowThreadProcessId")
	pickerGetProcessID = syscall.NewLazyDLL("kernel32.dll").NewProc("GetCurrentProcessId")
	pickerWindowText   = pickerUser.NewProc("GetWindowTextW")
	pickerWindowClass  = pickerUser.NewProc("GetClassNameW")
	pickerMu           sync.Mutex
)

type pickerGUID struct {
	a    uint32
	b, c uint16
	d    [8]byte
}

var (
	pickerOpenClass = pickerGUID{0xdc1c5a9c, 0xe88a, 0x4dde, [8]byte{0xa5, 0xa1, 0x60, 0xf8, 0x2a, 0x20, 0xae, 0xf7}}
	pickerOpenIID   = pickerGUID{0xd57c7288, 0xd4ad, 0x4768, [8]byte{0xbe, 0x02, 0x9d, 0x96, 0x95, 0x32, 0xd9, 0x60}}
	pickerSaveClass = pickerGUID{0xc0b4e2f3, 0xba21, 0x4773, [8]byte{0x8d, 0xba, 0x33, 0x5e, 0xc9, 0x46, 0xeb, 0x8b}}
	pickerSaveIID   = pickerGUID{0x84bccd23, 0x5fde, 0x4cdb, [8]byte{0xae, 0xa4, 0xaf, 0x64, 0xb8, 0x3d, 0x78, 0xab}}
)

// IUnknown / IModalWindow / IFileDialog / IFileOpenDialog in Windows SDK order.
const (
	pickerRelease       = 2
	pickerShow          = 3
	pickerSetTypes      = 4
	pickerSetTypeIndex  = 5
	pickerSetOptions    = 9
	pickerSetFilename   = 15
	pickerGetResult     = 20
	pickerSetExtension  = 22
	pickerGetResults    = 27
	shellGetDisplayName = 5
	shellArrayCount     = 7
	shellArrayItem      = 8
)

type pickerCOM struct{ table *[29]uintptr }

// Pointers passed synchronously to COM must escape: stack growth between this
// wrapper and SyscallN must not relocate memory referenced by uintptr arguments.
//
//go:uintptrescapes
func (c *pickerCOM) call(method int, args ...uintptr) uintptr {
	hr, _, _ := syscall.SyscallN(c.table[method], append([]uintptr{uintptr(unsafe.Pointer(c))}, args...)...)
	runtime.KeepAlive(c)
	return hr
}
func pickerError(action string, hr uintptr) error {
	if uint32(hr)&0x80000000 == 0 {
		return nil
	}
	return fmt.Errorf("Finestra file Windows (%s): HRESULT 0x%08X", action, uint32(hr))
}
func pickerOwner() uintptr {
	// The current WebView2 host registers its HWND with the clipboard bridge.
	// Prefer that exact same-process window even when Windows has shifted
	// foreground focus to a different program while opening the picker.
	hwnd := clipboardOwner.Load()
	if hwnd != 0 {
		valid, _, _ := pickerIsWindow.Call(hwnd)
		var ownerPID uint32
		pickerWindowProcess.Call(hwnd, uintptr(unsafe.Pointer(&ownerPID)))
		pid, _, _ := pickerGetProcessID.Call()
		if valid != 0 && ownerPID == uint32(pid) {
			return hwnd
		}
	}
	// Older browser-based launchers do not register the native host HWND.
	// Never assign an unrelated foreground window as the dialog owner.
	hwnd, _, _ = pickerForeground.Call()
	if hwnd == 0 {
		return 0
	}
	var title [1024]uint16
	n, _, _ := pickerWindowText.Call(hwnd, uintptr(unsafe.Pointer(&title[0])), uintptr(len(title)))
	var class [256]uint16
	pickerWindowClass.Call(hwnd, uintptr(unsafe.Pointer(&class[0])), uintptr(len(class)))
	if n == 0 || !neuroMapWindowOwner(syscall.UTF16ToString(title[:]), syscall.UTF16ToString(class[:])) {
		return 0
	}
	// Only own the user's current NeuroMap window, never an unrelated app.
	return hwnd
}
func pickerPath(item *pickerCOM) (string, error) {
	if item == nil {
		return "", fmt.Errorf("Risultato file Windows non valido")
	}
	var text *uint16
	hr := item.call(shellGetDisplayName, 0x80058000, uintptr(unsafe.Pointer(&text))) // SIGDN_FILESYSPATH
	if err := pickerError("percorso", hr); err != nil {
		return "", err
	}
	if text == nil {
		return "", fmt.Errorf("Percorso file Windows mancante")
	}
	defer pickerFree.Call(uintptr(unsafe.Pointer(text)))
	for n := 0; n < 32768; n++ {
		if *(*uint16)(unsafe.Add(unsafe.Pointer(text), n*2)) == 0 {
			return syscall.UTF16ToString(unsafe.Slice(text, n)), nil
		}
	}
	return "", fmt.Errorf("Percorso file Windows troppo lungo")
}
func windowsPick(save, multiple, export bool, suggested string) ([]string, error) {
	config, err := filePickerConfig(save, multiple, export, suggested)
	if err != nil {
		return nil, err
	}
	if !pickerMu.TryLock() {
		return nil, fmt.Errorf("È già aperta una finestra di scelta file")
	}
	defer pickerMu.Unlock()
	// All shell interfaces remain on the same STA OS thread, including cleanup.
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	hr, _, _ := pickerInitialize.Call(0, 0x2|0x4) // APARTMENTTHREADED | DISABLE_OLE1DDE
	if err = pickerError("inizializzazione", hr); err != nil {
		return nil, err
	}
	defer pickerUninitialize.Call()
	class, iid := &pickerOpenClass, &pickerOpenIID
	if save {
		class, iid = &pickerSaveClass, &pickerSaveIID
	}
	var dialog *pickerCOM
	hr, _, _ = pickerCreate.Call(uintptr(unsafe.Pointer(class)), 0, 1, uintptr(unsafe.Pointer(iid)), uintptr(unsafe.Pointer(&dialog)))
	if err = pickerError("creazione", hr); err != nil {
		return nil, err
	}
	if dialog == nil {
		return nil, fmt.Errorf("Finestra file Windows non disponibile")
	}
	type filterSpec struct{ name, pattern *uint16 }
	filters := make([]filterSpec, len(config.filters))
	var name, extension *uint16
	defer func() {
		dialog.call(pickerRelease)
		runtime.KeepAlive(filters)
		runtime.KeepAlive(name)
		runtime.KeepAlive(extension)
	}()
	for i, f := range config.filters {
		if filters[i].name, err = syscall.UTF16PtrFromString(nativeInterfaceText(f.name)); err != nil {
			return nil, err
		}
		if filters[i].pattern, err = syscall.UTF16PtrFromString(f.pattern); err != nil {
			return nil, err
		}
	}
	if err = pickerError("filtri", dialog.call(pickerSetTypes, uintptr(len(filters)), uintptr(unsafe.Pointer(&filters[0])))); err != nil {
		return nil, err
	}
	runtime.KeepAlive(filters)
	if err = pickerError("formato", dialog.call(pickerSetTypeIndex, uintptr(config.index))); err != nil {
		return nil, err
	}
	if err = pickerError("opzioni", dialog.call(pickerSetOptions, uintptr(config.options))); err != nil {
		return nil, err
	}
	if save {
		name, err = syscall.UTF16PtrFromString(config.filename)
		if err != nil {
			return nil, err
		}
		extension, err = syscall.UTF16PtrFromString(config.extension)
		if err != nil {
			return nil, err
		}
		if err = pickerError("nome", dialog.call(pickerSetFilename, uintptr(unsafe.Pointer(name)))); err != nil {
			return nil, err
		}
		if err = pickerError("estensione", dialog.call(pickerSetExtension, uintptr(unsafe.Pointer(extension)))); err != nil {
			return nil, err
		}
	}
	hr = dialog.call(pickerShow, pickerOwner())
	if uint32(hr) == 0x800704c7 {
		return nil, nil
	} // Cancellation is not an error.
	if err = pickerError("visualizzazione", hr); err != nil {
		return nil, err
	}
	if !multiple {
		var item *pickerCOM
		if err = pickerError("risultato", dialog.call(pickerGetResult, uintptr(unsafe.Pointer(&item)))); err != nil {
			return nil, err
		}
		if item == nil {
			return nil, fmt.Errorf("Risultato file Windows mancante")
		}
		defer item.call(pickerRelease)
		path, e := pickerPath(item)
		if e != nil {
			return nil, e
		}
		return []string{path}, nil
	}
	var items *pickerCOM
	if err = pickerError("selezione", dialog.call(pickerGetResults, uintptr(unsafe.Pointer(&items)))); err != nil {
		return nil, err
	}
	if items == nil {
		return nil, fmt.Errorf("Selezione file Windows mancante")
	}
	defer items.call(pickerRelease)
	var count uint32
	if err = pickerError("conteggio", items.call(shellArrayCount, uintptr(unsafe.Pointer(&count)))); err != nil {
		return nil, err
	}
	if count > maxNativeOpenFiles {
		return nil, fmt.Errorf("Seleziona massimo 30 file per volta")
	}
	paths := make([]string, 0, count)
	for i := uint32(0); i < count; i++ {
		var item *pickerCOM
		if err = pickerError("elemento", items.call(shellArrayItem, uintptr(i), uintptr(unsafe.Pointer(&item)))); err != nil {
			return nil, err
		}
		if item == nil {
			return nil, fmt.Errorf("Elemento file Windows mancante")
		}
		path, e := pickerPath(item)
		item.call(pickerRelease)
		if e != nil {
			return nil, e
		}
		paths = append(paths, path)
	}
	return paths, nil
}
func desktopFileDialog(save bool, suggested string) (string, error) {
	paths, err := windowsPick(save, false, false, suggested)
	if err != nil || len(paths) == 0 {
		return "", err
	}
	return paths[0], nil
}
func desktopMultiOpenDialog() ([]string, error) { return windowsPick(false, true, false, "") }
func desktopExportDialog(suggested string) (string, error) {
	paths, err := windowsPick(true, false, true, suggested)
	if err != nil || len(paths) == 0 {
		return "", err
	}
	return paths[0], nil
}
