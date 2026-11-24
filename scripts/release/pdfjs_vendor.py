#!/usr/bin/env python3
"""Fetch and verify one pinned, Apache-2.0 PDF.js distribution at packaging time.

End-user PDF parsing is fully offline. No CDN or remote PDF requests at runtime.
Uses only Python's standard library; no paid API, Node installation, or GitHub Actions.
"""
from __future__ import annotations
import base64
import hashlib
import io
import os
from pathlib import Path
import shutil
import tarfile
import urllib.request

VERSION = "6.4.299"
URL = f"https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-{VERSION}.tgz"
SRI = "sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g=="
FILES = {
    # Official Mozilla minified legacy ESM builds plus official image/color WASM
    # and no-WASM decoders so CCITT/JBIG2/JPEG2000/ICC scanned PDFs render cleanly offline.
    "legacy/build/pdf.min.mjs": "pdf.mjs",
    "legacy/build/pdf.worker.min.mjs": "pdf.worker.mjs",
    "wasm/jbig2.wasm": "wasm/jbig2.wasm",
    "wasm/openjpeg.wasm": "wasm/openjpeg.wasm",
    "wasm/qcms_bg.wasm": "wasm/qcms_bg.wasm",
    "wasm/jbig2_nowasm_fallback.js": "wasm/jbig2_nowasm_fallback.js",
    "wasm/openjpeg_nowasm_fallback.js": "wasm/openjpeg_nowasm_fallback.js",
    "LICENSE": "LICENSE.txt",
}
MAX_ARCHIVE = 28 * 1024 * 1024
MAX_ASSET = 15 * 1024 * 1024


def _check(blob: bytes) -> None:
    if len(blob) > MAX_ARCHIVE or not hashlib.sha512(blob).digest() == base64.b64decode(SRI.partition("-")[2]):
        raise ValueError("PDF.js tarball hash/size mismatch; refusing an unverified dependency")


def unpack(blob: bytes) -> dict[str, bytes]:
    _check(blob)
    result = {}
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as tar:
        for source, name in FILES.items():
            entry = tar.getmember("package/" + source)
            if not entry.isfile() or entry.size < 128 or entry.size > MAX_ASSET:
                raise ValueError("Missing or oversized PDF.js distribution asset: " + name)
            handle = tar.extractfile(entry)
            if handle is None:
                raise ValueError("Unreadable PDF.js distribution file: " + name)
            data = handle.read(MAX_ASSET + 1)
            if len(data) != entry.size:
                raise ValueError("Truncated PDF.js distribution file: " + name)
            result[name] = data
    return result


def stage(directory: Path, cache: Path | None = None, fetcher=None) -> Path:
    directory = Path(directory)
    if directory.exists():
        raise FileExistsError(f"PDF.js destination already exists: {directory}")
    cache_root = Path(os.environ.get("XDG_CACHE_HOME") or Path.home() / ".cache")
    cache = Path(cache or cache_root / "neuromap" / ("pdfjs-dist-" + VERSION + ".tgz"))
    fetcher = fetcher or _download
    if cache.is_file():
        blob = cache.read_bytes()
    else:
        blob = fetcher(URL)
        _check(blob)
        cache.parent.mkdir(parents=True, exist_ok=True)
        temp = cache.with_name(cache.name + ".tmp")
        temp.write_bytes(blob)
        temp.replace(cache)
    outputs = unpack(blob)
    directory.mkdir(parents=True)
    for name, data in outputs.items():
        out_path = directory / name
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(data)
    (directory / "LICENSE-NOTICE.txt").write_text(
        "PDF.js (pdfjs-dist) " + VERSION +
        "\\nCopyright 2012 Mozilla Foundation\\nLicense: Apache-2.0\\n" +
        "Source: https://github.com/mozilla/pdf.js\\n" +
        "Tarball: " + URL + "\\n" +
        "Integrity: " + SRI + "\\n" +
        "See: https://www.apache.org/licenses/LICENSE-2.0\\n",
        encoding="utf-8",
    )
    return directory


def _download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "NeuroMap PDF.js offline release bundler"})
    with urllib.request.urlopen(request, timeout=50) as response:
        if not response.url.startswith("https://") or response.status != 200:
            raise ValueError("Non-HTTPS PDF.js registry redirect or invalid HTTP response")
        blob = response.read(MAX_ARCHIVE + 1)
        _check(blob)
        return blob


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    print(stage(args.destination))
