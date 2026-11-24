"""Regression tests for the monotonic macOS bundle build number."""
import sys
from pathlib import Path
import plistlib
import json
import unittest
import tempfile
import shutil

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/release"))
from macos_edition import stage_macos_edition, PUBLIC_BUNDLE_ID, DEVELOPER_BUNDLE_ID
from macos_version import macos_bundle_build


class MacOSVersionTests(unittest.TestCase):
    def test_prereleases_and_final_increase_monotonically(self):
        releases = [
            "7.4.0-alpha.1", "7.4.0-beta.1", "7.4.0-rc.1",
            "7.4.0-rc.2", "7.4.0", "7.4.1-alpha.1", "7.4.1",
            "7.5.0-rc.1", "7.5.0", "8.0.0",
        ]
        build_numbers = [int(macos_bundle_build(v)) for v in releases]
        self.assertEqual(build_numbers, sorted(set(build_numbers)))
        self.assertEqual(macos_bundle_build("7.4.0-rc.1"), "704003001")

    def test_staging_preserves_public_identity_and_isolates_developer(self):
        original = ROOT / "apps/macos/native/Info.plist"
        for developer in (False, True):
            with self.subTest(developer=developer), tempfile.TemporaryDirectory() as tmp:
                staged = Path(tmp)
                shutil.copyfile(original, staged / "Info.plist")
                expected = DEVELOPER_BUNDLE_ID if developer else PUBLIC_BUNDLE_ID
                self.assertEqual(stage_macos_edition(staged, developer), expected)
                data = plistlib.loads((staged / "Info.plist").read_bytes())
                self.assertEqual(data["CFBundleIdentifier"], expected)
                self.assertEqual(data["CFBundleExecutable"], "Glauka")
                self.assertEqual(data["CFBundleVersion"], macos_bundle_build(
                    json.loads((ROOT / "versions.json").read_text(encoding="utf-8"))["macos"]["version"]))
                self.assertEqual(data["CFBundleDisplayName"],
                                 "Glauka Developer" if developer else "Glauka")
        # No staging operation modifies the tracked public bundle.
        self.assertEqual(plistlib.loads(original.read_bytes())["CFBundleIdentifier"],
                         PUBLIC_BUNDLE_ID)

    def test_malformed_and_colliding_versions_are_rejected(self):
        for version in ("7.4", "7.4.0-developer", "7.4.0-rc.1000",
                        "7.4.0-rc.0", "7.100.0", "7.4.100", "7.4.0/evil"):
            with self.subTest(version=version), self.assertRaises(ValueError):
                macos_bundle_build(version)

    def test_source_plist_and_staged_builder_derive_canonical_build(self):
        release = json.loads((ROOT / "versions.json").read_text())["macos"]["version"]
        info = plistlib.loads((ROOT / "apps/macos/native/Info.plist").read_bytes())
        self.assertEqual(info["CFBundleVersion"], macos_bundle_build(release))
        self.assertEqual(info["CFBundleShortVersionString"], release.split("-", 1)[0])
        prepare = (ROOT / "scripts/release/prepare.py").read_text()
        self.assertIn("info['CFBundleVersion'] = macos_bundle_build(release)", prepare)
        self.assertIn("info['CFBundleShortVersionString'] = release.split('-', 1)[0]", prepare)


if __name__ == "__main__":
    unittest.main()
