"""Single-source-of-truth release metadata consistency tests (versions.json)."""
import json
from pathlib import Path
import plistlib
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]


class ReleaseMetadataTests(TestCase):
    def test_repo_and_platform_versions_match_versions_json(self):
        version = json.loads((ROOT / 'versions.json').read_text(encoding='utf-8'))
        package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
        lock = json.loads((ROOT / 'package-lock.json').read_text(encoding='utf-8'))
        desktop_ver = version['windows']['version']
        mac_ver = version['macos']['version']
        self.assertEqual(version['editor'], desktop_ver)
        self.assertEqual(mac_ver, desktop_ver)
        self.assertEqual(package['version'], desktop_ver)
        self.assertEqual(lock['version'], desktop_ver)
        self.assertEqual(lock['packages']['']['version'], desktop_ver)
        self.assertEqual(version['windows']['edition'], 'Release')
        self.assertNotIn('Developer', version['windows']['edition'])
        self.assertNotIn('7.4.0', json.dumps(version))
        self.assertEqual(version['android']['editor_features'], '6.16.0')
        self.assertRegex(version['android']['version'], r'^\d+\.\d+\.\d+$')

    def test_android_baseline_is_distinguished_from_shared_modules(self):
        version = json.loads((ROOT / 'versions.json').read_text(encoding='utf-8'))
        android = version['android']
        self.assertEqual(android['editor_features_scope'], 'legacy_android_baseline')
        self.assertEqual(android['shared_modules_version'], version['editor'])
        self.assertEqual(len(android['shared_modules']), len(set(android['shared_modules'])))
        for feature in ('ocr', 'document', 'dashboard', 'save-recovery', 'graphics'):
            self.assertIn(feature, android['shared_modules'])
        shell = (ROOT / 'apps/android/editor/shell-dictionary.js').read_text(encoding='utf-8')
        self.assertIn("NM_PRODUCT_VERSION='" + android['version'] + "'", shell)

    def test_desktop_ui_windows_metadata_and_installer_match(self):
        desktop_ver = json.loads((ROOT / 'versions.json').read_text(encoding='utf-8'))['windows']['version']
        major, minor, patch = map(int, desktop_ver.split('-')[0].split('.'))
        build = int(desktop_ver.rsplit('.', 1)[-1]) if '-' in desktop_ver else 0
        numeric = {'Major': major, 'Minor': minor, 'Patch': patch, 'Build': build}
        shell = (ROOT / 'apps/desktop-shared/editor/shell-dictionary.js').read_text(encoding='utf-8')
        self.assertIn("NM_PRODUCT_VERSION='" + desktop_ver + "'", shell)
        self.assertNotIn('7.4.0', shell.split('const NM_DICT', 1)[0])
        for path in ('apps/windows/installer/versioninfo.json',
                     'apps/desktop-shared/src/versioninfo.json'):
            data = json.loads((ROOT / path).read_text(encoding='utf-8'))
            self.assertEqual(data['FixedFileInfo']['FileVersion'], numeric)
            self.assertEqual(data['FixedFileInfo']['ProductVersion'], numeric)
            self.assertEqual(data['StringFileInfo']['FileVersion'], desktop_ver)
            self.assertEqual(data['StringFileInfo']['ProductVersion'], desktop_ver)
            self.assertEqual(data['StringFileInfo']['ProductName'], 'Glauka')
            self.assertNotIn('Developer', data['StringFileInfo']['ProductName'])
        installer = (ROOT / 'apps/windows/installer/install_ui.ps1').read_text(encoding='utf-8')
        self.assertIn("$script:installerVersion='" + desktop_ver + "'", installer)
        self.assertIn('Text="' + desktop_ver + '"', installer)
        self.assertNotIn('7.4.0', installer)
        self.assertIn('Glauka-Installer-' + desktop_ver + '.log',
                      (ROOT / 'apps/windows/installer/main.go').read_text(encoding='utf-8'))

    def test_macos_bundle_and_github_workflows_only_keep_macos(self):
        mac_ver = json.loads((ROOT / 'versions.json').read_text(encoding='utf-8'))['macos']['version']
        with (ROOT / 'apps/macos/native/Info.plist').open('rb') as stream:
            info = plistlib.load(stream)
        self.assertEqual(info['CFBundleShortVersionString'], mac_ver.split('-', 1)[0])
        self.assertEqual(info['CFBundleVersion'], __import__('macos_version').macos_bundle_build(mac_ver))
        self.assertEqual(info['GlaukaReleaseVersion'], mac_ver)
        self.assertRegex(info['CFBundleShortVersionString'], r'^\d+\.\d+\.\d+$')
        workflows = sorted(p.name for p in (ROOT / '.github/workflows').iterdir() if not p.name.startswith('.'))
        self.assertEqual(workflows, ['build-macos-6151.yml'])

    def test_release_gate_requires_local_stress_suite(self):
        package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
        self.assertEqual(package['scripts']['test:stress'], 'node scripts/release/stress_v74.js')
        script = (ROOT / 'scripts/release/v7_gate.py').read_text(encoding='utf-8')
        self.assertIn("('stress-v74', [npm, 'run', 'test:stress']", script)
        self.assertNotIn('github actions', script.lower().split('def plan', 1)[1])
