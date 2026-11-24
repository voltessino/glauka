//go:build !windows

package main

func runningInStorePackage() bool { return false }

func oldUnpackagedInstall() bool { return false }
