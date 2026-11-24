package main

import (
	"encoding/json"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

// storeListingURL stays empty while the Partner Center listing is only a draft.
// The reserved address lives in apps/windows/msix/identity.json and must not be
// shown as a working download until that page is public.
var storeListingURL = ""

// MigrationReport describes how a Store package relates to an older direct install.
// The Store package keeps the same data folder and never removes the old program.
func MigrationReport(packaged, licensePresent, oldInstall bool) map[string]any {
	channel := "direct"
	updateMode := "none"
	if packaged {
		channel = "microsoft-store"
		updateMode = "store"
	}
	return map[string]any{
		"packaged":             packaged,
		"channel":              channel,
		"updateMode":           updateMode,
		"licensePresent":       licensePresent,
		"oldInstallPresent":    oldInstall,
		"removedOldInstall":    false,
		"sharesExistingFolder": true,
		"unsavedWork":          "La mappa non salvata resta nel programma già aperto. Salvala prima di chiuderlo.",
		"rollback":             "Disinstalla solo il pacchetto Store. Le mappe e la licenza restano nella cartella già usata dal programma precedente.",
	}
}

func safeStoreListing(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme != "https" || parsed.Host != "apps.microsoft.com" || parsed.User != nil {
		return ""
	}
	return parsed.String()
}

func distributionStatus(configDir, version string) map[string]any {
	licensePath := filepath.Join(configDir, "pro-license.dat")
	info, err := os.Stat(licensePath)
	licensePresent := err == nil && info.Mode().IsRegular() && info.Size() > 0 && info.Size() < 8192
	report := MigrationReport(runningInStorePackage(), licensePresent, oldUnpackagedInstall())
	report["version"] = version
	report["storeListingUrl"] = safeStoreListing(storeListingURL)
	report["releaseNotes"] = "Glauka 1.0.4 apre con il tema scelto, anche se è scuro. Free resta gratuito. Pro si attiva con la licenza già emessa, senza un abbonamento."
	return report
}

func noteStoreMigration(dir string) {
	if !runningInStorePackage() || dir == "" {
		return
	}
	payload, err := json.Marshal(distributionStatus(dir, xmindCreatorVersion))
	if err != nil {
		return
	}
	_ = atomicFile(filepath.Join(dir, "store-migration.json"), payload)
}
