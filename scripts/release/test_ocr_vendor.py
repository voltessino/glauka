import io,json,tarfile,tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch
import ocr_vendor as V
class OCRVendorTests(TestCase):
 def test_cache_rejects_corruption_and_never_requests_runtime_models(self):
  with tempfile.TemporaryDirectory() as root:
   cache=Path(root);(cache/'asset').write_bytes(b'corrupt')
   with patch('urllib.request.urlopen',side_effect=AssertionError('network')):
    with self.assertRaisesRegex(ValueError,'hash/size'):V.cached('asset','https://invalid',lambda b:False,cache)
 def test_staging_only_extracts_allowlisted_files_and_retains_licenses(self):
  def fake(name,url,verify,cache):
   if name=='ita.traineddata':return b'model'
   if name=='model-LICENSE':return b'model license'
   package=next(n for n,v in V.PACKAGES.items() if name==n+'-'+v[0]+'.tgz')
   output=io.BytesIO()
   with tarfile.open(fileobj=output,mode='w:gz') as tar:
    for source in list(V.PACKAGES[package][2])+['../../escape']:
     data=b'x'*160;item=tarfile.TarInfo('package/'+source);item.size=len(data);tar.addfile(item,io.BytesIO(data))
   return output.getvalue()
  with tempfile.TemporaryDirectory() as root:
   dest=Path(root)/'ocr'
   with patch.object(V,'cached',side_effect=fake):V.stage(dest,Path(root)/'cache')
   self.assertTrue(all((dest/n).is_file() for n in V.ASSETS))
   self.assertTrue((dest/'MODEL-LICENSE.txt').exists());self.assertFalse((Path(root)/'escape').exists())
   manifest=json.loads((dest/'manifest.json').read_text());self.assertEqual(manifest['language'],'ita')
   with self.assertRaises(FileExistsError):V.stage(dest)
 def test_all_platforms_copy_the_same_offline_ocr_fixture_without_native_permissions(self):
  from prepare import ROOT,prepare
  def fake_ocr(directory):
   directory=Path(directory);directory.mkdir(parents=True)
   for name in V.ASSETS:(directory/name).write_bytes(('ocr-fixture:'+name).encode())
   (directory/'manifest.json').write_text('{"language":"ita"}')
   (directory/'MODEL-LICENSE.txt').write_text('offline fixture')
  def fake_pdfjs(directory):
   directory=Path(directory);directory.mkdir(parents=True)
   (directory/'pdf.mjs').write_text('offline fixture')
   (directory/'pdf.worker.mjs').write_text('offline fixture')
  with tempfile.TemporaryDirectory() as root:
   with patch('prepare.stage_ocr',side_effect=fake_ocr),patch('prepare.stage_pdfjs',side_effect=fake_pdfjs):
    win=prepare('windows',Path(root)/'win');android=prepare('android',Path(root)/'android')
   w=win/'desktop/resources/ocr';a=android/'app/src/main/assets/assets/ocr'
   for name in V.ASSETS+('host-worker.js','manifest.json'):
    self.assertEqual((w/name).read_bytes(),(a/name).read_bytes())
   self.assertEqual((w/'host-worker.js').read_bytes(),(ROOT/'apps/desktop-shared/ocr/host-worker.js').read_bytes())
   java=(android/'app/src/main/java/it/neuromap/architect/preview/AndroidAssetPolicy.java').read_text()
   for name in V.ASSETS+('host-worker.js',):self.assertIn('"assets/ocr/'+name+'"',java)
