"""Compile the real installer's native identity interop and parse the WPF script.
No Windows APIs are called here; native taskbar visual validation needs Windows.
"""
from pathlib import Path
import os,re,shutil,subprocess,tempfile,unittest
ROOT=Path(__file__).resolve().parents[2]
class InstallerIdentityTests(unittest.TestCase):
 def test_native_identity_interop_compiles_and_script_parses(self):
  shell=os.environ.get('NEUROMAP_PWSH') or shutil.which('pwsh') or shutil.which('powershell.exe')
  if not shell:self.skipTest('PowerShell unavailable')
  source=(ROOT/'apps/windows/installer/install_ui.ps1').read_text(encoding='utf-8-sig')
  body=re.search(r'Add-Type @"\n(.*?)\n"@',source,re.S).group(1)
  with tempfile.TemporaryDirectory()as temp:
   check=Path(temp)/'identity.ps1'
   check.write_text("$ErrorActionPreference='Stop'\nAdd-Type @'\n"+body+"\n'@\n"+
    "$errors=$null;$tokens=$null;[void][System.Management.Automation.Language.Parser]::ParseFile($args[0],[ref]$tokens,[ref]$errors);if($errors.Count){throw ($errors|Out-String)}\n"+
    "if(-not [GlaukaInstallerChrome].GetMethod('SetCurrentProcessExplicitAppUserModelID')){throw 'Identity API missing'}\n"+
    "if(-not [GlaukaInstallerChrome].GetMethod('SetWindowIcons')){throw 'Window icons missing'}\n")
   result=subprocess.run([shell,'-NoLogo','-NoProfile','-NonInteractive','-File',str(check),str(ROOT/'apps/windows/installer/install_ui.ps1')],capture_output=True,text=True,timeout=30)
   self.assertEqual(result.returncode,0,result.stdout+'\n'+result.stderr)
 def test_identity_precedes_window_creation_and_console_is_not_created(self):
  source=(ROOT/'apps/windows/installer/install_ui.ps1').read_text(encoding='utf-8-sig')
  self.assertLess(source.index('SetCurrentProcessExplicitAppUserModelID($installerAppID)'),source.index('[Windows.Markup.XamlReader]::Load'))
  self.assertIn('SetWindowIcons($handle,$SourceIcon)',source)
  self.assertIn('Glauka.Setup.Developer',source)
  self.assertIn('CreationFlags: 0x08000000',(ROOT/'apps/windows/installer/main.go').read_text())
  native=(ROOT/'apps/desktop-shared/src/native_window_windows.go').read_text()
  self.assertIn('EnumResourceNamesW',native)
  self.assertIn('IconId: nativeWindowIconID()',native)
  self.assertNotIn('IconId: 1,',native)
if __name__=='__main__':unittest.main()
