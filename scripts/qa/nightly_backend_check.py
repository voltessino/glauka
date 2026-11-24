#!/usr/bin/env python3
"""Stage a fresh out-of-tree Windows backend and run real loopback security probes.

A complete production/installer build and Authenticode verification are NOT
performed. This is a smoke gate suitable for the nightly test runner.
"""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[2]

def execute(args,cwd):
    print('Running:', ' '.join(map(str,args)),flush=True)
    subprocess.run(list(map(str,args)),cwd=cwd,check=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report-dir',type=Path,required=True)
    args=parser.parse_args()
    if os.name!='nt':
        raise SystemExit('Windows native backend smoke test requires Windows')
    if not shutil.which('go'):
        raise SystemExit('Go compiler is not installed')
    sys.path.insert(0,str(ROOT/'scripts/release'))
    from prepare import prepare
    with tempfile.TemporaryDirectory(prefix='nm-nightly-',dir=str(args.report_dir.resolve())) as tmp:
        staging=Path(tmp)/'staging'
        prepare('windows',staging)
        backend=staging/'desktop'
        execute(['go','test','.'],backend)
        execute(['go','test','-tags','developer','.'],backend)
        binary=Path(tmp)/'neuromap-nightly-backend.exe'
        execute(['go','build','-buildvcs=false','-trimpath','-o',binary,'.'],backend)
        execute([sys.executable,ROOT/'scripts/qa/pentest_loopback.py',binary],ROOT)
        print('PASS: production-tag backend built and loopback security smoke passed.')
        print('No customer installer was built or signed.')

if __name__=='__main__':
    main()
