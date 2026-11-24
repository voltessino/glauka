//go:build windows

package main

import (
	_ "embed"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

//go:embed uninstall_files.ps1
var cleanupWindowsFiles string

func yesNo(msg string) bool {
	fn := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
	text, _ := syscall.UTF16PtrFromString(nativeInterfaceText(msg))
	title, _ := syscall.UTF16PtrFromString("Glauka")
	ret, _, _ := fn.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x24)
	return ret == 6
}
func psSingleQuoted(x string) string { return "'" + strings.ReplaceAll(x, "'", "''") + "'" }
func actualDesktop() string {
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "[Environment]::GetFolderPath('DesktopDirectory')")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if out, err := cmd.Output(); err == nil {
		p := strings.TrimSpace(string(out))
		if filepath.IsAbs(p) && p != "" {
			return p
		}
	}
	return filepath.Join(os.Getenv("USERPROFILE"), "Desktop")
}
func windowsLinks() []string {
	roaming := os.Getenv("APPDATA")
	link := "Glauka.lnk"
	if developerEdition() {
		link = "Glauka Developer.lnk"
	}
	return []string{
		filepath.Join(roaming, "Microsoft", "Windows", "Start Menu", "Programs", link),
		filepath.Join(actualDesktop(), link),
	}
}
func createWindowsShortcut(link, target, icon string) error {
	_ = os.MkdirAll(filepath.Dir(link), 0755)
	code := "$w=New-Object -ComObject WScript.Shell;" +
		"$s=$w.CreateShortcut(" + psSingleQuoted(link) + ");" +
		"$s.TargetPath=" + psSingleQuoted(target) + ";" +
		"$s.WorkingDirectory=" + psSingleQuoted(filepath.Dir(target)) + ";" +
		"$s.IconLocation=" + psSingleQuoted(icon) + ";" +
		"$s.Description='Glauka - Idee, studio e progetti';$s.Save()"
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", code)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Run()
}
// Keep registry and shortcut ownership intact until the exact installed
// executable was successfully removed by the post-exit cleanup script.
func registeredUninstallOwnsExecutable(exe, name string) bool {
    script := `$ErrorActionPreference='Stop'
$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\' + ` + psSingleQuoted(name) + `
$target=` + psSingleQuoted(exe) + `
$entry=Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
if(!$entry){exit 2}
$expected='"'+$target+'" --uninstall'
$folder=[IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($target)).TrimEnd('\')
$registered=if($entry.InstallLocation){[IO.Path]::GetFullPath([string]$entry.InstallLocation).TrimEnd('\')}else{''}
if(([string]$entry.UninstallString) -ine $expected -or $registered -ine $folder){exit 3}
exit 0`
    cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
    cmd.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
    return cmd.Run()==nil
}
func doUninstall() {
    current, err := os.Executable()
    if err!=nil {
        showError("Impossibile verificare la versione di Glauka da disinstallare.")
        return
    }
    registryName:="NeuroMapArchitect"
    if developerEdition(){registryName="NeuroMapArchitectDeveloper"}
    if !registeredUninstallOwnsExecutable(current,registryName) {
        showError("Disinstallazione annullata: questa versione non è più quella registrata da Windows. Apri Impostazioni > App per gestire la versione attiva. Nessun file è stato eliminato.")
        return
    }
    if !yesNo("Vuoi disinstallare soltanto questa versione di Glauka?\n\nLe altre versioni, i progetti e i backup non verranno toccati. Dopo la chiusura, il risultato sarà registrato in AppData.") {
        return
    }
    folder:=filepath.Dir(current)
    local:=os.Getenv("LOCALAPPDATA")
    if local==""{local=os.TempDir()}
    report:=filepath.Join(local,"Glauka","uninstall-last-result.json")
    links:=windowsLinks()
    psLinks:=make([]string,0,len(links))
    for _,link:=range links{psLinks=append(psLinks,psSingleQuoted(link))}
    // Do not unregister now. The child removes the exact EXE after this process
    // exits, then cleans only shortcuts and registration still pointing to it.
    script:="& {" + cleanupWindowsFiles + "} -InstallDir " + psSingleQuoted(folder) +
        " -Executable " + psSingleQuoted(current) +
        " -RegistryName " + psSingleQuoted(registryName) +
        " -ReportPath " + psSingleQuoted(report) +
        " -ShortcutPaths @(" + strings.Join(psLinks,",") + ")"
    cmd:=exec.Command("powershell.exe","-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",script)
    cmd.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
    if err:=cmd.Start();err!=nil{
        showError("Disinstallazione non avviata: "+err.Error())
        return
    }
    // The native executable must exit to release its own file lock.
}
