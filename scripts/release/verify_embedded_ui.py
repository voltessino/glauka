#!/usr/bin/env python3
"""Verify that a packaged executable actually contains the prepared editor."""
from pathlib import Path
import argparse
import hashlib
import json
import re

def verify(binary, html):
    payload=Path(binary).read_bytes()
    expected=Path(html).read_bytes()
    if expected not in payload:
        raise ValueError('Executable does not contain the exact prepared editor HTML')
    for token in (b'root.NeuroMapDrag=',b'nm-drag-preview',b'nm-theme-picker',b'data-neuromap-build='):
        if token not in expected:
            raise ValueError('Prepared editor is missing '+token.decode())
    for token in (b'id="nm615-theme-top"',b'id="nm615-theme"',b'id="nm-android-theme"'):
        if token in expected:
            raise ValueError('Legacy background dropdown is still present')
    revision=re.search(br'data-neuromap-build="([^"]+)"',expected)
    return {'revision':revision.group(1).decode() if revision else None,'binary':Path(binary).name,'sha256':hashlib.sha256(payload).hexdigest(),
            'editorSHA256':hashlib.sha256(expected).hexdigest(),'editorBytes':len(expected)}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('binary');parser.add_argument('html');args=parser.parse_args()
    print(json.dumps(verify(args.binary,args.html),indent=2))
