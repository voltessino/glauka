#!/usr/bin/env python3
"""Build desktop packages from this checkout, without GitHub Actions."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import zipfile
from urllib.parse import urlsplit

from prepare import prepare, ROOT
from verify_embedded_ui import verify
from windows_metadata import stage_windows_distribution_metadata
from macos_edition import stage_macos_edition


def run(args, cwd, env=None):
    print('+ ' + ' '.join(map(str, args)), flush=True)
    subprocess.run(list(map(str, args)), cwd=cwd, env=env, check=True)


def sign_windows(binary, thumbprint, signtool='signtool.exe'):
    """Use a verified identity already provisioned in the Windows certificate store.

    SignTool supports hardware/cloud-backed keys through the certificate's CSP/KSP.
    A failed signature or trust/timestamp verification aborts packaging.
    """
    run([signtool, 'sign', '/sha1', thumbprint, '/s', 'My', '/fd', 'SHA256',
         '/tr', 'http://timestamp.digicert.com', '/td', 'SHA256', binary], ROOT)
    run([signtool, 'verify', '/pa', '/all', '/tw', binary], ROOT)


def validate_signing(target, thumbprint):
    if not thumbprint:
        return
    if target != 'windows' or platform.system() != 'Windows':
        raise ValueError('Authenticode signing requires a Windows build host and a provisioned code-signing certificate.')
    if not re.fullmatch(r'[0-9A-Fa-f]{40}', thumbprint):
        raise ValueError('Certificate thumbprint must contain exactly 40 hexadecimal characters.')


def build(target, destination, go='go', backend_only=False, windows_thumbprint=None, signtool='signtool.exe',
          developer=False, mac_sign_identity=None, mac_notary_profile=None, license_url=None):
    """Build production (Free/license checked) by default; Developer is explicit and private."""
    variant = 'Developer' if developer else 'Release'
    edition_tags = ['-tags', 'developer'] if developer else []
    # Pin the production license origin in the compiled Go backend. Never
    # rely on an environment variable for a distributed paid application.
    if license_url:
        parsed = urlsplit(license_url)
        if (parsed.scheme != 'https' or not parsed.hostname or
                parsed.username or parsed.password or parsed.query or parsed.fragment or
                any(ch.isspace() for ch in license_url)):
            raise ValueError('Production license endpoint must be a clean HTTPS URL without credentials, query or fragment.')
        license_url = license_url.rstrip('/')
    license_ldflag = ' -X main.releaseLicenseURL=' + license_url if license_url else ''
    if target == 'macos' and not developer and not backend_only:
        if not mac_sign_identity or not mac_notary_profile:
            raise ValueError('Public macOS release requires Developer ID Application signing and a notarization Keychain profile. Use --developer for private local tests.')
    if developer and (mac_sign_identity or mac_notary_profile):
        raise ValueError('Do not sign/notarize a private Developer entitlement as a public release.')
    validate_signing(target, windows_thumbprint)
    if target == 'macos' and platform.system() != 'Darwin' and not backend_only:
        raise ValueError('The Swift/WebKit app and DMG require macOS and Xcode Command Line Tools. Use --backend-only to cross-compile Go backends.')
    version=json.loads((ROOT/'versions.json').read_text(encoding='utf-8'))[target]['version']
    license_ldflag += ' -X main.xmindCreatorVersion=' + version
    google_secret = os.environ.get('GLAUKA_GOOGLE_CLIENT_SECRET', '').strip()
    if google_secret:
        if any(c.isspace() for c in google_secret):
            raise ValueError('GLAUKA_GOOGLE_CLIENT_SECRET must not contain whitespace.')
        license_ldflag += ' -X main.embeddedGoogleClientSecret=' + google_secret
    dest = Path(destination).resolve()
    prepare(target, dest)
    desktop, output = dest/'desktop', dest/'output'
    if target == 'windows':
        stage_windows_distribution_metadata(desktop, version, developer)
    elif target == 'macos':
        stage_macos_edition(dest/'mac', developer)
    output.mkdir()
    host_env = dict(os.environ, GLAUKA_AUDIT_SOURCE_ROOT=str(ROOT))
    host_env.pop('GOOS', None)
    host_env.pop('GOARCH', None)
    repo_nm = ROOT.parent / 'neuromap-android' / 'node_modules'
    if repo_nm.is_dir() and 'NODE_PATH' not in host_env:
        host_env['NODE_PATH'] = str(repo_nm)
    for tags in ([], ['-tags', 'developer']):
        run([go, 'test', *tags, '.'], desktop, host_env)
    # A successful Go compile cannot detect a browser microtask/observer loop.
    # Exercise the real staged native server/CSP/bridge before packaging an app.
    startup_verified = False
    if not backend_only:
        qa_startup = desktop / ('glauka-startup-qa.exe' if platform.system() == 'Windows' else 'glauka-startup-qa')
        qa_env = dict(host_env, CGO_ENABLED='0')
        run([go, 'build', '-buildvcs=false', *edition_tags, '-trimpath', '-o', qa_startup, '.'], desktop, qa_env)
        try:
            run(['node', ROOT/'scripts/qa/desktop_startup_smoke.cjs', qa_startup], ROOT, host_env)
            startup_verified = True
        finally:
            qa_startup.unlink(missing_ok=True)
    env = dict(host_env, CGO_ENABLED='0')
    artifacts = []
    if target == 'windows':
        env.update(GOOS='windows', GOARCH='amd64')
        local_vi = Path(os.environ.get('GOPATH', Path.home() / 'go')) / 'bin' / ('goversioninfo.exe' if platform.system() == 'Windows' else 'goversioninfo')
        if shutil.which('goversioninfo'):
            vi_args = ['goversioninfo', '-64', '-o', 'rsrc_windows_amd64.syso']
        elif local_vi.is_file():
            vi_args = [str(local_vi), '-64', '-o', 'rsrc_windows_amd64.syso']
        else:
            vi_args = [go, 'run', 'github.com/josephspurrier/goversioninfo/cmd/goversioninfo@v1.5.0', '-64', '-o', 'rsrc_windows_amd64.syso']
        for folder in (desktop, desktop/'setup'):
            run(vi_args, folder, host_env)
        app = desktop/'setup/binaries/NeuroMap-Architect.exe'
        run([go, 'build', '-buildvcs=false', *edition_tags, '-trimpath', '-ldflags', '-s -w -H windowsgui' + license_ldflag, '-o', app, '.'], desktop, env)
        # A console-mode QA copy from identical Go sources runs real local
        # unauthorized-request probes; unlike WindowsGUI it has a stdout URL.
        if platform.system() == 'Windows':
            qa_binary = desktop/'neuromap-qa-server.exe'
            run([go,'build','-buildvcs=false',*edition_tags,'-trimpath',
                 '-ldflags','-s -w' + license_ldflag,'-o',qa_binary,'.'],desktop,env)
            try:
                run([sys.executable,ROOT/'scripts/qa/pentest_loopback.py',qa_binary],ROOT)
            finally:
                qa_binary.unlink(missing_ok=True)
        # Sign before copying AND before Go embeds the app into the installer.
        if windows_thumbprint:
            sign_windows(app, windows_thumbprint, signtool)
        portable = output/f'Glauka-Portable-{version}-{variant}.exe'
        shutil.copy2(app, portable)
        installer = output/f'Glauka-Setup-{version}-{variant}.exe'
        run([go, 'build', '-buildvcs=false', '-trimpath', '-ldflags',
             '-s -w -H windowsgui -X main.installerEdition=' + variant, '-o', installer, '.'], desktop/'setup', env)
        if windows_thumbprint:
            sign_windows(installer, windows_thumbprint, signtool)
        artifacts = [portable, installer]
        if platform.system() == 'Windows':
            run(['powershell.exe', '-NoProfile', '-File', ROOT/'apps/windows/tests/install_upgrade.tests.ps1', '-Desktop', desktop], ROOT)
        archive = output/f'Glauka-Windows-{version}-{variant}.zip'
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
            for artifact in artifacts:
                z.write(artifact, artifact.name)
        artifacts.append(archive)
    else:
        backends = []
        for arch in ('amd64', 'arm64'):
            binary = output/('neuromap-server-'+arch)
            run([go, 'build', '-buildvcs=false', *edition_tags, '-trimpath', '-ldflags', '-s -w' + license_ldflag, '-o', binary, '.'], desktop, dict(env, GOOS='darwin', GOARCH=arch))
            backends.append(binary)
        if backend_only:
            artifacts = backends
        else:
            app = output/('Glauka Developer.app' if developer else 'Glauka.app')
            mac = app/'Contents/MacOS'
            resources = app/'Contents/Resources'
            mac.mkdir(parents=True)
            resources.mkdir()
            clipboard_test = output/'clipboard-tests'
            run(['swiftc', '-framework', 'Cocoa', dest/'mac/Clipboard.swift', ROOT/'apps/macos/tests/clipboard/main.swift', '-o', clipboard_test], dest)
            run([clipboard_test], dest)
            native = []
            for arch in ('arm64', 'x86_64'):
                binary = output/('NeuroMap-'+arch)
                run(['swiftc', '-O', '-target', arch+'-apple-macos12.0', '-framework', 'Cocoa', '-framework', 'WebKit', dest/'mac/main.swift', dest/'mac/Clipboard.swift', '-o', binary], dest)
                native.append(binary)
            run(['lipo', '-create', *native, '-output', mac/'Glauka'], dest)
            run(['lipo', '-create', *backends, '-output', mac/'neuromap-server'], dest)
            # Exercise the production backend against real loopback abuse probes
            # before signing any public package.
            run([sys.executable, ROOT/'scripts/qa/pentest_loopback.py',
                 mac/'neuromap-server'],ROOT)
            for binary in mac.iterdir():
                binary.chmod(binary.stat().st_mode | 0o111)
            shutil.copy2(dest/'mac/Info.plist', app/'Contents/Info.plist')
            shutil.copy2(dest/'mac/NativeMessages.json', resources/'NativeMessages.json')
            for localized in (dest/'mac').glob('*.lproj'):
                shutil.copytree(localized, resources/localized.name)
            iconset = output/'NeuroMap.iconset'
            iconset.mkdir()
            for size in (16, 32, 128, 256, 512):
                for scale in (1, 2):
                    filename = f'icon_{size}x{size}'+('@2x' if scale == 2 else '')+'.png'
                    run(['sips', '-s', 'format', 'png', '-z', size*scale, size*scale, desktop/'resources/icon.png', '--out', iconset/filename], dest)
            run(['iconutil', '-c', 'icns', '-o', resources/'Glauka.icns', iconset], dest)
            run(['plutil', '-lint', app/'Contents/Info.plist'], dest)
            if developer:
                run(['codesign', '--force', '--deep', '--sign', '-', app], dest)
            else:
                # A trusted macOS release uses a Developer ID certificate,
                # hardened runtime, a timestamp and Apple notarization.
                run(['codesign', '--force', '--deep', '--options', 'runtime', '--timestamp',
                     '--sign', mac_sign_identity, app], dest)
            run(['codesign', '--verify', '--deep', '--strict', '--verbose=2', app], dest)
            if not developer:
                notary_zip = output/'neuromap-notary-submission.zip'
                run(['ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', app, notary_zip], dest)
                run(['xcrun', 'notarytool', 'submit', notary_zip, '--keychain-profile',
                     mac_notary_profile, '--wait'], dest)
                run(['xcrun', 'stapler', 'staple', app], dest)
                run(['xcrun', 'stapler', 'validate', app], dest)
                notary_zip.unlink()
            dmg_source = output/'dmg-content'
            dmg_source.mkdir()
            run(['ditto', app, dmg_source/app.name], dest)
            (dmg_source/'Applications').symlink_to('/Applications')
            dmg = output/f'Glauka-Mac-{version}-{variant}.dmg'
            run(['hdiutil', 'create', '-volname', f'Glauka {variant} {version}', '-srcfolder', dmg_source, '-ov', '-format', 'UDZO', dmg], dest)
            run(['hdiutil', 'verify', dmg], dest)
            if not developer:
                run(['xcrun', 'notarytool', 'submit', dmg, '--keychain-profile',
                     mac_notary_profile, '--wait'], dest)
                run(['xcrun', 'stapler', 'staple', dmg], dest)
                run(['xcrun', 'stapler', 'validate', dmg], dest)
            archive = output/f'Glauka-Mac-{version}-{variant}.zip'
            run(['ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', app, archive], dest)
            artifacts = [dmg, archive, mac/'neuromap-server']
    checks = [verify(p, desktop/'resources/index.html') for p in artifacts if p.suffix == '.exe' or p.name.startswith('neuromap-server')]
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip())
    manifest = {'sourceRevision': revision, 'sourceDirty': dirty, 'host': platform.system(), 'target': target,
                'edition': variant, 'developerEntitlement': bool(developer),
                'privateOwnerActivation': bool(developer), 'aiLicenseRequired': True,
                'aiModel': 'bring-your-own-provider-key', 'localToolsPlan': 'free',
                'licenseServerConfigured': bool(license_url),
                'macSigning': ({'status': 'ad-hoc-private' if developer else 'developer-id-notarized'}
                               if target == 'macos' and not backend_only else None),
                'distributionReady': (not developer and
                     ((target == 'windows' and bool(windows_thumbprint)) or
                      (target == 'macos' and not backend_only and bool(mac_sign_identity) and bool(mac_notary_profile)))),
                'nativeApplicationExecuted': False, 'uiTestsRunByThisScript': startup_verified, 'startupSmokeVerified': startup_verified, 'backendOnly': backend_only,
                'windowsSigning': ({'status': 'verified' if windows_thumbprint else 'unsigned',
                                    'certificateThumbprint': windows_thumbprint} if target == 'windows' else None),
                'embeddedEditorChecks': checks,
                'artifacts': [{'name': str(p.relative_to(output)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in artifacts]}
    (output/'build-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    (output/'SHA256SUMS.txt').write_text(''.join(p['sha256']+'  '+p['name']+'\n' for p in manifest['artifacts']), encoding='utf-8')
    # Run independent OS trust commands against the real resulting packages,
    # not merely the fact that signing commands returned zero earlier.
    if target == 'windows' and windows_thumbprint and platform.system() == 'Windows' and not developer:
        run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
             ROOT/'scripts/release/verify_signed_windows.ps1', '-BuildDirectory', dest], ROOT)
    elif target == 'macos' and not developer and not backend_only:
        run(['bash', ROOT/'scripts/release/verify_signed_macos.sh', output], ROOT)
    print(output)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('platform', choices=['windows', 'macos'])
    parser.add_argument('destination', help='Fresh directory outside the checkout')
    parser.add_argument('--go', default='go', help='Go executable')
    parser.add_argument('--backend-only', action='store_true', help='macOS Go backends only; no Swift app or DMG')
    parser.add_argument('--developer', action='store_true', help='PRIVATE testing only: embeds unrestricted developer entitlement. Never distribute.')
    parser.add_argument('--mac-sign-identity', help='Developer ID Application certificate in the macOS signing Keychain')
    parser.add_argument('--mac-notary-profile', help='Apple notarytool Keychain profile (no secret is stored in source)')
    parser.add_argument('--license-url', help='Pinned HTTPS licensing/proxy service origin embedded in public Go binary')
    parser.add_argument('--windows-sign-thumbprint', help='Trusted code-signing certificate in CurrentUser/My (Windows host only)')
    parser.add_argument('--signtool', default='signtool.exe', help='Windows SDK SignTool executable')
    args = parser.parse_args()
    if args.backend_only and args.platform != 'macos':
        parser.error('--backend-only applies only to macos')
    try:
        build(args.platform, args.destination, args.go, args.backend_only, args.windows_sign_thumbprint,
              args.signtool, args.developer, args.mac_sign_identity, args.mac_notary_profile,
              args.license_url)
    except ValueError as error:
        parser.exit(2, str(error)+'\n')
