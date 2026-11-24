"""Zero-network tests for the pinned PDF.js 6.x release bundler."""
from __future__ import annotations
import io
from pathlib import Path
import tarfile
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
from pdfjs_vendor import FILES, MAX_ARCHIVE, SRI, VERSION, stage, unpack


def archive(*, without=None):
    out=io.BytesIO()
    with tarfile.open(fileobj=out, mode="w:gz") as tar:
        for source in FILES:
            if source==without:
                continue
            payload=("-" * 160 + source).encode()
            info=tarfile.TarInfo(name="package/"+source)
            info.size=len(payload)
            tar.addfile(info,io.BytesIO(payload))
        # Forged extra files must NEVER be unpacked.
        evil=b"ignore"
        extra=tarfile.TarInfo(name="package/../../outside.js")
        extra.size=len(evil)
        tar.addfile(extra,io.BytesIO(evil))
    return out.getvalue()


class PdfJsVendorTests(TestCase):
    def test_default_cache_honors_xdg_without_writing_home(self):
        with TemporaryDirectory() as root:
            folder=Path(root)
            with patch.dict("os.environ", {"XDG_CACHE_HOME": str(folder / "cache")}):
                with patch("pdfjs_vendor._check",return_value=None):
                    stage(folder / "out", fetcher=lambda _: archive())
            self.assertTrue((folder / "cache" / "neuromap" / ("pdfjs-dist-" + VERSION + ".tgz")).is_file())

    def test_latest_pinned_package_has_real_integrity_and_offline_modules(self):
        self.assertEqual(VERSION,"6.4.299")
        self.assertTrue(SRI.startswith("sha512-"))
        self.assertEqual(
            sorted(FILES.values()),
            [
                "LICENSE.txt",
                "pdf.mjs",
                "pdf.worker.mjs",
                "wasm/jbig2.wasm",
                "wasm/jbig2_nowasm_fallback.js",
                "wasm/openjpeg.wasm",
                "wasm/openjpeg_nowasm_fallback.js",
                "wasm/qcms_bg.wasm",
            ],
        )
        self.assertIn('legacy/build/pdf.min.mjs',FILES)
        self.assertIn('legacy/build/pdf.worker.min.mjs',FILES)
        self.assertNotIn('legacy/build/pdf.mjs',FILES)
        self.assertNotIn('legacy/build/pdf.worker.mjs',FILES)

    def test_no_network_when_verified_archive_is_cached(self):
        with TemporaryDirectory() as root:
            folder=Path(root)
            cached=folder/"pdfjs.tgz"
            cached.write_bytes(archive())
            with patch("pdfjs_vendor._check",return_value=None):
                dest=stage(folder/"out",cache=cached,
                    fetcher=lambda _:self.fail("Network requested despite local cache"))
            self.assertTrue((dest/"pdf.mjs").is_file())
            self.assertTrue((dest/"pdf.worker.mjs").is_file())
            self.assertTrue((dest/"LICENSE.txt").is_file())
            self.assertFalse((folder/"outside.js").exists())
            with self.assertRaises(FileExistsError):
                stage(dest,cache=cached)

    def test_corrupt_archive_fails_closed_without_creating_bundle(self):
        with TemporaryDirectory() as root:
            folder=Path(root);cached=folder/"broken.tgz"
            cached.write_bytes(b"bad")
            with self.assertRaises(ValueError):
                stage(folder/"out",cache=cached)
            self.assertFalse((folder/"out").exists())

    def test_missing_worker_is_rejected_without_partial_install(self):
        with TemporaryDirectory() as root:
            folder=Path(root);cached=folder/"partial.tgz"
            cached.write_bytes(archive(without="legacy/build/pdf.worker.min.mjs"))
            with patch("pdfjs_vendor._check",return_value=None):
                with self.assertRaises(KeyError):
                    stage(folder/"out",cache=cached)
            self.assertFalse((folder/"out").exists())
