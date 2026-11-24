"""Presentation audit over the real Android prepare() closure, without rewriting text."""
from pathlib import Path
from html.parser import HTMLParser
import argparse,collections,json,re,subprocess,sys,hashlib
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from android_touch_inventory import ROOT,inventory
# Broad discovery includes legitimate key names and action labels; strict guidance is narrower.
MOD=r'(?:ctrl\.?|control|cmd|command|alt|shift|strg|umschalt|mai?usc|maj|may[uú]s)'
STRICT=re.compile(r'(?:⌘|contr[oô]le\s*[+＋/]|(?<![A-Za-z0-9_])'+MOD+r'\s*(?:[+＋/]|[-–](?=(?:[a-z0-9]|F(?:[1-9]|1[0-2]))\b)|(?=\s+[a-z0-9]\b))|\bF(?:[1-9]|1[0-2])\b|tasto\s+destro|right[ -]?click|rotellina|mouse\s*wheel|doppio\s+clic|double[ -]?click|clic\s+(?:droit|derecho)|mausrad|rechte\s+maustaste|molette|rueda\s+del\s+rat[oó]n|bot[aã]o\s+direito|roda\s+do\s+mouse|鼠标右键|滚轮|عجلة\s+الماوس|زر\s+الفأرة\s+الأيمن|\b(?:Esc|Escape|Invio|Enter)\s*(?:[:：]|(?:per|to|termina|exits|naviga|teletrasporta)\b)|\bTab\s+(?:per|to)\b|\b(?:ctrl|control|cmd|command|alt|shift|strg|umschalt|mai?usc|maj|may[uú]s)\s+(?:clic(?:k)?|mouse|enter|invio|tab|delete|canc)\b|\b(?:premi|press|presione|dr[uü]cken|appuyez|pressione)\s+(?:Ins|Insert|Canc|Delete|Entf|Suppr|Supr)\b|\b(?:Canc|Delete|Entf|Suppr|Supr)\s+(?:elimina|deletes?|pour|per|to)\b|(?:控制|命令|上档|换档|كنترول|كونترول|شيفت|ألت)\s*[+＋/])',re.I)
STRICT=re.compile(STRICT.pattern+r'|tasto\s+(?:dx|sinistro|centrale)|right\s+mouse\s+button|left[ -]click|middle[ -]click|mouse\s+button|survol(?:ez|er)|hover\s+(?:over|to)|passa\s+(?:il\s+mouse|sopra)|doppio\s+click|double\s+clic|pulsa\s+(?:Enter|Supr)|appuyez\s+sur\s+(?:Entrée|Suppr)|pressione\s+(?:Enter|Delete)|按下\s*(?:回车|删除)|اضغط\s+على\s+(?:Enter|Delete)',re.I)
RAW=re.compile(STRICT.pattern+r'|\b(?:Ins|Insert|Canc|Delete|Entf|Suppr|Supr|Esc|Escape|Invio|Enter|Tab)\b|(?:tast[oa]|tecla|key|touche)\s+(?:Control|Shift|Alt)|(?:控制|命令|删除|上档)键',re.I)
TOKENS=re.compile(r'(?P<comment>//[^\n]*|/\*[\s\S]*?\*/)|(?P<string>"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`)',re.S)
FALLBACKS={
 'apps/desktop-shared/editor/wiki-links-ui.js':['Nota salvata. Ctrl+Z per annullare.','Note saved. Ctrl+Z to undo.'],
 'apps/desktop-shared/editor/knowledge-db-ui.js':['Proprietà associate al nodo, senza duplicazioni. Salva per confermare; Ctrl+Z per annullare.'],
 'packages/editor-ui/creative-inspector.js':['Invio: nuova voce · Ctrl+Invio: conferma · Maiusc+Invio: a capo','Enter: next item · Ctrl+Enter: confirm · Shift+Enter: line break'],
 # Lexical fragments after creative-tools / creative-drawing splits keep the same
 # desktop fallbacks, still routed through GlaukaTouchGuidance on Android.
 'packages/editor-ui/creative-tools.js':['Apri con ↗ o Ctrl/Cmd + clic. Modifica con doppio clic.','Open with ↗ or Ctrl/Cmd + click. Double-click to edit.','Seleziona il recinto. Doppio clic per il titolo.','Select boundary. Double-click for title.'],
 'packages/editor-ui/creative-tools-mount-panel.js':['Apri con ↗ o Ctrl/Cmd + clic. Modifica con doppio clic.','Open with ↗ or Ctrl/Cmd + click. Double-click to edit.','Seleziona il recinto. Doppio clic per il titolo.','Select boundary. Double-click for title.'],
 'packages/editor-ui/creative-drawing.js':['Trascina sulla mappa per disegnare. Usa Seleziona più elementi per raggrupparli. Esc termina il disegno.','Drag on the map to draw. Use Select multiple objects to group them. Esc exits drawing.'],
 'packages/editor-ui/creative-drawing-toolbar.js':['Trascina sulla mappa per disegnare. Usa Seleziona più elementi per raggrupparli. Esc termina il disegno.','Drag on the map to draw. Use Select multiple objects to group them. Esc exits drawing.'],
 'packages/editor-ui/editor-shared/navigation-search-camera.js':['Cerca in tutte le schede · ↑↓ naviga · Invio teletrasporta']}
STYLE_COMPAT={'Stile applicato · Ctrl+Z per annullare','Style applied · Ctrl+Z to undo'}
class Markup(HTMLParser):
    def __init__(self):super().__init__(convert_charrefs=True);self.stack=[];self.rows=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs);parent=self.stack[-1] if self.stack else {}
        legacy=parent.get('legacy',False) or a.get('id')=='context-menu' or any(c in a.get('class','').split() for c in ['top-chrome'])
        physical=parent.get('physical',False) or 'data-glauka-physical-keyboard' in a
        row={'tag':tag,'legacy':legacy,'physical':physical,'id':a.get('id','')}
        for k in ['title','aria-label','placeholder','alt']:
            if k in a:self.rows.append((a[k],self.getpos()[0],legacy,physical,'attribute '+k))
        if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.stack.append(row)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i]['tag']==tag:del self.stack[i:];break
    def handle_data(self,data):
        p=self.stack[-1] if self.stack else {}
        if data.strip():self.rows.append((data,self.getpos()[0],p.get('legacy',False),p.get('physical',False),'technical' if p.get('tag') in {'script','style'} else 'text'))
def is_catalog(file):
    name=file.rsplit('/',1)[-1]
    return '/locales/' in file or name in {
        'localization.js','shell-dictionary.js','shell-product-locale.js','interface-languages.js',
        # Lexical fragments of the shared localization dictionary.
        'localization-messages.js','localization-messages-main.js','localization-messages-ranges.js',
    } or name.startswith('localization-messages')
def classify_literal(file,value,context):
    if '/vendor/' in file:return 'third_party_library'
    if is_catalog(file):return 'shared_catalog_reference'
    # Insert is the visible lettering-dialog button, not the physical Insert key.
    if file in {
        'packages/editor-ui/creative-drawing.js',
        'packages/editor-ui/creative-drawing-dialogs.js',
    } and value=='Enter the text, choose a style, then press Insert.':return 'existing_touch_button_instruction'
    if not STRICT.search(value):return 'action_label_or_technical_key'
    if re.fullmatch(r'[#.\w:/-]+',value) and not re.fullmatch(r'F(?:[1-9]|1[0-2])',value,re.I):return 'technical_identifier'
    if (file=='apps/android/editor/app.js' or file.endswith('/app-camera-status.js')) and value in STYLE_COMPAT:
        return 'exact_style_compatibility_matcher'
    # Optional hardware-keyboard cheatsheets in linked views; Android help text
    # prefers GlaukaMobile touch copy and keeps these as physical references.
    if '/linked-view-' in file and (
        'aria-keyshortcuts' in context or value in {
            'F2','Ins','Enter','Insert','Shift+F10','Esc',
        } or value.startswith('Alt+') or value.startswith('F2/') or value.startswith('Enter/F2')
        or value.startswith('Invio/F2') or 'Ctrl/Cmd+rotellina' in value or 'Ctrl/Cmd+wheel' in value
        or 'Tastiera: Alt' in value or 'Keyboard: Alt' in value
    ):
        return 'physical_keyboard_reference'
    if value in FALLBACKS.get(file,[]) and 'GlaukaTouchGuidance' in context:return 'desktop_fallback_with_android_presentation'
    if re.fullmatch(r'F(?:[1-9]|1[0-2])',value,re.I) and re.search(r'\.key\s*===?\s*[\'"]?\s*$',context.split(value)[0][-90:]):return 'physical_keyboard_handler'
    return 'unreviewed_ui_instruction'
def scan_file(file,text):
    rows=[]
    def add(value,line,category,kind):
        for m in RAW.finditer(value):rows.append({'file':file,'line':line,'match':m.group(),'text':value.strip()[:500],'category':category,'kind':kind})
    if '/vendor/' in file:
        for line,value in enumerate(text.splitlines(),1):add(value,line,'third_party_library','library')
        return rows
    if file.endswith('.html'):
        parser=Markup();parser.feed(text)
        for value,line,legacy,physical,kind in parser.rows:
            category='physical_keyboard_reference' if physical else 'hidden_legacy_reference' if legacy else 'technical_code' if kind=='technical' else 'unreviewed_ui_instruction' if STRICT.search(value) else 'action_label_or_technical_key'
            add(value,line,category,kind)
    elif file.endswith(('.js','.mjs','.cjs','.java')):
        spans=[]
        for token in TOKENS.finditer(text):
            spans.append((token.start(),token.end()));value=token.group();line=text.count('\n',0,token.start())+1
            if token.lastgroup=='comment':add(value,line,'technical_comment','comment');continue
            raw=value[1:-1];context=text[max(0,token.start()-400):token.end()+400]
            # Event keys retain their physical keyboard semantics.
            before=text[max(0,token.start()-80):token.start()]
            category='physical_keyboard_handler' if re.fullmatch(r'F(?:[1-9]|1[0-2])',raw,re.I) and re.search(r'\.key\s*===?\s*$',before) else classify_literal(file,raw,context)
            add(raw,line,category,'literal')
        # Matches in operators/regular expressions are code, not emitted UI text.
        end=0
        for start,stop in spans:
            add(text[end:start],text.count('\n',0,end)+1,'technical_code','code');end=stop
        add(text[end:],text.count('\n',0,end)+1,'technical_code','code')
    else:
        category='unreviewed_ui_instruction' if STRICT.search(text) and (file.endswith('.xml') and '<string' in text or file.endswith('.css') and re.search(r'content\s*:',text)) else 'shared_catalog_reference' if is_catalog(file) else 'third_party_library' if '/vendor/' in file or '/ocr/' in file else 'native_or_build_metadata'
        for line,value in enumerate(text.splitlines(),1):add(value,line,category,'data')
    return rows
def audit(files,base=None,overrides=None):
    records=[];scanned=[]
    for file in files:
        if overrides and file in overrides:text=overrides[file]
        elif base:
            result=subprocess.run(['git','show',base+':'+file],cwd=ROOT,capture_output=True,text=True)
            if result.returncode:continue
            text=result.stdout
        else:text=(ROOT/file).read_text(encoding='utf-8', errors='replace')
        scanned.append(file);records.extend(scan_file(file,text))
    return {'files_analyzed':len(scanned),'files':scanned,'counts':dict(collections.Counter(r['category'] for r in records)),'occurrences':records,'unreviewed':[r for r in records if r['category']=='unreviewed_ui_instruction']}
CLOSURE_INPUTS=['apps/desktop-shared/editor/sources.json','scripts/release/prepare.py','apps/android/editor/sources.json','scripts/release/pdfjs_vendor.py','scripts/release/ocr_vendor.py','scripts/release/interface_locales.py']
def file_digest(path):
    # Hash LF-normalized bytes so Windows checkouts with autocrlf match Linux CI.
    return hashlib.sha256((ROOT/path).read_bytes().replace(b'\r\n',b'\n').replace(b'\r',b'\n')).hexdigest()
def native_files():
    result=[]
    for p in (ROOT/'apps/android/native').rglob('*'):
        if not p.is_file() or p.suffix not in __import__('android_touch_inventory').TEXT:continue
        if any(part in {'build','.gradle','test','androidTest'} for part in p.relative_to(ROOT/'apps/android/native').parts) or p.name=='local.properties':continue
        result.append(p.relative_to(ROOT).as_posix())
    return sorted(result)
def source_manifest(detail):
    return {'files':detail['files'],'dependencies':detail['dependencies'],'closure_input_sha256':{f:file_digest(f) for f in CLOSURE_INPUTS},'native_files':native_files(),'languages':[x['code']for x in json.loads((ROOT/'packages/editor-ui/locales/source.json').read_text(encoding='utf-8'))['languages']]}
def validate_manifest(m):
    for f,expected in m['closure_input_sha256'].items():
        if file_digest(f)!=expected:raise ValueError('Android build inputs changed: regenerate the audited source manifest: '+f)
    if native_files()!=m['native_files']:raise ValueError('Android native asset tree changed: regenerate the audited source manifest')
    languages=[x['code']for x in json.loads((ROOT/'packages/editor-ui/locales/source.json').read_text(encoding='utf-8'))['languages']]
    if languages!=m['languages']:raise ValueError('Android locale set changed: regenerate the audited source manifest')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--base');p.add_argument('--check',action='store_true');p.add_argument('--source-manifest');p.add_argument('--write-manifest');a=p.parse_args()
    if a.source_manifest:
        manifest=json.loads(Path(a.source_manifest).read_text(encoding='utf-8'));validate_manifest(manifest);result=audit(manifest['files'],base=a.base);result['vendor_analysis']='pinned dependencies recorded by the full staging audit'
    else:
        detail=inventory(detail=True,dependency_text=True)
        result=audit(detail['files'],base=a.base)
        dependency_rows=[]
        for dep in detail['dependencies']:
            for line,value in enumerate(dep.pop('text','').splitlines(),1):
                for match in RAW.finditer(value):dependency_rows.append({'file':'packaged-dependency:'+dep['stage_file'],'line':line,'match':match.group(),'text':value[max(0,match.start()-60):match.end()+80],'category':'third_party_library','kind':'library'})
        result['source_files_analyzed']=result['files_analyzed'];result['dependency_files_analyzed']=len(detail['dependencies']);result['files_analyzed']+=len(detail['dependencies']);result['dependencies']=detail['dependencies'];result['occurrences'].extend(dependency_rows);result['counts']=dict(collections.Counter(r['category']for r in result['occurrences']))
        if a.write_manifest:Path(a.write_manifest).write_text(json.dumps(source_manifest(detail),ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2));sys.exit(1 if a.check and result['unreviewed'] else 0)
