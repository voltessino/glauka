package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTimeMachineVersionRecovery(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "config")
	p := filepath.Join(dir, "Mappa.neuromap")
	a := []byte(`{"root":{"id":"r","notes":"á"}}`)
	b := []byte(`{"root":{"id":"r","notes":"after"}}`)
	if id, e := stageProjectRevision(cfg, p, a); e != nil || id != "" { t.Fatalf("initial %q %v", id, e) }
	if e := os.WriteFile(p, a, 0600); e != nil { t.Fatal(e) }
	id, e := stageProjectRevision(cfg, p, b)
	if e != nil || id == "" { t.Fatalf("stage %q %v", id, e) }
	got, e := readProjectRevision(cfg, p, id)
	if e != nil || !bytes.Equal(got, a) { t.Fatalf("roundtrip %v", e) }
	if e := os.WriteFile(p, b, 0600); e != nil { t.Fatal(e) }
	rec, e := recoverProjectRevision(cfg, p, id)
	if e != nil { t.Fatal(e) }
	got, e = os.ReadFile(rec)
	if e != nil || !bytes.Equal(got, a) { t.Fatalf("recover %v", e) }
	now, _ := os.ReadFile(p)
	if !bytes.Equal(now, b) { t.Fatal("recovery changed current file") }
	if _, e = recoverProjectRevision(cfg, p, id); !os.IsExist(e) { t.Fatalf("recovery should refuse overwrite: %v", e) }
}

func TestTimeMachineDedupAndIntegrity(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "map.xmind")
	cfg := filepath.Join(dir, "cfg")
	old := []byte("PK\003\004 binary-xmind-data")
	_ = os.WriteFile(p, old, 0600)
	id, e := stageProjectRevision(cfg, p, []byte("new"))
	if e != nil { t.Fatal(e) }
	id2, e := stageProjectRevision(cfg, p, []byte("new"))
	if e != nil || id != id2 { t.Fatalf("dedup: %q != %q, %v", id, id2, e) }
	vv, e := listProjectRevisions(cfg, p)
	if e != nil || len(vv) != 1 { t.Fatalf("list %+v %v", vv, e) }
	if _, e := readProjectRevision(cfg, p, "../evil"); e == nil { t.Fatal("traversal accepted") }
	folder, _ := projectHistoryDir(cfg, p)
	if e := os.WriteFile(filepath.Join(folder, id), bytes.Repeat([]byte("z"), len(old)), 0600); e != nil { t.Fatal(e) }
	if _, e := readProjectRevision(cfg, p, id); e == nil || !strings.Contains(e.Error(), "checksum") {
		t.Fatalf("corrupted revision accepted: %v", e)
	}
	if _, e := stageProjectRevision(cfg, p, []byte("new")); e == nil {
		t.Fatal("existing corrupted revision must not be trusted for deduplication")
	}
}

func TestTimeMachineNoOverwriteOnSnapshotFailure(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "cfg")
	_ = os.WriteFile(cfg, []byte("block directory"), 0600)
	p := filepath.Join(dir, "map.neuromap")
	old := []byte("original")
	_ = os.WriteFile(p, old, 0600)
	if _, e := stageProjectRevision(cfg, p, []byte("new")); e == nil { t.Fatal("expected failed snapshot") }
	b, _ := os.ReadFile(p)
	if !bytes.Equal(b, old) { t.Fatal("original mutated") }
}

func TestTimeMachineRetention(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "cfg")
	p := filepath.Join(dir, "map.neuromap")
	for i := 0; i < 30; i++ {
		before := []byte{byte(i), byte(i >> 8)}
		_ = os.WriteFile(p, before, 0600)
		if _, err := stageProjectRevision(cfg, p, []byte("upcoming")); err != nil { t.Fatal(err) }
		if err := pruneProjectRevisions(cfg, p); err != nil { t.Fatal(err) }
	}
	vv, e := listProjectRevisions(cfg, p)
	if e != nil || len(vv) > maxProjectHistoryVersions || len(vv) == 0 { t.Fatalf("retention count %d err %v", len(vv), e) }
}

func TestTimeMachineRefusesSymlinkOriginal(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "target.neuromap")
	_ = os.WriteFile(target, []byte("old"), 0600)
	link := filepath.Join(dir, "link.neuromap")
	if e := os.Symlink(target, link); e != nil { t.Skip(e) }
	if _, e := stageProjectRevision(filepath.Join(dir, "cfg"), link, []byte("new")); e == nil { t.Fatal("symlink should be rejected") }
}


func TestTimeMachineThousandSequentialSnapshots(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "cfg")
	p := filepath.Join(dir, "stress.neuromap")
	for i := 0; i < 1000; i++ {
		old := []byte{byte(i), byte(i >> 8), 'x'}
		if err := os.WriteFile(p, old, 0600); err != nil { t.Fatal(err) }
		id, err := stageProjectRevision(cfg, p, []byte("next revision"))
		if err != nil { t.Fatalf("version %d: %v", i, err) }
		if i%100 == 0 {
			got, err := readProjectRevision(cfg, p, id)
			if err != nil || !bytes.Equal(old, got) { t.Fatalf("version %d damaged: %v", i, err) }
		}
		if err := pruneProjectRevisions(cfg, p); err != nil { t.Fatal(err) }
	}
	versions, err := listProjectRevisions(cfg, p)
	if err != nil || len(versions) != maxProjectHistoryVersions {
		t.Fatalf("expected bounded history after 1000 writes: %d %v", len(versions), err)
	}
	got, err := readProjectRevision(cfg, p, versions[0].ID)
	if err != nil || !bytes.Equal(got, []byte{byte(999 % 256), byte(999 >> 8), 'x'}) {
		t.Fatalf("latest snapshot missing: %v", err)
	}
}
