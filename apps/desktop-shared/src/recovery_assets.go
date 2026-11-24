package main

// Recovery-only media storage. Portable project exports remain self contained.
import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"regexp"
)

var recoveryImages = regexp.MustCompile(`"data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+"`)
var recoveryReserved = regexp.MustCompile(`"glauka-recovery:[^"\\]*"`)
var recoveryReferences = regexp.MustCompile(`"glauka-recovery:image:([a-f0-9]{64})"`)
var recoveryLiterals = regexp.MustCompile(`"glauka-recovery:literal:([A-Za-z0-9+/=]+)"`)

func recoveryAssetDir(path string) string { return path + ".assets" }
func recoveryAssetRead(path, hash string) ([]byte, error) {
	name := filepath.Join(recoveryAssetDir(path), hash)
	stat, err := os.Lstat(name)
	if err != nil {
		return nil, err
	}
	if !stat.Mode().IsRegular() || stat.Size() > maxWorkspace {
		return nil, errors.New("invalid recovery image")
	}
	data, err := os.ReadFile(name)
	if err != nil {
		return nil, err
	}
	digest := sha256.Sum256(data)
	if hex.EncodeToString(digest[:]) != hash {
		return nil, errors.New("recovery image checksum mismatch")
	}
	return data, nil
}
func packRecoveryAssets(path string, data []byte) ([]byte, error) {
	// Escape literal user strings before adding internal references.
	packed := recoveryReserved.ReplaceAllFunc(data, func(value []byte) []byte {
		return []byte(`"glauka-recovery:literal:` + base64.StdEncoding.EncodeToString(value[1:len(value)-1]) + `"`)
	})
	var failure error
	packed = recoveryImages.ReplaceAllFunc(packed, func(value []byte) []byte {
		if failure != nil || len(value) < 16400 {
			return value
		}
		asset := value[1 : len(value)-1]
		digest := sha256.Sum256(asset)
		hash := hex.EncodeToString(digest[:])
		if _, err := recoveryAssetRead(path, hash); err != nil {
			dir := recoveryAssetDir(path)
			if err = os.MkdirAll(dir, 0700); err != nil {
				failure = err
				return value
			}
			entries, err := os.ReadDir(dir)
			if err != nil {
				failure = err
				return value
			}
			var size int64
			for _, entry := range entries {
				if info, e := entry.Info(); e == nil {
					size += info.Size()
				}
			}
			if size+int64(len(asset)) > int64(6*maxWorkspace) {
				failure = errors.New("recovery media capacity exceeded; export a backup")
				return value
			}
			if err = atomicFile(filepath.Join(dir, hash), asset); err != nil {
				failure = err
				return value
			}
		}
		return []byte(`"glauka-recovery:image:` + hash + `"`)
	})
	return packed, failure
}
func unpackRecoveryAssets(path string, data []byte) ([]byte, error) {
	var failure error
	size := len(data)
	unpacked := recoveryReferences.ReplaceAllFunc(data, func(ref []byte) []byte {
		if failure != nil {
			return ref
		}
		match := recoveryReferences.FindSubmatch(ref)
		asset, err := recoveryAssetRead(path, string(match[1]))
		if err != nil {
			failure = err
			return ref
		}
		size += len(asset) + 2 - len(ref)
		if size > maxWorkspace {
			failure = errors.New("recovery expansion limit")
			return ref
		}
		return append(append([]byte{'"'}, asset...), '"')
	})
	if failure != nil {
		return nil, failure
	}
	unpacked = recoveryLiterals.ReplaceAllFunc(unpacked, func(ref []byte) []byte {
		match := recoveryLiterals.FindSubmatch(ref)
		value, err := base64.StdEncoding.DecodeString(string(match[1]))
		if err != nil {
			failure = err
			return ref
		}
		return append(append([]byte{'"'}, value...), '"')
	})
	if len(unpacked) > maxWorkspace {
		return nil, errors.New("recovery expansion limit")
	}
	return unpacked, failure
}
func pruneRecoveryAssets(path string) {
	keep := map[string]bool{}
	for _, name := range []string{path, path + ".previous", path + ".damaged", path + ".previous.damaged"} {
		stat, err := os.Stat(name)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil || stat.Size() > maxWorkspace+4096 {
			return
		}
		data, err := os.ReadFile(name)
		if err != nil {
			return
		}
		// Preserve forensic media when an archived generation is damaged.
		if bytes.HasSuffix([]byte(name), []byte(".damaged")) {
			return
		}
		for _, ref := range recoveryReferences.FindAllSubmatch(data, -1) {
			keep[string(ref[1])] = true
		}
	}
	entries, _ := os.ReadDir(recoveryAssetDir(path))
	for _, entry := range entries {
		if regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(entry.Name()) && !keep[entry.Name()] {
			_ = os.Remove(filepath.Join(recoveryAssetDir(path), entry.Name()))
		}
	}
}
