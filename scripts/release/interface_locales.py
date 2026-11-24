"""Package local UI catalogs; no translator or network is used during builds/runtime."""
from pathlib import Path
import json
import re


def catalogs(ui):
    base=json.loads((ui/'locales/source.json').read_text(encoding='utf-8'))
    packs={language['code']:json.loads((ui/'locales'/f"{language['code']}.json").read_text(encoding='utf-8')) for language in base['languages']}
    expected=set(base['entries'])
    for code,pack in packs.items():
        if set(pack)!=expected:raise ValueError(f'Incomplete locale: {code}')
        for key,text in pack.items():
            if not isinstance(text,str) or not text.strip():raise ValueError(f'Empty locale message: {code}/{key}')
            if sorted(re.findall(r'\{\d+\}',text))!=sorted(re.findall(r'\{\d+\}',base['entries'][key]['en'])):raise ValueError(f'Locale placeholders changed: {code}/{key}')
            if '⟦TOKEN' in text or '⟦NEWLINE' in text:raise ValueError(f'Unresolved locale token: {code}/{key}')
    entries={key:{'it':packs['it'][key],'en':packs['en'][key]}for key in base['entries']}
    aliases=dict(base['aliases'])
    for key,entry in entries.items():
        for text in entry.values():aliases.setdefault(text,key)
    return {'languages':base['languages'],'entries':entries,'aliases':aliases},packs


def compose(ui):
    source,_=catalogs(ui)
    script=(ui/'interface-languages.js').read_text(encoding='utf-8')
    if script.count('/* @glauka-locale-source */ null')!=1:raise ValueError('Missing interface locale source marker')
    return script.replace('/* @glauka-locale-source */ null',json.dumps(source,ensure_ascii=False,separators=(',',':')).replace('</','<\\/'))


def stage(ui,destination):
    source,packs=catalogs(ui)
    destination.mkdir(parents=True,exist_ok=True)
    (destination/'source.json').write_text(json.dumps(source,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    for code,pack in packs.items():(destination/f'{code}.json').write_text(json.dumps(pack,ensure_ascii=False,separators=(',',':')),encoding='utf-8')


def installer(ui,script,destination):
    source,packs=catalogs(ui)
    labels=set(re.findall(r"Localize '((?:[^']|'')*)'",script.read_text(encoding='utf-8-sig')))
    labels.update(re.findall(r'installerText\("([^"]+)"\)',(script.parent/'main.go').read_text(encoding='utf-8')))
    labels=sorted({text.replace("''", "'")for text in labels})
    messages={code:{text:pack[source['aliases'][text.strip()]]for text in labels}for code,pack in packs.items()}
    destination.write_text(json.dumps({'languages':source['languages'],'messages':messages},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
