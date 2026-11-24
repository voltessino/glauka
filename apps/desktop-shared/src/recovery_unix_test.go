//go:build linux || darwin

package main

import (
	"bytes"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"
)

// A kernel-enforced file-size limit makes a real write fail without filling
// the developer's disk. This exercises EFBIG, not an actual ENOSPC condition.
func TestQAOSWriteFailureHelper(t *testing.T) {
	path := os.Getenv("NEUROMAP_QA_LIMIT_PATH")
	if path == "" {
		return
	}
	signal.Ignore(syscall.SIGXFSZ)
	if err := syscall.Setrlimit(syscall.RLIMIT_FSIZE, &syscall.Rlimit{Cur: 4096, Max: 4096}); err != nil {
		t.Fatal(err)
	}
	if err := atomicFile(path, bytes.Repeat([]byte("x"), 1024*1024)); err == nil {
		t.Fatal("OS write limit must reject the save")
	}
}
func TestQAOSWriteFailureRetainsOriginalAndCleansStaging(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "limited.neuromap")
	original := []byte(`{"previous":"Keep me"}`)
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(exe, "-test.run=^TestQAOSWriteFailureHelper$")
	cmd.Env = append(os.Environ(), "NEUROMAP_QA_LIMIT_PATH="+path)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("write failure subprocess: %v %s", err, out)
	}
	if !bytes.Equal(qaRead(t, path), original) {
		t.Fatal("failed write replaced original")
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatal("failed write left staging files")
	}
}
func TestQAReadOnlyDirectoryKeepsOriginal(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("root bypasses POSIX directory permissions")
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "readonly.neuromap")
	original := []byte(`{"previous":true}`)
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(dir, 0500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0700) })
	if err := atomicFile(path, []byte(`{"new":true}`)); err == nil {
		t.Fatal("read-only directory must reject save")
	}
	if !bytes.Equal(qaRead(t, path), original) {
		t.Fatal("failed save changed original")
	}
}
