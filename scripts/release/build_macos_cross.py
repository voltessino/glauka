#!/usr/bin/env python3
"""Build a universal Cocoa/WebKit app and a real HFS+/UDIF DMG from Linux.

Requires the pinned, preconfigured tools described in docs/building-macos-on-linux.md.
This checks packaging integrity; it cannot execute or certify macOS behavior.
"""
import argparse
import hashlib
import json
from pathlib import Path
import plistlib
import shutil
import struct
import subprocess
import zipfile

from build_desktop import build, run
from prepare import ROOT
from macos_artifacts import universal, verify_adhoc, png_icns
from verify_embedded_ui import verify


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def package(destination, tool_root, go):
    tools = Path(tool_root).resolve()
    swift = tools/'linux/usr/bin/swiftc'
    rcodesign = tools/'rcodesign/apple-codesign-0.29.0-x86_64-unknown-linux-musl/rcodesign'
    hfs = tools/'libdmg/build/hfs/hfsplus'
    dmgtool = tools/'libdmg/build/dmg/dmg'
    mkfs = tools/'hfs-source/newfs_hfs.tproj/newfs_hfs'
    fsck = tools/'hfs-source/fsck_hfs.tproj/fsck_hfs'
    for command in (swift, rcodesign, hfs, dmgtool, mkfs, fsck):
        if not command.is_file():
            raise ValueError('Missing cross-build tool: '+str(command))
    output = build('macos', destination, go=go, backend_only=True, developer=True)
    dest = output.parent
    manifest = json.loads((output/'build-manifest.json').read_text())
    if manifest['sourceDirty']:
        raise ValueError('Build from a clean, committed checkout')
    version = json.loads((ROOT/'versions.json').read_text())['macos']['version']
    sources, native = dest/'mac', dest/'native-cross'
    native.mkdir()
    app = output/'Glauka Developer.app'
    mac, resources = app/'Contents/MacOS', app/'Contents/Resources'
    mac.mkdir(parents=True)
    resources.mkdir()
    common = [swift, '-O', '-sdk', tools/'sdk/MacOSX14.4.sdk',
              '-resource-dir', tools/'mac-resources/usr/lib/swift',
              '-tools-directory', tools/'linux/usr/bin', '-module-cache-path', dest/'module-cache',
              '-use-ld=lld', '-Xlinker', '-dead_strip_dylibs', '-Xlinker', '-fatal_warnings',
              '-framework', 'Cocoa', '-framework', 'WebKit']
    shells = []
    for arch in ('x86_64', 'arm64'):
        binary = native/('NeuroMap-'+arch)
        run([*common, '-target', arch+'-apple-macos12.0', sources/'main.swift', sources/'Clipboard.swift', '-o', binary], dest)
        shells.append(binary)
    # Compile the real clipboard regression binary too. Linux cannot run it.
    run([*common, '-target', 'arm64-apple-macos12.0', sources/'Clipboard.swift',
         ROOT/'apps/macos/tests/clipboard/main.swift', '-o', native/'clipboard-tests-arm64'], dest)
    universal(shells, mac/'Glauka')
    universal([output/'neuromap-server-amd64', output/'neuromap-server-arm64'], mac/'neuromap-server')
    shutil.copy2(sources/'Info.plist', app/'Contents/Info.plist')
    shutil.copy2(sources/'NativeMessages.json', resources/'NativeMessages.json')
    for localized in sources.glob('*.lproj'):
        shutil.copytree(localized, resources/localized.name)
    info = plistlib.loads((app/'Contents/Info.plist').read_bytes())
    if (info['CFBundleExecutable'] != 'Glauka' or
        info['CFBundleIdentifier'] != 'com.neuromap.architect.macbeta.developer' or
        info['CFBundleDisplayName'] != 'Glauka Developer' or
        info['CFBundleShortVersionString'] != version.split('-',1)[0]):
        raise ValueError('Bundle identity/version mismatch')
    # Preserve the branded PNG pixels with their actual ICNS chunk size.
    png = (dest/'desktop/resources/icon.png').read_bytes()
    (resources/'Glauka.icns').write_bytes(png_icns(png))
    run([rcodesign, 'sign', '-C', '/dev/null', app], dest)
    for path in [app, *app.rglob('*')]:
        path.chmod(0o755 if path.is_dir() or path.parent == mac else 0o644)
    signatures = {'shell': verify_adhoc(mac/'Glauka', app),
                  'backend': verify_adhoc(mac/'neuromap-server')}
    manifest['embeddedEditorChecks'].append(verify(mac/'neuromap-server', dest/'desktop/resources/index.html'))
    # Check the signed resource envelope, including the nested universal backend.
    envelope = plistlib.loads((app/'Contents/_CodeSignature/CodeResources').read_bytes())
    for name, entry in envelope.get('files2', {}).items():
        if isinstance(entry, dict) and 'hash2' in entry:
            if hashlib.sha256((app/'Contents'/name).read_bytes()).digest() != entry['hash2']:
                raise ValueError('Resource envelope mismatch: '+name)
        if isinstance(entry, dict) and 'cdhash' in entry:
            if entry['cdhash'].hex() not in {r['cdhash'] for r in signatures['backend']}:
                raise ValueError('Nested executable signature mismatch')
    raw = dest/'distribution.hfs'
    with raw.open('wb') as stream:
        stream.truncate(128*1024*1024)
    run([mkfs, '-v', 'Glauka '+version, '-U', '0', '-G', '0', '-M', '0755', raw], dest)
    run([hfs, raw, 'mkdir', '/'+app.name], dest)
    run([hfs, raw, 'addall', app, '/'+app.name], dest)
    run([hfs, raw, 'symlink', '/Applications', '/Applications'], dest)
    for name in ('Glauka', 'neuromap-server'):
        # addall defaults to 0644; explicitly grant execution in the filesystem.
        run([hfs, raw, 'chmod', '0755', '/'+app.name+'/Contents/MacOS/'+name], dest)
    listing = subprocess.check_output([str(hfs), str(raw), 'ls', '/'+app.name+'/Contents/MacOS'], text=True)
    if sum(line.startswith('100755') for line in listing.splitlines()) != 2:
        raise ValueError('DMG executable permissions are incorrect')
    run([fsck, '-fn', raw], dest)
    image = output/f'Glauka-Mac-{version}-Developer.dmg'
    run([dmgtool, 'build', raw, image], dest)
    with image.open('rb') as stream:
        stream.seek(-512, 2)
        if stream.read(4) != b'koly':
            raise ValueError('Missing UDIF trailer')
    recovered = dest/'recovered.hfs'
    run([dmgtool, 'extract', image, recovered], dest)
    if digest(raw) != digest(recovered):
        raise ValueError('DMG filesystem roundtrip mismatch')
    readback = dest/'readback'
    readback.mkdir()
    run([hfs, recovered, 'extractall', '/', readback], dest)
    for path in app.rglob('*'):
        if path.is_file() and digest(path) != digest(readback/app.name/path.relative_to(app)):
            raise ValueError('DMG app readback mismatch: '+str(path))
    archive = output/f'Glauka-Mac-{version}-Developer.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for path in [app, *sorted(app.rglob('*'))]:
            z.write(path, path.relative_to(output))
    manifest.update({'backendOnly': False, 'buildMethod': 'Linux Swift/Clang/LLD cross compilation',
                     'macosSigning': {'status': 'ad-hoc', 'notarized': False, 'integrityChecks': signatures},
                     'clipboardTestsCompiled': True, 'clipboardTestsExecuted': False,
                     'dmgFilesystemChecked': True, 'dmgRoundtripVerified': True, 'appReadbackVerified': True,
                     'toolchain': {'swift': '6.0.3', 'sdk': '14.4', 'rcodesign': '0.29.0'},
                     'artifacts': [{'name': p.name, 'sha256': digest(p)} for p in (image, archive)]})
    (output/'build-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    (output/'SHA256SUMS.txt').write_text(''.join(p['sha256']+'  '+p['name']+'\n' for p in manifest['artifacts']))
    print(output)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination')
    parser.add_argument('--tool-root', required=True)
    parser.add_argument('--go', default='go')
    args = parser.parse_args()
    package(args.destination, args.tool_root, args.go)
