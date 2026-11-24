//go:build darwin

package main

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"time"
)

func defaultInterfaceLocale() string {
	// Finder does not inherit shell locale variables. The native wrapper passes
	// Apple's ordered language preference; saved app preferences still take priority.
	if value := os.Getenv("GLAUKA_SYSTEM_LANGUAGE"); value != "" {
		return interfaceLocaleFromIdentifier(value)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	data, err := exec.CommandContext(ctx, "/usr/bin/defaults", "read", "-g", "AppleLanguages").Output()
	if err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			value := strings.Trim(strings.TrimSpace(line), "\"(), ")
			if value != "" {
				return interfaceLocaleFromIdentifier(value)
			}
		}
	}
	return "en"
}
