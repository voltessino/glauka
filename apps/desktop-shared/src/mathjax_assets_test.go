package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMathJaxRouteIsAllowlistedBesidePdfjs(t *testing.T) {
	source, err := os.ReadFile(filepath.Join("main.go"))
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, needle := range []string{
		`resources/mathjax/*`,
		`"/mathjax/"`,
		`"/mathjax/mathjax.js"`,
		`resources/mathjax/mathjax.js`,
	} {
		if !strings.Contains(text, needle) {
			t.Fatalf("missing MathJax allowlist contract %q", needle)
		}
	}
	if strings.Count(text, `"/mathjax/mathjax.js"`) < 1 {
		t.Fatal("expected a single allowlisted mathjax.js path check")
	}
}
