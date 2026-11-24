package main

import "strings"

// Accept Apple/BCP-47 identifiers without using a locale as a filesystem path.
func interfaceLocaleFromIdentifier(value string) string {
	parts := strings.FieldsFunc(strings.ToLower(strings.TrimSpace(value)), func(r rune) bool { return r == '-' || r == '_' || r == '.' })
	if len(parts) > 0 {
		if parts[0] == "zh" {
			return "zh-CN"
		}
		if supportedInterfaceLocale(parts[0]) {
			return parts[0]
		}
	}
	return "en"
}
