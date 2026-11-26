"""Content-only anteprima deployment must not overwrite OVH access controls."""
from pathlib import Path
import re
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_anteprima_update import build_update, validate_links


class ExistingAnteprimaUpdateTests(unittest.TestCase):
    def test_portable_italian_and_english_site_without_password_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder, archive = build_update(Path(tmp) / "update")
            self.assertEqual(folder.name, "anteprima")
            self.assertEqual(archive.name, "aggiornamento-anteprima.zip")
            self.assertTrue(archive.is_file())
            self.assertTrue((folder / "index.html").is_file())
            self.assertTrue((folder / "home-en.html").is_file())
            self.assertTrue((folder / "release-config.js").is_file())
            self.assertFalse((folder / "launch.css").exists())
            self.assertFalse((folder / "site-evolution.css").exists())
            self.assertFalse((folder / "living-canvas.js").exists())
            self.assertFalse((folder / "story-paths.js").exists())
            self.assertFalse((folder / "product-guide.js").exists())
            for example in ("anatomia-mappa", "anatomia-mappa-en"):
                self.assertTrue((folder / f"assets/examples/{example}.png").is_file())
            self.assertTrue((folder / "assets/examples/it/matematica.png").is_file())
            self.assertFalse((folder / "assets/examples/matematica-mappa.png").exists())
            self.assertFalse((folder / "media/glauka-demo.mp4").exists())
            for name in ("work", "study", "ideas", "organize"):
                self.assertFalse((folder / f"assets/{name}.png").exists())
            self.assertTrue((folder / "home.js").is_file())
            self.assertTrue((folder / "cinema.js").is_file())
            self.assertTrue((folder / "faq.js").is_file())
            self.assertTrue((folder / "release-status.js").is_file())
            self.assertTrue((folder / "media/glauka-studio-reel.mp4").is_file())
            self.assertTrue((folder / "media/glauka-studio-reel.png").is_file())
            self.assertTrue((folder / "ai-map.js").is_file())
            self.assertTrue((folder / "wiki.css").is_file())
            self.assertTrue((folder / "wiki.js").is_file())
            self.assertTrue((folder / "guida/index.html").is_file())
            self.assertTrue((folder / "guide/index.html").is_file())
            self.assertNotIn("../../", (folder / "guida/index.html").read_text(encoding="utf-8"))
            self.assertIn("../wiki.css", (folder / "guida/index.html").read_text(encoding="utf-8"))
            self.assertTrue((folder / "glauka-home-audit.js").is_file())
            for language in ("it", "en"):
                for view in ("mindmap", "orgchart", "tree", "network", "flow", "kanban", "timeline"):
                    self.assertEqual((folder / f"assets/views/{language}/view-{view}.png").read_bytes(), (Path(__file__).resolve().parents[2] / "apps/website/home-review" / f"assets/views/{language}/view-{view}.png").read_bytes())
                for subject in ("matematica", "project"):
                    self.assertEqual((folder / f"assets/examples/{language}/{subject}.png").read_bytes(), (Path(__file__).resolve().parents[2] / "apps/website/home-review" / f"assets/examples/{language}/{subject}.png").read_bytes())

            validate_links(folder)
            for name in (".htaccess", ".htpasswd", ".htpasswd-glauka-preview"):
                self.assertFalse((folder / name).exists())
            self.assertNotIn("../", (folder / "index.html").read_text(encoding="utf-8"))
            self.assertNotIn("../", (folder / "home-en.html").read_text(encoding="utf-8"))
            self.assertTrue((folder.parent / "LEGGIMI-ANTEPRIMA.txt").is_file())

            with zipfile.ZipFile(archive) as bundle:
                paths = bundle.namelist()
                self.assertIn("anteprima/index.html", paths)
                self.assertIn("anteprima/home-en.html", paths)
                self.assertTrue(all(p.startswith("anteprima/") for p in paths))
                self.assertFalse(any(".htaccess" in p or ".htpasswd" in p
                                     for p in paths))
                self.assertEqual(bundle.testzip(), None)

    def test_refuses_overwrite_of_existing_stage(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "update"
            folder, archive = build_update(output)
            payload = archive.read_bytes()
            with self.assertRaises(FileExistsError):
                build_update(output)
            self.assertEqual(archive.read_bytes(), payload)
            self.assertTrue(folder.is_dir())

    def test_rejects_broken_or_parent_escaping_html_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder, _ = build_update(Path(tmp) / "update")
            source = folder / "home-en.html"
            body = source.read_text(encoding="utf-8")
            with self.subTest("broken asset"):
                source.write_text(body.replace("</body>", '<img src="assets/missing.png"></body>'),
                                  encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "Broken"):
                    validate_links(folder)
            with self.subTest("parent escape"):
                source.write_text(body.replace("</body>", '<img src="../private.txt"></body>'),
                                  encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "Nonportable"):
                    validate_links(folder)

    def test_update_instructions_explicitly_preserve_ovh_protection(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder, _ = build_update(Path(tmp) / "update")
            instructions = (folder.parent / "LEGGIMI-ANTEPRIMA.txt").read_text(encoding="utf-8")
            self.assertIn(".htaccess", instructions)
            self.assertIn(".htpasswd-glauka-preview", instructions)
            self.assertIn("anteprima/anteprima/", instructions)
            self.assertNotIn("Password:", instructions)


if __name__ == "__main__":
    unittest.main()
