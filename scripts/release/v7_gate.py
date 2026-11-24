#!/usr/bin/env python3
"""Run the existing NeuroMap v7 source quality gates locally; never invoke GitHub Actions.

This is an evidence collector, not a substitute for native GUI / signed package QA.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]


def plan(root: Path, output: Path, *, skip_browser=False, skip_stage=False,
         python=None, platform=None):
    """Return checked-in test commands without shell expansion or remote CI."""
    python = python or sys.executable
    npm = 'npm.cmd' if (platform or os.name) == 'nt' else 'npm'
    npx = 'npx.cmd' if (platform or os.name) == 'nt' else 'npx'
    return [
        ('node-tests', [npm, 'test'], {}, False),
        ('stress-v74', [npm, 'run', 'test:stress'], {}, False),
        ('stress-v75', [npm, 'run', 'test:knowledge:stress'], {}, False),
        ('stress-v76', [npm, 'run', 'test:database:stress'], {}, False),
        ('build-tests', [npm, 'run', 'test:build'], {}, False),
        ('browser-chromium', [npm, 'run', 'test:browser'], {}, skip_browser),
        ('browser-webkit', [npx, 'playwright', 'test', '-c',
                            'playwright.desktop.config.js'],
         {'NEUROMAP_TEST_ENGINE': 'webkit'}, skip_browser),
        ('stage-windows', [python, 'scripts/release/prepare.py', 'windows',
                           str(output / 'prepared-windows')], {}, skip_stage),
        ('stage-macos', [python, 'scripts/release/prepare.py', 'macos',
                         str(output / 'prepared-macos')], {}, skip_stage),
    ]


def run_gate(root: Path, output: Path, *, skip_browser=False, skip_stage=False,
             dry_run=False, timeout=1800, executor=None):
    root, output = root.resolve(), output.resolve()
    if output == root or output.is_relative_to(root) or root.is_relative_to(output):
        raise ValueError('Choose a QA output directory outside the source repository')
    if output.exists() and any(output.iterdir()):
        raise ValueError('QA output directory must be new or empty')
    if not (root / 'package.json').is_file() or not (root / 'versions.json').is_file():
        raise ValueError('Not a NeuroMap checkout')
    output.mkdir(parents=True, exist_ok=True)
    version = json.loads((root / 'versions.json').read_text(encoding='utf-8'))
    try:
        revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'],
                                           cwd=root, text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        revision = None
    report = {
        'kind': 'NeuroMap source-level v7 quality gate',
        'started_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
        'revision': revision, 'editor_version': version.get('editor'),
        'android_editor_features': version.get('android', {}).get('editor_features'),
        'android_editor_features_scope': version.get('android', {}).get('editor_features_scope'),
        'android_shared_modules_version': version.get('android', {}).get('shared_modules_version'),
        'android_shared_modules': version.get('android', {}).get('shared_modules', []),
        'native_gui_verified': False, 'signed_packages_verified': False,
        'complete': False, 'passed': False, 'steps': [],
    }
    execute = executor or subprocess.run
    for name, command, extra_env, skipped in plan(root, output,
            skip_browser=skip_browser, skip_stage=skip_stage):
        entry = {'name': name, 'command': command, 'status': 'skipped' if skipped
                 else 'planned' if dry_run else 'running'}
        report['steps'].append(entry)
        if skipped or dry_run:
            continue
        start = time.monotonic()
        logfile = output / (name + '.log')
        try:
            with logfile.open('w', encoding='utf-8') as stream:
                result = execute(command, cwd=root, env={**os.environ, **extra_env},
                                 stdout=stream, stderr=subprocess.STDOUT, timeout=timeout,
                                 check=False)
            entry['returncode'] = result.returncode
            entry['status'] = 'passed' if result.returncode == 0 else 'failed'
        except (OSError, subprocess.TimeoutExpired) as error:
            entry['status'] = 'failed'
            entry['error'] = str(error)
        entry['duration_seconds'] = round(time.monotonic() - start, 2)
        entry['log'] = str(logfile)
        (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False,
                                              indent=2), encoding='utf-8')
    report['complete'] = all(step['status'] in ('passed', 'failed')
                             for step in report['steps'])
    report['passed'] = report['complete'] and all(
        step['status'] == 'passed' for step in report['steps'])
    report['finished_utc'] = dt.datetime.now(dt.timezone.utc).isoformat()
    (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False,
                                          indent=2), encoding='utf-8')
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='New directory OUTSIDE the checkout')
    parser.add_argument('--skip-browser', action='store_true',
                        help='Partial evidence only; never counts as full pass')
    parser.add_argument('--skip-stage', action='store_true',
                        help='Partial evidence only; never counts as full pass')
    parser.add_argument('--dry-run', action='store_true',
                        help='Display planned commands without claiming passed tests')
    parser.add_argument('--timeout', type=int, default=1800, help='Seconds per step')
    args = parser.parse_args(argv)
    if args.timeout < 1: parser.error('--timeout must be positive')
    output = args.output or Path(tempfile.mkdtemp(prefix='neuromap-v7-qa-'))
    try:
        report = run_gate(ROOT, output, skip_browser=args.skip_browser,
                          skip_stage=args.skip_stage, dry_run=args.dry_run,
                          timeout=args.timeout)
    except (OSError, ValueError) as error:
        parser.exit(2, str(error) + '\n')
    print(json.dumps({'output': str(output), 'passed': report['passed'],
                      'complete': report['complete'], 'steps': [
                          {'name': item['name'], 'status': item['status']}
                          for item in report['steps']]}, ensure_ascii=False, indent=2))
    return 0 if report['passed'] or args.dry_run else 1


if __name__ == '__main__':
    raise SystemExit(main())
