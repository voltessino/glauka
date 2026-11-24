from pathlib import Path
import importlib.util,json,tempfile,unittest
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('ui_collect',ROOT/'scripts/dev/collect_android_interface_messages.py');collect=importlib.util.module_from_spec(spec);spec.loader.exec_module(collect)
class TranslationRefreshTests(unittest.TestCase):
 def test_new_canonical_english_invalidates_generated_values_but_keeps_reviewed_terms(self):
  with tempfile.TemporaryDirectory() as directory:
   folder=Path(directory);(folder/'fr.json').write_text(json.dumps({'changed':'old generated','reviewed':'human reviewed','same':'stable'}));(folder/'reviewed-terms.json').write_text(json.dumps({'reviewed':{'fr':'human reviewed'}}))
   source={'languages':[{'code':'it'},{'code':'en'},{'code':'fr'}],'entries':{k:{'en':'New English','known':True} for k in ['changed','reviewed','same']}}
   previous={'changed':('Italian guessed',False),'reviewed':('Italian guessed',False),'same':('New English',True)}
   self.assertEqual(collect.invalidate_generated(source,previous,folder),1)
   self.assertEqual(json.loads((folder/'fr.json').read_text()),{'reviewed':'human reviewed','same':'stable'})
