from pathlib import Path
import json
import ast
import re
import tempfile
import unittest
from interface_locales import catalogs,installer
ROOT=Path(__file__).resolve().parents[2]
UI=ROOT/'packages/editor-ui'
class InterfaceLocaleTests(unittest.TestCase):
 def test_all_catalogs_cover_the_same_messages_and_reviewed_terminology(self):
  source,packs=catalogs(UI)
  self.assertEqual(set(packs),{'it','en','de','es','fr','pt','ar','zh-CN'})
  self.assertGreater(len(source['entries']),4000)
  for key,terms in json.loads((UI/'locales/reviewed-terms.json').read_text()).items():
   for code,value in terms.items():self.assertEqual(packs[code][key],value,(code,key))
 def test_installer_every_lookup_is_available_in_every_native_named_language(self):
  with tempfile.TemporaryDirectory()as tmp:
   out=Path(tmp)/'locales.json';script=ROOT/'apps/windows/installer/install_ui.ps1';installer(UI,script,out)
   data=json.loads(out.read_text());self.assertIn('简体中文',[l['name']for l in data['languages']]);self.assertIn('العربية',[l['name']for l in data['languages']])
   keys={s.replace("''", "'")for s in re.findall(r"Localize '((?:[^']|'')*)'",script.read_text(encoding='utf-8-sig'))}
   keys.update(re.findall(r'installerText\("([^"]+)"\)',(script.parent/'main.go').read_text()))
   for code,pack in data['messages'].items():self.assertEqual(set(pack),keys,code);self.assertTrue(all(pack.values()))

 def test_every_static_ui_pair_has_a_catalog_entry(self):
  source=json.loads((UI/'locales/source.json').read_text())
  literal=r"""(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')"""
  pattern=re.compile(r'\b(?:tr|t|pair|message)\(\s*('+literal+r')\s*,\s*('+literal+r')')
  missing=[]
  for folder in [UI,UI/'editor-shared',ROOT/'apps/desktop-shared/editor',ROOT/'apps/desktop-shared/src',ROOT/'apps/android/editor',ROOT/'apps/android/native/app/src/main/assets/assets']:
   for file in folder.glob('*.js'):
    if file.name=='interface-languages.js':continue
    for m in pattern.finditer(file.read_text()):
     try:a,b=map(ast.literal_eval,m.groups())
     except (ValueError,SyntaxError):continue
     if a==b or min(len(a),len(b))<2 or not re.search(r'[A-Za-zÀ-ž]',a+b) or re.fullmatch(r'[a-z]{2}-[A-Z]{2}',a):continue
     if a.strip() not in source['aliases'] and b.strip() not in source['aliases']:missing.append((str(file.relative_to(ROOT)),a,b))
  self.assertEqual(missing,[], 'New UI text needs a catalog entry before release')
 def test_compose_is_identical_across_python_hash_seeds(self):
  import os
  import subprocess
  import sys
  command=[sys.executable,'-c',"from pathlib import Path;import hashlib;from interface_locales import compose;print(hashlib.sha256(compose(Path('packages/editor-ui')).encode()).hexdigest())"]
  hashes=[]
  for seed in ['1','2']:
   result=subprocess.run(command,cwd=ROOT,env={**os.environ,'PYTHONPATH':str(ROOT/'scripts/release'),'PYTHONHASHSEED':seed},capture_output=True,text=True,check=True)
   hashes.append(result.stdout.strip())
  self.assertEqual(hashes[0],hashes[1])

 def test_latest_main_image_errors_and_command_opener_are_localized(self):
  source,packs=catalogs(UI)
  for text in ['Immagine con dimensioni non valide','ERRORE IMMAGINE','⌕ Comandi','Trascina prima i documenti e poi le immagini, separatamente','Elemento ZIP oltre il limite di decompressione.','Immagine vuota o oltre 32 MB']:
   key=source['aliases'][text]
   for code in ['de','es','fr','pt','ar','zh-CN']:
    self.assertNotEqual(packs[code][key],packs['it'][key],(code,text))
    self.assertNotEqual(packs[code][key],packs['en'][key],(code,text))

 def test_symbol_placement_guidance_is_complete_in_all_eight_languages(self):
  source,packs=catalogs(UI)
  texts=[
   'Scegli dove inserire il simbolo: nella scritta oppure come distintivo esterno al ramo.',
   'Il simbolo comparirà nella scritta del nodo (es. ❷ Ciao).',
   'Distintivi esterni selezionati:',
  ]
  for text in texts:
   key=source['aliases'][text]
   self.assertEqual(source['aliases'][source['entries'][key]['en']],key)
   for code,pack in packs.items():
    self.assertTrue(pack[key].strip(),(code,text))
    if code not in ('it','en'):
     self.assertNotEqual(pack[key],packs['it'][key],(code,text))
     self.assertNotEqual(pack[key],packs['en'][key],(code,text))
  example=source['aliases'][texts[1]]
  for code,pack in packs.items():self.assertIn('❷',pack[example],code)
