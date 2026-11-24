#!/usr/bin/env python3
"""Read-only accounting of tracked Git blobs at a selected commit.

No deletes, branch pruning, checkout changes, staging, network calls or history rewrites.
Requires only Git and Python 3.12+; reports HEAD by default.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import subprocess

CODE_EXTENSIONS = {
    '.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.css', '.scss',
    '.html', '.go', '.java', '.swift', '.py', '.ps1', '.sh', '.command',
    '.gradle', '.kt', '.kts',
}
ARCHIVE_SUFFIXES = ('.zip', '.zip.b64', '.tar.gz', '.tar.gz.b64', '.7z', '.rar')


def parse_tree(raw: bytes) -> list[dict]:
    """Parse git ls-tree -r -l -z; sizes are Git blob sizes, not disk allocation."""
    result = []
    for record in raw.split(b'\0'):
        if not record:
            continue
        try:
            header, raw_path = record.split(b'\t', 1)
            mode, kind, oid, size = header.split()
            if kind != b'blob':
                continue
            result.append({
                'path': raw_path.decode('utf-8', 'surrogateescape'),
                'bytes': int(size),
            })
        except (ValueError, UnicodeError) as exc:
            raise ValueError('Invalid git ls-tree record') from exc
    return result


def category(path: str) -> str:
    if '/legacy/' in path and path.lower().endswith(ARCHIVE_SUFFIXES):
        return 'archivi_storici_da_rivedere'
    if path.startswith('docs/qa/evidence/'):
        return 'evidenze_qa'
    if path.startswith('docs/screenshots/'):
        return 'schermate_documentazione'
    if path.startswith('apps/website/'):
        return 'risorse_sito'
    if path.startswith('packages/editor-ui/vendor/'):
        return 'librerie_terze_parti'
    if path.startswith('packages/editor-ui/locales/'):
        return 'traduzioni'
    return 'altro_codice_documenti_e_asset'


def analyze(files: list[dict], top: int = 10) -> dict:
    by_category: dict[str, dict] = {}
    by_extension: dict[str, dict] = {}
    total = 0
    code = {'files': 0, 'bytes': 0}
    historical = []
    for file in files:
        path, size = file['path'], file['bytes']
        if not isinstance(size, int) or size < 0:
            raise ValueError('Invalid Git blob size')
        total += size
        group = category(path)
        value = by_category.setdefault(group, {'files': 0, 'bytes': 0})
        value['files'] += 1
        value['bytes'] += size
        extension = Path(path).suffix.lower() or '(nessuna)'
        value = by_extension.setdefault(extension, {'files': 0, 'bytes': 0})
        value['files'] += 1
        value['bytes'] += size
        if extension in CODE_EXTENSIONS:
            code['files'] += 1
            code['bytes'] += size
        if group == 'archivi_storici_da_rivedere':
            historical.append(file)
    if sum(x['bytes'] for x in by_category.values()) != total:
        raise AssertionError('Category totals do not reconcile')
    return {
        'file_count': len(files), 'total_bytes': total,
        'code_files': code['files'], 'code_bytes': code['bytes'],
        'categories': by_category, 'extensions': by_extension,
        'historical_archives_review_only': sorted(historical, key=lambda x: (-x['bytes'], x['path'])),
        'largest_files': sorted(files, key=lambda x: (-x['bytes'], x['path']))[:top],
        'cleanup_performed': False,
        'important': ('Archive candidates have NOT been proven unused. '
                      'Check references, backups, PRs and release distribution before removal. '
                      'Deleting tracked files does not erase Git history.'),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[2],
                        help='Local repository checkout (default: script repository)')
    parser.add_argument('--ref', default='HEAD', help='Git revision to measure, read-only')
    parser.add_argument('--json', action='store_true', help='Print a JSON report to standard output')
    parser.add_argument('--top', type=int, default=10, help='Largest files to show')
    args = parser.parse_args(argv)
    if args.top < 0 or args.top > 200:
        parser.error('--top must be between 0 and 200')
    result = subprocess.run(['git', 'ls-tree', '-r', '-l', '-z', args.ref],
                            cwd=args.repo, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            check=False)
    if result.returncode:
        parser.error('Git tree not available: ' + result.stderr.decode('utf-8', 'replace')[:400])
    data = analyze(parse_tree(result.stdout), top=args.top)
    data['ref'] = args.ref
    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print(f"Versioned files: {data['file_count']} — {data['total_bytes']/1_000_000:.2f} MB")
        print(f"Source-like files: {data['code_files']} — {data['code_bytes']/1_000_000:.2f} MB")
        for label, stat in sorted(data['categories'].items(), key=lambda t: -t[1]['bytes']):
            print(f"{label}: {stat['files']} files, {stat['bytes']/1_000_000:.2f} MB")
        print('Historical archive candidates (review only, no deletion):')
        for item in data['historical_archives_review_only']:
            print(f"  {item['path']} ({item['bytes'] / 1_000_000:.3f} MB)")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
