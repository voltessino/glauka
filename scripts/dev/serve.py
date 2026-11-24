#!/usr/bin/env python3
"""Serve a staged editor on loopback for browser tests; no native bridge is exposed."""
from pathlib import Path
import argparse
import functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'release'))
from prepare import prepare
p=argparse.ArgumentParser();p.add_argument('platform',choices=['android','macos']);p.add_argument('--port',type=int,required=True)
a=p.parse_args()
with tempfile.TemporaryDirectory(prefix='neuromap-browser-') as tmp:
    root=prepare(a.platform,Path(tmp)/'source')
    directory=root/'app/src/main/assets' if a.platform=='android' else root/'desktop/resources'
    handler=functools.partial(SimpleHTTPRequestHandler,directory=str(directory))
    ThreadingHTTPServer(('127.0.0.1',a.port),handler).serve_forever()
