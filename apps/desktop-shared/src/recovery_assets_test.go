package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func mediaDoc(label, content string) []byte {
	return []byte(`{"tabs":[{"root":{"text":"` + label + `"},"images":[{"src":"data:image/png;base64,` + strings.Repeat(content, 20000) + `"}]}]}`)
}
func TestRecoveryMediaDeduplicatesWithoutRewritingAndPreservesExports(t *testing.T) {
	path := filepath.Join(t.TempDir(), "workspace")
	a := mediaDoc("A", "A")
	if err := writeRecovery(path, a); err != nil {
		t.Fatal(err)
	}
	files, _ := os.ReadDir(recoveryAssetDir(path))
	if len(files) != 1 {
		t.Fatal("expected one asset", len(files))
	}
	asset := filepath.Join(recoveryAssetDir(path), files[0].Name())
	before, _ := os.Stat(asset)
	small, _ := os.Stat(path)
	if small.Size() > 1000 {
		t.Fatal("image still duplicated in journal")
	}
	b := mediaDoc("B", "A")
	if err := writeRecovery(path, b); err != nil {
		t.Fatal(err)
	}
	after, _ := os.Stat(asset)
	if !before.ModTime().Equal(after.ModTime()) {
		t.Fatal("unchanged media rewritten")
	}
	got, _, err := readRecovery(path)
	if err != nil || !bytes.Equal(got, b) {
		t.Fatal("portable image content changed", err)
	}
}
func TestRecoveryMediaMissingOrCorruptFallsBackAndUnusedAssetsArePruned(t *testing.T) {
	for _, missing := range []bool{true, false} {
		t.Run(map[bool]string{true: "missing", false: "corrupt"}[missing], func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "workspace")
			a := mediaDoc("A", "A")
			b := mediaDoc("B", "B")
			_ = writeRecovery(path, a)
			_ = writeRecovery(path, b)
			raw, _ := os.ReadFile(path)
			refs := recoveryReferences.FindAllSubmatch(raw, -1)
			if len(refs) != 1 {
				t.Fatal("ref missing")
			}
			target := filepath.Join(recoveryAssetDir(path), string(refs[0][1]))
			if missing {
				_ = os.Remove(target)
			} else {
				_ = os.WriteFile(target, []byte("corrupt"), 0600)
			}
			got, previous, err := readRecovery(path)
			if err != nil || !previous || !bytes.Equal(got, a) {
				t.Fatal("previous not recovered", err)
			}
		})
	}
	path := filepath.Join(t.TempDir(), "workspace")
	for _, value := range []string{"A", "B", "C"} {
		if err := writeRecovery(path, mediaDoc(value, value)); err != nil {
			t.Fatal(err)
		}
	}
	files, _ := os.ReadDir(recoveryAssetDir(path))
	if len(files) != 2 {
		t.Fatal("unreferenced images retained", len(files))
	}
	if err := discardRecovery(path); err != nil {
		t.Fatal(err)
	}
	files, _ = os.ReadDir(recoveryAssetDir(path))
	if len(files) != 0 {
		t.Fatal("discarded media retained")
	}
}
func TestRecoveryReservedUserTextAndLegacyEnvelopeRemainReadable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "workspace")
	for _, text := range []string{"glauka-recovery:image:" + strings.Repeat("a", 64), "glauka-recovery:literal:abcd"} {
		data := []byte(`{"tabs":[{"root":{"text":"` + text + `"}}]}`)
		if err := writeRecovery(path, data); err != nil {
			t.Fatal(err)
		}
		got, _, err := readRecovery(path)
		if err != nil || !bytes.Equal(got, data) {
			t.Fatal("user text changed", err)
		}
	}
	// An existing v1 checksum envelope remains valid, including inline images.
	data := mediaDoc("legacy", "A")
	packed, err := packRecoveryAssets(path, data)
	if err != nil || len(packed) >= len(data) {
		t.Fatal(err)
	}
	if _, err := unpackRecoveryAssets(path, []byte(`"glauka-recovery:image:`+strings.Repeat("f", 64)+`"`)); err == nil {
		t.Fatal("missing asset accepted")
	}
}

func TestRecoveryV1EnvelopeWithInlineMediaRemainsReadable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "workspace")
	data := mediaDoc("legacy", "A")
	digest := sha256.Sum256(data)
	envelope := []byte(fmt.Sprintf(`{"format":"GlaukaRecovery-v1","sha256":%q,"payload":%s}`, hex.EncodeToString(digest[:]), data))
	if err := os.WriteFile(path, envelope, 0600); err != nil {
		t.Fatal(err)
	}
	got, previous, err := readRecovery(path)
	if err != nil || previous || !bytes.Equal(got, data) {
		t.Fatal("v1 envelope changed", err)
	}
}
