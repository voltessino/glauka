package main

// These switches apply only to NeuroMap's --user-data-dir. Do not change
// registry policies or the user's normal Edge/Chrome profile.
func desktopBrowserArgs(url, profile string) []string {
	return []string{"--app=" + url, "--new-window", "--user-data-dir=" + profile,
		"--no-first-run", "--no-default-browser-check", "--disable-session-crashed-bubble",
		"--disable-sync", "--disable-background-mode", "--disable-features=msImplicitSignin,msIdentitySignin,msEdgeFirstRunExperience,msEdgeSyncPromo"}
}
