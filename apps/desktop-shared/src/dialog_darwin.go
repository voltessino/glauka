//go:build darwin

package main

import "fmt"

// Pass the message as argv, never as AppleScript source. Quotes, newlines and
// backslashes from a filesystem or runtime error must remain plain text.
func showError(message string) {
	fmt.Println("Glauka:", message)
	_, _ = scriptRun(`on run argv
display alert "Glauka" message (item 1 of argv)
end run`, message)
}
func doUninstall() {}
