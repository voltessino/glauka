# Build Mac da Linux, senza GitHub Actions

La build nativa su Mac rimane in `scripts/release/build_desktop.py macos`. È disponibile anche una compilazione incrociata che conserva **gli stessi sorgenti Swift/Cocoa/WebKit e Go**, senza sostituire l'app con un launcher browser.

```sh
GOCACHE=/workspace/.neuromap-cache/go GOPATH=/workspace/.neuromap-cache/gopath \
python3 scripts/release/build_macos_cross.py /workspace/NUOVA_CARTELLA \
  --tool-root /workspace/.neuromap-tools/swift-cross \
  --go /workspace/.neuromap-tools/go/bin/go
```

Il checkout deve essere pulito e la destinazione nuova. Il toolchain predisposto in questo ambiente rimane fuori dal repository e non viene distribuito insieme all'app.

## Dipendenze predisposte

- Swift **6.0.3** Linux Ubuntu 24.04, inclusi Clang/LLD, da `download.swift.org/swift-6.0.3-release/ubuntu2404/swift-6.0.3-RELEASE/swift-6.0.3-RELEASE-ubuntu24.04.tar.gz`.
- Moduli e librerie statiche Darwin della corrispondente distribuzione ufficiale `download.swift.org/swift-6.0.3-release/xcode/swift-6.0.3-RELEASE/swift-6.0.3-RELEASE-osx.pkg`, estratti dal payload gzip/CPIO del contenitore XAR in `mac-resources/`.
- SDK **14.4** da [joseluisq/macosx-sdks](https://github.com/joseluisq/macosx-sdks/releases/tag/14.4), archivio confrontato con il relativo SHA-256. Nel toolchain locale `libxml2/libxml` è un alias di `../libxml`, eliminando la doppia definizione del modulo. `mac-resources/usr/lib/clang/17` punta agli header Clang Linux. Le `.dylib` del toolchain Darwin sono spostate fuori dal percorso di link: si usano gli stub delle **librerie di sistema** dello SDK, evitando dipendenze dal toolchain e avvisi macOS 13 su un'app con minimo macOS 12.
- **rcodesign 0.29.0**, archivio Linux musl e SHA-256 della [release ufficiale](https://github.com/indygreg/apple-platform-rs/releases/tag/apple-codesign/0.29.0), estratto in `rcodesign/`.
- [libdmg-hfsplus](https://github.com/planetbeing/libdmg-hfsplus) al commit `7ac55ec64c96f7800d9818ce64c79670e7f02b67`, compilato in `libdmg/build`. L'opzione opzionale OpenSSL/FileVault è disabilitata nel CMake del tool locale: viene creata un'immagine **non cifrata**, senza necessità delle API OpenSSL obsolete. CMake 3.31.6 è installato fuori dal repository.
- [pkg-hfsprogs](https://github.com/rbrito/pkg-hfsprogs) al commit `1b7634dc22420d9e5b00b77962a58d29b851bfef`: applicate nell'ordine le patch `debian/patches/series`. Su Debian 13 si usa `<string.h>` della glibc per strlcpy/strlcat al posto dell'header libbsd, si esclude `<sys/sysctl.h>` dal ramo Linux e si collega fsck a `libbsd.so.0`. GCC usa `-D_GNU_SOURCE -DDEBUG_BUILD=0 -D_FILE_OFFSET_BITS=64 -DLINUX=1 -DBSD=1` e il percorso `include/` del port. I due eseguibili si trovano in `hfs-source/{newfs_hfs,fsck_hfs}.tproj/`.

## Cosa verifica la procedura

Compila Intel e Apple Silicon con minimo macOS 12, usando gli stessi sorgenti nativi; genera i due eseguibili universali e una firma ad hoc del bundle. Controlla tutte le pagine SHA-256 delle quattro slice, i riferimenti alle sole librerie di sistema, Info.plist, requisiti, CodeResources e i riferimenti al backend annidato. La firma ad hoc ha intenzionalmente CMS vuoto: **non** equivale a Developer ID o notarizzazione.

Crea un filesystem HFS+ nuovo, con collegamento ad Applicazioni e permessi eseguibili espliciti per entrambi i programmi; esegue fsck senza riparazioni. Crea un contenitore DMG UDIF, lo decomprime e confronta il filesystem byte per byte, poi rilegge ogni file dell'app. Produce anche lo ZIP del bundle, manifest e SHA-256. Verifica l'editor effettivamente incorporato nel backend.

`nativeApplicationExecuted` e `clipboardTestsExecuted` restano **false**: i test clipboard nativi vengono soltanto compilati. La validità del contenitore, delle firme ad hoc e dei file non dimostra il funzionamento WKWebView o l'accettazione Gatekeeper su un Mac reale.
