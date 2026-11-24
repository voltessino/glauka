package main

import (
	"errors"
	"fmt"
	"encoding/json"
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestRecoveryJournalFallbackIntegrityAndLegacy(t *testing.T) {
	path := filepath.Join(t.TempDir(), "workspace-autosave.json")
	a := []byte(`{"tabs":[{"root":{"text":"A"}}]}`)
	b := []byte(`{"tabs":[{"root":{"text":"B 中文"}}]}`)
	if err := os.WriteFile(path, a, 0600); err != nil {
		t.Fatal(err)
	}
	if got, old, err := readRecovery(path); err != nil || old || !bytes.Equal(got, a) {
		t.Fatalf("legacy: %s %v %v", got, old, err)
	}
	if err := writeRecovery(path, b); err != nil {
		t.Fatal(err)
	}
	if err := writeRecovery(path, b); err != nil {
		t.Fatal(err)
	}
	if got, old, err := readRecovery(path); err != nil || old || !bytes.Equal(got, b) {
		t.Fatalf("new: %s %v %v", got, old, err)
	}
	if err := os.WriteFile(path, []byte("interrupted"), 0600); err != nil {
		t.Fatal(err)
	}
	if got, old, err := readRecovery(path); err != nil || !old || !bytes.Equal(got, a) {
		t.Fatalf("fallback: %s %v %v", got, old, err)
	}
	if err := writeRecovery(path, b); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("interrupted again"), 0600); err != nil {
		t.Fatal(err)
	}
	if got, _, err := readRecovery(path); err != nil || !bytes.Equal(got, a) {
		t.Fatalf("previous lost: %s %v", got, err)
	}
	if err := discardRecovery(path); err != nil {
		t.Fatal(err)
	}
	if got, _, err := readRecovery(path); err != nil || got != nil {
		t.Fatalf("discard: %s %v", got, err)
	}
}
func TestRecoveryJournalInvalidDataCannotReplaceGoodGeneration(t *testing.T) {
	path := filepath.Join(t.TempDir(), "workspace-autosave.json")
	a := []byte(`{"tabs":[{"root":{"text":"Good"}}]}`)
	if err := writeRecovery(path, a); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{`{`, `{"tabs":[]}`, `{"tabs":[{"root":{}}]}`, `{"tabs":[null]}`} {
		if err := writeRecovery(path, []byte(bad)); err == nil {
			t.Fatalf("invalid accepted: %s", bad)
		}
	}
	if got, _, err := readRecovery(path); err != nil || !bytes.Equal(got, a) {
		t.Fatalf("valid replaced: %s %v", got, err)
	}
	disk, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	disk = bytes.Replace(disk, []byte("Good"), []byte("Evil"), 1)
	if err = os.WriteFile(path, disk, 0600); err != nil {
		t.Fatal(err)
	}
	if _, _, err = readRecovery(path); err == nil {
		t.Fatal("checksum corruption accepted")
	}
}
func TestDamagedRecoveryIsArchivedBeforeExplicitResume(t *testing.T) {
	path := filepath.Join(t.TempDir(), "workspace-autosave.json")
	broken := []byte("truncated recovery")
	if err := os.WriteFile(path, broken, 0600); err != nil {
		t.Fatal(err)
	}
	if err := writeRecovery(path, []byte(`{"tabs":[{"root":{"text":"Resumed"}}]}`)); err != nil {
		t.Fatal(err)
	}
	archived, err := os.ReadFile(path + ".damaged")
	if err != nil || !bytes.Equal(archived, broken) {
		t.Fatalf("damaged copy lost: %s %v", archived, err)
	}
}

func TestRecoveryUpToOneHundredTabsIsLossless(t *testing.T) {
 path := filepath.Join(t.TempDir(), "workspace-autosave.json")
 for _, count := range []int{21, 100} {
  tabs := make([]map[string]any, count)
  for i := range tabs {
   tabs[i] = map[string]any{
    "id": fmt.Sprintf("tab-%d", i),
    "root": map[string]any{"text":fmt.Sprintf("Map %d", i), "children":[]any{}},
   }
  }
  serialized, err := json.Marshal(map[string]any{"tabs":tabs})
  if err != nil { t.Fatal(err) }
  if err = writeRecovery(path, serialized); err != nil { t.Fatalf("%d tabs: %v",count,err) }
  got, old, err := readRecovery(path)
  if err != nil || old || !bytes.Equal(got,serialized) {
   t.Fatalf("round-trip %d tabs failed: old=%v err=%v",count,old,err)
  }
 }
 // The native endpoint also caps at 100: preserve the last verified generation.
 tooMany := make([]map[string]any, 101)
 for i := range tooMany {
  tooMany[i] = map[string]any{"root":map[string]any{"text":"Map"}}
 }
 invalid,err := json.Marshal(map[string]any{"tabs":tooMany})
 if err != nil {t.Fatal(err)}
 if err := writeRecovery(path,invalid);err==nil {t.Fatal("accepted 101 tabs")}
 recovered,_,err := readRecovery(path)
 if err!=nil || !bytes.Contains(recovered,[]byte("Map 99")) {
  t.Fatalf("last valid backup replaced: %v",err)
 }
}

func TestRecoveryRestoresInterruptedWindowsReplacementBeforeNextSave(t *testing.T) {
 path := filepath.Join(t.TempDir(), "workspace-autosave.json")
 old := []byte(`{"tabs":[{"root":{"text":"Before interruption"}}]}`)
 next := []byte(`{"tabs":[{"root":{"text":"After restart"}}]}`)
 if err:=writeRecovery(path,old);err!=nil {t.Fatal(err)}
 pending := path+".replace-pending"
 // Crash window in the Windows atomicFile fallback: old file moved away,
 // staged replacement never installed.
 if err:=os.Rename(path,pending);err!=nil {t.Fatal(err)}
 got,previous,err:=readRecovery(path)
 if err!=nil||!previous||!bytes.Equal(got,old){
  t.Fatalf("failed to recover Windows replacement backup: %q %v %v",got,previous,err)
 }
 if err:=writeRecovery(path,next);err!=nil {t.Fatalf("restart save blocked: %v",err)}
 got,previous,err=readRecovery(path)
 if err!=nil||previous||!bytes.Equal(got,next){t.Fatalf("latest snapshot unavailable: %q %v",got,err)}
 recovered,err:=os.ReadFile(path+".previous")
 if err!=nil {t.Fatal(err)}
 if _,oldPayload,err:=readRecoveryFile(path+".previous");err!=nil||!bytes.Equal(oldPayload,old){
  t.Fatalf("previous generation was not preserved: %q %v",recovered,err)
 }
 if _,err:=os.Lstat(pending);!os.IsNotExist(err){t.Fatalf("stale replacement still exists: %v",err)}
}
func TestRecoveryAfterCompletedWindowsInstallCleansStalePendingCopy(t *testing.T) {
 path:=filepath.Join(t.TempDir(),"workspace-autosave.json")
 old:=[]byte(`{"tabs":[{"root":{"text":"Old"}}]}`)
 next:=[]byte(`{"tabs":[{"root":{"text":"Newest"}}]}`)
 if err:=writeRecovery(path,old);err!=nil{t.Fatal(err)}
 raw,err:=os.ReadFile(path);if err!=nil{t.Fatal(err)}
 if err:=os.WriteFile(path+".replace-pending",raw,0600);err!=nil{t.Fatal(err)}
 if err:=writeRecovery(path,next);err!=nil{t.Fatal(err)}
 if _,err:=os.Stat(path+".replace-pending");!os.IsNotExist(err){t.Fatal("stale backup not removed",err)}
 got,_,err:=readRecovery(path)
 if err!=nil||!bytes.Equal(got,next){t.Fatalf("latest recovery missing: %v",err)}
}
func TestRecoveryInterruptedReplacementKeepsImageAssetPath(t *testing.T) {
 path:=filepath.Join(t.TempDir(),"workspace-autosave.json")
 old:=mediaDoc("Before crash","A")
 if err:=writeRecovery(path,old);err!=nil{t.Fatal(err)}
 if err:=os.Rename(path,path+".replace-pending");err!=nil{t.Fatal(err)}
 got,previous,err:=readRecovery(path)
 if err!=nil||!previous||!bytes.Equal(got,old){
  t.Fatalf("image recovery backup not restored: previous=%v err=%v",previous,err)
 }
}
func TestRecoveryJournalRefusesSymbolicLinks(t *testing.T) {
 dir:=t.TempDir()
 outside:=filepath.Join(dir,"outside.json")
 if err:=os.WriteFile(outside,[]byte(`{"tabs":[{"root":{"text":"External"}}]}`),0600);err!=nil{t.Fatal(err)}
 link:=filepath.Join(dir,"workspace-autosave.json")
 if err:=os.Symlink(outside,link);err!=nil{t.Skipf("symlink creation unavailable: %v",err)}
 if got,_,err:=readRecovery(link);err==nil||got!=nil{
  t.Fatalf("journal followed symbolic link: %q %v",got,err)
 }
}

func TestRecoveryRepairsInterruptedPreviousGenerationRotation(t *testing.T) {
 path := filepath.Join(t.TempDir(), "workspace-autosave.json")
 a := []byte(`{"tabs":[{"root":{"text":"A"}}]}`)
 b := []byte(`{"tabs":[{"root":{"text":"B"}}]}`)
 c := []byte(`{"tabs":[{"root":{"text":"C"}}]}`)
 if err := writeRecovery(path,a);err!=nil{t.Fatal(err)}
 if err := writeRecovery(path,b);err!=nil{t.Fatal(err)}
 // Interrupted Windows fallback for path+".previous": the verified
 // generation is now in the replacement sibling.
 if err := os.Rename(path+".previous",path+".previous.replace-pending");err!=nil{t.Fatal(err)}
 if err := writeRecovery(path,c);err!=nil{t.Fatalf("autosave stuck after previous-generation interruption: %v",err)}
 got,previous,err := readRecovery(path)
 if err!=nil||previous||!bytes.Equal(got,c){t.Fatalf("latest snapshot incorrect: %q / %v",got,err)}
 _,old,err := readRecoveryFile(path+".previous")
 if err!=nil||!bytes.Equal(old,b){t.Fatalf("previous generation incorrect: %q / %v",old,err)}
 if _,err:=os.Lstat(path+".previous.replace-pending");!errors.Is(err,os.ErrNotExist){
  t.Fatalf("interrupted previous-generation staging not cleared: %v",err)
 }
}

func TestExplicitDiscardClearsInterruptedReplacementCopies(t *testing.T) {
 path := filepath.Join(t.TempDir(),"workspace-autosave.json")
 a := []byte(`{"tabs":[{"root":{"text":"Recoverable"}}]}`)
 b := []byte(`{"tabs":[{"root":{"text":"Newest"}}]}`)
 if err:=writeRecovery(path,a);err!=nil{t.Fatal(err)}
 if err:=writeRecovery(path,b);err!=nil{t.Fatal(err)}
 if err:=os.Rename(path,path+".replace-pending");err!=nil{t.Fatal(err)}
 if err:=os.Rename(path+".previous",path+".previous.replace-pending");err!=nil{t.Fatal(err)}
 if err:=discardRecovery(path);err!=nil{t.Fatalf("discard failed: %v",err)}
 got,fromPrevious,err:=readRecovery(path)
 if err!=nil||got!=nil||fromPrevious{t.Fatalf("discarded recovery resurrected: %q %v %v",got,fromPrevious,err)}
 for _,name:=range []string{path,path+".previous",path+".replace-pending",path+".previous.replace-pending"}{
  if _,err:=os.Lstat(name);!errors.Is(err,os.ErrNotExist){t.Fatalf("discard left %s: %v",name,err)}
 }
}

func TestRecoveryRejectsMalformedCollectionsBeforeRotatingLastValidBackup(t *testing.T) {
 path := filepath.Join(t.TempDir(),"workspace-autosave.json")
 good := []byte(`{"tabs":[{"root":{"text":"Safe","children":[]},"images":[],"relationships":[]}]}`)
 if err:=writeRecovery(path,good);err!=nil{t.Fatal(err)}
 for _,bad:=range []string{
  `{"tabs":[{"root":{"text":"Bad","children":{}}}]}`,
  `{"tabs":[{"root":{"text":"Bad","children":"wrong"}}]}`,
  `{"tabs":[{"root":{"text":"Bad"},"images":{}}]}`,
  `{"tabs":[{"root":{"text":"Bad"},"relationships":"wrong"}]}`,
  `{"tabs":[{"root":{"text":null}}]}`,
 }{
  if err:=writeRecovery(path,[]byte(bad));err==nil{
   t.Fatalf("malformed journal accepted: %s",bad)
  }
  recovered,previous,err:=readRecovery(path)
  if err!=nil||previous||!bytes.Equal(recovered,good){
   t.Fatalf("good generation altered after rejecting bad workspace: %s, %v",bad,err)
  }
 }
 for _,valid:=range []string{
  `{"tabs":[{"root":{"text":"Legacy","children":null},"images":null,"relationships":null}]}`,
  `{"tabs":[{"root":{"text":""}}]}`,
 }{
  if err:=writeRecovery(path,[]byte(valid));err!=nil{
   t.Fatalf("valid legacy workspace rejected: %s: %v",valid,err)
  }
 }
}
