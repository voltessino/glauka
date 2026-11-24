from pathlib import Path
import tempfile
import unittest
from verify_embedded_ui import verify

class EmbeddedEditorTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root=Path(self.temporary.name)
        self.html=self.root/'index.html'
        self.binary=self.root/'app.exe'
        self.payload=b'<html data-neuromap-build="revision"><script>root.NeuroMapDrag={}; /* nm-drag-preview nm-theme-picker */</script></html>'
        self.html.write_bytes(self.payload)
    def test_exact_prepared_editor_is_identified(self):
        self.binary.write_bytes(b'MZ\x00\x01'+self.payload+b'\x00\x02')
        evidence=verify(self.binary,self.html)
        self.assertEqual(evidence['editorBytes'],len(self.payload))
        self.assertEqual(len(evidence['editorSHA256']),64)
    def test_stale_editor_in_binary_is_rejected(self):
        self.binary.write_bytes(self.payload.replace(b'root.NeuroMapDrag',b'old.NeuroMapDrag'))
        with self.assertRaisesRegex(ValueError,'exact prepared editor'):verify(self.binary,self.html)
    def test_legacy_dropdown_in_prepared_editor_is_rejected(self):
        self.html.write_bytes(self.payload+b'<select id="nm615-theme-top"></select>')
        self.binary.write_bytes(self.html.read_bytes())
        with self.assertRaisesRegex(ValueError,'Legacy background'):verify(self.binary,self.html)
