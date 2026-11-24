//go:build !windows && !darwin

package main

import (
	"os"
	"strings"
)

func defaultInterfaceLocale() string {
	for _, key := range []string{"LC_ALL", "LC_MESSAGES", "LANG"} {
		value := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
		if value == "" {
			continue
		}
		if value == "c" || value == "posix" || strings.HasPrefix(value, "c.") {
			return "it"
		}
		code := strings.FieldsFunc(value, func(r rune) bool { return r == '_' || r == '-' || r == '.' })
		if len(code) > 0 {
			if code[0] == "zh" {
				return "zh-CN"
			}
			if supportedInterfaceLocale(code[0]) {
				return code[0]
			}
		}
		return "en"
	}
	return "it"
}
