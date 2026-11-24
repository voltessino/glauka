package main

import (
	"strings"
	"testing"
)

func TestBrowserUsesIsolatedAppProfileWithoutSync(t *testing.T) {
	args := strings.Join(desktopBrowserArgs("http://127.0.0.1:43118/", "/tmp/NeuroMap profile"), "\n")
	for _, required := range []string{"--app=http://127.0.0.1:43118/", "--user-data-dir=/tmp/NeuroMap profile", "--disable-sync", "--disable-background-mode", "--no-first-run", "msImplicitSignin", "msEdgeFirstRunExperience"} {
		if !strings.Contains(args, required) {
			t.Errorf("missing profile isolation option %q", required)
		}
	}
}
