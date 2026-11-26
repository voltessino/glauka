"""Build the selected Glauka home for an OVH password-protected /anteprima/ directory.

Credentials are generated only in the output directory, never in the repository.
The FTP home path must be copied from the hosting panel, independently of the domain document root.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import zipfile

REPO = Path(__file__).resolve().parents[2]
SITE = REPO / "apps" / "website"
HOME_FILES = (
    "index.html",
    "home-en.html",
    "home.css",
    "home.js",
    "ai-map.js",
    "glauka-home-audit.js",
    "cinema.js",
    "faq.js",
    "release-status.js",
    "wiki.css",
    "wiki.js",
)
WIKI_PAGES = (
    "guida/index.html",
    "guide/index.html",
)
MEDIA_FILES = (
    "glauka-studio-reel.mp4",
    "glauka-studio-reel.png",
    "glauka-studio-reel.it.vtt",
    "glauka-studio-reel.en.vtt",
)


def copy_privacy_notice(public: Path, site: Path = SITE) -> None:
    """Ship the real privacy page beside the home, not a missing /privacy.html."""
    folder = public / "privacy"
    folder.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(site / "privacy" / "index.html", folder / "index.html")


def apache_config(ftp_home: str) -> str:
    if not re.fullmatch(r"/home/[A-Za-z0-9_-]+", ftp_home):
        raise ValueError("Use the FTP home shown by OVH, e.g. /home/account")
    return f'''# Private preview only; install inside the domain's anteprima directory.
Options -Indexes
DirectoryIndex index.html
AuthType Basic
AuthName "Glauka - Anteprima privata"
AuthBasicProvider file
AuthUserFile "{ftp_home}/.htpasswd-glauka-preview"
Require valid-user

# Fail closed unless Apache itself confirms HTTPS. A client can forge
# X-Forwarded-Proto; a trusted TLS proxy must enforce HTTPS at the edge.
<If "%{{HTTPS}} != 'on'">
    Require all denied
</If>
ErrorDocument 403 "Apri l'anteprima con HTTPS: https://glauka.it/anteprima/"

<FilesMatch "^\\.">
    Require all denied
</FilesMatch>
<IfModule mod_headers.c>
    Header always set X-Robots-Tag "noindex, nofollow, nosnippet"
    Header always set Cache-Control "private, no-store"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Content-Security-Policy "frame-ancestors 'none'"
</IfModule>
'''


def rewrite_public_paths(content: str) -> str:
    return (
        content.replace("../assets/", "assets/")
        .replace("../media/", "media/")
        .replace("../release-config.js", "release-config.js")
        .replace("../styles/", "styles/")
    )


def rewrite_wiki_page(content: str) -> str:
    """Guide pages live one folder down, so parent links stay inside the site."""
    return (
        content.replace("../../assets/", "../assets/")
        .replace("../../styles/", "../styles/")
        .replace("../../media/", "../media/")
    )


def build(output: Path, ftp_home: str, site: Path = SITE) -> Path:
    config = apache_config(ftp_home)
    output = Path(output)
    archive = output.with_suffix(".zip")
    # A generated password or its ZIP must never become a repository artifact.
    if any(path.resolve().is_relative_to(REPO.resolve()) for path in (output, archive)):
        raise ValueError("Private preview credentials must be generated outside the repository")
    if output.exists() or archive.exists():
        raise FileExistsError("Preview directory or ZIP already exists; refusing to rotate credentials")
    output.mkdir(parents=True, mode=0o700)
    password = secrets.token_urlsafe(18)
    encoded = subprocess.run(
        ["openssl", "passwd", "-apr1", "-stdin"], input=(password + "\n").encode(),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True,
    ).stdout.decode().strip()
    if not encoded.startswith("$apr1$"):
        raise RuntimeError("Unexpected Apache password hash format")
    credentials = output / "1-HOME-FTP"
    public = output / "2-CARTELLA-DEL-DOMINIO" / "anteprima"
    credentials.mkdir(parents=True)
    public.mkdir(parents=True)
    (credentials / ".htpasswd-glauka-preview").write_text("anteprima:" + encoded + "\n")
    (credentials / ".htpasswd-glauka-preview").chmod(0o600)
    for name in HOME_FILES:
        content = rewrite_public_paths((site / "home-review" / name).read_text())
        if name == "index.html":
            content = re.sub(r'<a\s+href="\.\./prisma-evolutions/">.*?</a>', "", content, flags=re.S)
            content = content.replace("Anteprima locale del sito · Non ancora pubblicata", "Anteprima privata · Sito in preparazione")
        (public / name).write_text(content, encoding="utf-8")
    home = site / "home-review"
    for name in WIKI_PAGES:
        target = public / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(rewrite_wiki_page((home / name).read_text(encoding="utf-8")), encoding="utf-8")
    shutil.copyfile(site / "release-config.js", public / "release-config.js")
    if (site / "styles").exists():
        shutil.copytree(site / "styles", public / "styles", dirs_exist_ok=True)
    for source in sorted((site / "home-review" / "assets").rglob("*")):
        if not source.is_file() or source.suffix.lower() not in {".png", ".svg"}:
            continue
        target = public / "assets" / source.relative_to(site / "home-review" / "assets")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    shutil.copytree(site / "assets" / "fonts", public / "assets" / "fonts")
    shutil.copyfile(site / "assets" / "glauka-mark.svg", public / "assets" / "glauka-mark.svg")
    (public / "media").mkdir()
    for name in MEDIA_FILES:
        shutil.copyfile(site / "media" / name, public / "media" / name)
    copy_privacy_notice(public, site)
    from build_anteprima_update import validate_links
    validate_links(public)
    (public / ".htaccess").write_text(config)
    (output / "ACCESSO-ANTEPRIMA.txt").write_text(
        "ACCESSO PRIVATO ALL'ANTEPRIMA\n\n"
        "Indirizzo: https://glauka.it/anteprima/\n"
        "Nome utente: anteprima\nPassword: " + password + "\n\n"
        "Queste sono le credenziali dell'anteprima, diverse da quelle del tuo account OVH.\n"
        "Conserva questo file sul tuo PC: non caricarlo nello spazio del sito.\n"
    )
    (output / "ACCESSO-ANTEPRIMA.txt").chmod(0o600)
    (output / "ISTRUZIONI.txt").write_text(f'''GLAUKA — ANTEPRIMA PRIVATA SUL TUO DOMINIO

Il pacchetto non è stato caricato online. È il sito selezionato, pronto per una
cartella separata e protetta. Non serve installare Node.js o un CMS sull'hosting.

1. Estrai questo ZIP sul tuo PC.

2. In OVH, apri I miei siti e controlla la Cartella root della riga glauka.it.
   Annota quel valore: spesso è www, ma va verificato nel tuo pannello.
   L'hosting deve avere SSL attivo per glauka.it.

3. Torna alla sezione FTP e SSH e apri FTP Explorer.
   Vai nella HOME FTP ({ftp_home}), risalendo alla cartella iniziale se serve.
   La HOME FTP non è la cartella web del dominio. Carica QUI il file contenuto
   in 1-HOME-FTP: .htpasswd-glauka-preview.
   Il suo percorso finale deve essere: {ftp_home}/.htpasswd-glauka-preview.
   Se il tuo computer nasconde il file, abilita la visualizzazione dei file nascosti.

4. In FTP Explorer entra nella Cartella root del dominio, letta al punto 2.
   Al suo interno carica la cartella anteprima contenuta in
   2-CARTELLA-DEL-DOMINIO. Mantieni le sottocartelle assets e media.
   Carica anche .htaccess, il file nascosto dentro anteprima: serve per la password.
   ESEMPIO, soltanto se Cartella root = www:
       {ftp_home}/www/anteprima/index.html
       {ftp_home}/www/anteprima/.htaccess
       {ftp_home}/www/anteprima/assets/...
       {ftp_home}/www/anteprima/media/...
   Non caricare nel sito la cartella 1-HOME-FTP, queste istruzioni o il file
   ACCESSO-ANTEPRIMA.txt. Non sostituire index.html nella root del dominio.
   Se FTP Explorer non permette il caricamento di cartelle, usa un client SFTP
   con i parametri del pannello OVH e la stessa struttura dei percorsi.

5. Apri https://glauka.it/anteprima/ in una finestra privata del browser.
   Deve comparire la richiesta di nome utente e password.
   Trovi i dati nel file ACCESSO-ANTEPRIMA.txt, rimasto sul tuo PC.
   Dopo l'accesso puoi navigare il sito, provare i selettori e guardare il video.

La protezione Apache si applica anche a immagini, video e sottocartelle.
L'anteprima invia inoltre noindex ai motori di ricerca; il noindex da solo non
sostituisce la password. La versione normale di glauka.it non viene modificata.

Se compare 500: controlla che .htpasswd-glauka-preview sia nella HOME FTP e
che il percorso in .htaccess corrisponda al pannello. Se compare 404: controlla
la Cartella root del dominio e che index.html sia proprio dentro anteprima.
Se compare 403 anche in HTTPS: l'hosting potrebbe terminare TLS su un proxy.
Richiedi al provider un segnale HTTPS autenticato e l'obbligo di HTTPS al proxy,
impedendo accesso diretto HTTP all'origine. Non fidarti del solo header
X-Forwarded-Proto inviato dal browser, e non disattivare il blocco.
Prima di considerarla privata verifica sempre la richiesta di accesso da una
finestra privata, sia sulla pagina che su un'immagine o sul video.
''')
    # Exclusive creation prevents a concurrent process from replacing an existing
    # private archive; POSIX mode 0600 protects the credential-bearing ZIP.
    fd = os.open(archive, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as stream:
        with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as bundle:
            for file in sorted(output.rglob("*")):
                if file.is_file():
                    bundle.write(file, Path(output.name) / file.relative_to(output))
    return archive


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--ftp-home", required=True)
    args = parser.parse_args()
    archive = build(args.output, args.ftp_home)
    print("Private preview package:", archive)
    print("Credentials are in ACCESSO-ANTEPRIMA.txt inside the package; no remote upload performed.")
