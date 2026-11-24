import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch
from v7_gate import plan, run_gate


class LocalV7GateTests(TestCase):
    def roots(self):
        source=TemporaryDirectory()
        output=TemporaryDirectory()
        self.addCleanup(source.cleanup)
        self.addCleanup(output.cleanup)
        root=Path(source.name)
        (root/'package.json').write_text('{}',encoding='utf-8')
        (root/'versions.json').write_text(json.dumps({'editor':'6.20.0-dev.4',
          'android':{'editor_features':'6.16.0'}}),encoding='utf-8')
        return root,Path(output.name)/'v7-evidence'

    def test_complete_plan_executes_existing_scripts_and_never_uses_actions(self):
        p=plan(Path('/source'),Path('/qa'),platform='posix',python='/python')
        self.assertEqual(len(p),9)
        self.assertEqual(p[0][1],['npm','test'])
        self.assertEqual(p[1][1],['npm','run','test:stress'])
        self.assertEqual(p[2][1],['npm','run','test:knowledge:stress'])
        self.assertEqual(p[3][1],['npm','run','test:database:stress'])
        self.assertEqual(p[4][1],['npm','run','test:build'])
        self.assertEqual(p[5][1],['npm','run','test:browser'])
        self.assertEqual(p[6][2],{'NEUROMAP_TEST_ENGINE':'webkit'})
        self.assertEqual(p[7][1][:3],['/python','scripts/release/prepare.py','windows'])
        self.assertEqual(p[8][1][:3],['/python','scripts/release/prepare.py','macos'])
        self.assertNotIn('actions',str(p).lower())

    def test_windows_npm_shim_is_used_locally(self):
        p=plan(Path('C:/workspace'),Path('C:/qa'),platform='nt')
        self.assertEqual(p[0][1][0],'npm.cmd')
        self.assertEqual(p[6][1][0],'npx.cmd')

    @patch('v7_gate.subprocess.check_output',return_value='abcdef1234')
    def test_all_nine_successful_processes_produce_complete_pass_evidence(self, _):
        root,out=self.roots()
        calls=[]
        def execute(cmd,**kwargs):
            calls.append((cmd,kwargs))
            return SimpleNamespace(returncode=0)
        result=run_gate(root,out,executor=execute)
        self.assertTrue(result['complete'])
        self.assertTrue(result['passed'])
        self.assertEqual(len(calls),9)
        self.assertTrue(all(x['status']=='passed' for x in result['steps']))
        self.assertFalse(result['native_gui_verified'])
        self.assertFalse(result['signed_packages_verified'])
        self.assertEqual(json.loads((out/'report.json').read_text())['revision'],'abcdef1234')

    @patch('v7_gate.subprocess.check_output',return_value='abcdef1234')
    def test_one_failed_command_marks_gate_failed_even_if_others_pass(self,_):
        root,out=self.roots()
        def execute(cmd,**kwargs):
            return SimpleNamespace(returncode=17 if kwargs['env'].get('NEUROMAP_TEST_ENGINE') == 'webkit' else 0)
        result=run_gate(root,out,executor=execute)
        self.assertTrue(result['complete'])
        self.assertFalse(result['passed'])
        self.assertEqual(sum(x['status']=='failed' for x in result['steps']),1)

    @patch('v7_gate.subprocess.check_output',return_value='abcdef1234')
    def test_skipping_browser_or_build_staging_never_reports_complete_pass(self,_):
        root,out=self.roots()
        result=run_gate(root,out,skip_browser=True,skip_stage=True,
                        executor=lambda *args,**kwargs: SimpleNamespace(returncode=0))
        self.assertFalse(result['complete'])
        self.assertFalse(result['passed'])
        self.assertEqual(sum(x['status']=='skipped' for x in result['steps']),4)

    @patch('v7_gate.subprocess.check_output',return_value='abcdef1234')
    def test_dry_run_only_plans_without_invoking_native_processes(self,_):
        root,out=self.roots()
        result=run_gate(root,out,dry_run=True,
                        executor=lambda *args,**kwargs: self.fail('Must not execute'))
        self.assertFalse(result['complete'])
        self.assertFalse(result['passed'])
        self.assertTrue(all(x['status']=='planned' for x in result['steps']))

    def test_output_inside_checkout_is_rejected(self):
        root,_=self.roots()
        with self.assertRaisesRegex(ValueError,'outside'):
            run_gate(root,root/'qa',dry_run=True)

    def test_unknown_checkout_is_rejected(self):
        with TemporaryDirectory() as root,TemporaryDirectory() as out:
            with self.assertRaisesRegex(ValueError,'checkout'):
                run_gate(Path(root),Path(out)/'v7-qa',dry_run=True)
