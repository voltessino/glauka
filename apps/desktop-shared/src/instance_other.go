//go:build !windows && !darwin

package main

// The shared-instance protocol is enabled for Windows file associations.
// Other Unix variants keep their existing native startup behavior.
func acquireAppInstance(dir string, developer bool)(bool,func(),error){
 return true,func(){},nil
}

func focusExistingGlaukaWindow(developer bool){}
