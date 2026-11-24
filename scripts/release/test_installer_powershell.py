"""Execute the real installer file operations, without needing WPF or admin rights."""
import os
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]

class InstallerPowerShellTests(unittest.TestCase):
    def test_actual_install_upgrade_and_custom_folder_cleanup(self):
        shell = os.environ.get('NEUROMAP_PWSH') or shutil.which('pwsh') or shutil.which('powershell.exe')
        if not shell:
            self.skipTest('PowerShell unavailable: installer copy/cleanup operations were not executed')
        result = subprocess.run([shell, '-NoLogo', '-NoProfile', '-NonInteractive', '-File',
                                 str(ROOT/'apps/windows/tests/install_upgrade.tests.ps1')],
                                cwd=ROOT, capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout+'\n'+result.stderr)
        self.assertIn('unrelated file preservation', result.stdout)

    def test_optional_launch_and_finish(self):
        shell = os.environ.get('NEUROMAP_PWSH') or shutil.which('pwsh') or shutil.which('powershell.exe')
        if not shell:
            self.skipTest('PowerShell unavailable: installer completion not executed')
        result = subprocess.run([shell, '-NoLogo', '-NoProfile', '-NonInteractive', '-File',
                                 str(ROOT/'apps/windows/tests/installer_finish.tests.ps1')],
                                cwd=ROOT, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout+'\n'+result.stderr)
        self.assertIn('unchecked no-launch', result.stdout)
