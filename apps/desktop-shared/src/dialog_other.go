//go:build !windows && !darwin

package main

import "fmt"

func showError(message string) { fmt.Println("NeuroMap error:", message) }
func doUninstall()             {}
