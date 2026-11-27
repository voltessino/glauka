"""Verify single-source-of-truth synchronization from versions.json."""
import json
import plistlib
from pathlib import Path
import shutil
import tempfile
import unittest

from sync_versions import ROOT, sync_versions


class SyncVersionsTests(unittest.TestCase):
    def test_repo_matches_versions_json_and_bumps_cleanly(self):
        self.assertEqual(sync_versions(ROOT, check=True), [])

        with tempfile.TemporaryDirectory() as tmp:
            copy = Path(tmp) / "repo"
            rel_files = [
                "versions.json",
                "package.json",
                "package-lock.json",
                "apps/desktop-shared/editor/shell-dictionary.js",
                "apps/android/editor/shell-dictionary.js",
                "apps/desktop-shared/src/desktop_files.go",
                "apps/desktop-shared/src/store_distribution.go",
                "apps/desktop-shared/src/versioninfo.json",
                "apps/windows/installer/versioninfo.json",
                "apps/windows/installer/install_ui.ps1",
                "apps/windows/installer/main.go",
                "apps/macos/native/Info.plist",
                "apps/website/release-config.js",
                "apps/website/home-review/home.js",
                "apps/website/app.js",
            ]
            for rel in rel_files:
                dst = copy / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / rel, dst)

            manifest = json.loads((copy / "versions.json").read_text(encoding="utf-8"))
            manifest["editor"] = "1.0.9"
            manifest["windows"]["version"] = "1.0.9"
            manifest["macos"]["version"] = "1.0.9"
            manifest["android"]["version"] = "0.6.30"
            (copy / "versions.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

            sync_versions(copy, check=False)
            self.assertEqual(sync_versions(copy, check=True), [])
            self.assertEqual(json.loads((copy / "package.json").read_text())["version"], "1.0.9")
            self.assertIn("NM_PRODUCT_VERSION='1.0.9'", (copy / "apps/desktop-shared/editor/shell-dictionary.js").read_text(encoding="utf-8"))
            self.assertIn("NM_PRODUCT_VERSION='0.6.30'", (copy / "apps/android/editor/shell-dictionary.js").read_text(encoding="utf-8"))
            info = plistlib.loads((copy / "apps/macos/native/Info.plist").read_bytes())
            self.assertEqual(info["CFBundleShortVersionString"], "1.0.9")
            self.assertIn("v1.0.9/Glauka-Setup-1.0.9-Release.exe", (copy / "apps/website/release-config.js").read_text(encoding="utf-8"))
            self.assertIn("v0.6.30/Glauka-Android-Free-0.6.30-Release.apk", (copy / "apps/website/release-config.js").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
