"""Build a Glauka MSIX from a public Windows Release executable.

The package is the Store candidate. A local test certificate, when requested,
is written beside the package and is not installed as a trusted Windows root.
"""

from __future__ import annotations

import argparse
import json
import shutil
import struct
import subprocess
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = ROOT / "apps/windows/msix/AppxManifest.xml"
IDENTITY = ROOT / "apps/windows/msix/identity.json"
FORBIDDEN = (
    b"BEGIN PRIVATE",
    b"BEGIN EC PRIVATE",
    b"Glauka License Manager",
    b"production.glkkey",
)


def public_windows_version(root: Path = ROOT) -> str:
    version = json.loads((root / "versions.json").read_text(encoding="utf-8"))["windows"]
    if version.get("edition") != "Release":
        raise ValueError("La versione Windows pubblica non è marcata Release.")
    return version["version"]


def msix_version(version: str, revision: int = 0) -> str:
    parts = version.split(".")
    if len(parts) != 3 or any(not part.isdigit() for part in parts):
        raise ValueError("MSIX accetta solo un numero Major.Minor.Build, per esempio 1.0.1.")
    if not isinstance(revision, int) or isinstance(revision, bool) or revision < 0 or revision > 65535:
        raise ValueError("Revisione MSIX fuori dai limiti (0-65535).")
    numbers = [int(part) for part in parts]
    if any(number < 0 or number > 65535 for number in numbers):
        raise ValueError("Componente di versione fuori dai limiti MSIX.")
    return f"{numbers[0]}.{numbers[1]}.{numbers[2]}.{revision}"


def load_identity(path: Path = IDENTITY, *, store: bool = False) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    required = ("packageName", "publisher", "publisherDisplayName")
    if any(not str(data.get(key, "")).strip() for key in required):
        raise ValueError("Identità MSIX incompleta.")
    if "Developer" in data["packageName"] or "Developer" in data["publisherDisplayName"]:
        raise ValueError("Il pacchetto pubblico non può chiamarsi Developer.")
    publisher = data["publisher"]
    if store and ("Local Test" in publisher or not str(data.get("storeListingUrl", "")).startswith("https://apps.microsoft.com/")):
        raise ValueError("Per lo Store servono l'editore del Partner Center e la pagina ufficiale.")
    return data


def render_manifest(identity: dict, version: str, revision: int = 0) -> str:
    text = TEMPLATE.read_text(encoding="utf-8")
    values = {
        "__NAME__": identity["packageName"],
        "__PUBLISHER__": identity["publisher"],
        "__PUBLISHER_DISPLAY__": identity["publisherDisplayName"],
        "__VERSION__": msix_version(version, revision),
    }
    for key, value in values.items():
        if any(char in value for char in "<>&\"'"):
            raise ValueError("Valore di identità non utilizzabile nel manifest.")
        text = text.replace(key, value)
    if "__" in text or "Developer" in text:
        raise ValueError("Manifest incompleto o marcato Developer.")
    for required in ("runFullTrust", ".gk", ".glk", ".neuromap", "ExcludedDirectory", "NeuroMap Architect", "ExcludedKey"):
        if required not in text:
            raise ValueError("Manifest privo di un requisito Store.")
    return text


def _png(width: int, height: int, rgba: tuple[int, int, int, int]) -> bytes:
    row = b"\x00" + bytes(rgba) * width
    return _png_from_raw(width, height, row * height)


def _segment_distance(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
    dx, dy = x2 - x1, y2 - y1
    length = dx * dx + dy * dy
    if length == 0:
        return ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length))
    return ((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2) ** 0.5


def _mark_png(width: int, height: int) -> bytes:
    """The real Glauka mark: three outlined squares joined by two branches."""
    side = min(width, height)
    pad = side * 0.16
    scale = (side - 2 * pad) / 30
    ox = (width - 30 * scale) / 2
    oy = (height - 30 * scale) / 2
    strokes = []
    for x, y, w, h in ((5.76, 8.28, 5.88, 5.88), (18.36, 4.08, 5.88, 5.88), (18.36, 19.2, 5.88, 5.88)):
        corners = ((x, y), (x + w, y), (x + w, y + h), (x, y + h))
        strokes.extend((*corners[i], *corners[(i + 1) % 4]) for i in range(4))
    strokes.extend(((11.64, 10.8, 18.36, 6.6), (11.64, 10.8, 18.36, 21.72)))
    paper, ink = (255, 255, 255), (100, 65, 223)
    raw = bytearray()
    for py in range(height):
        raw.append(0)
        for px in range(width):
            red = green = blue = 0
            for sy in (0.25, 0.75):
                for sx in (0.25, 0.75):
                    vx = (px + sx - ox) / scale
                    vy = (py + sy - oy) / scale
                    on_mark = min(_segment_distance(vx, vy, *segment) for segment in strokes) <= 0.95
                    color = ink if on_mark else paper
                    red += color[0]
                    green += color[1]
                    blue += color[2]
            raw.extend((red // 4, green // 4, blue // 4, 255))
    return _png_from_raw(width, height, bytes(raw))


def _png_from_raw(width: int, height: int, raw: bytes) -> bytes:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def write_icons(folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    images = {
        "StoreLogo.png": (50, 50),
        "Square44x44Logo.png": (44, 44),
        "Square150x150Logo.png": (150, 150),
        "Wide310x150Logo.png": (310, 150),
    }
    for name, size in images.items():
        (folder / name).write_bytes(_mark_png(*size))


def assert_layout_clean(folder: Path) -> None:
    for path in folder.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() in {".pem", ".key", ".pfx", ".glkkey"}:
            raise ValueError(f"File non ammesso nel pacchetto: {path.name}")
        if path.stat().st_size > 80_000_000:
            continue
        data = path.read_bytes()
        for marker in FORBIDDEN:
            if marker in data:
                raise ValueError("Il pacchetto contiene materiale privato o il License Manager.")


def executable_is_public_release(executable: Path) -> None:
    if "Developer" in executable.name:
        raise ValueError("Il pacchetto Store non può partire da una build Developer.")
    try:
        import ctypes
        from ctypes import wintypes
    except ImportError:
        return
    if not hasattr(ctypes, "windll"):
        return
    size = ctypes.windll.version.GetFileVersionInfoSizeW(str(executable), None)
    if not size:
        return
    buffer = ctypes.create_string_buffer(size)
    if not ctypes.windll.version.GetFileVersionInfoW(str(executable), 0, size, buffer):
        return
    value = ctypes.c_void_p()
    length = wintypes.UINT()
    translations = None
    if ctypes.windll.version.VerQueryValueW(buffer, "\\VarFileInfo\\Translation", ctypes.byref(value), ctypes.byref(length)):
        translations = ctypes.string_at(value.value, length.value)
    language = "040904B0"
    if translations and len(translations) >= 4:
        language = f"{int.from_bytes(translations[0:2], 'little'):04x}{int.from_bytes(translations[2:4], 'little'):04x}"
    name = ctypes.c_wchar_p()
    query = f"\\StringFileInfo\\{language}\\ProductName"
    if ctypes.windll.version.VerQueryValueW(buffer, query, ctypes.byref(name), ctypes.byref(length)) and name.value:
        if "Developer" in name.value:
            raise ValueError("L'eseguibile è marcato Developer.")


def stage_layout(executable: Path, layout: Path, identity: dict, version: str, revision: int = 0) -> None:
    if "Developer" in executable.name:
        raise ValueError("Il pacchetto Store non può partire da una build Developer.")
    if layout.exists():
        shutil.rmtree(layout)
    layout.mkdir(parents=True)
    shutil.copy2(executable, layout / "Glauka.exe")
    write_icons(layout / "Assets")
    (layout / "AppxManifest.xml").write_text(render_manifest(identity, version, revision), encoding="utf-8")
    assert_layout_clean(layout)
    executable_is_public_release(layout / "Glauka.exe")


def find_tool(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    roots = [Path(r"C:\Program Files (x86)\Windows Kits\10\bin"), Path(r"C:\Program Files\Windows Kits\10\bin")]
    for root in roots:
        if not root.is_dir():
            continue
        matches = sorted(root.glob(f"**/x64/{name}"), reverse=True)
        if matches:
            return str(matches[0])
    return None


def pack(layout: Path, package: Path, makeappx: str) -> None:
    package.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([makeappx, "pack", "/d", str(layout), "/p", str(package), "/o"], check=True)


def sign_for_local_test(package: Path, signtool: str, certificate: Path, password: str) -> None:
    """Sign with a file certificate. Do not add it to the trusted Windows store."""
    subprocess.run(
        [signtool, "sign", "/fd", "SHA256", "/f", str(certificate), "/p", password, str(package)],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Crea il pacchetto MSIX di Glauka.")
    parser.add_argument("executable", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--store", action="store_true", help="Richiede l'identità ufficiale del Partner Center.")
    parser.add_argument("--revision", type=int, default=0, help="Quarto numero MSIX opzionale (0-65535) per aggiornamenti Store.")
    parser.add_argument("--version", default="", help="Versione Major.Minor.Build esplicita per il manifest MSIX (es. 1.0.5).")
    args = parser.parse_args()
    identity = load_identity(store=args.store)
    version = args.version.strip() or public_windows_version()
    package_tag = f"{version}.{args.revision}" if args.revision else version
    layout = args.destination / "layout"
    package = args.destination / f"Glauka-{package_tag}-Release.msix"
    stage_layout(args.executable, layout, identity, version, args.revision)
    tool = find_tool("makeappx.exe")
    if not tool:
        raise SystemExit("makeappx.exe non è installato. Il layout è pronto, il pacchetto MSIX no.")
    pack(layout, package, tool)
    print(package)


if __name__ == "__main__":
    main()
