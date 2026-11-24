"""Android offline resources, native allowlists and upgrade identity."""
from pathlib import Path
import json
import re
import tempfile
import unittest
from prepare import prepare,ROOT

class AndroidLanguageTests(unittest.TestCase):
    def test_android_stages_every_catalog_locally_and_includes_touch_controls(self):
        with tempfile.TemporaryDirectory() as temporary:
            dest=prepare('android',Path(temporary)/'android')
            folder=dest/'app/src/main/assets'
            source=json.loads((folder/'app/locales/source.json').read_text())
            expected={l['code'] for l in source['languages']}
            self.assertEqual(expected,{'it','en','de','es','fr','pt','ar','zh-CN'})
            for code in expected:
                pack=json.loads((folder/f'app/locales/{code}.json').read_text())
                self.assertEqual(set(pack),set(source['entries']))
            script=(folder/'assets/localization.js').read_text()
            self.assertIn('globalThis.GlaukaMobile=true',script)
            self.assertIn('glauka-welcome-language',script)
            self.assertIn('glauka-android-language',script)
            html=(folder/'app/index.html').read_text()
            self.assertNotIn('@glauka-mobile-logo',html)
            self.assertIn('Glauka',html)
            self.assertIn('/assets/interface-languages.css',html)
            java=(dest/'app/src/main/java/it/neuromap/architect/preview/MainActivity.java').read_text()
            self.assertIn('app/locales/(it|en|de|es|fr|pt|ar|zh-CN)',(dest/'app/src/main/java/it/neuromap/architect/preview/AndroidAssetPolicy.java').read_text())
            self.assertIn('private static boolean validLocale',java)
            self.assertIn('if(!validLocale(code))return false;',java)
            self.assertNotIn('clean.startsWith("app/locales/")',java)
            gradle=(dest/'app/build.gradle').read_text()
            self.assertIn("applicationId 'it.neuromap.architect.preview'",gradle)
            self.assertIn('versionCode(androidVersion.version_code as int)',gradle)
            self.assertEqual(json.loads((dest/'versions.json').read_text())['android'],json.loads((ROOT/'versions.json').read_text())['android'])
