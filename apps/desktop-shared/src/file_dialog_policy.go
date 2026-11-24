package main

import (
	"fmt"
	"path/filepath"
	"strings"
)

// IFileDialog options: native overwrite/existence checks remain enabled.
const (
	pickerOverwrite    = 0x2
	pickerStrictTypes  = 0x4
	pickerNoChangeDir  = 0x8
	pickerFilesystem   = 0x40
	pickerMultiple     = 0x200
	pickerPathExists   = 0x800
	pickerFileExists   = 0x1000
	maxNativeOpenFiles = 30 // Ticketed reads: 100 MiB per file, 100 MiB per selection.
)

type pickerFilter struct{ name, pattern string }
type pickerConfig struct {
	filters             []pickerFilter
	index               uint32
	extension, filename string
	options             uint32
}

func filePickerConfig(save, multiple, export bool, suggested string) (pickerConfig, error) {
	c := pickerConfig{index: 1, options: pickerFilesystem | pickerNoChangeDir | pickerPathExists}
	if !save {
		c.options |= pickerFileExists
		if multiple {
			c.options |= pickerMultiple
		}
		c.filters = []pickerFilter{{"Mappe e progetti", "*.gk;*.glk;*.neuromap;*.xmind;*.json;*.md;*.markdown;*.txt;*.opml;*.xml"}, {"Progetti Glauka (.gk)", "*.gk;*.glk;*.neuromap"}, {"Mappe XMind", "*.xmind"}, {"Backup JSON", "*.json"}, {"Tutti i file", "*.*"}}
		return c, nil
	}
	if multiple {
		return c, fmt.Errorf("Selezione multipla non disponibile per il salvataggio")
	}
	c.options |= pickerOverwrite | pickerStrictTypes
	c.filename = filepath.Base(suggested)
	if c.filename == "." || c.filename == "" {
		c.filename = "Nuova mappa.gk"
	}
	ext := strings.ToLower(filepath.Ext(c.filename))
	if export {
		allowed := map[string]string{".png": "Immagine PNG", ".svg": "Immagine SVG", ".md": "Markdown", ".json": "JSON", ".opml": "OPML", ".xml": "XML", ".txt": "Testo", ".html": "HTML", ".ics": "Calendario", ".pdf": "PDF", ".docx": "Word DOCX", ".zip": "Archivio ZIP", ".mm": "FreeMind", ".neuromap": "Glauka legacy", ".gk": "Glauka", ".glk": "Glauka legacy"}
		name, ok := allowed[ext]
		if !ok {
			return c, fmt.Errorf("Formato export non consentito")
		}
		c.extension = strings.TrimPrefix(ext, ".")
		c.filters = []pickerFilter{{name, "*" + ext}}
		return c, nil
	}
	c.extension = "gk"
	c.filters = []pickerFilter{{"Progetti Glauka (.gk)", "*.gk;*.glk;*.neuromap"}, {"Mappe XMind", "*.xmind"}}
	if ext == ".xmind" {
		c.index = 2
		c.extension = "xmind"
	} else if ext == ".neuromap" || ext == ".glk" {
		// Preserve an explicitly chosen legacy filename for safe round-trip editing.
		c.extension = strings.TrimPrefix(ext, ".")
	} else if ext != "" && ext != ".gk" {
		c.filename = strings.TrimSuffix(c.filename, filepath.Ext(c.filename)) + ".gk"
	}
	return c, nil
}
func neuroMapWindowOwner(title, class string) bool {
	normalized := strings.ToLower(strings.TrimSpace(title))
	return (normalized == "glauka" || strings.HasPrefix(normalized, "glauka —") || strings.HasPrefix(normalized, "neuromap architect")) && (class == "webview" || strings.HasPrefix(class, "Chrome_WidgetWin_"))
}
