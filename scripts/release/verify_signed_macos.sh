#!/usr/bin/env bash
# Glauka release gate: validate the actual signed and notarized .app and .dmg.
# Run on macOS with Xcode Command Line Tools; no GitHub Actions.
set -euo pipefail
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "FAIL: real macOS Gatekeeper verification requires macOS" >&2
  exit 2
fi
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/Glauka-Mac-Release/output" >&2
  exit 2
fi
build_dir="$1"
manifest="$build_dir/build-manifest.json"
app="$build_dir/Glauka.app"
[[ -f "$manifest" && -d "$app" ]] || { echo "FAIL: missing app or manifest" >&2; exit 1; }
# Manifest validation (including SHA256) is checked against the complete set
# of artifacts *before* invoking Gatekeeper and notarization services.
python3 - "$manifest" "$build_dir" <<'PY'
import hashlib, json, pathlib, plistlib, re, sys
manifest_path, build_dir = map(pathlib.Path, sys.argv[1:])
m=json.loads(manifest_path.read_text())
assert m['target']=='macos' and m['edition']=='Release', 'not a production macOS build'
assert m['developerEntitlement'] is False and m['sourceDirty'] is False
assert m['distributionReady'] is True and m['macSigning']['status']=='developer-id-notarized'
root=build_dir.resolve()
dmg=[]
for item in m['artifacts']:
    p=(root/item['name']).resolve()
    assert p.is_relative_to(root), 'unsafe artifact path'
    assert p.is_file(), 'missing artifact: '+str(p)
    assert hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256'], 'hash mismatch: '+str(p)
    if p.suffix=='.dmg': dmg.append(str(p))
assert len(dmg)==1, 'expected precisely one notarized DMG'
match = re.fullmatch(r'Glauka-Mac-(.+)-Release\.dmg', pathlib.Path(dmg[0]).name)
assert match is not None, 'unexpected public DMG filename'
version = match.group(1)
info_path = build_dir/'Glauka.app/Contents/Info.plist'
info = plistlib.loads(info_path.read_bytes())
assert info['CFBundleExecutable']=='Glauka', 'wrong app executable in bundle'
assert info['GlaukaReleaseVersion']==version, 'bundle/DMG full version differs'
assert info['CFBundleShortVersionString']==version.split('-',1)[0], 'bundle short version differs'
assert str(info['CFBundleVersion']).isdigit(), 'bundle build number is not numeric'
print('VALIDATED_DMG='+dmg[0])
PY
dmg="$(python3 - "$manifest" "$build_dir" <<'PY'
import json,pathlib,sys
m=json.loads(pathlib.Path(sys.argv[1]).read_text())
root=pathlib.Path(sys.argv[2])
print(root/next(item['name'] for item in m['artifacts'] if item['name'].endswith('.dmg')))
PY
)"
codesign --verify --deep --strict --verbose=2 "$app"
sign_details="$(codesign -dv --verbose=4 "$app" 2>&1)"
if ! grep -Fq 'Authority=Developer ID Application:' <<<"$sign_details"; then
  echo "FAIL: signed with ad hoc or non-Developer ID identity" >&2
  exit 1
fi
if ! grep -Eq 'TeamIdentifier=[A-Z0-9]{10}' <<<"$sign_details"; then
  echo "FAIL: Developer Team ID unavailable" >&2
  exit 1
fi
spctl --assess --verbose=4 --type execute "$app"
xcrun stapler validate "$app"
hdiutil verify "$dmg"
xcrun stapler validate "$dmg"
spctl --assess --verbose=4 --type open --context context:primary-signature "$dmg"
echo "PASS: Signed and notarized Developer ID app and DMG accepted by Gatekeeper."
