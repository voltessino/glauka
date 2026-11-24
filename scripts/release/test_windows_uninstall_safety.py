"""Source-contract checks for Windows-specific recovery; no Windows host required."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'apps/desktop-shared/src'
TESTS = ROOT / 'apps/windows/tests'


class WindowsRecoverySafetyTests(unittest.TestCase):
    def test_uninstaller_targets_exact_installed_exe(self):
        cleanup = (SRC / 'uninstall_files.ps1').read_text(encoding='utf-8')
        native = (SRC / 'uninstall_windows.go').read_text(encoding='utf-8')
        self.assertIn("[Parameter(Mandatory=$true)][string]$Executable", cleanup)
        self.assertIn("Get-FileHash -LiteralPath $target", cleanup)
        self.assertIn("OrdinalIgnoreCase", cleanup)
        self.assertIn("Remove-Item -LiteralPath $target -Force", cleanup)
        self.assertNotIn("Where-Object {\n $_.Name -match", cleanup)
        self.assertIn("Remove-OwnedRegistration $target", cleanup)
        self.assertIn("if ($warnings.Count -gt 0)", cleanup)
        self.assertIn("Write-UninstallReport 'failed'", cleanup)
        self.assertIn("registeredUninstallOwnsExecutable(current,registryName)", native)
        self.assertIn("strings.Join(psLinks", native)
        self.assertNotIn('reg("DELETE"', native)
        self.assertNotIn('unregisterGlaukaAssociations(current)', native)
        regression = (TESTS / 'install_upgrade.tests.ps1').read_text(encoding='utf-8')
        self.assertIn("Another installed version was deleted", regression)
        self.assertIn("Modified executable was incorrectly removed", regression)
        self.assertIn("Cross-install uninstall was accepted", regression)

    def test_close_fallback_never_forces_without_native_confirmation(self):
        source = (SRC / 'native_window_windows.go').read_text(encoding='utf-8')
        self.assertIn("glaukaCloseAnswered", source)
        self.assertIn("id != closeSequence", source)
        self.assertIn("confirmForcedClose()", source)
        self.assertIn("closeTimerID, 90000", source)
        self.assertIn("0x134", source)  # Yes/No, warning, No is default
        self.assertIn("if reply == 6", source)

    def test_native_png_uses_one_locked_bitmap_not_duplicate_go_array(self):
        win = (SRC / 'clipboard_png_windows.go').read_text(encoding='utf-8')
        helper = (SRC / 'clipboard_dib.go').read_text(encoding='utf-8')
        self.assertIn("clipboardDIBSize", win)
        self.assertIn("encodeClipboardDIBV5(unsafe.Slice", win)
        self.assertNotIn("dib := make([]byte", win)
        self.assertIn("width*height > 40_000_000", helper)

    def test_exported_xmind_creator_uses_release_manifest_at_build(self):
        files = (SRC / 'desktop_files.go').read_text(encoding='utf-8')
        builder = (ROOT / 'scripts/release/build_desktop.py').read_text(encoding='utf-8')
        self.assertIn('"version": xmindCreatorVersion', files)
        self.assertNotIn('"version": "5.4.0"', files)
        self.assertIn("' -X main.xmindCreatorVersion=' + version", builder)
        self.assertIn('meta.Creator.Version != xmindCreatorVersion',
                      (SRC / 'desktop_files_test.go').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
