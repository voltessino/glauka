package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPickerOpenRequiresExistingFilesystemAndPreservesImportFormats(t *testing.T) {
	for _, multi := range []bool{false, true} {
		c, e := filePickerConfig(false, multi, false, "")
		if e != nil {
			t.Fatal(e)
		}
		required := uint32(pickerFilesystem | pickerPathExists | pickerFileExists | pickerNoChangeDir)
		if c.options&required != required {
			t.Fatal("native existence or CWD protection missing")
		}
		if (c.options&pickerMultiple != 0) != multi {
			t.Fatal("wrong selection mode")
		}
		for _, ext := range []string{"gk", "glk", "neuromap", "xmind", "json", "md", "markdown", "txt", "opml", "xml"} {
			if !strings.Contains(c.filters[0].pattern, "*."+ext) {
				t.Fatal(ext)
			}
		}
	}
}
func TestPickerSaveSelectsFormatBeforeNativeOverwriteConfirmation(t *testing.T) {
	for _, tc := range []struct {
		name, filename, ext string
		index               uint32
	}{{"Mappa 🧠.gk", "Mappa 🧠.gk", "gk", 1}, {"Mappa storica.neuromap", "Mappa storica.neuromap", "neuromap", 1}, {"Compatibilità.glk", "Compatibilità.glk", "glk", 1}, {"Cellule 细胞.XMIND", "Cellule 细胞.XMIND", "xmind", 2}, {"appunti.md", "appunti.gk", "gk", 1}, {"", "Nuova mappa.gk", "gk", 1}} {
		c, e := filePickerConfig(true, false, false, tc.name)
		if e != nil {
			t.Fatal(e)
		}
		if c.filename != tc.filename || c.extension != tc.ext || c.index != tc.index {
			t.Fatalf("wrong save config: %+v", c)
		}
		if c.options&(pickerOverwrite|pickerStrictTypes) != (pickerOverwrite | pickerStrictTypes) {
			t.Fatal("overwrite/type check disabled")
		}
		if c.options&(pickerFileExists|pickerMultiple) != 0 {
			t.Fatal("cannot create a new project")
		}
	}
	if _, e := filePickerConfig(true, true, false, "Map.neuromap"); e == nil {
		t.Fatal("multi save accepted")
	}
}
func TestExportPickerRestrictsExportToSupportedFormats(t *testing.T) {
	for _, ext := range []string{"png", "svg", "md", "json", "opml", "xml", "txt", "html", "ics", "pdf", "docx", "zip", "mm", "neuromap", "gk", "glk"} {
		c, e := filePickerConfig(true, false, true, "export."+ext)
		if e != nil || len(c.filters) != 1 || c.extension != ext || c.filters[0].pattern != "*."+ext {
			t.Fatalf("%s: %+v %v", ext, c, e)
		}
		if c.options&(pickerOverwrite|pickerStrictTypes) != (pickerOverwrite | pickerStrictTypes) {
			t.Fatal("export overwrite/type check disabled")
		}
	}
	for _, ext := range []string{"exe", "bat", "js", "xmind"} {
		if _, e := filePickerConfig(true, false, true, "export."+ext); e == nil {
			t.Fatal("invalid export accepted", ext)
		}
	}
}
func TestPickerOwnerExcludesUnrelatedForegroundWindows(t *testing.T) {
	for _, tc := range []struct {
		title, class string
		want         bool
	}{{"Glauka", "Chrome_WidgetWin_1", true}, {"Glauka", "webview", true}, {"Glauka — Developer", "webview", true}, {"NeuroMap Architect", "webview", true}, {"Glauka.txt - Notepad", "webview", false}, {"Unrelated window", "webview", false}, {"Glauka — 7.4", "Chrome_WidgetWin_1", true}, {"Glauka.txt - Notepad", "Notepad", false}, {"NeuroMap Architect", "Chrome_WidgetWin_1", true}, {"NeuroMap Architect Developer", "Chrome_WidgetWin_1", true}, {"NeuroMap Architect.txt - Notepad", "Notepad", false}, {"voltessino/neuromap-android - GitHub", "Chrome_WidgetWin_1", false}, {"Document", "Chrome_WidgetWin_1", false}} {
		if neuroMapWindowOwner(tc.title, tc.class) != tc.want {
			t.Fatalf("wrong owner: %+v", tc)
		}
	}
}
func TestNativeWindowsOpenBatchBoundedAndImportFiltersMatchParser(t *testing.T) {
	if maxNativeOpenFiles != 30 {
		t.Fatalf("picker and backend should accept the same bounded batch: %d", maxNativeOpenFiles)
	}
	cfg, err := filePickerConfig(false, true, false, "")
	if err != nil {
		t.Fatal(err)
	}
	for _, ext := range []string{".txt", ".markdown", ".xml"} {
		if !strings.Contains(cfg.filters[0].pattern, "*"+ext) || !projectExtension("import"+ext) {
			t.Fatalf("advertised import cannot open: %s", ext)
		}
	}
	if strings.Contains(cfg.filters[0].pattern, "*.mm") || projectExtension("unsupported.mm") {
		t.Fatal("FreeMind .mm is not parsed by this importer; do not advertise it")
	}
}

func TestAuthorizedRepeatedProjectSaveDoesNotNeedAnyPicker(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "Map.neuromap")
	s := &service{secret: "picker-test", configDir: dir}
	if e := s.approvePath(path); e != nil {
		t.Fatal(e)
	}
	for _, text := range []string{"first", "second"} {
		payload := `{"root":{"id":"r","text":"` + text + `","children":[]}}`
		body, _ := json.Marshal(map[string]any{"json": payload, "filename": "Map.neuromap", "filePath": path, "saveAs": false})
		r := httptest.NewRequest(http.MethodPost, "/__desktop/file/save", bytes.NewReader(body))
		r.Header.Set("X-NeuroMap-Session", s.secret)
		w := httptest.NewRecorder()
		s.routes().ServeHTTP(w, r)
		if w.Code != 200 {
			t.Fatalf("direct save failed: %d %s", w.Code, w.Body.String())
		}
		data, e := os.ReadFile(path)
		if e != nil || string(data) != payload {
			t.Fatalf("wrong saved bytes: %s %v", data, e)
		}
	}
}

func TestGlaukaNativeProjectExtensionsKeepLegacyCompatibility(t *testing.T) {
  for _, name := range []string{"untitled.gk", "legacy.neuromap", "legacy.glk", "mindmap.xmind", "notes.txt", "notes.markdown", "map.xml"} {
    if !projectExtension(name) { t.Fatalf("rejected valid project format %s", name) }
  }
  for _, name := range []string{"test.exe", "test.js", "test.bat", "unhandled.mm"} {
    if projectExtension(name) { t.Fatalf("accepted unsafe project format %s", name) }
  }
}
