"""Derive Android's real text-source closure by tracing a disposable prepare stage.
Markers only exist in this audit's temporary output, never in release artifacts.
"""
from pathlib import Path
import json,re,sys,tempfile,shutil,hashlib
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/release'))
import prepare
MARK=re.compile(r'@glauka-audit-source:([A-Za-z0-9/_.-]+)')
TEXT={'.js','.mjs','.cjs','.css','.html','.json','.java','.xml','.gradle','.properties','.pro','.md','.txt','.svg'}
def inventory(detail=False,dependency_text=False):
    original=prepare.read
    original_copy=shutil.copyfile
    copied={}
    def trace_copy(src,dst,*args,**kwargs):
        result=original_copy(src,dst,*args,**kwargs)
        copied[Path(dst).resolve()]=Path(src).resolve()
        return result
    def traced(path):
        text=original(path)
        if path.suffix in {'.js','.css','.svg','.txt'}:
            # Always emit POSIX paths so Windows checkouts match the audited manifest.
            return '/* @glauka-audit-source:'+path.relative_to(ROOT).as_posix()+' */\n'+text
        return text
    with tempfile.TemporaryDirectory(prefix='glauka-touch-audit-') as tmp:
        try:
            prepare.read=traced
            shutil.copyfile=trace_copy
            stage=prepare.prepare('android',Path(tmp)/'android')
        finally:
            prepare.read=original
            shutil.copyfile=original_copy
        sources=set();dependencies={}
        for p in stage.rglob('*'):
            if not p.is_file() or p.suffix not in TEXT:continue
            text=p.read_text(errors='replace')
            sources.update(MARK.findall(text))
            rel=p.relative_to(stage).as_posix()
            if any('/assets/'+kind+'/' in '/'+rel for kind in ['pdfjs','ocr']) and p.name!='host-worker.js':
                row={'stage_file':rel,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
                if dependency_text:row['text']=text
                dependencies[rel]=row
            candidate=copied.get(p.resolve(),ROOT/'apps/android/native'/p.relative_to(stage))
            if candidate.is_file() and '/src/test/' not in candidate.as_posix() and '/src/androidTest/' not in candidate.as_posix():
                if candidate.read_text(errors='replace')==text or candidate.suffix=='.html':
                    if candidate.is_relative_to(ROOT):sources.add(candidate.relative_to(ROOT).as_posix())
                    else:dependencies[rel]={'source':candidate.as_posix(),'stage_file':rel}
        sources.update('packages/editor-ui/locales/'+n for n in ['source.json','it.json','en.json','de.json','es.json','fr.json','pt.json','ar.json','zh-CN.json'])
        sources.update(['packages/editor-ui/interface-languages.js','apps/android/editor/sources.json','apps/desktop-shared/editor/sources.json','versions.json'])
        return {'files':sorted(sources),'dependencies':sorted(dependencies.values(),key=lambda row:row['stage_file'])} if detail else sorted(sources)
if __name__=='__main__':
    result=inventory(detail=True);result.update(base='Android prepare() runtime-source closure',source_files_analyzed=len(result['files']),dependency_files_analyzed=len(result['dependencies']),files_analyzed=len(result['files'])+len(result['dependencies']))
    print(json.dumps(result,ensure_ascii=False,indent=2))
