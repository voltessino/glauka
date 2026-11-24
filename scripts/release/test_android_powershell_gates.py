"""Execute the Windows builder's fail-closed flow in PowerShell on POSIX.

External Git/npm/SDK commands are deterministic fixtures; JUnit validation uses
the real Python helper. This is not a Windows 5.1 or real APK build test.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SHELL = os.environ.get('NEUROMAP_PWSH') or shutil.which('pwsh')
STUB = r'''#!/usr/bin/python3
import hashlib,json,os,subprocess,sys
from pathlib import Path
args=sys.argv[1:]; role=Path(sys.argv[0]).name
home=Path(os.environ['GLAUKA_GATE_FIXTURE']); case=os.environ['GLAUKA_GATE_CASE']
with (home/'calls.jsonl').open('a') as f:f.write(json.dumps([role,args])+'\n')
revision='ab'*20
if role in ('git','git.exe'):
 if 'branch' in args:print('gate-fixture')
 elif 'rev-parse' in args:
  previous=(home/'revisions').read_text() if (home/'revisions').exists() else ''
  (home/'revisions').write_text(previous+'x')
  print(('cd'*20 if case=='source-change' and len(previous)>=1 else revision)[:10] if '--short=10' in args else ('cd'*20 if case=='source-change' and len(previous)>=1 else revision))
 sys.exit(0)
if role=='java.exe':print('openjdk fixture');sys.exit(0)
if role=='npm.cmd':sys.exit(17 if case=='node-failure' else 0)
if role=='gradle.bat':
 if case=='gradle-failure':sys.exit(23)
 assert ':app:testDebugUnitTest' in args and ':app:assembleDebug' in args
 reports=Path('app/build/test-results/testDebugUnitTest');reports.mkdir(parents=True)
 xml={'bad-xml':'<',
      'empty-reports':'<testsuite tests="0" failures="0" errors="0" skipped="0"/>',
      'skipped-reports':'<testsuite tests="1" failures="0" errors="0" skipped="1"/>',
      'failed-java':'<testsuite tests="1" failures="1" errors="0" skipped="0"/>',
      'error-java':'<testsuite tests="1" failures="0" errors="1" skipped="0"/>'}.get(case,'<testsuite tests="1" failures="0" errors="0" skipped="0"/>')
 if case != 'missing-reports':(reports/'TEST-fixture.xml').write_text(xml)
 apk=Path('app/build/outputs/apk/debug/app-debug.apk');apk.parent.mkdir(parents=True)
 apk.write_bytes(b'fixture-not-an-installable-apk'*50000);sys.exit(0)
if role=='python.exe':
 if args==['--version']:print('Python fixture');sys.exit(0)
 if args[0].endswith('prepare.py'):Path(args[2]).mkdir(parents=True);sys.exit(0)
 if args[0].endswith('verify_android_preview.py'):
  apk=Path(args[args.index('--apk')+1]);out=Path(args[args.index('--output')+1])
  out.write_text(json.dumps({'sourceRevision':revision,'sourceDirty':False,'updates066PreviewInPlace':True,
   'sha256':'0'*64 if case=='hash-mismatch' else hashlib.sha256(apk.read_bytes()).hexdigest()}));sys.exit(0)
 sys.exit(subprocess.call([sys.executable,*args]))
sys.exit(99)
'''


@unittest.skipUnless(os.name == 'posix' and SHELL,
                     'Requires POSIX executable fixtures and PowerShell; Windows validation is separate')
class AndroidPowerShellGateTests(unittest.TestCase):
    def run_case(self, case):
        with tempfile.TemporaryDirectory() as temporary:
            home=Path(temporary)
            repo=home/'repo'
            shutil.copytree(ROOT/'scripts/release',repo/'scripts/release',
                            ignore=shutil.ignore_patterns('__pycache__'))
            # .NET's Windows ProgramFiles special folder is empty on Linux.
            # Substitute ONLY this host probe in the copied fixture, not gate logic.
            builder=repo/'scripts/release/build_android_local.ps1'
            text=builder.read_text()
            probe="([Environment]::GetFolderPath('ProgramFiles'))"
            self.assertEqual(text.count(probe),1)
            builder.write_text(text.replace(probe,'$env:ProgramFiles'))
            sdk=home/'sdk'; java=home/'jdk'; tools=home/'local/Glauka/BuildTools/gradle-8.9/bin'
            (sdk/'platforms/android-35').mkdir(parents=True)
            (sdk/'platforms/android-35/android.jar').touch()
            (java/'bin').mkdir(parents=True);(java/'bin/javac.exe').touch()
            tools.mkdir(parents=True)
            build_tools=sdk/'build-tools/35.0.0';build_tools.mkdir(parents=True)
            for name in ['apksigner.bat','aapt.exe']:(build_tools/name).touch()
            binary=home/'bin';binary.mkdir()
            for path in [binary/name for name in ['git','git.exe','python.exe','npm.cmd']]+[java/'bin/java.exe',tools/'gradle.bat']:
                path.write_text(STUB);path.chmod(0o755)
            profile=home/'profile';profile.mkdir()
            env={**os.environ,'GLAUKA_GATE_FIXTURE':str(home),'GLAUKA_GATE_CASE':case,
                 'PATH':str(home/'unused')+os.pathsep+str(binary)+os.pathsep+os.environ['PATH'],
                 'LOCALAPPDATA':str(home/'local'),'USERPROFILE':str(profile),
                 'ProgramFiles':str(home/'program-files'),
                 'JAVA_HOME':str(java),'ANDROID_HOME':str(sdk),'ANDROID_SDK_ROOT':str(sdk),
                 'XDG_CONFIG_HOME':str(home/'config'),'XDG_DATA_HOME':str(home/'data'),
                 'XDG_CACHE_HOME':str(home/'cache')}
            result=subprocess.run([SHELL,'-NoProfile','-NonInteractive','-File',
                str(repo/'scripts/release/build_android_local.ps1'),'-PreviewBranch','-SkipUpdate'],
                env=env,cwd=repo,text=True,capture_output=True,timeout=60)
            calls=[json.loads(line) for line in (home/'calls.jsonl').read_text().splitlines()]
            outputs=list(profile.glob('Glauka-APK/*.apk'))
            return result,calls,len(outputs)

    def test_success_requires_node_java_and_identity_before_distribution(self):
        result,calls,outputs=self.run_case('ok')
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertEqual(outputs,1)
        roles=[role for role,_ in calls]
        self.assertLess(roles.index('npm.cmd'),roles.index('gradle.bat'))
        self.assertIn(':app:testDebugUnitTest',next(args for role,args in calls if role=='gradle.bat'))

    def test_failing_node_stops_before_staging_and_gradle(self):
        result,calls,outputs=self.run_case('node-failure')
        self.assertNotEqual(result.returncode,0)
        self.assertIn('Test JavaScript falliti',result.stdout+result.stderr)
        self.assertFalse(any(role=='gradle.bat' or any('prepare.py' in arg for arg in args)
                             for role,args in calls))
        self.assertEqual(outputs,0)

    def test_gradle_reports_source_and_hash_failures_never_distribute(self):
        for case in ['gradle-failure','missing-reports','empty-reports','skipped-reports',
                     'bad-xml','failed-java','error-java','hash-mismatch','source-change']:
            with self.subTest(case=case):
                result,calls,outputs=self.run_case(case)
                self.assertNotEqual(result.returncode,0,result.stdout+result.stderr)
                self.assertIn('gradle.bat',[role for role,_ in calls])
                self.assertEqual(outputs,0,result.stdout+result.stderr)


if __name__=='__main__':unittest.main()
