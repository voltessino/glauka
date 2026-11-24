"""Regression tests for Android presentation auditing (no source files mutated)."""
import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'qa'))
import android_touch_audit as audit
class AndroidTouchAuditTests(unittest.TestCase):
    def test_real_build_manifest_and_sources(self):
        manifest=json.loads((audit.ROOT/'apps/android/tests/fixtures/touch-guidance-sources.json').read_text())
        audit.validate_manifest(manifest)
        self.assertEqual(audit.audit(manifest['files'])['unreviewed'],[])
    def test_manifest_matches_actual_android_staging(self):
        manifest=json.loads((audit.ROOT/'apps/android/tests/fixtures/touch-guidance-sources.json').read_text())
        actual=audit.inventory(detail=True)
        self.assertEqual(actual['files'],manifest['files'])
        self.assertEqual(actual['dependencies'],manifest['dependencies'])
    def test_new_ui_instructions_fail_in_included_javascript(self):
        file='apps/android/editor/app.js'
        result=audit.audit([file],overrides={file:"showToast('Press Ctrl + K to find a node');"})
        self.assertEqual(len(result['unreviewed']),1)
        self.assertTrue(audit.audit([file],overrides={file:"showToast('Ctrl+Z');"})['unreviewed'])
    def test_hidden_modals_are_not_automatically_exempt(self):
        rows=audit.scan_file('screen.html','<div class="hidden"><p>Press Ctrl+Z</p></div>')
        self.assertEqual(rows[0]['category'],'unreviewed_ui_instruction')
        self.assertEqual(audit.scan_file('screen.html','<div class="dropdown-panel">Ctrl+Z</div>')[0]['category'],'unreviewed_ui_instruction')
    def test_explicit_physical_reference_is_preserved(self):
        rows=audit.scan_file('screen.html','<aside data-glauka-physical-keyboard><p>Ctrl+Z</p></aside>')
        self.assertEqual(rows[0]['category'],'physical_keyboard_reference')
    def test_handler_and_comment_are_not_ui(self):
        rows=audit.scan_file('screen.js',"// Ctrl+Z handler\nif(event.key === 'F2') edit();")
        self.assertEqual({r['category']for r in rows},{'technical_comment','physical_keyboard_handler'})
    def test_changed_closure_requires_actual_build_inventory(self):
        manifest=json.loads((audit.ROOT/'apps/android/tests/fixtures/touch-guidance-sources.json').read_text())
        altered=copy.deepcopy(manifest);altered['closure_input_sha256']['scripts/release/prepare.py']='changed'
        with self.assertRaisesRegex(ValueError,'regenerate'):audit.validate_manifest(altered)
    def test_native_toasts_are_checked(self):
        self.assertEqual(audit.scan_file('Screen.java','toast("Ctrl+Z to undo");')[0]['category'],'unreviewed_ui_instruction')
    def test_additional_mouse_and_translated_instructions(self):
        for value in ['Tasto Dx','right mouse button','left-click','hover over a node','Appuyez sur Entrée','按下回车','Ctrl-Z','Ctrl. + Z']:
            self.assertIsNotNone(audit.STRICT.search(value),value)
    def test_control_noun_and_ordinary_tab_are_not_shortcuts(self):
        for value in ['Current tab: map','enter percentages','au contrôle d’intégrité']:
            self.assertIsNone(audit.STRICT.search(value),value)
if __name__=='__main__':unittest.main()
