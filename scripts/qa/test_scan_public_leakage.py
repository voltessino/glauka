#!/usr/bin/env python3
"""Unit tests for scan_public_leakage (no network, no Git writes)."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scan_public_leakage import find_personal_homes, scan_text, scan_tree


class ScanPublicLeakageTests(unittest.TestCase):
    def test_allows_fixture_home_paths(self):
        text = "saved to /Users/qa/Map.neuromap and C:/Users/person/Project.gk"
        self.assertEqual(find_personal_homes(text), [])

    def test_flags_real_windows_home(self):
        text = "C:/Users/maxde/.gemini/antigravity/brain/uuid/out"
        self.assertIn("maxde", find_personal_homes(text))

    def test_public_mode_flags_private_download_urls(self):
        text = "https://github.com/voltessino/neuromap-android/blob/downloads/x/y-private.zip?raw=true"
        private = scan_text("docs/x.md", text, "private")
        public = scan_text("docs/x.md", text, "public")
        self.assertFalse(any(f["category"].startswith("private-") for f in private))
        self.assertTrue(any(f["category"] == "private-download-url" for f in public))

    def test_scan_tree_finds_personal_path_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            sample = root / "tests" / "bad.spec.js"
            sample.parent.mkdir(parents=True)
            sample.write_text(
                "const SHOT='C:/Users/maxde/secret-shots';\n", encoding="utf-8")
            findings = scan_tree(root, "private")
            self.assertTrue(any(f["category"] == "personal-home-path" for f in findings))


if __name__ == "__main__":
    unittest.main()
