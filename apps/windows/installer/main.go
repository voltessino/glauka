//go:build windows

package main

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

// installerEdition is embedded by build_desktop.py with -ldflags.
// A public Free/Pro package must never call itself a Developer installation.
var installerEdition = "Release"

//go:embed binaries/NeuroMap-Architect.exe binaries/icon.ico binaries/brand.png binaries/locales.json install_ui.ps1 install_files.ps1
var files embed.FS

// The earliest native failure can occur before the language selector is visible.
func installerText(text string) string {
	data, err := files.ReadFile("binaries/locales.json")
	if err != nil {
		return text
	}
	var catalog struct {
		Messages map[string]map[string]string `json:"messages"`
	}
	if json.Unmarshal(data, &catalog) != nil {
		return text
	}
	id, _, _ := syscall.NewLazyDLL("kernel32.dll").NewProc("GetUserDefaultUILanguage").Call()
	code := map[uintptr]string{0x10: "it", 0x09: "en", 0x07: "de", 0x0a: "es", 0x0c: "fr", 0x16: "pt", 0x01: "ar", 0x04: "zh-CN"}[id&0x3ff]
	if code == "" {
		code = "en"
	}
	preference, err := os.ReadFile(filepath.Join(os.Getenv("APPDATA"), "NeuroMap Architect", "ui-locale.json"))
	if err == nil && len(preference) <= 512 {
		var p struct {
			Locale string `json:"locale"`
		}
		if json.Unmarshal(preference, &p) == nil && catalog.Messages[p.Locale] != nil {
			code = p.Locale
		}
	}
	if translated, ok := catalog.Messages[code][text]; ok {
		if strings.HasSuffix(text, " ") && !strings.HasSuffix(translated, " ") {
			translated += " "
		}
		return translated
	}
	return text
}

func showInstallerError(message string) {
	title, _ := syscall.UTF16PtrFromString("Glauka")
	msg, _ := syscall.UTF16PtrFromString(message)
	proc := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
	proc.Call(0, uintptr(unsafe.Pointer(msg)), uintptr(unsafe.Pointer(title)), 0x10)
}

func main() {
	dir, err := os.MkdirTemp("", "Glauka-Installer-")
	if err != nil {
		showInstallerError(installerText("Could not prepare installation: ") + err.Error())
		return
	}
	defer os.RemoveAll(dir)
	for _, name := range []string{"binaries/NeuroMap-Architect.exe", "binaries/icon.ico", "binaries/brand.png", "binaries/locales.json", "install_ui.ps1", "install_files.ps1"} {
		b, e := files.ReadFile(name)
		if e != nil {
			showInstallerError(installerText("Installation package is incomplete: ") + e.Error())
			return
		}
		dst := filepath.Join(dir, filepath.Base(name))
		if e = os.WriteFile(dst, b, 0600); e != nil {
			showInstallerError(installerText("Could not extract the application: ") + e.Error())
			return
		}
	}
	// Grant foreground permission to child setup UI and suppress only the console window,
	// without setting SW_HIDE on the child GUI startup info.
	_, _, _ = syscall.NewLazyDLL("user32.dll").NewProc("AllowSetForegroundWindow").Call(^uintptr(0))
	command := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-File", filepath.Join(dir, "install_ui.ps1"),
		"-SourceExe", filepath.Join(dir, "NeuroMap-Architect.exe"),
		"-SourceIcon", filepath.Join(dir, "icon.ico"),
		"-SourceLogo", filepath.Join(dir, "brand.png"),
		"-Edition", installerEdition,
		"-SourceLanguages", filepath.Join(dir, "locales.json"))
	command.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000} // CREATE_NO_WINDOW: hide PowerShell console cleanly without SW_HIDE on WPF GUI
	output, runErr := command.CombinedOutput()
	if runErr == nil {
		return
	}
	var exitErr *exec.ExitError
	if errors.As(runErr, &exitErr) && exitErr.ExitCode() == 2 {
		return
	} // user cancelled
	logPath := filepath.Join(os.TempDir(), "Glauka-Installer-1.0.4.log")
	_ = os.WriteFile(logPath, append([]byte("Installer failure: "+runErr.Error()+"\r\n"), output...), 0600)
	detail := strings.TrimSpace(string(output))
	if len(detail) > 600 {
		detail = detail[:600] + "..."
	}
	if detail == "" {
		detail = runErr.Error()
	}
	showInstallerError(fmt.Sprintf(installerText("Could not complete installation.")+"\n\n%s\n\n"+installerText("Details: ")+"%s", detail, logPath))
}
