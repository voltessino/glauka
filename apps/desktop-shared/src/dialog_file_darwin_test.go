//go:build darwin

package main

import (
    "reflect"
    "strings"
    "testing"
)

func TestMacNULSelectionPreservesNewlineSpacesAndUnicode(t *testing.T) {
    wanted := []string{"/Users/test/notes\ncontinued.gk", "/Users/test/ map with spaces .xmind", "/Users/test/日本語.md"}
    got, err := parseMacSelection(strings.Join(wanted, "\x00") + "\x00")
    if err != nil || !reflect.DeepEqual(got, wanted) {
        t.Fatalf("mac file selection changed names: got=%q err=%v", got, err)
    }
}

func TestMacNULSelectionNeverTreatsNewlineAsFileDelimiter(t *testing.T) {
    if _, err := parseMacSelection("/Users/test/m1.gk\n/Users/test/m2.gk"); err == nil {
        t.Fatal("newline-delimited selection must not be treated as valid structured output")
    }
    if got, err := parseMacSelection(""); err != nil || got != nil {
        t.Fatalf("cancelled selection: got=%v err=%v", got, err)
    }
}

func TestMacNULSelectionRejectsTooManyOrInvalidFiles(t *testing.T) {
    many := make([]string,31)
    for i := range many { many[i] = "/tmp/example.gk" }
    for _, raw := range []string{
        strings.Join(many, "\x00")+"\x00",
        "relative.gk\x00",
        "/tmp/ok.gk\x00\x00",
        "/tmp/missing-terminator.gk",
    } {
        if _, err := parseMacSelection(raw); err == nil {
            t.Fatalf("invalid native file selection accepted: %q", raw)
        }
    }
}
