package main

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

// Desktop APIs never accept a free-form path as an authorization grant.
// Paths can be overwritten only after being chosen by the native dialog,
// associated by Windows, or previously approved by the current user.
// Authorization must reflect filesystem casing: Linux and some macOS volumes
// are case-sensitive. Only Windows compares approved paths case-insensitively.
func approvedPathKey(p string) (string, error) {
 abs, err := filepath.Abs(p)
 if err != nil { return "", err }
 key := filepath.Clean(abs)
 if runtime.GOOS == "windows" { key = strings.ToLower(key) }
 return key, nil
}
func (s *service) approvePath(p string) error { return s.approvePaths([]string{p}) }

// One durable write per picker batch; the same mutex/rollback contract as a
// single grant. Disk-full must never leave new write authority in memory.
func (s *service) approvePaths(paths []string) error {
	if len(paths) == 0 {
		return nil
	}
	keys := make([]string, 0, len(paths))
	for _, p := range paths {
		key, err := approvedPathKey(p)
		if err != nil {
			return err
		}
		keys = append(keys, key)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.approvedPaths == nil {
		s.approvedPaths = make(map[string]bool)
	}
	previous := make(map[string]bool, len(s.approvedPaths))
	for key, value := range s.approvedPaths {
		previous[key] = value
	}
	for _, key := range keys {
		s.approvedPaths[key] = true
	}
	data, err := json.Marshal(s.approvedPaths)
	if err == nil {
		err = atomicFile(filepath.Join(s.configDir, "approved-project-paths.json"), data)
	}
	if err != nil {
		s.approvedPaths = previous
	}
	return err
}
func (s *service) authorizedPath(p string) bool {
	key, err := approvedPathKey(p)
	if err != nil { return false }
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.approvedPaths[key]
}

type recentProjectFile struct {
	Path      string `json:"path"`
	Filename  string `json:"filename"`
	Dir       string `json:"dir"`
	ModTimeMs int64  `json:"modTimeMs"`
	Size      int64  `json:"size"`
}

// listRecentApprovedProjects returns existing project files from paths already
// authorized by native file dialogs, Windows file associations, or saves,
// ordered from most recently modified to oldest. Never accepts user paths.
func (s *service) listRecentApprovedProjects(limit int) []recentProjectFile {
	if limit <= 0 {
		return []recentProjectFile{}
	}
	s.mu.Lock()
	candidates := make([]string, 0, len(s.approvedPaths))
	for p, ok := range s.approvedPaths {
		if ok {
			candidates = append(candidates, p)
		}
	}
	s.mu.Unlock()
	type entry struct {
		item    recentProjectFile
		modNano int64
		sortKey string
	}
	seen := make(map[string]bool)
	rows := make([]entry, 0, len(candidates))
	for _, rawPath := range candidates {
		if !projectExtension(rawPath) {
			continue
		}
		key, err := approvedPathKey(rawPath)
		if err != nil || seen[key] {
			continue
		}
		info, err := os.Stat(rawPath)
		if err != nil || !info.Mode().IsRegular() || info.Size() < 0 || info.Size() > maxNativeOpenFileBytes {
			continue
		}
		seen[key] = true
		absPath, err := filepath.Abs(rawPath)
		if err != nil {
			absPath = filepath.Clean(rawPath)
		}
		dirName := filepath.Base(filepath.Dir(absPath))
		if dirName == "." || dirName == string(filepath.Separator) {
			dirName = ""
		}
		mod := info.ModTime()
		rows = append(rows, entry{
			item: recentProjectFile{
				Path:      absPath,
				Filename:  filepath.Base(absPath),
				Dir:       dirName,
				ModTimeMs: mod.UnixMilli(),
				Size:      info.Size(),
			},
			modNano: mod.UnixNano(),
			sortKey: key,
		})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].modNano != rows[j].modNano {
			return rows[i].modNano > rows[j].modNano
		}
		return rows[i].sortKey < rows[j].sortKey
	})
	if len(rows) > limit {
		rows = rows[:limit]
	}
	out := make([]recentProjectFile, len(rows))
	for i := range rows {
		out[i] = rows[i].item
	}
	return out
}
func (s *service) loadPaths() {
	var paths map[string]bool
	if data, err := os.ReadFile(filepath.Join(s.configDir, "approved-project-paths.json")); err == nil && len(data) < 64*1024 {
		_ = json.Unmarshal(data, &paths)
	}
	s.mu.Lock()
	s.approvedPaths = paths
	if s.approvedPaths == nil {
		s.approvedPaths = make(map[string]bool)
	}
	s.mu.Unlock()
}
func (s *service) fileOpenedResponse(w io.Writer, p string) error {
	info, err := os.Stat(p)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() || info.Size() > maxWorkspace {
		return errors.New("File troppo grande o non valido")
	}
	data, err := os.ReadFile(p)
	if err != nil {
		return err
	}
	return json.NewEncoder(w).Encode(map[string]any{"cancelled": false, "filename": filepath.Base(p), "path": p, "base64": base64.StdEncoding.EncodeToString(data)})
}

// Overridden from versions.json during the local release build via -ldflags.
// The source default allows un-staged developer go test runs.
var xmindCreatorVersion = "1.0.4"

type storedNode struct {
	ID       string        `json:"id"`
	Text     string        `json:"text"`
	Notes    string        `json:"notes"`
	LinkURL  string        `json:"linkUrl"`
	Children []*storedNode `json:"children"`
}
type storedImage struct {
	Src            string  `json:"src"`
	AttachedNodeID string  `json:"attachedNodeId"`
	Mode           string  `json:"mode"`
	Width          float64 `json:"width"`
	Height         float64 `json:"height"`
}
type xmindSheet struct {
	Title  string        `json:"title"`
	Root   *storedNode   `json:"root"`
	Images []storedImage `json:"images"`
}

func encodeXMind(content string, rawSheets []json.RawMessage) ([]byte, error) {
	if len(rawSheets) == 0 || len(rawSheets) > 60 {
		return nil, errors.New("Non sono presenti schede XMind valide")
	}
	var b bytes.Buffer
	zw := zip.NewWriter(&b)
	writeFile := func(name string, data []byte) error {
		w, err := zw.Create(name)
		if err != nil {
			return err
		}
		_, err = w.Write(data)
		return err
	}
	sheets := make([]map[string]any, 0, len(rawSheets))
	resources := map[string][]byte{}
	nodeCount := 0
	for si, raw := range rawSheets {
		var sheet xmindSheet
		if err := json.Unmarshal(raw, &sheet); err != nil {
			return nil, fmt.Errorf("Scheda %d non valida: %w", si+1, err)
		}
		if sheet.Root == nil {
			return nil, fmt.Errorf("Scheda %d senza nodo principale", si+1)
		}
		attached := make(map[string]map[string]any)
		for ii, img := range sheet.Images {
			if img.Mode != "attached" || img.AttachedNodeID == "" || !strings.HasPrefix(img.Src, "data:image/") {
				continue
			}
			sep := strings.Index(img.Src, ",")
			if sep < 0 || sep > 100 {
				continue
			}
			header := img.Src[:sep]
			if !strings.HasSuffix(strings.ToLower(header), ";base64") {
				continue
			}
			rawType := strings.TrimPrefix(strings.Split(header, ";")[0], "data:")
			ext := "png"
			if e, err := mime.ExtensionsByType(rawType); err == nil {
				for _, v := range e {
					if v == ".png" || v == ".jpg" || v == ".jpeg" || v == ".webp" || v == ".gif" {
						ext = strings.TrimPrefix(v, ".")
						break
					}
				}
			}
			decoded, err := base64.StdEncoding.DecodeString(img.Src[sep+1:])
			if err != nil || len(decoded) > 15<<20 {
				continue
			}
			file := fmt.Sprintf("resources/s%d_img%d.%s", si, ii, ext)
			resources[file] = decoded
			if _, exists := attached[img.AttachedNodeID]; !exists {
				attached[img.AttachedNodeID] = map[string]any{"src": "xap:" + file, "width": img.Width, "height": img.Height}
			}
		}
		var convert func(*storedNode, int) (map[string]any, error)
		convert = func(n *storedNode, depth int) (map[string]any, error) {
			nodeCount++
			if nodeCount > 20000 || depth > 120 {
				return nil, errors.New("Struttura mappa troppo grande")
			}
			o := map[string]any{"id": n.ID, "title": n.Text, "class": "topic"}
			if n.Notes != "" {
				o["notes"] = map[string]any{"plain": map[string]any{"content": n.Notes}}
			}
			if choice, err := classifyLinkTarget(n.LinkURL); err == nil {
				href := choice.Value
				if choice.Kind == "file" {
					href = fileLinkHref(choice.Value)
				}
				o["href"] = href
			}
			if image, ok := attached[n.ID]; ok {
				o["image"] = image
			}
			if len(n.Children) > 0 {
				children := make([]any, 0, len(n.Children))
				for _, child := range n.Children {
					if child == nil {
						continue
					}
					converted, err := convert(child, depth+1)
					if err != nil {
						return nil, err
					}
					children = append(children, converted)
				}
				o["children"] = map[string]any{"attached": children}
			}
			return o, nil
		}
		root, err := convert(sheet.Root, 0)
		if err != nil {
			return nil, err
		}
		title := sheet.Title
		if strings.TrimSpace(title) == "" {
			title = sheet.Root.Text
		}
		sheets = append(sheets, map[string]any{"id": fmt.Sprintf("sheet_%d_%d", time.Now().UnixNano(), si), "class": "sheet", "title": title,
			"rootTopic": root, "topicPositioning": "clockwise", "structureClass": "org.xmind.ui.map.unbalanced"})
	}
	rawContent, err := json.Marshal(sheets)
	if err != nil {
		return nil, err
	}
	if err = writeFile("content.json", rawContent); err != nil {
		return nil, err
	}
	rawMetadata, _ := json.Marshal(map[string]any{"creator": map[string]any{"name": "Glauka", "version": xmindCreatorVersion}, "activeSheetId": sheets[0]["id"]})
	if err = writeFile("metadata.json", rawMetadata); err != nil {
		return nil, err
	}
	manifest := map[string]any{"file-entries": map[string]any{"content.json": map[string]any{}, "metadata.json": map[string]any{}, "neuromap/workspace.json": map[string]any{}}}
	for name := range resources {
		manifest["file-entries"].(map[string]any)[name] = map[string]any{}
	}
	rawManifest, _ := json.Marshal(manifest)
	if err = writeFile("manifest.json", rawManifest); err != nil {
		return nil, err
	}
	// NeuroMap-specific document retains free images, exact positioning, study
	// data, relationship styles, etc. XMind itself reads content.json.
	workspace, _ := json.Marshal(map[string]any{"schema": "NeuroMapArchitect-WorkspaceBatch-v6", "tabs": rawSheets})
	if err = writeFile("neuromap/workspace.json", workspace); err != nil {
		return nil, err
	}
	for name, payload := range resources {
		if err = writeFile(name, payload); err != nil {
			return nil, err
		}
	}
	if err = zw.Close(); err != nil {
		return nil, err
	}
	if b.Len() > maxWorkspace {
		return nil, errors.New("Il file XMind supera il limite di 80 MB")
	}
	return b.Bytes(), nil
}

// Backup the native XMind once, outside the working file list. NeuroMap Backups
// contains original XMind snapshots that may have styles unsupported by NeuroMap.
// Never silently delete or replace an existing legacy .bak.xmind backup.
func xmindBackupDestination(path string) string {
	return filepath.Join(filepath.Dir(path), "Glauka Backups", strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))+".original.xmind")
}
func backupOriginalXMind(path string) error {
	_, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	// The legacy format may already hold the original. Preserve it untouched.
	legacy := path + ".before-NeuroMap.bak.xmind"
	if _, err := os.Stat(legacy); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	// Honor an original already protected by the old backup location.
	oldBackup := filepath.Join(filepath.Dir(path), "NeuroMap Backups", strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))+".original.xmind")
	if _, err := os.Stat(oldBackup); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	backup := xmindBackupDestination(path)
	if _, err := os.Stat(backup); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	// 0700 ensures private project snapshots are not made world-readable.
	if err := os.MkdirAll(filepath.Dir(backup), 0700); err != nil {
		return err
	}
	src, err := os.Open(path)
	if err != nil {
		return err
	}
	defer src.Close()
	dst, err := os.OpenFile(backup, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return err
	}
	_, err = io.Copy(dst, src)
	closeErr := dst.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		_ = os.Remove(backup)
	}
	return err
}
