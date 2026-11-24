import unittest
from verify_android_preview import validate,validate_payload
from pathlib import Path
import tempfile,zipfile
class PreviewIdentityTests(unittest.TestCase):
 def test_local_signer_exception_never_waives_version_or_identity(self):
  identity={'applicationId':'it.neuromap.architect.preview','certificateSha256':'a'*64}
  version={'version_code':20,'version':'test'}
  certificate='Number of signers: 1\nSigner #1 certificate SHA-256 digest: '+'b'*64
  metadata="name='it.neuromap.architect.preview' versionCode='20' versionName='test'"
  self.assertEqual(validate(certificate,metadata,identity,version,True),'b'*64)
  for cert,meta in [(certificate,metadata.replace("versionCode='20'","versionCode='19'")),(certificate,metadata.replace('architect.preview','other.app')),(certificate.replace('signers: 1','signers: 2'),metadata),('',metadata)]:
   with self.assertRaises(ValueError):validate(cert,meta,identity,version,True)
 def test_updates_require_the_pinned_certificate_and_current_version(self):
  identity={'applicationId':'it.neuromap.architect.preview','certificateSha256':'a'*64};version={'version_code':13,'version':'0.6.7-rc.1-private'}
  certificate='Number of signers: 1\nSigner #1 certificate SHA-256 digest: '+'a'*64
  metadata="name='it.neuromap.architect.preview' versionCode='13' versionName='0.6.7-rc.1-private'"
  self.assertEqual(validate(certificate,metadata,identity,version),'a'*64)
  for cert,meta in [(certificate.replace('a'*64,'b'*64),metadata),(certificate,metadata.replace("versionCode='13'","versionCode='12'")),(certificate.replace('signers: 1','signers: 2'),metadata)]:
   with self.assertRaises(ValueError):validate(cert,meta,identity,version)
 def test_old_payload_is_rejected_even_when_package_version_and_signer_match(self):
  with tempfile.TemporaryDirectory() as folder:
   apk=Path(folder)/'test.apk'
   with zipfile.ZipFile(apk,'w') as archive:
    archive.writestr('assets/app/index.html','<html data-neuromap-build="old-revision">')
   with self.assertRaisesRegex(ValueError,'source revision'):validate_payload(apk,'current-revision')
   self.assertEqual(validate_payload(apk,'old-revision'),0)
 def test_stale_staged_asset_is_rejected(self):
  with tempfile.TemporaryDirectory() as folder:
   stage=Path(folder);assets=stage/'app/src/main/assets';assets.mkdir(parents=True)
   (assets/'script.js').write_text('current UI')
   apk=stage/'test.apk'
   with zipfile.ZipFile(apk,'w') as archive:
    archive.writestr('assets/app/index.html','<html data-neuromap-build="revision">')
    archive.writestr('assets/script.js','old UI')
   with self.assertRaisesRegex(ValueError,'assets differ'):validate_payload(apk,'revision',stage)
 def test_unexpected_old_assets_are_rejected_even_if_current_files_match(self):
  with tempfile.TemporaryDirectory() as folder:
   stage=Path(folder);assets=stage/'app/src/main/assets/app';assets.mkdir(parents=True)
   html='<html data-neuromap-build="revision">';(assets/'index.html').write_text(html)
   apk=stage/'test.apk'
   with zipfile.ZipFile(apk,'w') as archive:
    archive.writestr('assets/app/index.html',html)
    archive.writestr('assets/old-ui.js','stale')
   with self.assertRaisesRegex(ValueError,'unexpected or missing'):validate_payload(apk,'revision',stage)
