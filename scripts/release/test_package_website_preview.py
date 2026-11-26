"""Checks for a portable preview bundle and separation of its credentials."""
import hashlib
import os
from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest
from urllib.parse import unquote, urlsplit
import zipfile

from package_website_preview import REPO, apache_config, build


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in {"href", "src", "poster"} and value and not value.startswith("#"):
                if not urlsplit(value).scheme:
                    self.paths.append(unquote(urlsplit(value).path))


class WebsitePreviewPreflightTest(unittest.TestCase):
    def test_https_gate_rejects_untrusted_client_forwarded_header(self):
        config = apache_config("/home/example")
        # Apache must verify HTTPS itself; the client can forge forwarded headers.
        self.assertIn('<If "%{HTTPS} != \'on\'">', config)
        self.assertNotIn("req('X-Forwarded-Proto')", config)
        self.assertIn("Require all denied", config)
        self.assertIn("Require valid-user", config)

    def test_refuses_to_place_credentials_in_checkout(self):
        destination = REPO / "glauka-preview-must-not-create"
        self.assertFalse(destination.exists())
        with self.assertRaisesRegex(ValueError, "outside the repository"):
            build(destination, "/home/example")
        self.assertFalse(destination.exists())
        self.assertFalse(destination.with_suffix(".zip").exists())

    def test_existing_zip_is_never_overwritten_even_if_directory_is_new(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "glauka-preview"
            archive = output.with_suffix(".zip")
            archive.write_bytes(b"existing private backup")
            with self.assertRaises(FileExistsError):
                build(output, "/home/example")
            self.assertEqual(archive.read_bytes(), b"existing private backup")
            self.assertFalse(output.exists())


@unittest.skipUnless(shutil.which("openssl"), "OpenSSL is required to create Apache password hashes")
class WebsitePreviewTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.output = Path(cls.temp.name) / "preview"
        cls.archive = build(cls.output, "/home/exampleaccount")
        cls.public = cls.output / "2-CARTELLA-DEL-DOMINIO" / "anteprima"

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_auth_file_is_outside_web_root_and_matches_generated_password(self):
        private = self.output / "1-HOME-FTP" / ".htpasswd-glauka-preview"
        username, hashed = private.read_text().strip().split(":", 1)
        self.assertEqual(username, "anteprima")
        password = re.search(r"^Password: (.+)$", (self.output / "ACCESSO-ANTEPRIMA.txt").read_text(), re.M)[1]
        result = subprocess.run(
            ["openssl", "passwd", "-apr1", "-salt", hashed.split("$")[2], "-stdin"],
            input=(password + "\n").encode(), stdout=subprocess.PIPE, check=True,
        ).stdout.decode().strip()
        self.assertTrue(result == hashed)
        for file in self.public.rglob("*"):
            if file.is_file() and file.suffix in {".html", ".css", ".js", ".txt"}:
                text = file.read_text()
                self.assertNotIn(password, text)
                self.assertNotIn(hashed, text)
        self.assertFalse((self.public / private.name).exists())

    @unittest.skipUnless(os.name == "posix", "POSIX ownership bits required")
    def test_private_credentials_and_zip_have_restrictive_permissions(self):
        credentials = self.output / "1-HOME-FTP" / ".htpasswd-glauka-preview"
        access = self.output / "ACCESSO-ANTEPRIMA.txt"
        for item in (self.output, credentials, access, self.archive):
            with self.subTest(path=str(item)):
                self.assertEqual(item.stat().st_mode & 0o077, 0)

    def test_apache_protection_is_required_and_covers_all_assets(self):
        config = (self.public / ".htaccess").read_text()
        self.assertIn('AuthUserFile "/home/exampleaccount/.htpasswd-glauka-preview"', config)
        self.assertIn("Require valid-user", config)
        self.assertIn("Options -Indexes", config)
        self.assertIn("noindex, nofollow", config)
        self.assertIn('<If "%{HTTPS} != \'on\'">', config)
        self.assertNotIn("req('X-Forwarded-Proto')", config)
        self.assertNotIn("Satisfy any", config)
        self.assertNotIn("Require all granted", config)

    def test_all_html_and_font_paths_are_local_to_preview(self):
        html = (self.public / "index.html").read_text()
        links = Links()
        links.feed(html)
        self.assertNotIn("../", html)
        self.assertNotIn("Confronta le proposte", html)
        self.assertIn('id="hero-title"', html)
        self.assertIn("cinema.js", html)
        self.assertNotIn("living-canvas.js", html)
        self.assertNotIn("story-paths.js", html)
        for relative in links.paths:
            path = (self.public / relative).resolve()
            self.assertTrue(path.is_relative_to(self.public.resolve()))
            self.assertTrue(path.is_file(), relative)
        # The bilingual preview must remain portable under /anteprima/
        # without leaking paths outside the protected folder.
        english = (self.public / "home-en.html").read_text()
        self.assertIn('<html lang="en">', english)
        self.assertNotIn("../", english)
        translated = Links()
        translated.feed(english)
        self.assertIn("index.html", translated.paths)
        for relative in translated.paths:
            path = (self.public / relative).resolve()
            self.assertTrue(path.is_relative_to(self.public.resolve()))
            self.assertTrue(path.is_file(), relative)
        self.assertFalse((self.public / "home-en.js").exists())
        self.assertFalse((self.public / "launch.css").exists())
        self.assertFalse((self.public / "living-canvas.js").exists())
        self.assertFalse((self.public / "story-paths.js").exists())
        self.assertTrue((self.public / "home.js").is_file())
        self.assertTrue((self.public / "cinema.js").is_file())
        self.assertTrue((self.public / "assets/examples/anatomia-mappa.png").is_file())
        self.assertFalse((self.public / "assets/examples/matematica-mappa.png").exists())
        self.assertFalse((self.public / "assets/views/view-mindmap.png").exists())
        for language in ("it", "en"):
            for view in ("mindmap", "orgchart", "tree", "network", "flow", "kanban", "timeline"):
                self.assertEqual((self.public / f"assets/views/{language}/view-{view}.png").read_bytes(), (Path(__file__).resolve().parents[2] / "apps/website/home-review" / f"assets/views/{language}/view-{view}.png").read_bytes())
            for subject in ("matematica", "project"):
                self.assertEqual((self.public / f"assets/examples/{language}/{subject}.png").read_bytes(), (Path(__file__).resolve().parents[2] / "apps/website/home-review" / f"assets/examples/{language}/{subject}.png").read_bytes())

        for css in self.public.glob("*.css"):
            for relative in re.findall(r'url\([\'"]?([^\)\'\"]+)', css.read_text()):
                self.assertTrue((css.parent / relative).is_file(), relative)

    def test_only_runtime_files_are_deployed_and_hidden_files_are_in_zip(self):
        self.assertEqual(list(self.public.rglob("*.json")), [])
        self.assertEqual(list(self.public.rglob("*.md")), [])
        with zipfile.ZipFile(self.archive) as bundle:
            self.assertIn("preview/1-HOME-FTP/.htpasswd-glauka-preview", bundle.namelist())
            self.assertIn("preview/2-CARTELLA-DEL-DOMINIO/anteprima/.htaccess", bundle.namelist())
        self.assertFalse((self.public / "media/glauka-demo.mp4").exists())
        self.assertFalse((self.public / "product-guide.js").exists())
        self.assertTrue((self.public / "ai-map.js").is_file())
        self.assertEqual([p.name for p in self.public.rglob("*.mp4")], ["glauka-studio-reel.mp4"])
        packaged = (self.public / "index.html").read_text()
        self.assertIn('<video id="cinema-video" preload="none"', packaged)
        self.assertIn("data-cinema", packaged)
        for name in ("work", "study", "ideas", "organize"):
            self.assertFalse((self.public / f"assets/{name}.png").exists())

    def test_rebuild_refuses_to_rotate_existing_credentials(self):
        private = self.output / "1-HOME-FTP/.htpasswd-glauka-preview"
        before = hashlib.sha256(private.read_bytes()).digest()
        with self.assertRaises(FileExistsError):
            build(self.output, "/home/exampleaccount")
        self.assertEqual(hashlib.sha256(private.read_bytes()).digest(), before)
        for bad in ("/home/test/../user", "/home/a\nRequire all granted", "exampleaccount", "/var/www"):
            with self.assertRaises(ValueError):
                apache_config(bad)


if __name__ == "__main__":
    unittest.main()
