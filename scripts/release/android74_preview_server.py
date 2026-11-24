#!/usr/bin/env python3
"""Stage and serve the actual Android WebView assets for offline viewport tests."""
from __future__ import annotations
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/release'))
from prepare import prepare


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5178)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('invalid port')
    with tempfile.TemporaryDirectory(prefix='neuromap-android74-') as temporary:
        target = prepare('android', Path(temporary) / 'staged')
        assets = target / 'app/src/main/assets'
        handler = partial(SimpleHTTPRequestHandler, directory=str(assets))
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
        print(f'Android preview ready: http://127.0.0.1:{args.port}/app/index.html', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()


if __name__ == '__main__':
    main()
