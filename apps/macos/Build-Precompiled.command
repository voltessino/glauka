#!/bin/bash
# Run inside the Mac build kit, beside mac/, output/ and clipboard-test/main.swift.
set -euo pipefail
cd -- "$(dirname -- "$0")"
trap 'printf "\nBuild interrotta. Leggi l’errore sopra. Premi Invio per chiudere.\n"; read -r unused || true' ERR
if [ "$(uname -s)" != Darwin ]; then
  printf 'Questo pacchetto richiede macOS 12 o successivo.\n'
  exit 1
fi
if ! xcrun --find swiftc >/dev/null 2>&1; then
  printf 'Installa prima gli strumenti Apple: xcode-select --install\n'
  exit 1
fi
(cd output && shasum -a 256 -c SHA256SUMS.txt)
shasum -a 256 -c KIT-SHA256SUMS.txt
# Native wrappers must be built from the enclosed current sources.
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/neuromap-native.XXXXXX")
app="$build_dir/Glauka.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources" output
xcrun swiftc -framework Cocoa mac/Clipboard.swift clipboard-test/main.swift -o "$build_dir/clipboard-tests"
"$build_dir/clipboard-tests"
for arch in arm64 x86_64; do
  xcrun swiftc -O -target "$arch-apple-macos12.0" -framework Cocoa -framework WebKit mac/main.swift mac/Clipboard.swift -o "$build_dir/NeuroMap-$arch"
done
lipo -create "$build_dir/NeuroMap-arm64" "$build_dir/NeuroMap-x86_64" -output "$app/Contents/MacOS/Glauka"
lipo -create output/neuromap-server-amd64 output/neuromap-server-arm64 -output "$app/Contents/MacOS/neuromap-server"
chmod +x "$app/Contents/MacOS/Glauka" "$app/Contents/MacOS/neuromap-server"
cp mac/Info.plist "$app/Contents/Info.plist"
iconset="$build_dir/Glauka.iconset"
mkdir "$iconset"
for size in 16 32 128 256 512; do
  for scale in 1 2; do
    suffix=''
    if [ "$scale" = 2 ]; then suffix='@2x'; fi
    sips -s format png -z "$((size * scale))" "$((size * scale))" resources/icon.png --out "$iconset/icon_${size}x${size}${suffix}.png" >/dev/null
  done
done
iconutil -c icns -o "$app/Contents/Resources/Glauka.icns" "$iconset"
plutil -lint "$app/Contents/Info.plist"
# Local test signature only; this is not an Apple Developer ID or notarization.
codesign --force --sign - "$app/Contents/MacOS/neuromap-server"
codesign --force --sign - "$app/Contents/MacOS/Glauka"
codesign --force --sign - "$app"
codesign --verify --deep --verbose=2 "$app"
version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist")
dmg_source="$build_dir/dmg-content"
mkdir "$dmg_source"
ditto "$app" "$dmg_source/Glauka.app"
ln -s /Applications "$dmg_source/Applications"
dmg="output/Glauka-Mac-$version-Developer.dmg"
archive="output/Glauka-Mac-$version-Developer.zip"
hdiutil create -volname "Glauka Developer $version" -srcfolder "$dmg_source" -ov -format UDZO "$dmg"
hdiutil verify "$dmg"
ditto -c -k --sequesterRsrc --keepParent "$app" "$archive"
shasum -a 256 "$dmg" "$archive" > output/MACOS-PACKAGE-SHA256SUMS.txt
printf '\nDMG e app ZIP creati nella cartella output. Firma locale di prova, senza notarizzazione.\n'
open output
