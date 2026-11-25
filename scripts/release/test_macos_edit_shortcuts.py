"""The Mac edit menu must route Command keys without dropping the page script."""
from pathlib import Path
import json
import unittest

ROOT = Path(__file__).resolve().parents[2]
NATIVE = ROOT / "apps" / "macos" / "native"


class MacEditShortcutTests(unittest.TestCase):
    def test_menu_routes_command_keys_and_embeds_the_page_script(self):
        swift = (NATIVE / "main.swift").read_text(encoding="utf-8")
        script = (NATIVE / "mac-edit.js").read_text(encoding="utf-8").rstrip("\n")
        start = swift.index('static let source = #"""') + len('static let source = #"""')
        end = swift.index('"""#', start)
        self.assertEqual(swift[start:end].strip("\n"), script)
        for marker in (
            'addEditItem(edit, "copy", #selector(glaukaCopy(_:)), "c")',
            'addEditItem(edit, "paste", #selector(glaukaPaste(_:)), "v")',
            'addEditItem(edit, "cut", #selector(glaukaCut(_:)), "x")',
            'addEditItem(edit, "selectAll", #selector(glaukaSelectAll(_:)), "a")',
            'addEditItem(edit, "undo", #selector(glaukaUndo(_:)), "z")',
            'addEditItem(edit, "redo", #selector(glaukaRedo(_:)), "z", shift: true)',
            "pageEditingText",
            "neuromapEditState",
            "GlaukaMacEdit.command",
            "NSApp.sendAction(selector, to: nil, from: nil)",
            'key.name == "copy" || key.name == "selectAll"',
            "keyEquivalent: \"\"",
        ):
            if marker == 'keyEquivalent: ""':
                self.assertNotIn(marker, swift)
            else:
                self.assertIn(marker, swift)
        messages = json.loads((NATIVE / "NativeMessages.json").read_text(encoding="utf-8"))
        for pack in messages.values():
            self.assertTrue(pack.get("undo") and pack.get("redo"))


if __name__ == "__main__":
    unittest.main()
