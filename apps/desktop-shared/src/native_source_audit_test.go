package main

import (
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func nativeAuditRoot() string {
	if root := os.Getenv("GLAUKA_AUDIT_SOURCE_ROOT"); root != "" {
		return root
	}
	return filepath.Join("..", "..", "..")
}

// Parse every Go file, INCLUDING Windows/macOS build-tagged files and tests.
// go test alone excludes files for other platforms; this catches malformed
// Go syntax without requiring Windows, cgo or GitHub Actions.
func TestNativeGoSourceSyntaxAllPlatforms(t *testing.T) {
	directories := []string{".", filepath.Join(nativeAuditRoot(), "apps", "windows", "installer")}
	checked := 0
	for _, directory := range directories {
		entries, err := os.ReadDir(directory)
		if err != nil {
			t.Fatalf("cannot read %s: %v", directory, err)
		}
		for _, entry := range entries {
			if entry.IsDir() || filepath.Ext(entry.Name()) != ".go" {
				continue
			}
			path := filepath.Join(directory, entry.Name())
			if _, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.AllErrors|parser.ParseComments); err != nil {
				t.Errorf("%s: %v", path, err)
			}
			checked++
		}
	}
	if checked < 69 {
		t.Fatalf("native Go inventory unexpectedly shrank: %d files", checked)
	}
}

// Compile pure Java security policies using the installed JDK. The Android
// Activity and vault depend on Android SDK classes and are compiled by Gradle;
// do not mistake a JVM-only pass for a full APK compile.
func TestNativeJavaPoliciesCompileOnHostJDK(t *testing.T) {
	javac, err := exec.LookPath("javac")
	if err != nil {
		t.Skip("JDK not installed; Android Gradle compile still required")
	}
	root := filepath.Join(nativeAuditRoot(), "apps", "android", "native", "app", "src", "main", "java", "it", "neuromap", "architect", "preview")
	sources := []string{
		filepath.Join(root, "AndroidAssetPolicy.java"),
		filepath.Join(root, "AndroidAiHostPolicy.java"),
		filepath.Join(root, "AndroidAiJobLimiter.java"),
	}
	for _, p := range sources {
		if _, err := os.Stat(p); err != nil {
			t.Fatal(err)
		}
	}
	args := append([]string{"--release", "17", "-d", t.TempDir()}, sources...)
	cmd := exec.Command(javac, args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("host Java policies failed to compile: %v\n%s", err, out)
	}
}

func TestNativeJavaSourceInventoryAndWebViewGuards(t *testing.T) {
	root := filepath.Join(nativeAuditRoot(), "apps", "android", "native", "app", "src")
	checked := 0
	var activity string
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || filepath.Ext(path) != ".java" {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if !strings.Contains(string(data), "package it.neuromap.architect.preview;") {
			t.Errorf("unexpected Java package in %s", path)
		}
		if entry.Name() == "MainActivity.java" {
			activity = string(data)
		}
		checked++
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if checked < 9 {
		t.Fatalf("missing native Java sources: %d", checked)
	}
	for _, guard := range []string{
		"setAllowFileAccess(false)", "setAllowContentAccess(false)",
		"MIXED_CONTENT_NEVER_ALLOW", "AndroidAssetPolicy.mimeFor",
		"json.length()>indexLimit", "json.length()>documentLimit",
	} {
		if !strings.Contains(activity, guard) {
			t.Errorf("native WebView/file guard missing: %s", guard)
		}
	}
}
