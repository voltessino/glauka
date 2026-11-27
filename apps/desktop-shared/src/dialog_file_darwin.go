//go:build darwin

package main

import (
	"fmt"
	"os/exec"
	"strings"
)

func scriptRun(src string, args ...string) (string, error) {
	// The explicit "-" script name is documented by osascript(1): read source
	// from stdin, then pass subsequent argv entries as literal run arguments.
	// No filename, prompt or error message can become an osascript flag/source.
	a := append([]string{"-"}, args...)
	cmd := exec.Command("osascript", a...)
	cmd.Stdin = strings.NewReader(src)
	b, err := cmd.CombinedOutput()
	if err != nil {
		if strings.Contains(string(b), "User canceled") || strings.Contains(string(b), "-128") {
			return "", nil
		}
		return "", fmt.Errorf("macOS file dialog: %s", strings.TrimSpace(string(b)))
	}
	// osascript appends exactly one newline. Do not trim a valid leading/trailing
	// space or newline from a macOS filename.
	return strings.TrimSuffix(string(b), "\n"), nil
}
func desktopFileDialog(save bool, suggested string) (string, error) {
	if save {
		return scriptRun(`on run argv
set f to choose file name with prompt (item 2 of argv) default name (item 1 of argv)
return POSIX path of f
end run`, suggested, nativeInterfaceText("Salva progetto"))
	}
	return scriptRun(`on run argv
set f to choose file with prompt (item 1 of argv)
return POSIX path of f
end run`, nativeInterfaceText("Apri mappa"))
}
func parseMacSelection(out string) ([]string, error) {
    if out == "" { return nil, nil }
    if !strings.HasSuffix(out, "\x00") {
        return nil, fmt.Errorf("Risposta selettore Mac incompleta")
    }
    paths := strings.Split(strings.TrimSuffix(out, "\x00"), "\x00")
    if len(paths) > 30 {
        return nil, fmt.Errorf("Seleziona massimo 30 file per volta")
    }
    for _, path := range paths {
        if path == "" || !strings.HasPrefix(path, "/") {
            return nil, fmt.Errorf("Percorso selezionato non valido")
        }
    }
    return paths, nil
}

func desktopLinkFileDialog() (string, error) {
	return scriptRun(`on run argv
set f to choose file with prompt (item 1 of argv)
return POSIX path of f
end run`, nativeInterfaceText("Collega un file"))
}
func desktopMultiOpenDialog() ([]string, error) {
	out, err := scriptRun(`on run argv
set fs to choose file with prompt (item 1 of argv) with multiple selections allowed
set t to ""
repeat with f in fs
set t to t & POSIX path of f & (ASCII character 0)
end repeat
return t
end run`, nativeInterfaceText("Apri mappa"))
	if err != nil || out == "" { return nil, err }
	// NUL is forbidden in macOS filenames: unlike newline, it is an
	// unambiguous separator even for unusual user-created document names.
	return parseMacSelection(out)
}
func desktopFolderDialog() (string, error) {
	return scriptRun(`on run argv
set f to choose folder with prompt (item 1 of argv)
return POSIX path of f
end run`, nativeInterfaceText("Scegli cartella di esportazione"))
}
