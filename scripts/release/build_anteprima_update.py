"""Prepare a ready-to-upload Glauka update for an EXISTING /anteprima/.

No remote upload, password creation/rotation, or Apache changes.
Output contains OUTPUT/anteprima/ and OUTPUT/aggiornamento-anteprima.zip.
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlsplit
import zipfile

from package_website_preview import HOME_FILES, MEDIA_FILES, SITE, copy_privacy_notice


class LocalLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        for name, value in attrs:
            if name not in {"href", "src", "poster"} or not value:
                continue
            if value.startswith(("#", "data:", "mailto:", "tel:")):
                continue
            url = urlsplit(value)
            if not url.scheme and not url.netloc:
                self.paths.append(unquote(url.path))


def validate_links(target: Path) -> None:
    """Reject broken or escaping relative paths in both language versions."""
    for name in ("index.html", "home-en.html"):
        body = (target / name).read_text(encoding="utf-8")
        parser = LocalLinks()
        parser.feed(body)
        if "../" in body:
            raise ValueError(f"Nonportable parent path in {name}")
        for relative in parser.paths:
            linked = (target / relative).resolve()
            if not linked.is_relative_to(target.resolve()) or not linked.is_file():
                raise ValueError(f"Broken/escaping link in {name}: {relative}")
    for css in target.glob("*.css"):
        for raw in re.findall(r'''url\(\s*['"]?([^)'" ]+)''', css.read_text(encoding="utf-8")):
            if raw.startswith(("data:", "http:", "https:")):
                continue
            linked = (css.parent / raw.split("?")[0]).resolve()
            if not linked.is_relative_to(target.resolve()) or not linked.is_file():
                raise ValueError(f"Missing CSS asset {css.name}: {raw}")


def copy_website_contents(target: Path, site: Path = SITE) -> list[str]:
    target.mkdir(parents=True, exist_ok=False)
    copied: list[str] = []
    home = site / "home-review"
    for name in HOME_FILES:
        body = (home / name).read_text(encoding="utf-8")
        body = (body.replace("../assets/", "assets/")
                    .replace("../media/", "media/")
                    .replace("../release-config.js", "release-config.js")
                    .replace("../styles/", "styles/"))
        if name == "index.html":
            body = re.sub(r'<a\s+href="\.\./prisma-evolutions/">.*?</a>', "",
                          body, flags=re.S)
            body = body.replace("Anteprima locale del sito · Non ancora pubblicata",
                                "Anteprima privata · Sito in preparazione")
        (target / name).write_text(body, encoding="utf-8")
        copied.append(name)

    shutil.copyfile(site / "release-config.js", target / "release-config.js")
    copied.append("release-config.js")
    if (site / "styles").exists():
        shutil.copytree(site / "styles", target / "styles", dirs_exist_ok=True)
        for src in sorted((target / "styles").rglob("*")):
            if src.is_file():
                copied.append(src.relative_to(target).as_posix())

    for src in sorted((home / "assets").rglob("*")):
        if not src.is_file() or src.suffix.lower() not in {".png", ".svg"}:
            continue
        rel = src.relative_to(home)
        dst = target / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        copied.append(rel.as_posix())

    shutil.copytree(site / "assets" / "fonts", target / "assets" / "fonts")
    for src in sorted((target / "assets" / "fonts").rglob("*")):
        if src.is_file():
            copied.append(src.relative_to(target).as_posix())
    shutil.copyfile(site / "assets" / "glauka-mark.svg",
                    target / "assets" / "glauka-mark.svg")
    copied.append("assets/glauka-mark.svg")

    media = target / "media"
    media.mkdir()
    for name in MEDIA_FILES:
        shutil.copyfile(site / "media" / name, media / name)
        copied.append("media/" + name)
    copy_privacy_notice(target, site)
    copied.append("privacy/index.html")

    if any(p.name in {".htaccess", ".htpasswd", ".htpasswd-glauka-preview"}
           for p in target.rglob("*")):
        raise ValueError("A content update may never contain access files")
    validate_links(target)
    return copied


def build_update(output: Path, site: Path = SITE) -> tuple[Path, Path]:
    """Create update ZIP and contents, never overwriting an existing update."""
    output = Path(output).expanduser().resolve()
    folder = output / "anteprima"
    archive = output / "aggiornamento-anteprima.zip"
    if folder.exists() or archive.exists():
        raise FileExistsError("An update exists; choose a new output folder")
    output.mkdir(parents=True, exist_ok=True)
    try:
        copied = copy_website_contents(folder, site)
        with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED,
                             compresslevel=7) as zipped:
            for rel in copied:
                zipped.write(folder / rel, Path("anteprima") / rel)
        (output / "LEGGIMI-ANTEPRIMA.txt").write_text(
            "GLAUKA — AGGIORNAMENTO DELLA CARTELLA ANTEPRIMA\n\n"
            "Il pacchetto NON contiene password o file .htaccess.\n"
            "Non cancellare o sovrascrivere .htaccess su OVH.\n"
            "Non cambiare .htpasswd-glauka-preview nella HOME FTP.\n"
            "Lo ZIP e' un archivio: estrailo sul PC prima dell'FTP.\n"
            "Carica gli ELEMENTI dentro anteprima/ nella cartella OVH\n"
            "glauka.it/anteprima/ già esistente, senza creare una\n"
            "seconda sottocartella anteprima/anteprima/.\n"
            "Sovrascrivi soltanto HTML, CSS, JS e asset omonimi.\n"
            "Se manca la protezione, NON pubblicare i file.\n"
            "Dopo il caricamento verifica la password in navigazione\n"
            "privata per pagina, CSS e immagini.\n"
            "La pagina è senza video: esplora le schermate e le funzioni.\n",
            encoding="utf-8")
        return folder, archive
    except Exception:
        if folder.exists():
            shutil.rmtree(folder)
        if archive.exists():
            archive.unlink()
        raise


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--output", required=True, type=Path,
                    help="Fresh local folder outside the live hosting")
    args = ap.parse_args()
    folder, archive = build_update(args.output)
    print("Cartella pronta:", folder)
    print("Archivio per OVH:", archive)
    print("No remote upload; existing password and Apache settings unchanged.")
