#!/usr/bin/env python3
"""Local-only Android 0.6 RC verification and debug APK build; never use GitHub Actions."""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
def plan(output, *, python=None, platform=None):
    npm='npm.cmd' if (platform or os.name)=='nt' else 'npm'
    npx='npx.cmd' if (platform or os.name)=='nt' else 'npx'
    interpreter=python or sys.executable
    return [
      ('node-unit', [npm, 'test'], ROOT),
      ('build-and-staging-tests', [npm, 'run', 'test:build'], ROOT),
      ('android-stress', [npm, 'run', 'test:android:stress'], ROOT),
      ('knowledge-links-stress', [npm, 'run', 'test:knowledge:stress'], ROOT),
      ('knowledge-database-stress', [npm, 'run', 'test:database:stress'], ROOT),
      ('android-adaptive-browser', [npm, 'run', 'test:android:ui'], ROOT),
      ('stage-android', [interpreter, 'scripts/release/prepare.py', 'android', str(output/'android')], ROOT),
      ('assemble-debug-apk', ['gradle.bat' if (platform or os.name)=='nt' else 'gradle', '--no-daemon', 'assembleDebug'], output/'android'),
    ]


def execute(output: Path, *, dry_run=False, skip_browser=False, timeout=1800):
    out=output.resolve()
    if out==ROOT or out.is_relative_to(ROOT) or ROOT.is_relative_to(out):
        raise ValueError('Use an output directory outside the checkout')
    if out.exists() and any(out.iterdir()):
        raise ValueError('Output directory must be empty')
    if not (ROOT/'apps/android/native/app/build.gradle').is_file():
        raise ValueError('Not a NeuroMap Android checkout')
    out.mkdir(parents=True,exist_ok=True)
    details=json.loads((ROOT/'versions.json').read_text())
    revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    result={'type':'NeuroMap Android RC gate','revision':revision,
      'version':details['android']['version'],'startedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
      'allStepsPassed':False,'stableCertified':False,'physicalDeviceVerified':False,'steps':[]}
    commands=plan(out)
    for name,cmd,workdir in commands:
        entry={'step':name,'argv':cmd,'status':'planned'}
        result['steps'].append(entry)
        if dry_run or (skip_browser and name=='android-adaptive-browser'):
            entry['status']='planned' if dry_run else 'skipped'
            continue
        start=time.monotonic()
        try:
            with (out/(name+'.log')).open('w',encoding='utf-8') as stream:
                proc=subprocess.run(cmd,cwd=workdir,stdout=stream,stderr=subprocess.STDOUT,
                  timeout=timeout,check=False)
            entry['returncode']=proc.returncode
            entry['status']='passed' if proc.returncode==0 else 'failed'
        except (OSError, subprocess.TimeoutExpired) as error:
            entry['status']='failed';entry['error']=str(error)
        entry['seconds']=round(time.monotonic()-start,3)
        if entry['status']!='passed':
            break
    apk=out/'android/app/build/outputs/apk/debug/app-debug.apk'
    if not dry_run and apk.is_file() and apk.stat().st_size>1000000:
        with apk.open('rb') as stream:
            digest=hashlib.file_digest(stream,'sha256').hexdigest()
        result['apk']={'path':str(apk),'bytes':apk.stat().st_size,
          'sha256':digest}
    result['allStepsPassed']=len(result['steps'])==len(commands) and all(
      x['status']=='passed' for x in result['steps']) and 'apk' in result
    (out/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    return result


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--dry-run',action='store_true')
    parser.add_argument('--skip-browser',action='store_true')
    parser.add_argument('--timeout',type=int,default=1800)
    args=parser.parse_args()
    if args.timeout<1:parser.error('timeout must be positive')
    try:report=execute(args.output,dry_run=args.dry_run,skip_browser=args.skip_browser,
      timeout=args.timeout)
    except (ValueError,OSError) as e:parser.exit(2,str(e)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 0 if args.dry_run or report['allStepsPassed'] else 1


if __name__=='__main__':
    raise SystemExit(main())
