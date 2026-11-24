#!/usr/bin/env python3
"""Build a verified private APK ZIP locally, without GitHub Actions or uploads."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[2]


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def validate_source(revision, dirty, remote_main, *, allow_unmerged=False):
    if dirty:
        raise ValueError('Commit or set aside local changes before creating a distributable APK.')
    if not revision or not remote_main:
        raise ValueError('Source revision or main is unavailable; no package was created.')
    if revision != remote_main and not allow_unmerged:
        raise ValueError('HEAD differs from main. Update/integrate main first, or explicitly use --allow-unmerged for a private branch preview.')


def snapshot(*, offline=False, allow_unmerged=False):
    revision = git('rev-parse', 'HEAD')
    dirty = git('status', '--porcelain')
    if offline:
        main = git('rev-parse', 'origin/main')
    else:
        result = git('ls-remote', 'origin', 'refs/heads/main').split()
        main = result[0] if result else ''
    validate_source(revision, dirty, main, allow_unmerged=allow_unmerged)
    return {'revision': revision, 'remoteMain': main,
            'remoteChecked': not offline, 'matchesMain': revision == main}


def validate_output(output, root=ROOT):
    output, root = output.resolve(), root.resolve()
    if output == root or output.is_relative_to(root) or root.is_relative_to(output):
        raise ValueError('Output must be outside, and must not contain, the repository.')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Output must be a new or empty directory; old staging is never reused.')
    return output


def sha256(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def package_zip(apk, destination, version, revision, expected_sha256=None):
    """Only expose a finished archive after checking CRC and embedded APK bytes."""
    expected_sha256 = expected_sha256 or sha256(apk)
    if sha256(apk) != expected_sha256:
        raise ValueError('APK changed after verification; no ZIP was created.')
    temporary = destination.with_suffix('.zip.tmp')
    apk_name = destination.stem + '.apk'
    try:
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            archive.write(apk, apk_name)
            archive.writestr('LEGGIMI.txt',
                'Glauka Android ' + version + '\nCommit: ' + revision + '\n\n'
                'Estrai lo ZIP e apri l’APK. Anteprima debug privata, non release pubblica.\n'
                'Compatibilità della firma e verifiche: build-manifest.json accanto allo ZIP.\n'
                'Non disinstallare l’app senza un backup completo verificato.\n')
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise ValueError('ZIP CRC check failed')
            with archive.open(apk_name) as stream:
                if hashlib.file_digest(stream, 'sha256').hexdigest() != expected_sha256:
                    raise ValueError('ZIP contains a different APK')
        temporary.replace(destination)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def tools_for_sdk(sdk):
    extension = '.bat' if os.name == 'nt' else ''
    executable = '.exe' if os.name == 'nt' else ''
    folder = sdk / 'build-tools' / '35.0.0'
    signer, aapt = folder / ('apksigner' + extension), folder / ('aapt' + executable)
    if not signer.is_file() or not aapt.is_file():
        raise ValueError('Android SDK Build Tools 35.0.0 (apksigner/aapt) are required.')
    return signer, aapt


def failed_tap_tests(log_text, limit=30):
    """Extract failing Node --test TAP case names, without altering gate results."""
    import re
    if not isinstance(log_text, str):
        return []
    return [match.group(1).strip()[:240] for match in
            list(re.finditer(r"^\s*not ok\s+\d+\s*-\s*(.+)$", log_text, re.MULTILINE))[:limit]]



def verified_native_java_tests(report_dir):
    """Fail closed when Gradle has no executed tests or invalid JUnit XML."""
    files = sorted(report_dir.glob('TEST-*.xml'))
    if not files:
        raise ValueError('Native Java test results are missing; no APK ZIP was created.')
    total = 0
    executed = 0
    for file in files:
        try:
            root = ET.parse(file).getroot()
            if root.tag != 'testsuite':
                raise ValueError('expected testsuite root')
            row = root.attrib
            tests = int(row['tests'])
            failures = int(row['failures'])
            errors = int(row['errors'])
            skipped = int(row.get('skipped', 0))
            if min(tests, failures, errors, skipped) < 0 or skipped > tests or failures + errors > tests:
                raise ValueError('invalid counts')
        except (ET.ParseError, KeyError, ValueError) as exc:
            raise ValueError('Invalid native Java test report: ' + file.name) from exc
        if failures or errors:
            raise ValueError('Native Java tests failed; no APK ZIP was created.')
        total += tests
        executed += tests - skipped
    if executed == 0:
        raise ValueError('No native Java tests executed (zero or all skipped); no APK ZIP was created.')
    return total


def build(args):
    output = validate_output(args.output)
    source = snapshot(offline=args.offline, allow_unmerged=args.allow_unmerged)
    signer, aapt = tools_for_sdk(args.sdk.resolve())
    if not shutil.which('gradle') and not shutil.which('gradle.bat'):
        raise ValueError('Gradle 8.9 must be on PATH; JDK17 and Android SDK35 are required.')
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm:
        raise ValueError('Node/npm are required.')
    output.mkdir(parents=True, exist_ok=True)
    with (output/'.build-in-progress').open('x') as lock:
        lock.write(source['revision']+'\n')
    checks = []

    def run(name, command, cwd=ROOT):
        print(name + '…', flush=True)
        log_path = output / (name + '.log')
        try:
            with log_path.open('w', encoding='utf-8') as log:
                subprocess.run([str(item) for item in command], cwd=cwd,
                               stdout=log, stderr=subprocess.STDOUT, check=True)
        except subprocess.CalledProcessError:
            if name == 'node-tests':
                failures = failed_tap_tests(log_path.read_text(encoding='utf-8', errors='replace'))
                if failures:
                    print('Node test failures (TAP):', file=sys.stderr)
                    for item in failures:
                        print('  FAIL: ' + item, file=sys.stderr)
            print('Full failing gate log: ' + str(log_path), file=sys.stderr)
            raise
        checks.append({'name': name, 'status': 'passed'})

    stage = output / 'android'
    run('node-tests', [npm, 'test'])
    run('stage', [sys.executable, ROOT/'scripts/release/prepare.py', 'android', stage])
    run('native-gate', [sys.executable, ROOT/'scripts/release/android_06_gate.py', '--project', stage])
    apk = stage/'app/build/outputs/apk/debug/app-debug.apk'
    report_path = output/'android-identity.json'
    run('verify', [sys.executable, ROOT/'scripts/release/verify_android_preview.py',
                  '--apk', apk, '--apksigner', signer, '--aapt', aapt,
                  '--stage', stage, '--output', report_path])
    identity = json.loads(report_path.read_text())
    after = snapshot(offline=args.offline, allow_unmerged=args.allow_unmerged)
    if source != after or identity['sourceRevision'] != source['revision']:
        raise ValueError('Source or main changed during compilation; no ZIP was created. Build again from a clean checkout.')
    native_java_tests = verified_native_java_tests(
        stage/'app/build/test-results/testDebugUnitTest')
    version = identity['version']
    destination = output/('Glauka-Android-' + version + '.zip')
    package_zip(apk, destination, version, source['revision'], identity['sha256'])
    manifest = {'sourceRevision': source['revision'], 'sourceDirty': False,
                'privateOwnerActivation': True, 'aiLicenseRequired': True,
                'aiModel': 'bring-your-own-provider-key', 'localToolsPlan': 'free',
                'source': source, 'android': identity, 'checks': checks,
                'nativeJavaTests': native_java_tests,
                'physicalDeviceVerified': False, 'publicReleaseReady': False,
                'files': {destination.name: {'bytes': destination.stat().st_size,
                                            'sha256': sha256(destination)}}}
    (output/'build-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    (output/'SHA256SUMS.txt').write_text(sha256(destination)+'  '+destination.name+'\n')
    (output/'.build-in-progress').unlink()
    print('Verified private APK ZIP: ' + str(destination))
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    sdk = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
    parser.add_argument('--sdk', type=Path, default=Path(sdk) if sdk else None)
    parser.add_argument('--offline', action='store_true', help='Use cached origin/main; report that live main was not checked')
    parser.add_argument('--allow-unmerged', action='store_true', help='Explicit private preview of a committed branch outside main')
    args = parser.parse_args()
    if args.sdk is None:
        parser.error('--sdk or ANDROID_HOME/ANDROID_SDK_ROOT is required')
    try:
        build(args)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, 'No distributable ZIP: '+str(error)+'\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
