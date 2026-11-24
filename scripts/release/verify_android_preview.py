"""Fail before distributing an incompatible preview signer or wrong APK version.
Reads only public APK metadata. Never exports, generates or prints private keys.
"""
from pathlib import Path
import argparse,hashlib,json,re,subprocess,zipfile
ROOT=Path(__file__).resolve().parents[2]
def validate(certificate,badging,identity,version,allow_different_signer=False):
 match=re.search(r'Signer #1 certificate SHA-256 digest: ([a-f0-9]{64})',certificate)
 if not match or (match.group(1)!=identity['certificateSha256'] and not allow_different_signer):
  raise ValueError('Firma preview diversa: distribuzione interrotta. Recupera la chiave della preview esistente; non generare un’altra chiave per un aggiornamento.')
 if 'Number of signers: 1' not in certificate:raise ValueError('Unexpected APK signers')
 expected="name='"+identity['applicationId']+"' versionCode='"+str(version['version_code'])+"' versionName='"+version['version']+"'"
 if expected not in badging:raise ValueError('APK identity/version differs from versions.json')
 return match.group(1)
def validate_payload(apk,revision,stage=None):
 with zipfile.ZipFile(apk) as archive:
  if archive.testzip() is not None:raise ValueError('Corrupt APK archive')
  html=archive.read('assets/app/index.html').decode('utf-8')
  if 'data-neuromap-build="'+revision+'"' not in html:
   raise ValueError('APK source revision differs from the current checkout; rebuild before distributing')
  count=0
  if stage is not None:
   assets=stage/'app/src/main/assets'
   if not assets.is_dir():raise ValueError('Missing staged Android assets')
   for file in assets.rglob('*'):
    if file.is_file():
     name='assets/'+file.relative_to(assets).as_posix()
     if archive.read(name)!=file.read_bytes():raise ValueError('APK assets differ from staging: '+name)
     count+=1
   expected={'assets/'+f.relative_to(assets).as_posix() for f in assets.rglob('*') if f.is_file()}
   actual={name for name in archive.namelist() if name.startswith('assets/') and not name.endswith('/')}
   if not expected or actual!=expected:raise ValueError('APK assets differ from staging: unexpected or missing files')
  return count
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--apk',type=Path,required=True);p.add_argument('--apksigner',required=True);p.add_argument('--aapt',required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--stage',type=Path,help='Verify every staged asset inside the APK');p.add_argument('--allow-different-signer',action='store_true',help='Local independent install only; never waives version or source checks');a=p.parse_args()
 identity=json.loads((ROOT/'scripts/release/android-preview-identity.json').read_text());version=json.loads((ROOT/'versions.json').read_text())['android']
 cert=subprocess.check_output([a.apksigner,'verify','--verbose','--print-certs',str(a.apk)],text=True)
 metadata=subprocess.check_output([a.aapt,'dump','badging',str(a.apk)],text=True)
 fingerprint=validate(cert,metadata,identity,version,a.allow_different_signer)
 revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 if subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip():
  raise ValueError('Uncommitted source changes: APK cannot be verified for distribution')
 assets_verified=validate_payload(a.apk,revision,a.stage)
 report={'file':a.apk.name,'bytes':a.apk.stat().st_size,'sha256':hashlib.sha256(a.apk.read_bytes()).hexdigest(),'certificateSha256':fingerprint,'applicationId':identity['applicationId'],'version':version['version'],'versionCode':version['version_code'],'updates066PreviewInPlace':fingerprint==identity['certificateSha256']}
 report['sourceRevision']=revision
 report['sourceDirty']=False
 report['stagedAssetsVerified']=assets_verified
 a.output.write_text(json.dumps(report,indent=2)+'\n');print('APK verificato: identità, versione e commit sorgente corretti; firma '+('compatibile.' if report['updates066PreviewInPlace'] else 'diversa, installazione locale indipendente.'))
if __name__=='__main__':main()
