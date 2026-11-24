"""Windows DPI regression checks: no GitHub Actions and no native build required."""
from pathlib import Path
import json
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "apps/desktop-shared/src"
EDITOR = ROOT / "apps/desktop-shared/editor"


class WindowsDPITest(unittest.TestCase):
    def test_manifest_is_embedded_by_the_existing_resource_builder(self):
        config = json.loads((SRC / "versioninfo.json").read_text(encoding="utf-8"))
        manifest_relative = config["ManifestPath"]
        self.assertEqual(manifest_relative, "resources/dpi-aware.manifest")
        manifest_path = SRC / manifest_relative
        self.assertTrue(manifest_path.is_file())
        root = ET.parse(manifest_path).getroot()
        namespace = "{http://schemas.microsoft.com/SMI/2016/WindowsSettings}"
        per_monitor = root.find(".//" + namespace + "dpiAwareness")
        self.assertIsNotNone(per_monitor)
        self.assertEqual(per_monitor.text.strip(), "PerMonitorV2")
        fallback = root.find(".//{http://schemas.microsoft.com/SMI/2005/WindowsSettings}dpiAware")
        self.assertIsNotNone(fallback)
        self.assertEqual(fallback.text.strip(), "true/pm")
        builder = (ROOT / "scripts/release/build_desktop.py").read_text(encoding="utf-8")
        self.assertIn("goversioninfo", builder)
        self.assertIn("rsrc_windows_amd64.syso", builder)
        staging = (ROOT / "scripts/release/prepare.py").read_text(encoding="utf-8")
        self.assertIn("shutil.copytree(ROOT / 'apps/desktop-shared/src'", staging)

    def test_native_webview_handles_monitor_dpi_change(self):
        source = (SRC / "native_window_windows.go").read_text(encoding="utf-8")
        self.assertIn("msg == 0x02E0", source)
        self.assertIn("SetWindowPos", source)
        self.assertIn("dpiSuggestedRect", source)
        # Never change the close lifecycle or run in a detached Edge window.
        self.assertIn("msg == 0x10 && !closing", source)
        self.assertIn("webview.NewWithOptions", source)
        # A close request can include an interactive Save/Discard dialogue; do
        # not terminate automatically if WebView2 stops replying.
        self.assertIn("glaukaCloseAnswered", source)
        self.assertIn("closeSequence++", source)
        self.assertIn("SetTimer", source)
        self.assertIn("90000", source)
        self.assertIn("MessageBoxW", source)
        self.assertIn("0x134", source)  # MB_DEFBUTTON2: No
        self.assertIn("if closePending {", source)
        self.assertIn("if oldProc == 0", source)
        self.assertIn("if installed == 0", source)
        self.assertIn("pickerOwner()", (SRC / "dialog_file_windows.go").read_text(encoding="utf-8"))

    def test_editor_redraws_when_dpr_changes_without_resize(self):
        app = (EDITOR / "app.js").read_text(encoding="utf-8")
        self.assertIn("window.matchMedia?", app)
        self.assertIn("(resolution: ${value}dppx)", app)
        self.assertIn("redrawForDisplayChange", app)
        self.assertIn("this.renderer.resize();", app)

    def test_desktop_canvas_budget_allows_crisp_4k_200_percent(self):
        src = (EDITOR / "renderer.js").read_text(encoding="utf-8")
        self.assertIn("const maxPixels = lowMemory ? 24000000 : 36000000", src)
        self.assertIn("devicePixelRatio", src)
        self.assertIn("Math.sqrt(maxPixels / (cssWidth * cssHeight))", src)
        self.assertIn("8192 / cssWidth", src)
        # This is the physical backing size of 4K at DPR=2 (3840*2160*4).
        self.assertGreaterEqual(36_000_000, 3840 * 2160 * 4)


if __name__ == "__main__":
    unittest.main()
