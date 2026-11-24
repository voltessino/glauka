"""Edition/version staging checks; runnable without Windows, Go or GitHub Actions."""
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from windows_metadata import stage_windows_distribution_metadata

ROOT = Path(__file__).resolve().parents[2]


class WindowsDistributionMetadataTests(unittest.TestCase):
    def stage(self, directory):
        source = ROOT / 'apps/desktop-shared/src'
        installer = ROOT / 'apps/windows/installer'
        target = Path(directory)
        (target / 'setup').mkdir()
        (target / 'resources').mkdir()
        shutil.copyfile(source / 'versioninfo.json', target / 'versioninfo.json')
        shutil.copyfile(installer / 'versioninfo.json', target / 'setup/versioninfo.json')
        shutil.copyfile(installer / 'install_ui.ps1', target / 'setup/install_ui.ps1')
        shutil.copyfile(installer / 'main.go', target / 'setup/main.go')
        (target / 'resources/index.html').write_text(
            "<script>const NM_PRODUCT_VERSION='7.4.0-rc.1 Developer';</script>",
            encoding='utf-8')
        return target

    def test_staged_public_and_developer_packages_have_distinct_identities(self):
        for developer in (False, True):
            with self.subTest(developer=developer), tempfile.TemporaryDirectory() as tmp:
                dest = self.stage(tmp)
                stage_windows_distribution_metadata(dest, '7.5.2-rc.4', developer)
                for rel in ('versioninfo.json', 'setup/versioninfo.json'):
                    details = json.loads((dest / rel).read_text())
                    self.assertEqual(details['FixedFileInfo']['FileVersion'],
                                     dict(Major=7, Minor=5, Patch=2, Build=4))
                    self.assertEqual(details['FixedFileInfo']['ProductVersion'],
                                     dict(Major=7, Minor=5, Patch=2, Build=4))
                    self.assertEqual(details['StringFileInfo']['FileVersion'], '7.5.2-rc.4')
                    self.assertEqual(details['StringFileInfo']['ProductName'],
                                     'Glauka Developer' if developer else 'Glauka')
                    self.assertEqual('Developer' in details['StringFileInfo']['FileDescription'],
                                     developer)
                ui = (dest / 'setup/install_ui.ps1').read_text(encoding='utf-8-sig')
                self.assertIn("$script:installerVersion='7.5.2-rc.4'", ui)
                self.assertIn('Text="7.5.2-rc.4"', ui)
                self.assertNotIn('7.4.0-rc.1', ui)
                self.assertIn('Glauka-Installer-7.5.2-rc.4.log',
                              (dest / 'setup/main.go').read_text())
                product = (dest / 'resources/index.html').read_text()
                expected = "NM_PRODUCT_VERSION='7.5.2-rc.4" + (
                    " Developer" if developer else "") + "'"
                self.assertIn(expected, product)

    def test_invalid_versions_fail_before_stamping(self):
        for version in ('7.4', '7.4.0/../', '65536.0.1', '1.2.3-rc.65536'):
            with self.subTest(version=version), tempfile.TemporaryDirectory() as tmp:
                staged = self.stage(tmp)
                with self.assertRaises(ValueError):
                    stage_windows_distribution_metadata(staged, version)

    def test_source_metadata_stays_unmodified(self):
        source = ROOT / 'apps/desktop-shared/src/versioninfo.json'
        original = source.read_bytes()
        with tempfile.TemporaryDirectory() as tmp:
            stage_windows_distribution_metadata(self.stage(tmp), '8.0.0', False)
        self.assertEqual(source.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
