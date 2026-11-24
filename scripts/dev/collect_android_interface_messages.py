"""Collect static Android UI messages for the offline catalog; never read projects."""
from pathlib import Path
from html.parser import HTMLParser
import ast
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
LOCALES = ROOT / 'packages/editor-ui/locales'
LITERAL = re.compile(r'''"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`''')


def candidate(text):
    text = text.strip()
    if re.fullmatch(r"[Mm][0-9\s.,+\-MmLlHhVvCcSsQqTtAaZzEe]+", text):
        return False  # SVG path data is code, not interface text.
    if not 2 <= len(text) <= 700 or not re.search(r'[A-Za-zÀ-ž]', text):
        return False
    if re.search(r'[<>{}=;\\]|https?://|application/|text/|image/|^[/#.\[]', text):
        return False
    if re.search(r'\b(?:const|function|return|document|window|querySelector)\b', text):
        return False
    return bool(re.search(r'\s|[À-ž]', text) or re.fullmatch(r'[A-Z][a-zA-ZÀ-ž]+', text))


class UIParser(HTMLParser):
    def __init__(self, emit):
        super().__init__()
        self.emit = emit
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
        for name, value in attrs:
            if name in ('title', 'placeholder', 'aria-label', 'alt') and value:
                self.emit(value)

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, text):
        if not self.skip:
            self.emit(text)


def invalidate_generated(source, previous, folder=LOCALES):
    """An explicit UI pair supersedes old translations guessed from Italian."""
    changed={key for key,entry in source['entries'].items() if key in previous and
             previous[key]!=(entry.get('en'),entry.get('known',False))}
    reviewed_path=folder/'reviewed-terms.json'
    reviewed=json.loads(reviewed_path.read_text()) if reviewed_path.exists() else {}
    removed=0
    for language in source['languages']:
        code=language['code']
        if code in ('it','en'):continue
        path=folder/(code+'.json')
        if not path.exists():continue
        pack=json.loads(path.read_text());before=len(pack)
        for key in changed:
            if code not in reviewed.get(key,{}):pack.pop(key,None)
        if len(pack)!=before:
            removed+=before-len(pack);path.write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n')
    return removed


def collect():
    source = json.loads((LOCALES/'source.json').read_text())
    old_count = len(source['entries'])
    previous={key:(entry.get('en'),entry.get('known',False)) for key,entry in source['entries'].items()}
    files = list((ROOT/'apps/android/editor').glob('*.js'))
    files += list((ROOT/'apps/android/native/app/src/main/assets/assets').glob('mobile*.js'))
    files += list((ROOT/'apps/android/native/app/src/main/java').rglob('*.java'))
    files += [ROOT/'apps/desktop-shared/src/cloud_panel.js', ROOT/'apps/desktop-shared/src/cloud_library_ui.js', ROOT/'apps/desktop-shared/editor/knowledge-db-ui.js',ROOT/'packages/editor-ui/creative-markers.js',ROOT/'packages/editor-ui/workspace-tools.js',ROOT/'packages/editor-ui/node-text-tools.js',ROOT/'packages/editor-ui/gentle-motion.js',ROOT/'packages/editor-ui/workspace-recovery.js',ROOT/'packages/editor-ui/save-status.js',ROOT/'packages/editor-ui/study-today.js',ROOT/'packages/editor-ui/lifecycle.js']
    files += [ROOT/'packages/editor-ui/map-style-gallery.js', ROOT/'packages/editor-ui/orbit-workspace.js']
    files += [ROOT/'apps/android/native/app/src/main/assets/app/index.html', ROOT/'packages/editor-ui/android-languages.js']
    paired_files = set()
    for folder in [ROOT/'packages/editor-ui', ROOT/'packages/editor-ui/editor-shared', ROOT/'apps/desktop-shared/editor', ROOT/'apps/desktop-shared/src', ROOT/'apps/android/native/app/src/main/assets/assets']:
        paired_files.update(path for path in folder.glob('*.js') if path.name != 'interface-languages.js' and path not in files)
    files += sorted(paired_files)
    for file in files:
        origin = str(file.relative_to(ROOT))
        def emit(raw):
            text = raw.strip()
            if not candidate(text) or text in source['aliases']:
                return
            key = 'm'+hashlib.sha256(text.encode()).hexdigest()[:12]
            source['entries'][key] = {'it':text, 'en':text, 'known':False, 'origins':[origin]}
            source['aliases'][text] = key
        contents = file.read_text()
        # Explicit UI pairs are authoritative even when punctuation resembles code.
        literal = r"""(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')"""
        pairs = re.compile(r'\b(?:tr|t|pair|message)\(\s*('+literal+r')\s*,\s*('+literal+r')')
        for match in pairs.finditer(contents):
            try:
                it,en = map(ast.literal_eval,match.groups())
            except (ValueError,SyntaxError):
                continue
            if it == en:
                continue
            it,en = it.strip(),en.strip()
            key = source['aliases'].get(it) or source['aliases'].get(en) or 'm'+hashlib.sha256(it.encode()).hexdigest()[:12]
            origins = sorted(set(source['entries'].get(key,{}).get('origins',[])+[origin]))
            if source['entries'].get(key,{}).get('known'):
                source['entries'][key]['origins'] = origins
                source['aliases'].setdefault(it,key)
                source['aliases'].setdefault(en,key)
                continue
            source['entries'][key] = {'it':it,'en':en,'known':True,'origins':origins}
            source['aliases'][it] = key
            source['aliases'][en] = key
        if file in paired_files:
            continue
        if file.suffix == '.html':
            UIParser(emit).feed(contents)
        else:
            for match in LITERAL.finditer(contents):
                token = match.group()
                try:
                    raw = token[1:-1] if token.startswith('`') else ast.literal_eval(token)
                except (ValueError, SyntaxError):
                    continue
                if '<' in raw and '>' in raw:
                    UIParser(emit).feed(raw)
                elif '${' not in raw:
                    emit(raw)
    invalidated=invalidate_generated(source,previous)
    if invalidated:print(f'Canonical UI text changed: {invalidated} generated translations will be refreshed')
    (LOCALES/'source.json').write_text(json.dumps(source, ensure_ascii=False, indent=2)+'\n')
    print(f'Android static messages added: {len(source["entries"])-old_count}; total: {len(source["entries"])}')


if __name__ == '__main__':
    collect()
