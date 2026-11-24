package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

// A Go mutex cannot coordinate these independent processes.
func TestQAProcessWriter(t *testing.T) {
	path := os.Getenv("NEUROMAP_QA_WRITE_PATH")
	if path == "" {
		return
	}
	index, _ := strconv.Atoi(os.Getenv("NEUROMAP_QA_WRITER"))
	barrier := os.Getenv("NEUROMAP_QA_BARRIER")
	deadline := time.Now().Add(10 * time.Second)
	for {
		if _, err := os.Stat(barrier); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("barrier timeout")
		}
		time.Sleep(time.Millisecond)
	}
	data := []byte(fmt.Sprintf(`{"writer":%d,"padding":"%s"}`, index, strings.Repeat(string(rune('A'+index)), 1024*1024)))
	for i := 0; i < 12 || os.Getenv("NEUROMAP_QA_CRASH_WRITER") == "1"; i++ {
		if err := atomicFile(path, data); err != nil {
			t.Fatal(err)
		}
	}
}
func qaProcess(t *testing.T, path, barrier string, index int) *exec.Cmd {
	t.Helper()
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(exe, "-test.run=^TestQAProcessWriter$", "-test.timeout=20s")
	cmd.Env = append(os.Environ(), "NEUROMAP_QA_WRITE_PATH="+path, "NEUROMAP_QA_BARRIER="+barrier, fmt.Sprintf("NEUROMAP_QA_WRITER=%d", index))
	return cmd
}
func TestQAIndependentProcessesNeverMixProjectBytes(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "shared.neuromap")
	barrier := filepath.Join(dir, "start")
	const count = 8
	cmds := make([]*exec.Cmd, count)
	outputs := make([]bytes.Buffer, count)
	for i := range cmds {
		cmds[i] = qaProcess(t, path, barrier, i)
		cmds[i].Stdout = &outputs[i]
		cmds[i].Stderr = &outputs[i]
		if err := cmds[i].Start(); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		for _, cmd := range cmds {
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
			}
		}
	})
	if err := os.WriteFile(barrier, []byte("start"), 0600); err != nil {
		t.Fatal(err)
	}
	for i, cmd := range cmds {
		if err := cmd.Wait(); err != nil {
			t.Errorf("writer %d: %v %s", i, err, outputs[i].String())
		}
	}
	final := qaRead(t, path)
	complete := false
	for i := 0; i < count; i++ {
		want := []byte(fmt.Sprintf(`{"writer":%d,"padding":"%s"}`, i, strings.Repeat(string(rune('A'+i)), 1024*1024)))
		complete = complete || bytes.Equal(final, want)
	}
	if !complete {
		t.Fatal("final document contains partial or mixed bytes")
	}
}
func TestQAKilledWriterKeepsOldOrCompleteNewFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "crash.neuromap")
	barrier := filepath.Join(dir, "start")
	old := []byte(`{"previous":"Keep α"}`)
	if err := os.WriteFile(path, old, 0600); err != nil {
		t.Fatal(err)
	}
	cmd := qaProcess(t, path, barrier, 0)
	// Keep writing until the parent interrupts; a fast writer must not finish
	// before the observer gets CPU time. The child still has a 20s timeout.
	cmd.Env = append(cmd.Env, "NEUROMAP_QA_CRASH_WRITER=1")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = cmd.Process.Kill() })
	if err := os.WriteFile(barrier, []byte("start"), 0600); err != nil {
		t.Fatal(err)
	}
	observed := false
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			t.Fatal(err)
		}
		for _, entry := range entries {
			if strings.Contains(entry.Name(), ".pending") {
				observed = true
				break
			}
		}
		if observed {
			break
		}
		time.Sleep(time.Millisecond)
	}
	if !observed {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		t.Fatal("could not observe a write in progress; interruption was not tested")
	}
	if err := cmd.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	_ = cmd.Wait()
	final := qaRead(t, path)
	newFile := []byte(fmt.Sprintf(`{"writer":0,"padding":"%s"}`, strings.Repeat("A", 1024*1024)))
	if !bytes.Equal(final, old) && !bytes.Equal(final, newFile) {
		t.Fatal("killed writer left a partial document")
	}
	recovered := []byte(`{"recovered":true}`)
	if err := atomicFile(path, recovered); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(qaRead(t, path), recovered) {
		t.Fatal("could not save after process interruption")
	}
}
func TestQASaveNeverReplacesADirectory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "folder.neuromap")
	if err := os.Mkdir(path, 0700); err != nil {
		t.Fatal(err)
	}
	sentinel := filepath.Join(path, "keep.txt")
	if err := os.WriteFile(sentinel, []byte("user data"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := atomicFile(path, []byte(`{"new":true}`)); err == nil {
		t.Error("directory replacement must fail")
	}
	if string(qaRead(t, sentinel)) != "user data" {
		t.Fatal("directory contents changed")
	}
}
