package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"testing"
)

func TestIllustrationURLAllowlist(t *testing.T) {
	valid := []struct{ kind, query, prefix, name string }{
		{"translate", "tess. conn.", "", ""},
		{"search", "heart", "", ""},
		{"svg", "", "fluent-emoji-flat", "red-heart"},
	}
	for _, tc := range valid {
		u, e := illustrationUpstreamURL(tc.kind, tc.query, tc.prefix, tc.name)
		if e != nil || !strings.HasPrefix(u, "https://") {
			t.Fatalf("expected safe url: %s %v", u, e)
		}
	}
	bad := []struct{ kind, query, prefix, name string }{
		{"svg", "", "evil.com", "x"}, {"svg", "", "noto", "../../bad"}, {"search", strings.Repeat("x", 101), "", ""}, {"bad", "x", "", ""},
	}
	for _, tc := range bad {
		if _, e := illustrationUpstreamURL(tc.kind, tc.query, tc.prefix, tc.name); e == nil {
			t.Fatalf("unsafe request accepted: %+v", tc)
		}
	}
}
func TestXMindRoundTripHasNeuroMapIllustrations(t *testing.T) {
	root := map[string]any{"id": "a", "text": "cuore", "children": []any{map[string]any{"id": "b", "text": "miocardio", "children": []any{}, "labelWrapChars": 12, "illustration": map[string]any{"prefix": "noto", "name": "red-heart", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"><path fill=\"red\"/></svg>"}}}}
	raw, _ := json.Marshal(map[string]any{"title": "Anatomia", "root": root, "branchStyle": "buzan", "defaultLabelWrapChars": 18})
	z, e := encodeXMind("", []json.RawMessage{raw})
	if e != nil {
		t.Fatal(e)
	}
	reader, e := zip.NewReader(bytes.NewReader(z), int64(len(z)))
	if e != nil {
		t.Fatal(e)
	}
	var foundNative, foundContent bool
	for _, f := range reader.File {
		r, e := f.Open()
		if e != nil {
			t.Fatal(e)
		}
		b, e := io.ReadAll(r)
		r.Close()
		if e != nil {
			t.Fatal(e)
		}
		if f.Name == "neuromap/workspace.json" {
			foundNative = true
			if !bytes.Contains(b, []byte("red-heart")) || !bytes.Contains(b, []byte("labelWrapChars")) {
				t.Fatalf("lost icon/wrap data: %s", string(b))
			}
		}
		if f.Name == "content.json" {
			foundContent = true
			if !bytes.Contains(b, []byte("miocardio")) {
				t.Fatal("XMind document missing node")
			}
		}
	}
	if !foundNative || !foundContent {
		t.Fatal("missing XMind core or NeuroMap metadata")
	}
}
