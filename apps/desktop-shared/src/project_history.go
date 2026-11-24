package main

import (
	"compress/gzip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"
)

// Time Machine stores the previous on-disk version *before* an intentional
// native overwrite. Project formats and logical IDs are never rewritten.
// Snapshots live under the private application config directory, not beside
// the user's project. This is local-only and deliberately independent of AI.
const (
	maxProjectHistoryVersions = 12
	maxProjectHistoryBytes    = 256 << 20
	maxProjectHistorySnapshot = 100 << 20
)

var projectHistoryID = regexp.MustCompile(`^\d{8}T\d{6}\.\d{9}Z_[a-f0-9]{64}\.snap$`)

type projectRevision struct {
	ID      string `json:"id"`
	SavedAt string `json:"savedAt"`
	SHA256  string `json:"sha256"`
	Size    int64  `json:"size"`
 Pinned bool `json:"pinned"`
}

func projectHistoryDir(configDir, projectPath string) (string, error) {
	abs, err := filepath.Abs(projectPath)
	if err != nil {
		return "", err
	}
	abs = filepath.Clean(abs)
	if runtime.GOOS == "windows" {
		abs = strings.ToLower(abs)
	}
	digest := sha256.Sum256([]byte(abs))
	return filepath.Join(configDir, "time-machine", hex.EncodeToString(digest[:])), nil
}

// Never silently replace the user's last saved copy if its protective snapshot
// fails. A new file, or a byte-identical save, needs no prior snapshot.
func stageProjectRevision(configDir, projectPath string, next []byte) (string, error) {
	info, err := os.Lstat(projectPath)
	if errors.Is(err, os.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if !info.Mode().IsRegular() {
		return "", fmt.Errorf("time machine: project is not a regular file")
	}
	if info.Size() > maxProjectHistorySnapshot {
		return "", fmt.Errorf("time machine: existing project exceeds snapshot safety limit")
	}
	old, err := os.ReadFile(projectPath)
	if err != nil {
		return "", fmt.Errorf("time machine: read original: %w", err)
	}
	if bytes.Equal(old, next) {
		return "", nil
	}
	dir, err := projectHistoryDir(configDir, projectPath)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", fmt.Errorf("time machine: create directory: %w", err)
	}
	digest := sha256.Sum256(old)
	sum := hex.EncodeToString(digest[:])
	// An exact copy already in history is sufficient: no duplicate data.
	existing, err := listProjectRevisions(configDir, projectPath)
	if err != nil {
		return "", err
	}
	for _, version := range existing {
		if version.SHA256 == sum {
			// Never trust an existing matching filename without checking its bytes.
			verified, verifyErr := readProjectRevision(configDir, projectPath, version.ID)
			if verifyErr != nil {
				return "", fmt.Errorf("time machine: existing revision damaged: %w", verifyErr)
			}
			if bytes.Equal(verified, old) {
				return version.ID, nil
			}
		}
	}
	name := time.Now().UTC().Format("20060102T150405.000000000Z") + "_" + sum + ".snap"
	path := filepath.Join(dir, name)
	if _, err := os.Lstat(path); err == nil {
		return "", fmt.Errorf("time machine: revision ID collision")
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	// Use fast, lossless compression for JSON-heavy maps when it actually
 // reduces disk usage. Previous uncompressed .snap files remain readable.
 archived:=old
 var compressed bytes.Buffer
 zipper,zipErr:=gzip.NewWriterLevel(&compressed,gzip.BestSpeed)
 if zipErr!=nil{return "",zipErr}
 if _,zipErr=zipper.Write(old);zipErr!=nil{_ = zipper.Close();return "",zipErr}
 if zipErr=zipper.Close();zipErr!=nil{return "",zipErr}
 if compressed.Len()<len(old){archived=compressed.Bytes()}
 if err := atomicFile(path, archived); err != nil {
		return "", fmt.Errorf("time machine: persist revision: %w", err)
	}
	return name, nil
}

func listProjectRevisions(configDir, projectPath string) ([]projectRevision, error) {
	dir, err := projectHistoryDir(configDir, projectPath)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return []projectRevision{}, nil
	}
	if err != nil {
		return nil, err
	}
	revisions := make([]projectRevision, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if !projectHistoryID.MatchString(name) || !entry.Type().IsRegular() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		t, err := time.Parse("20060102T150405.000000000Z", strings.SplitN(name, "_", 2)[0])
		if err != nil {
			continue
		}
		sum := strings.TrimSuffix(strings.SplitN(name, "_", 2)[1], ".snap")
		_, pinErr:=os.Lstat(filepath.Join(dir,name+".keep"))
  if pinErr!=nil&&!errors.Is(pinErr,os.ErrNotExist){return nil,pinErr}
  revisions = append(revisions, projectRevision{ID: name, SavedAt: t.Format(time.RFC3339Nano), SHA256: sum, Size: info.Size(),Pinned:pinErr==nil})
	}
	sort.Slice(revisions, func(i, j int) bool { return revisions[i].ID > revisions[j].ID })
	return revisions, nil
}

func readProjectRevision(configDir, projectPath, id string) ([]byte, error) {
	if !projectHistoryID.MatchString(id) {
		return nil, fmt.Errorf("time machine: invalid version identifier")
	}
	dir, err := projectHistoryDir(configDir, projectPath)
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, id)
	info, err := os.Lstat(path)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Size() > maxProjectHistorySnapshot {
		return nil, fmt.Errorf("time machine: invalid snapshot file")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
 if len(data)>=2&&data[0]==0x1f&&data[1]==0x8b{
  decoder,decodeErr:=gzip.NewReader(bytes.NewReader(data))
  if decodeErr!=nil{return nil,fmt.Errorf("time machine: compressed snapshot invalid: %w",decodeErr)}
  expanded,readErr:=io.ReadAll(io.LimitReader(decoder,maxProjectHistorySnapshot+1))
  closeErr:=decoder.Close()
  if readErr!=nil{return nil,fmt.Errorf("time machine: decompression failed: %w",readErr)}
  if closeErr!=nil{return nil,fmt.Errorf("time machine: compressed snapshot damaged: %w",closeErr)}
  if len(expanded)>maxProjectHistorySnapshot{return nil,fmt.Errorf("time machine: snapshot too large after decompression")}
  data=expanded
 }
	digest := sha256.Sum256(data)
	if hex.EncodeToString(digest[:]) != strings.TrimSuffix(strings.SplitN(id, "_", 2)[1], ".snap") {
		return nil, fmt.Errorf("time machine: snapshot checksum mismatch")
	}
	return data, nil
}

// Recovery deliberately writes a NEW sibling file using O_EXCL. The active
// project and its current on-disk content cannot be overwritten by recovery.
func recoverProjectRevision(configDir, projectPath, id string) (string, error) {
	data, err := readProjectRevision(configDir, projectPath, id)
	if err != nil {
		return "", err
	}
	ext := filepath.Ext(projectPath)
	name := strings.TrimSuffix(filepath.Base(projectPath), ext)
	stamp := strings.SplitN(id, "_", 2)[0]
	dest := filepath.Join(filepath.Dir(projectPath), name+" (recovered "+stamp+")"+ext)
	file, err := os.OpenFile(dest, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return "", err
	}
	n, writeErr := file.Write(data)
	if writeErr == nil && n != len(data) {
		writeErr = io.ErrShortWrite
	}
	if writeErr == nil {
		writeErr = file.Sync()
	}
	closeErr := file.Close()
	if writeErr == nil {
		writeErr = closeErr
	}
	if writeErr != nil {
		_ = os.Remove(dest)
		return "", writeErr
	}
	return dest, nil
}

// Called ONLY after a successful native project write; a failed save never
// triggers retention cleanup. Always keep at least the most recent revision.
// A pinned copy is never removed by automatic pruning. At most five can be
// protected per project to avoid unlimited app storage growth.
func setProjectRevisionPinned(configDir,projectPath,id string,pin bool) error {
 if !projectHistoryID.MatchString(id){return fmt.Errorf("time machine: invalid revision ID")}
 revisions,err:=listProjectRevisions(configDir,projectPath)
 if err!=nil{return err}
 found:=false;pinned:=0
 for _,v:=range revisions {if v.Pinned{pinned++};if v.ID==id{found=true;if v.Pinned&&pin{return nil}}}
 if !found{return os.ErrNotExist}
 if pin&&pinned>=5{return fmt.Errorf("time machine: maximum of five pinned copies per project")}
 dir,err:=projectHistoryDir(configDir,projectPath)
 if err!=nil{return err}
 marker:=filepath.Join(dir,id+".keep")
 if !pin{
  if err:=os.Remove(marker);err!=nil&&!errors.Is(err,os.ErrNotExist){return err}
  return nil
 }
 // Check historical bytes before permanently protecting a copy.
 if _,err:=readProjectRevision(configDir,projectPath,id);err!=nil{return err}
 return atomicFile(marker,[]byte("pinned\n"))
}

// Never delete retained user-pinned copies; only unpinned copies count toward
// the standard rolling 12-version / 256 MiB budget.
func pruneProjectRevisions(configDir, projectPath string) error {
 versions,err:=listProjectRevisions(configDir,projectPath)
 if err!=nil{return err}
 dir,err:=projectHistoryDir(configDir,projectPath)
 if err!=nil{return err}
 var unpinned []projectRevision
 for _,v:=range versions{if !v.Pinned{unpinned=append(unpinned,v)}}
 var total int64
 for i,v:=range unpinned{
  total+=v.Size
  if i<maxProjectHistoryVersions{continue}
  if err:=os.Remove(filepath.Join(dir,v.ID));err!=nil{return err}
  total-=v.Size
 }
 for i:=len(unpinned)-1;i>=1&&total>maxProjectHistoryBytes;i--{
  if i>=maxProjectHistoryVersions{continue}
  if err:=os.Remove(filepath.Join(dir,unpinned[i].ID));err!=nil{return err}
  total-=unpinned[i].Size
 }
 return nil
}
