from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
import json
from android74_gate import plan, execute

class Android74GateTests(TestCase):
    def test_required_local_steps_and_no_actions(self):
        with TemporaryDirectory() as root:
            stages=plan(Path(root),python='python3',platform='posix')
            self.assertEqual(len(stages),8)
            self.assertEqual([s[0] for s in stages],[
              'node-unit','build-and-staging-tests','android-stress',
              'knowledge-links-stress','knowledge-database-stress','android-adaptive-browser','stage-android','assemble-debug-apk'
            ])
            self.assertEqual(stages[2][1],['npm','run','test:android:stress'])
            self.assertEqual(stages[3][1],['npm','run','test:knowledge:stress'])
            self.assertEqual(stages[4][1],['npm','run','test:database:stress'])
            self.assertEqual(stages[5][1],['npm','run','test:android:ui'])
            self.assertNotIn('actions',str(stages).lower())
            windows=plan(Path(root),python='python',platform='nt')
            self.assertEqual(windows[0][1][0],'npm.cmd')
            self.assertEqual(windows[-1][1][0],'gradle.bat')

    def test_candidate_gate_never_certifies_stable_from_dry_run(self):
        with TemporaryDirectory() as root:
            with patch('android74_gate.subprocess.check_output',return_value='abcdef1234'):
                data=execute(Path(root)/'new',dry_run=True)
            self.assertFalse(data['allStepsPassed'])
            self.assertFalse(data['stableCertified'])
            self.assertFalse(data['physicalDeviceVerified'])
            self.assertEqual(len(data['steps']),8)
            self.assertTrue(all(x['status']=='planned' for x in data['steps']))

    def test_refuse_artifact_output_inside_repo(self):
        from android74_gate import ROOT
        with self.assertRaises(ValueError):
            execute(ROOT/'android-output',dry_run=True)
