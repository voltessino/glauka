package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestXMindEncoderHasValidSheetsAndNativeRoundTrip(t *testing.T) {
	sheets := []string{
		`{"title":"Anatomia","root":{"id":"r","text":"Anatomia","children":[{"id":"n1","text":"Arto superiore","notes":"Omoplata","children":[{"id":"n2","text":"Omero","children":[]}]}]},"images":[],"relationships":[],"thresholdY":500}`,
		`{"title":"Biochimica","root":{"id":"r2","text":"Biochimica","children":[{"id":"n3","text":"Enzimi","children":[]}]},"images":[],"relationships":[]}`,
	}
	data, err := encodeXMind("{}", []json.RawMessage{[]byte(sheets[0]), []byte(sheets[1])})
	if err != nil {
		t.Fatal(err)
	}
	z, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	files := make(map[string][]byte)
	for _, f := range z.File {
		r, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		buf := make([]byte, f.UncompressedSize64)
		_, err = r.Read(buf)
		if err != nil && err.Error() != "EOF" {
			t.Fatal(err)
		}
		r.Close()
		files[f.Name] = buf
	}
	var native struct {
		Tabs []json.RawMessage `json:"tabs"`
	}
	if err = json.Unmarshal(files["neuromap/workspace.json"], &native); err != nil {
		t.Fatal(err)
	}
	if len(native.Tabs) != 2 {
		t.Fatalf("expected 2 tabs; got %d", len(native.Tabs))
	}
	var converted []struct {
		Title     string `json:"title"`
		RootTopic struct {
			Title    string `json:"title"`
			Children struct {
				Attached []struct {
					Title string `json:"title"`
				} `json:"attached"`
			} `json:"children"`
		} `json:"rootTopic"`
	}
	if err = json.Unmarshal(files["content.json"], &converted); err != nil {
		t.Fatal(err)
	}
	if len(converted) != 2 || converted[0].RootTopic.Title != "Anatomia" || converted[1].RootTopic.Children.Attached[0].Title != "Enzimi" {
		t.Fatalf("bad xmind content: %+v", converted)
	}
	if len(files["manifest.json"]) == 0 || len(files["metadata.json"]) == 0 {
		t.Fatal("required metadata missing")
	}
	var meta struct { Creator struct { Version string `json:"version"` } `json:"creator"` }
	if err := json.Unmarshal(files["metadata.json"], &meta); err != nil { t.Fatal(err) }
	if meta.Creator.Version != xmindCreatorVersion {
		t.Fatalf("XMind creator version %q, expected %q", meta.Creator.Version, xmindCreatorVersion)
	}
}
func TestBackupOriginalXMindNeverOverwritesExistingBackup(t *testing.T) {
	tmp := t.TempDir()
	file := filepath.Join(tmp, "test.xmind")
	if err := os.WriteFile(file, []byte("original"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := backupOriginalXMind(file); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file, []byte("modified"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := backupOriginalXMind(file); err != nil {
		t.Fatal(err)
	}
	saved, err := os.ReadFile(xmindBackupDestination(file))
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(string(saved)) != "original" {
		t.Fatal("backup was overwritten")
	}
}
