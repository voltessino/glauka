import hashlib
from pathlib import Path
import tempfile
import unittest
import zipfile
from build_android_local import validate_source, validate_output, package_zip, failed_tap_tests


class PortableAndroidBuildTests(unittest.TestCase):
 def test_stale_main_and_dirty_tree_are_not_distributable(self):
  for revision,dirty,main in [('old','','new'),('new',' M app.js','new'),('new','','')]:
   with self.assertRaises(ValueError):validate_source(revision,dirty,main)
  validate_source('new','','new')
  validate_source('branch','','main',allow_unmerged=True)
  with self.assertRaises(ValueError):validate_source('branch','modified','main',allow_unmerged=True)

 def test_output_cannot_reuse_repo_ancestor_or_old_staging(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder)/'repo';root.mkdir()
   for bad in [root,root/'build',Path(folder)]:
    with self.assertRaises(ValueError):validate_output(bad,root)
   out=Path(folder)/'new';self.assertEqual(validate_output(out,root),out)
   out.mkdir();(out/'stale.apk').write_bytes(b'stale')
   with self.assertRaises(ValueError):validate_output(out,root)

 def test_zip_contains_exact_verified_apk_and_no_temporary_file(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);apk=root/'source.apk';apk.write_bytes(b'APK payload\x00'*1000)
   target=root/'Glauka-test.zip';package_zip(apk,target,'test','revision')
   self.assertFalse(target.with_suffix('.zip.tmp').exists())
   with zipfile.ZipFile(target) as archive:
    self.assertIsNone(archive.testzip())
    self.assertEqual(hashlib.sha256(archive.read('Glauka-test.apk')).digest(),hashlib.sha256(apk.read_bytes()).digest())
    self.assertIn('revision',archive.read('LEGGIMI.txt').decode())


 def test_javascript_gate_diagnostics_show_only_failed_names(self):
  tap = (
   "TAP version 13\n"
   "ok 1 - good\n"
   "not ok 2 - export route rejected\n"
   "  ---\n"
   "    error: expected success\n"
   "    not ok 3 - cloud intent stale\n"
   "ok 4 - microphone restored\n"
   "# fail 2\n"
  )
  self.assertEqual(failed_tap_tests(tap),
                   ['export route rejected', 'cloud intent stale'])
  self.assertEqual(failed_tap_tests('ok 1 - fine\n# pass 1\n'), [])

 def test_post_verification_apk_replacement_is_rejected(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);apk=root/'source.apk';apk.write_bytes(b'new unexpected APK')
   target=root/'Glauka-test.zip'
   with self.assertRaisesRegex(ValueError,'changed after verification'):
    package_zip(apk,target,'test','revision','0'*64)
   self.assertFalse(target.exists());self.assertFalse(target.with_suffix('.zip.tmp').exists())
