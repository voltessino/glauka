#!/usr/bin/env python3
"""No I/O: ensure licensing secrets cannot be produced inside the source tree."""
from pathlib import Path
import tempfile
import unittest
from issue import ROOT, outside_checkout


class IssuerPathSafetyTests(unittest.TestCase):
    def test_checkout_root_and_descendants_rejected(self):
        for path in (
            ROOT,
            ROOT / "private-issuer",
            ROOT / "scripts" / "licensing" / "owner.pem",
            ROOT / "scripts" / ".." / "pro.txt",
        ):
            with self.subTest(path=path), self.assertRaises(ValueError):
                outside_checkout(path)

    def test_external_directory_permitted_without_creating_it(self):
        outside = Path(tempfile.gettempdir()) / "glauka-issuer-outside-checkout"
        self.assertEqual(outside_checkout(outside), outside.resolve())

    def test_symlink_resolved_before_checkout_check(self):
        # An unresolved path containing '..' must not bypass the checkout boundary.
        candidate = ROOT.parent / ROOT.name / "sub" / ".." / "issuer.pem"
        with self.assertRaises(ValueError):
            outside_checkout(candidate)


if __name__ == "__main__":
    unittest.main()
