package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"
)

// Native-only, read-only summary of changes between a saved Time Machine revision
// and the currently saved project file across every mind-map format Glauka reads:
// .gk/.glk/.neuromap, .xmind (Zen JSON / Legacy XML / embedded Glauka workspace),
// .json, .opml/.xml, and .md/.markdown/.txt outlines. No unsaved editor state
// crosses the bridge and unknown binary blobs fail closed as unsupported.
type projectRevisionDiff struct {
	Supported     bool     `json:"supported"`
	Format        string   `json:"format,omitempty"`
	Reason        string   `json:"reason,omitempty"`
	Added         int      `json:"added"`
	Removed       int      `json:"removed"`
	Modified      int      `json:"modified"`
	Before        int      `json:"before"`
	Now           int      `json:"now"`
	ImagesBefore  int      `json:"imagesBefore"`
	ImagesNow     int      `json:"imagesNow"`
	AddedIDs      []string `json:"addedIds,omitempty"`
	ModifiedIDs   []string `json:"modifiedIds,omitempty"`
	AddedNames    []string `json:"addedNames,omitempty"`
	RemovedNames  []string `json:"removedNames,omitempty"`
	ModifiedNames []string `json:"modifiedNames,omitempty"`
}

type historyNodeEntry struct {
	ID      string
	Title   string
	Payload []byte
	Order   int
}

type historySnapshot struct {
	Format string
	Nodes  map[string]historyNodeEntry
	Images int
}

func trimTitleLabel(raw string) string {
	clean := strings.Join(strings.Fields(strings.TrimSpace(raw)), " ")
	if len([]rune(clean)) > 72 {
		r := []rune(clean)
		return string(r[:71]) + "…"
	}
	return clean
}

func addHistoryNode(nodes map[string]historyNodeEntry, key, id, title string, payload []byte) error {
	if len(key) == 0 || len(key) > 512 {
		return errors.New("invalid node key")
	}
	if _, exists := nodes[key]; exists {
		return errors.New("duplicate node key")
	}
	nodes[key] = historyNodeEntry{
		ID:      id,
		Title:   trimTitleLabel(title),
		Payload: payload,
		Order:   len(nodes),
	}
	return nil
}

func scanGlaukaTree(raw json.RawMessage, nodes map[string]historyNodeEntry, depth int, prefix string, pathCounts map[string]int) error {
	if depth > 256 || len(nodes) >= 100000 {
		return errors.New("project exceeds diff safety limit")
	}
	var n map[string]json.RawMessage
	if err := json.Unmarshal(raw, &n); err != nil {
		return err
	}
	var text string
	if len(n["text"]) > 0 {
		_ = json.Unmarshal(n["text"], &text)
	}
	if text == "" && len(n["title"]) > 0 {
		_ = json.Unmarshal(n["title"], &text)
	}
	var id string
	_ = json.Unmarshal(n["id"], &id)
	key := id
	if key == "" {
		base := prefix + "/" + strings.ToLower(strings.TrimSpace(text))
		pathCounts[base]++
		key = fmt.Sprintf("p:%s#%d", base, pathCounts[base])
	} else if len(key) > 256 {
		return errors.New("invalid node ID")
	}
	if _, exists := nodes[key]; exists && prefix != "" {
		key = prefix + ":" + key
	}
	var children []json.RawMessage
	if len(n["children"]) != 0 && string(n["children"]) != "null" {
		if err := json.Unmarshal(n["children"], &children); err != nil {
			return err
		}
	}
	delete(n, "children")
	payload, err := json.Marshal(n)
	if err != nil {
		return err
	}
	if err := addHistoryNode(nodes, key, id, text, payload); err != nil {
		return err
	}
	nextPrefix := key
	if prefix == "" && id == "" {
		nextPrefix = key
	}
	for _, child := range children {
		if err := scanGlaukaTree(child, nodes, depth+1, nextPrefix, pathCounts); err != nil {
			return err
		}
	}
	return nil
}

func historyNodesFromGlaukaJSON(data []byte, formatLabel string) (*historySnapshot, error) {
	var top map[string]json.RawMessage
	if err := json.Unmarshal(data, &top); err != nil {
		return nil, errors.New("non-Glauka JSON object")
	}
	nodes := make(map[string]historyNodeEntry)
	counts := make(map[string]int)

	if len(top["root"]) > 0 {
		var images []json.RawMessage
		_ = json.Unmarshal(top["images"], &images)
		if err := scanGlaukaTree(top["root"], nodes, 0, "", counts); err != nil {
			return nil, err
		}
		if len(nodes) == 0 {
			return nil, errors.New("empty project root")
		}
		return &historySnapshot{Format: formatLabel, Nodes: nodes, Images: len(images)}, nil
	}

	if len(top["tabs"]) > 0 {
		var tabs []json.RawMessage
		if err := json.Unmarshal(top["tabs"], &tabs); err != nil || len(tabs) == 0 {
			return nil, errors.New("invalid workspace tabs")
		}
		totalImages := 0
		for ti, tabRaw := range tabs {
			var tab struct {
				Root   json.RawMessage   `json:"root"`
				Images []json.RawMessage `json:"images"`
			}
			if err := json.Unmarshal(tabRaw, &tab); err != nil || len(tab.Root) == 0 {
				continue
			}
			totalImages += len(tab.Images)
			if err := scanGlaukaTree(tab.Root, nodes, 0, fmt.Sprintf("tab%d", ti), counts); err != nil {
				return nil, err
			}
		}
		if len(nodes) == 0 {
			return nil, errors.New("workspace contains no nodes")
		}
		return &historySnapshot{Format: formatLabel, Nodes: nodes, Images: totalImages}, nil
	}

	if len(top["rootTopic"]) > 0 {
		if err := scanXMindTopicJSON(top["rootTopic"], nodes, 0, "s0", counts); err != nil || len(nodes) == 0 {
			return nil, errors.New("invalid XMind sheet object")
		}
		return &historySnapshot{Format: "XMind JSON", Nodes: nodes, Images: 0}, nil
	}

	// Bare hierarchy JSON ({ text/title, children })
	if len(top["text"]) > 0 || len(top["title"]) > 0 {
		rawObj, _ := json.Marshal(top)
		if err := scanGlaukaTree(rawObj, nodes, 0, "json", counts); err == nil && len(nodes) > 0 {
			return &historySnapshot{Format: formatLabel, Nodes: nodes, Images: 0}, nil
		}
	}

	return nil, errors.New("non-Glauka project format")
}

func scanXMindTopicJSON(raw json.RawMessage, nodes map[string]historyNodeEntry, depth int, prefix string, pathCounts map[string]int) error {
	if depth > 256 || len(nodes) >= 100000 {
		return errors.New("project exceeds diff safety limit")
	}
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(raw, &obj); err != nil {
		return err
	}
	var id, title string
	_ = json.Unmarshal(obj["id"], &id)
	_ = json.Unmarshal(obj["title"], &title)
	if title == "" {
		_ = json.Unmarshal(obj["text"], &title)
	}
	var childGroups struct {
		Attached []json.RawMessage `json:"attached"`
		Detached []json.RawMessage `json:"detached"`
		Summary  []json.RawMessage `json:"summary"`
	}
	if len(obj["children"]) > 0 && string(obj["children"]) != "null" {
		_ = json.Unmarshal(obj["children"], &childGroups)
	}
	delete(obj, "children")
	key := id
	if key == "" {
		base := prefix + "/" + strings.ToLower(strings.TrimSpace(title))
		pathCounts[base]++
		key = fmt.Sprintf("xm:%s#%d", base, pathCounts[base])
	}
	if _, exists := nodes[key]; exists {
		key = fmt.Sprintf("%s:%s#%d", prefix, key, len(nodes))
	}
	payload, err := json.Marshal(obj)
	if err != nil {
		return err
	}
	if err := addHistoryNode(nodes, key, id, title, payload); err != nil {
		return err
	}
	for _, group := range [][]json.RawMessage{childGroups.Attached, childGroups.Detached, childGroups.Summary} {
		for _, child := range group {
			if err := scanXMindTopicJSON(child, nodes, depth+1, prefix, pathCounts); err != nil {
				return err
			}
		}
	}
	return nil
}

func historyNodesFromXMindZIP(data []byte) (*historySnapshot, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, err
	}
	readEntry := func(f *zip.File) ([]byte, error) {
		if f.UncompressedSize64 > maxProjectHistorySnapshot {
			return nil, errors.New("xmind entry exceeds safety size")
		}
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		defer rc.Close()
		out, err := io.ReadAll(io.LimitReader(rc, maxProjectHistorySnapshot+1))
		if err != nil {
			return nil, err
		}
		if len(out) > maxProjectHistorySnapshot {
			return nil, errors.New("xmind entry too large")
		}
		return out, nil
	}

	var workspaceFile, contentJSONFile, contentXMLFile *zip.File
	resourceImages := 0
	for _, f := range zr.File {
		lower := strings.ToLower(filepath.ToSlash(f.Name))
		if f.FileInfo().IsDir() {
			continue
		}
		if strings.HasPrefix(lower, "resources/") {
			ext := filepath.Ext(lower)
			if ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".webp" || ext == ".gif" || ext == ".svg" {
				resourceImages++
			}
		}
		switch {
		case lower == "neuromap/workspace.json":
			workspaceFile = f
		case lower == "content.json":
			contentJSONFile = f
		case lower == "content.xml":
			contentXMLFile = f
		}
	}

	if workspaceFile != nil {
		if raw, err := readEntry(workspaceFile); err == nil {
			if snap, err := historyNodesFromGlaukaJSON(raw, "XMind (.xmind)"); err == nil {
				if snap.Images == 0 && resourceImages > 0 {
					snap.Images = resourceImages
				}
				return snap, nil
			}
		}
	}
	if contentJSONFile != nil {
		raw, err := readEntry(contentJSONFile)
		if err != nil {
			return nil, err
		}
		var sheets []struct {
			RootTopic json.RawMessage `json:"rootTopic"`
		}
		if err := json.Unmarshal(raw, &sheets); err != nil || len(sheets) == 0 {
			var single struct {
				RootTopic json.RawMessage `json:"rootTopic"`
			}
			if err2 := json.Unmarshal(raw, &single); err2 == nil && len(single.RootTopic) > 0 {
				sheets = append(sheets, single)
			}
		}
		nodes := make(map[string]historyNodeEntry)
		counts := make(map[string]int)
		for i, sheet := range sheets {
			if len(sheet.RootTopic) == 0 {
				continue
			}
			if err := scanXMindTopicJSON(sheet.RootTopic, nodes, 0, fmt.Sprintf("s%d", i), counts); err != nil {
				return nil, err
			}
		}
		if len(nodes) > 0 {
			return &historySnapshot{Format: "XMind (.xmind)", Nodes: nodes, Images: resourceImages}, nil
		}
	}
	if contentXMLFile != nil {
		raw, err := readEntry(contentXMLFile)
		if err != nil {
			return nil, err
		}
		if snap, err := historyNodesFromXML(raw, "XMind Legacy (.xmind)"); err == nil {
			snap.Images = resourceImages
			return snap, nil
		}
	}
	return nil, errors.New("unrecognized XMind archive")
}

type genericXMLNode struct {
	XMLName xml.Name
	Attrs   []xml.Attr        `xml:",any,attr"`
	Text    string            `xml:",chardata"`
	Nodes   []*genericXMLNode `xml:",any"`
}

func xmlAttr(n *genericXMLNode, names ...string) string {
	for _, want := range names {
		for _, a := range n.Attrs {
			if strings.EqualFold(a.Name.Local, want) {
				return a.Value
			}
		}
	}
	return ""
}

func historyNodesFromXML(data []byte, formatOverride string) (*historySnapshot, error) {
	var root genericXMLNode
	dec := xml.NewDecoder(bytes.NewReader(data))
	dec.Entity = xml.HTMLEntity
	if err := dec.Decode(&root); err != nil {
		return nil, err
	}
	nodes := make(map[string]historyNodeEntry)
	counts := make(map[string]int)
	format := formatOverride

	var walkOPML func(*genericXMLNode, int, string) error
	walkOPML = func(el *genericXMLNode, depth int, prefix string) error {
		if depth > 256 || len(nodes) >= 100000 {
			return errors.New("OPML exceeds diff limit")
		}
		if strings.EqualFold(el.XMLName.Local, "outline") {
			title := xmlAttr(el, "text", "title")
			note := xmlAttr(el, "_note", "note")
			id := xmlAttr(el, "id")
			pathKey := prefix + "/" + strings.ToLower(strings.TrimSpace(title))
			key := id
			if key == "" {
				counts[pathKey]++
				key = fmt.Sprintf("opml:%s#%d", pathKey, counts[pathKey])
			}
			payload, _ := json.Marshal(map[string]any{"title": title, "note": note, "depth": depth})
			if err := addHistoryNode(nodes, key, id, title, payload); err != nil {
				return err
			}
			prefix = pathKey
		}
		for _, c := range el.Nodes {
			if err := walkOPML(c, depth+1, prefix); err != nil {
				return err
			}
		}
		return nil
	}

	var walkXMindXML func(*genericXMLNode, int, string) error
	walkXMindXML = func(el *genericXMLNode, depth int, prefix string) error {
		if depth > 256 || len(nodes) >= 100000 {
			return errors.New("XMind XML exceeds diff limit")
		}
		if strings.EqualFold(el.XMLName.Local, "topic") {
			id := xmlAttr(el, "id")
			title, note := "", ""
			for _, ch := range el.Nodes {
				switch strings.ToLower(ch.XMLName.Local) {
				case "title":
					title = strings.TrimSpace(ch.Text)
				case "notes":
					for _, nch := range ch.Nodes {
						if strings.EqualFold(nch.XMLName.Local, "plain") {
							note = strings.TrimSpace(nch.Text)
						}
					}
					if note == "" {
						note = strings.TrimSpace(ch.Text)
					}
				}
			}
			key := id
			pathKey := prefix + "/" + strings.ToLower(strings.TrimSpace(title))
			if key == "" {
				counts[pathKey]++
				key = fmt.Sprintf("xxml:%s#%d", pathKey, counts[pathKey])
			}
			payload, _ := json.Marshal(map[string]any{"title": title, "note": note})
			if err := addHistoryNode(nodes, key, id, title, payload); err != nil {
				return err
			}
			prefix = pathKey
		}
		for _, c := range el.Nodes {
			if err := walkXMindXML(c, depth+1, prefix); err != nil {
				return err
			}
		}
		return nil
	}

	var walkFreeMind func(*genericXMLNode, int, string) error
	walkFreeMind = func(el *genericXMLNode, depth int, prefix string) error {
		if depth > 256 || len(nodes) >= 100000 {
			return errors.New("FreeMind XML exceeds diff limit")
		}
		if strings.EqualFold(el.XMLName.Local, "node") {
			title := xmlAttr(el, "TEXT", "text")
			id := xmlAttr(el, "ID", "id")
			key := id
			pathKey := prefix + "/" + strings.ToLower(strings.TrimSpace(title))
			if key == "" {
				counts[pathKey]++
				key = fmt.Sprintf("mm:%s#%d", pathKey, counts[pathKey])
			}
			payload, _ := json.Marshal(map[string]any{"title": title, "depth": depth})
			if err := addHistoryNode(nodes, key, id, title, payload); err != nil {
				return err
			}
			prefix = pathKey
		}
		for _, c := range el.Nodes {
			if err := walkFreeMind(c, depth+1, prefix); err != nil {
				return err
			}
		}
		return nil
	}

	switch strings.ToLower(root.XMLName.Local) {
	case "opml":
		if format == "" {
			format = "OPML (.opml)"
		}
		if err := walkOPML(&root, 0, ""); err != nil {
			return nil, err
		}
	case "xmap-content":
		if format == "" {
			format = "XMind XML (.xml)"
		}
		if err := walkXMindXML(&root, 0, ""); err != nil {
			return nil, err
		}
	case "map":
		if format == "" {
			format = "FreeMind (.mm / .xml)"
		}
		if err := walkFreeMind(&root, 0, ""); err != nil {
			return nil, err
		}
	default:
		if format == "" {
			format = "XML (.xml)"
		}
		if err := walkOPML(&root, 0, ""); err != nil {
			return nil, err
		}
		if len(nodes) == 0 {
			_ = walkFreeMind(&root, 0, "")
		}
	}
	if len(nodes) == 0 {
		return nil, errors.New("no nodes found in XML")
	}
	return &historySnapshot{Format: format, Nodes: nodes, Images: 0}, nil
}

var markdownHeadingRe = regexp.MustCompile(`^(#{1,6})\s+(.*)$`)
var markdownBulletRe = regexp.MustCompile(`^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$`)
var markdownMetaCommentRe = regexp.MustCompile(`<!--[\s\S]*?-->`)

func historyNodesFromOutlineText(data []byte) (*historySnapshot, error) {
	if len(data) == 0 || !utf8.Valid(data) {
		return nil, errors.New("non-UTF8 binary data")
	}
	text := string(bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF}))
	for _, r := range text {
		if r < 0x20 && r != '\n' && r != '\r' && r != '\t' {
			return nil, errors.New("control characters in outline text")
		}
	}
	isMarkdown := strings.Contains(text, "NeuroMap-Markdown")
	lines := strings.Split(strings.ReplaceAll(strings.ReplaceAll(text, "\r\n", "\n"), "\r", "\n"), "\n")

	type stackFrame struct {
		depth int
		path  string
	}
	stack := []stackFrame{}
	nodes := make(map[string]historyNodeEntry)
	counts := make(map[string]int)
	inCode := false
	lineNo := 0

	for _, rawLine := range lines {
		trimmed := strings.TrimSpace(rawLine)
		if strings.HasPrefix(trimmed, "```") {
			inCode = !inCode
			continue
		}
		if inCode || trimmed == "" || trimmed == "---" {
			continue
		}
		cleaned := strings.TrimSpace(markdownMetaCommentRe.ReplaceAllString(rawLine, ""))
		if cleaned == "" {
			continue
		}
		depth := 0
		label := cleaned
		if m := markdownHeadingRe.FindStringSubmatch(cleaned); m != nil {
			isMarkdown = true
			depth = len(m[1]) - 1
			label = strings.TrimSpace(m[2])
		} else if m := markdownBulletRe.FindStringSubmatch(strings.TrimRight(rawLine, " \t")); m != nil {
			if strings.HasPrefix(strings.TrimSpace(rawLine), "-") || strings.HasPrefix(strings.TrimSpace(rawLine), "*") {
				isMarkdown = true
			}
			indent := strings.ReplaceAll(m[1], "\t", "  ")
			depth = 1 + len(indent)/2
			label = strings.TrimSpace(markdownMetaCommentRe.ReplaceAllString(m[2], ""))
		} else {
			leading := len(rawLine) - len(strings.TrimLeft(rawLine, " \t"))
			depth = leading / 2
			label = trimmed
		}
		if label == "" {
			continue
		}
		lineNo++
		for len(stack) > 0 && stack[len(stack)-1].depth >= depth {
			stack = stack[:len(stack)-1]
		}
		parentPath := ""
		if len(stack) > 0 {
			parentPath = stack[len(stack)-1].path
		}
		nodePath := parentPath + "/" + label
		stack = append(stack, stackFrame{depth: depth, path: nodePath})
		counts[nodePath]++
		key := fmt.Sprintf("txt:%s#%d", nodePath, counts[nodePath])
		payload, _ := json.Marshal(map[string]any{"text": label, "raw": cleaned, "depth": depth})
		if err := addHistoryNode(nodes, key, "", label, payload); err != nil {
			return nil, err
		}
		if len(nodes) >= 100000 {
			break
		}
	}
	if len(nodes) == 0 {
		return nil, errors.New("empty text outline")
	}
	format := "Testo / Schema (.txt)"
	if isMarkdown {
		format = "Markdown (.md)"
	}
	return &historySnapshot{Format: format, Nodes: nodes, Images: 0}, nil
}

func parseHistoryProject(data []byte) (*historySnapshot, error) {
	if len(data) == 0 {
		return nil, errors.New("empty snapshot")
	}
	// Check ZIP header for XMind (.xmind) before UTF-8 stripping.
	if len(data) >= 4 && data[0] == 'P' && data[1] == 'K' {
		return historyNodesFromXMindZIP(data)
	}
	trimmed := bytes.TrimSpace(bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF}))
	if len(trimmed) == 0 {
		return nil, errors.New("empty snapshot")
	}
	if trimmed[0] == '{' {
		if snap, err := historyNodesFromGlaukaJSON(trimmed, "Glauka (.gk)"); err == nil {
			return snap, nil
		}
	}
	if trimmed[0] == '[' {
		var sheets []json.RawMessage
		if err := json.Unmarshal(trimmed, &sheets); err == nil && len(sheets) > 0 {
			nodes := make(map[string]historyNodeEntry)
			counts := make(map[string]int)
			for i, sh := range sheets {
				var obj struct {
					RootTopic json.RawMessage `json:"rootTopic"`
				}
				if json.Unmarshal(sh, &obj) == nil && len(obj.RootTopic) > 0 {
					_ = scanXMindTopicJSON(obj.RootTopic, nodes, 0, fmt.Sprintf("s%d", i), counts)
				} else {
					_ = scanGlaukaTree(sh, nodes, 0, fmt.Sprintf("a%d", i), counts)
				}
			}
			if len(nodes) > 0 {
				return &historySnapshot{Format: "JSON", Nodes: nodes, Images: 0}, nil
			}
		}
	}
	if trimmed[0] == '<' {
		if snap, err := historyNodesFromXML(trimmed, ""); err == nil {
			return snap, nil
		}
	}
	return historyNodesFromOutlineText(data)
}

func sortedHistoryKeys(nodes map[string]historyNodeEntry) []string {
	keys := make([]string, 0, len(nodes))
	for k := range nodes {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		return nodes[keys[i]].Order < nodes[keys[j]].Order
	})
	return keys
}

func appendSampleTitle(samples []string, title string) []string {
	if title == "" || len(samples) >= 8 {
		return samples
	}
	samples = append(samples, title)
	return samples
}

func compareProjectHistory(oldData, currentData []byte) projectRevisionDiff {
	beforeSnap, err := parseHistoryProject(oldData)
	if err != nil {
		return projectRevisionDiff{Reason: "Formato non riconosciuto o binario non testuale."}
	}
	afterSnap, err := parseHistoryProject(currentData)
	if err != nil {
		return projectRevisionDiff{Reason: "Progetto attuale non confrontabile."}
	}
	format := afterSnap.Format
	if format == "" {
		format = beforeSnap.Format
	}
	result := projectRevisionDiff{
		Supported:    true,
		Format:       format,
		Before:       len(beforeSnap.Nodes),
		Now:          len(afterSnap.Nodes),
		ImagesBefore: beforeSnap.Images,
		ImagesNow:    afterSnap.Images,
	}
	for _, key := range sortedHistoryKeys(afterSnap.Nodes) {
		afterNode := afterSnap.Nodes[key]
		previous, exists := beforeSnap.Nodes[key]
		if !exists {
			result.Added++
			if afterNode.ID != "" && len(result.AddedIDs) < 240 {
				result.AddedIDs = append(result.AddedIDs, afterNode.ID)
			}
			result.AddedNames = appendSampleTitle(result.AddedNames, afterNode.Title)
			continue
		}
		if !bytes.Equal(previous.Payload, afterNode.Payload) {
			result.Modified++
			if afterNode.ID != "" && len(result.ModifiedIDs) < 240 {
				result.ModifiedIDs = append(result.ModifiedIDs, afterNode.ID)
			}
			label := afterNode.Title
			if label == "" {
				label = previous.Title
			}
			result.ModifiedNames = appendSampleTitle(result.ModifiedNames, label)
		}
	}
	for _, key := range sortedHistoryKeys(beforeSnap.Nodes) {
		if _, ok := afterSnap.Nodes[key]; !ok {
			result.Removed++
			result.RemovedNames = appendSampleTitle(result.RemovedNames, beforeSnap.Nodes[key].Title)
		}
	}
	return result
}

func (s *service) describeProjectHistory(filePath, id string) (projectRevisionDiff, error) {
	if !projectExtension(filePath) || !s.authorizedPath(filePath) || !projectHistoryID.MatchString(id) {
		return projectRevisionDiff{}, errors.New("unauthorized project history")
	}
	s.projectSaveMu.Lock()
	defer s.projectSaveMu.Unlock()
	historical, err := readProjectRevision(s.configDir, filePath, id)
	if err != nil {
		return projectRevisionDiff{}, err
	}
	handle, err := os.Open(filePath)
	if err != nil {
		return projectRevisionDiff{}, err
	}
	defer handle.Close()
	stat, err := handle.Stat()
	if err != nil {
		return projectRevisionDiff{}, err
	}
	if !stat.Mode().IsRegular() || stat.Size() > maxProjectHistorySnapshot {
		return projectRevisionDiff{}, fmt.Errorf("project too large to compare")
	}
	latest, err := io.ReadAll(io.LimitReader(handle, maxProjectHistorySnapshot+1))
	if err != nil {
		return projectRevisionDiff{}, err
	}
	if len(latest) > maxProjectHistorySnapshot {
		return projectRevisionDiff{}, fmt.Errorf("project too large")
	}
	return compareProjectHistory(historical, latest), nil
}
