"""Release candidate metadata consistency, no app build or GitHub Actions."""
import json
from pathlib import Path
from unittest import TestCase
import plistlib

ROOT = Path(__file__).resolve().parents[2]
MODULE_VERSION = '7.4.0-rc.1'
USER_VERSION = '1.0.4'
NUMERIC = {'Major': 1, 'Minor': 0, 'Patch': 4, 'Build': 0}


class Release74MetadataTests(TestCase):
    def test_repo_and_platform_versions_match_candidate(self):
        version = json.loads((ROOT / 'versions.json').read_text())
        package = json.loads((ROOT / 'package.json').read_text())
        lock = json.loads((ROOT / 'package-lock.json').read_text())
        self.assertEqual(package['version'], MODULE_VERSION)
        self.assertEqual(lock['version'], MODULE_VERSION)
        self.assertEqual(lock['packages']['']['version'], MODULE_VERSION)
        self.assertEqual(version['editor'], MODULE_VERSION)
        self.assertEqual(version['windows']['version'], USER_VERSION)
        self.assertEqual(version['macos']['version'], USER_VERSION)
        self.assertEqual(version['windows']['edition'], 'Release')
        self.assertNotIn('Developer', version['windows']['edition'])
        self.assertNotIn('7.4.0', version['windows']['version'])
        self.assertEqual(version['android']['editor_features'], '6.16.0')
        self.assertEqual(version['android']['version'], '0.6.21-rc.1-private')

    def test_android_baseline_is_distinguished_from_shared_modules(self):
        version = json.loads((ROOT / 'versions.json').read_text())
        android = version['android']
        self.assertEqual(android['editor_features_scope'], 'legacy_android_baseline')
        self.assertEqual(android['shared_modules_version'], version['editor'])
        self.assertEqual(len(android['shared_modules']), len(set(android['shared_modules'])))
        for feature in ('ocr', 'document', 'dashboard', 'save-recovery', 'graphics'):
            self.assertIn(feature, android['shared_modules'])
        shell = (ROOT / 'apps/android/editor/shell-dictionary.js').read_text(encoding='utf-8')
        self.assertIn("NM_PRODUCT_VERSION='" + android['version'] + "'", shell)

    def test_desktop_ui_windows_metadata_and_installer_match(self):
        shell = (ROOT / 'apps/desktop-shared/editor/shell-dictionary.js').read_text()
        self.assertIn("NM_PRODUCT_VERSION='" + USER_VERSION + "'", shell)
        self.assertNotIn('7.4.0', shell.split('const NM_DICT', 1)[0])
        paths = ('apps/windows/installer/versioninfo.json',
                 'apps/desktop-shared/src/versioninfo.json')
        for path in paths:
            data = json.loads((ROOT / path).read_text())
            self.assertEqual(data['FixedFileInfo']['FileVersion'], NUMERIC)
            self.assertEqual(data['FixedFileInfo']['ProductVersion'], NUMERIC)
            self.assertEqual(data['StringFileInfo']['FileVersion'], USER_VERSION)
            self.assertEqual(data['StringFileInfo']['ProductVersion'], USER_VERSION)
            self.assertEqual(data['StringFileInfo']['ProductName'], 'Glauka')
            self.assertNotIn('Developer', data['StringFileInfo']['ProductName'])
        installer = (ROOT / 'apps/windows/installer/install_ui.ps1').read_text()
        self.assertIn("$script:installerVersion='" + USER_VERSION + "'", installer)
        self.assertIn('Text="' + USER_VERSION + '"', installer)
        self.assertNotIn('7.4.0', installer)
        self.assertIn('Glauka-Installer-' + USER_VERSION + '.log',
                      (ROOT / 'apps/windows/installer/main.go').read_text())

    def test_macos_bundle_uses_numeric_app_store_safe_version(self):
        with (ROOT / 'apps/macos/native/Info.plist').open('rb') as stream:
            info = plistlib.load(stream)
        self.assertEqual(info['CFBundleShortVersionString'], '1.0.4')
        self.assertEqual(info['CFBundleVersion'], '100049000')
        self.assertEqual(info['GlaukaReleaseVersion'], '1.0.4')
        self.assertRegex(info['CFBundleShortVersionString'], r'^\d+\.\d+\.\d+$')

    def test_release_gate_requires_local_stress_suite(self):
        package = json.loads((ROOT / 'package.json').read_text())
        self.assertEqual(package['scripts']['test:stress'], 'node scripts/release/stress_v74.js')
        script = (ROOT / 'scripts/release/v7_gate.py').read_text()
        self.assertIn("('stress-v74', [npm, 'run', 'test:stress']", script)
        self.assertNotIn('github actions', script.lower().split('def plan', 1)[1])
