package main

import (
	"errors"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// Executable and script suffixes never open from a map load. A click must
// confirm them again on the desktop service before the operating system starts them.
var linkExecutableExt = map[string]bool{
	".exe": true, ".bat": true, ".cmd": true, ".ps1": true, ".vbs": true,
	".msi": true, ".sh": true, ".app": true, ".command": true, ".com": true, ".scr": true,
}

type linkChoice struct {
	Kind       string
	Value      string
	Executable bool
}

func linkExecutableName(name string) bool {
	return linkExecutableExt[strings.ToLower(filepath.Ext(name))]
}

func classifyLinkTarget(raw string) (linkChoice, error) {
	text := strings.TrimSpace(raw)
	if text == "" || len(text) > 2048 || strings.ContainsRune(text, 0) {
		return linkChoice{}, errors.New("Collegamento non valido")
	}
	lower := strings.ToLower(text)
	for _, blocked := range []string{"javascript:", "data:", "vbscript:"} {
		if strings.HasPrefix(lower, blocked) {
			return linkChoice{}, errors.New("Collegamento non consentito")
		}
	}
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		parsed, err := url.Parse(text)
		if err != nil || parsed.User != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			return linkChoice{}, errors.New("Indirizzo web non valido")
		}
		return linkChoice{Kind: "web", Value: parsed.String()}, nil
	}
	if strings.HasPrefix(lower, "file://") {
		parsed, err := url.Parse(text)
		if err != nil || (parsed.Host != "" && !strings.EqualFold(parsed.Host, "localhost")) {
			return linkChoice{}, errors.New("Percorso file non valido")
		}
		text = parsed.Path
		if runtime.GOOS == "windows" && len(text) >= 3 && text[0] == '/' && text[2] == ':' {
			text = text[1:]
		}
		text = filepath.FromSlash(text)
		lower = strings.ToLower(text)
	}
	if strings.Contains(text, "://") {
		return linkChoice{}, errors.New("Collegamento non consentito")
	}
	path := text
	if runtime.GOOS == "windows" {
		path = strings.ReplaceAll(path, "/", `\`)
	}
	if !filepath.IsAbs(path) {
		return linkChoice{}, errors.New("Il file deve avere un percorso completo")
	}
	clean := filepath.Clean(path)
	info, err := os.Stat(clean)
	if err != nil {
		return linkChoice{}, errors.New("File non trovato")
	}
	executable := linkExecutableName(clean)
	if info.IsDir() {
		if !strings.EqualFold(filepath.Ext(clean), ".app") {
			return linkChoice{}, errors.New("Scegli un file, non una cartella")
		}
		executable = true
	}
	return linkChoice{Kind: "file", Value: clean, Executable: executable}, nil
}

func openLinkedTarget(choice linkChoice) error {
	switch choice.Kind {
	case "web":
		return openExternalAddress(choice.Value)
	case "file":
		return openExternalAddress(choice.Value)
	default:
		return errors.New("Collegamento non valido")
	}
}

func fileLinkHref(path string) string {
	slash := filepath.ToSlash(path)
	if strings.HasPrefix(slash, "/") {
		return "file://" + slash
	}
	return "file:///" + slash
}
func openExternalAddress(target string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", target).Start()
	case "darwin":
		return exec.Command("open", target).Start()
	default:
		return exec.Command("xdg-open", target).Start()
	}
}
