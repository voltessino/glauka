"""Package updated Go/editor with the verified, unchanged existing Swift launcher.
Requires no macOS SDK; refuses reuse after any Swift/native source change.
Private ad-hoc ZIP only. This does not run the application or notarize it.
"""
from pathlib import Path
import argparse,hashlib,json,plistlib,shutil,struct,subprocess,zipfile
from build_desktop import build,run
from prepare import ROOT
from macos_artifacts import universal,verify_adhoc,thin_slices,png_icns
from verify_embedded_ui import verify
TEMPLATE_REVISION='a53ad282daf41f237c42ef1f3b871877ed5cdf6e'
TEMPLATE_SHA256='f119b74c2d4343abbf7fd0fefd3639c9509941e7aa8063eaa938d0dca7478614'
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def code_hashes(binary):
 result={}
 for part in thin_slices(Path(binary).read_bytes()):
  cpu=struct.unpack_from('<I',part,4)[0];count=struct.unpack_from('<I',part,16)[0];position=32
  for _ in range(count):
   command,length=struct.unpack_from('<II',part,position)
   if command==0x19:
    sections=struct.unpack_from('<I',part,position+64)[0]
    for i in range(sections):
     section=position+72+i*80;name=part[section:section+16].split(b'\0')[0]
     if name==b'__text':
      size=struct.unpack_from('<Q',part,section+40)[0];offset=struct.unpack_from('<I',part,section+48)[0]
      result[str(cpu)]=hashlib.sha256(part[offset:offset+size]).hexdigest()
   position+=length
 if len(result)!=2:raise ValueError('Both native launcher code sections required')
 return result

def package(destination,template,extractor,signer,go):
 if digest(template)!=TEMPLATE_SHA256:raise ValueError('Unverified Mac template package')
 for args in ([TEMPLATE_REVISION,'HEAD','--','apps/macos'],['--','apps/macos']):
  subprocess.run(['git','diff','--exit-code',*args],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
 output=build('macos',destination,go=go,backend_only=True,developer=True);dest=output.parent
 manifest=json.loads((output/'build-manifest.json').read_text())
 if manifest['sourceDirty']:raise ValueError('Clean committed sources required')
 extracted=dest/'verified-template';extracted.mkdir()
 run([extractor,'x','-y','-o'+str(extracted),template,'*/Glauka.app/*'],dest)
 candidates=list(extracted.glob('*/Glauka.app'))
 if len(candidates)!=1:raise ValueError('One verified template application required')
 app=output/'Glauka Developer.app';shutil.copytree(candidates[0],app)
 mac=app/'Contents/MacOS';resources=app/'Contents/Resources'
 old_code=code_hashes(mac/'Glauka');verify_adhoc(mac/'Glauka',app);verify_adhoc(mac/'neuromap-server')
 universal([output/'neuromap-server-amd64',output/'neuromap-server-arm64'],mac/'neuromap-server')
 for file in ['Info.plist']:shutil.copy2(dest/'mac'/file,app/'Contents'/file)
 shutil.copy2(dest/'mac/NativeMessages.json',resources/'NativeMessages.json')
 for localized in (dest/'mac').glob('*.lproj'):
  shutil.copytree(localized,resources/localized.name,dirs_exist_ok=True)
 (resources/'Glauka.icns').write_bytes(png_icns((dest/'desktop/resources/icon.png').read_bytes()))
 run([signer,'sign','-C','/dev/null',app],dest)
 for path in [app,*app.rglob('*')]:path.chmod(0o755 if path.is_dir() or path.parent==mac else 0o644)
 signatures={'shell':verify_adhoc(mac/'Glauka',app),'backend':verify_adhoc(mac/'neuromap-server')}
 if code_hashes(mac/'Glauka')!=old_code:raise ValueError('Native launcher instructions changed')
 manifest['embeddedEditorChecks'].append(verify(mac/'neuromap-server',dest/'desktop/resources/index.html'))
 envelope=plistlib.loads((app/'Contents/_CodeSignature/CodeResources').read_bytes())
 for name,entry in envelope.get('files2',{}).items():
  if isinstance(entry,dict) and 'hash2' in entry and hashlib.sha256((app/'Contents'/name).read_bytes()).digest()!=entry['hash2']:raise ValueError('Signed resource mismatch')
  if isinstance(entry,dict) and 'cdhash' in entry and entry['cdhash'].hex() not in {r['cdhash']for r in signatures['backend']}:raise ValueError('Nested executable mismatch')
 version=json.loads((ROOT/'versions.json').read_text())['macos']['version'];archive=output/f'Glauka-Mac-{version}-Developer.zip'
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for file in sorted(app.rglob('*')):
   if file.is_file():z.write(file,file.relative_to(output))
  z.writestr('LEGGIMI.txt','Glauka — anteprima privata universale, macOS 12+. Estrai Glauka Developer.app e spostala in Applicazioni. Firma ad hoc senza notarizzazione Apple; non collaudata su un Mac reale. Il launcher Swift verificato è invariato; backend ed editor sono aggiornati. Conserva un backup esportato dei progetti.\n')
 with zipfile.ZipFile(archive) as z:
  if z.testzip():raise ValueError('ZIP integrity failure')
  for file in app.rglob('*'):
   if file.is_file() and hashlib.sha256(z.read(file.relative_to(output).as_posix())).hexdigest()!=digest(file):raise ValueError('ZIP file mismatch')
  for name in ['Glauka','neuromap-server']:
   if not(z.getinfo(app.name+'/Contents/MacOS/'+name).external_attr>>16)&0o111:raise ValueError('ZIP executable permissions missing')
 manifest.update(nativeWrapperReused=True,nativeWrapperSourcesRevision=TEMPLATE_REVISION,templatePackageSha256=TEMPLATE_SHA256,nativeWrapperCodeHashes=old_code,nativeWrapperCodeUnchanged=True,signatures=signatures,nativeApplicationExecuted=False,clipboardTestsExecuted=False,notarized=False,artifact={'file':archive.name,'sha256':digest(archive),'bytes':archive.stat().st_size})
 (output/'macos-reuse-build-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(archive);return archive
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('destination');p.add_argument('--template',required=True);p.add_argument('--extractor',required=True);p.add_argument('--signer',required=True);p.add_argument('--go',required=True);a=p.parse_args();package(a.destination,a.template,a.extractor,a.signer,a.go)
