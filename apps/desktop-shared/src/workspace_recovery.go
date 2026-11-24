package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"unicode/utf8"
)

const recoveryFormat = "GlaukaRecovery-v2"
const legacyRecoveryFormat = "GlaukaRecovery-v1"

func validRecoveryJSON(data []byte) bool {
	if len(data) == 0 || len(data) > maxWorkspace || !utf8.Valid(data) || !json.Valid(data) {
		return false
	}
	var doc struct {
		Tabs []struct {
			Root struct {
				Text     *string         `json:"text"`
				Children json.RawMessage `json:"children"`
			} `json:"root"`
			Images        json.RawMessage `json:"images"`
			Relationships json.RawMessage `json:"relationships"`
		} `json:"tabs"`
	}
	if json.Unmarshal(data, &doc) != nil || len(doc.Tabs) == 0 || len(doc.Tabs) > 100 {
		return false
	}
	// Reject corrupt workspace structure before rotating the last durable
	// generation. Historical null collections remain readable.
	arrayOrEmpty := func(raw json.RawMessage) bool {
		return len(raw) == 0 || raw[0] == '[' || string(raw) == "null"
	}
	for _, tab := range doc.Tabs {
		if tab.Root.Text == nil ||
			!arrayOrEmpty(tab.Root.Children) ||
			!arrayOrEmpty(tab.Images) ||
			!arrayOrEmpty(tab.Relationships) {
			return false
		}
	}
	return true
}
func recoveryPayload(path string, data []byte) ([]byte, error) {
	var header struct {
		Format  string          `json:"format"`
		SHA     string          `json:"sha256"`
		Payload json.RawMessage `json:"payload"`
	}
	if json.Unmarshal(data, &header) != nil {
		return nil, errors.New("invalid recovery JSON")
	}
	if header.Format == recoveryFormat || header.Format == legacyRecoveryFormat {
		digest := sha256.Sum256(header.Payload)
		if header.SHA != hex.EncodeToString(digest[:]) {
			return nil, errors.New("recovery checksum mismatch")
		}
		payload := []byte(header.Payload)
		if header.Format == recoveryFormat {
			var err error
			payload, err = unpackRecoveryAssets(path, payload)
			if err != nil {
				return nil, err
			}
		}
		if !validRecoveryJSON(payload) {
			return nil, errors.New("invalid recovery workspace")
		}
		return payload, nil
	}
	if validRecoveryJSON(data) {
		return data, nil
	} // Legacy snapshots migrate after the next successful write.
	return nil, errors.New("invalid recovery workspace")
}
func readRecoveryFile(path string) ([]byte, []byte, error) {
	// Refuse symlinks and unbounded/changed files in the recovery journal.
	// This also covers the interrupted Windows replacement backup.
	before, err := os.Lstat(path)
	if err != nil {
		return nil, nil, err
	}
	if !before.Mode().IsRegular() || before.Size() > maxWorkspace+4096 {
		return nil, nil, errors.New("invalid recovery file or size")
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	defer file.Close()
	opened, err := file.Stat()
	if err != nil {
		return nil, nil, err
	}
	if !opened.Mode().IsRegular() || !os.SameFile(before, opened) ||
		opened.Size() > maxWorkspace+4096 {
		return nil, nil, errors.New("recovery file changed before read")
	}
	data, err := io.ReadAll(io.LimitReader(file, maxWorkspace+4097))
	if err != nil {
		return nil, nil, err
	}
	if len(data) > maxWorkspace+4096 || int64(len(data)) != opened.Size() {
		return nil, nil, errors.New("recovery file changed during read")
	}
	base := strings.TrimSuffix(strings.TrimSuffix(path, ".replace-pending"), ".previous")
	payload, err := recoveryPayload(base, data)
	return data, payload, err
}
func readRecovery(path string) ([]byte, bool, error) {
	_, payload, err := readRecoveryFile(path)
	if err == nil {
		return payload, false, nil
	}
	// On Windows, atomicFile may have moved the only valid current snapshot
	// to .replace-pending immediately before the application was killed.
	_, pending, pendingErr := readRecoveryFile(path + ".replace-pending")
	if pendingErr == nil {
		return pending, true, nil
	}
	_, previous, prevErr := readRecoveryFile(path + ".previous")
	if prevErr == nil {
		return previous, true, nil
	}
	if errors.Is(err, os.ErrNotExist) &&
		errors.Is(pendingErr, os.ErrNotExist) &&
		errors.Is(prevErr, os.ErrNotExist) {
		return nil, false, nil
	}
	return nil, false, errors.New("no valid recovery generation")
}
// Finish a Windows replacement interrupted between renaming the old
// workspace and installing the new one. Keep both invalid generations intact
// for diagnosis: never silently replace an invalid current with another file.
func repairRecoveryReplacement(path string) error {
	pendingPath := path + ".replace-pending"
	if _, err := os.Lstat(pendingPath); errors.Is(err, os.ErrNotExist) {
		return nil
	} else if err != nil {
		return err
	}
	unlock, err := lockAtomicReplacement(path)
	if err != nil {
		return err
	}
	defer unlock()
	if _, _, err := readRecoveryFile(pendingPath); errors.Is(err, os.ErrNotExist) {
		return nil
	} else if err != nil {
		return fmt.Errorf("interrupted recovery backup is damaged: %w", err)
	}
	_, _, err = readRecoveryFile(path)
	if errors.Is(err, os.ErrNotExist) {
		// Rename within the same directory; no valid current generation exists.
		return os.Rename(pendingPath, path)
	}
	if err != nil {
		return fmt.Errorf("current recovery is damaged; preserve interrupted backup: %w", err)
	}
	// Current is already complete; clean a leftover backup from a crash just
	// after its successful installation, under the replacement mutex.
	return os.Remove(pendingPath)
}
func writeRecovery(path string, data []byte) error {
	data = bytes.TrimSpace(data)
	if !validRecoveryJSON(data) {
		return errors.New("invalid recovery workspace")
	}
	// The Windows atomic replacement of the previous generation can also
	// be interrupted. Repair it before any new rotation, otherwise subsequent
	// autosaves remain blocked by a stale .replace-pending sibling.
	for _, target := range []string{path, path + ".previous"} {
		if err := repairRecoveryReplacement(target); err != nil {
			return err
		}
	}
	current, payload, err := readRecoveryFile(path)
	if err != nil {
		for _, name := range []string{path, path + ".previous"} {
			raw, _, readErr := readRecoveryFile(name)
			if readErr != nil && !errors.Is(readErr, os.ErrNotExist) {
				if raw == nil {
					return readErr
				}
				if archiveErr := atomicFile(name+".damaged", raw); archiveErr != nil {
					return archiveErr
				}
			}
		}
	}
	if err == nil {
		if bytes.Equal(payload, data) {
			return nil
		}
		if err = atomicFile(path+".previous", current); err != nil {
			return err
		}
	}
	packed, err := packRecoveryAssets(path, data)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(packed)
	prefix := []byte(fmt.Sprintf(`{"format":%q,"sha256":%q,"payload":`, recoveryFormat, hex.EncodeToString(digest[:])))
	next := make([]byte, 0, len(prefix)+len(packed)+1)
	next = append(next, prefix...)
	next = append(next, packed...)
	next = append(next, '}')
	if err := atomicFile(path, next); err != nil {
		return err
	}
	pruneRecoveryAssets(path)
	return nil
}
func discardRecovery(path string) error {
	// Explicit discard must not resurrect an interrupted Windows replacement
	// on the next startup. Include the two old versions' staging siblings.
	for _, name := range []string{path, path + ".previous",
		path + ".replace-pending", path + ".previous.replace-pending"} {
		if err := os.Remove(name); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	pruneRecoveryAssets(path)
	return nil
}
