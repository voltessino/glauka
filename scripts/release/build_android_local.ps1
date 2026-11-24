# Glauka Android: APK debug da Windows con un solo comando.
# Non usa GitHub Actions e non contiene credenziali cloud.
# powershell -ExecutionPolicy Bypass -File .\scripts\release\build_android_local.ps1
[CmdletBinding()]
param([switch]$SkipUpdate,[switch]$RunTests,[switch]$AllowDifferentPreviewSigner,[switch]$PreviewBranch)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Step([string]$message) {
    Write-Host ''
    Write-Host ('[Glauka APK] ' + $message) -ForegroundColor Cyan
}
function Fail([string]$message) {
    throw ('GLAUKA BUILD: ' + $message)
}
function CommandPath([string]$name) {
    $item = Get-Command $name -ErrorAction SilentlyContinue
    if ($null -ne $item) { return $item.Source }
    return $null
}

Step 'Controllo Git e ultimo main'
if (-not (CommandPath 'git.exe')) { Fail 'Git mancante. Installa Git for Windows.' }
$branch = (& git -C $repo branch --show-current | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { Fail 'Impossibile leggere il branch Git.' }
if ($branch -ne 'main' -and -not $PreviewBranch) { Fail ('Sei sul branch ' + $branch + '. Usa: git switch main, oppure -PreviewBranch -SkipUpdate per una prova privata.') }
if ($PreviewBranch -and $branch -eq 'main') { Fail '-PreviewBranch e riservato a branch di prova, non a main.' }
if ($PreviewBranch -and -not $SkipUpdate) { Fail '-PreviewBranch richiede -SkipUpdate: non unire main nel branch durante una prova.' }
$dirty = (& git -C $repo status --porcelain | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { Fail 'Stato Git non disponibile.' }
if ($dirty) { Fail 'Ci sono modifiche locali: crea un commit prima di compilare un APK distribuibile. -SkipUpdate evita soltanto il pull.' }
if (-not $SkipUpdate) {
    & git -C $repo pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { Fail 'Impossibile aggiornare main. Controlla la connessione a GitHub.' }
}
$revisionFull = (& git -C $repo rev-parse HEAD | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $revisionFull -notmatch '^[0-9a-f]{40}$') { Fail 'Commit Git non valido.' }
$revision = $revisionFull.Substring(0, 10)
Write-Host ('Commit sorgente: ' + $revision) -ForegroundColor Green

Step 'Controllo Python 3'
$python = CommandPath 'py.exe'
$pythonArgs = @('-3')
if (-not $python) {
    $python = CommandPath 'python.exe'
    $pythonArgs = @()
}
if (-not $python) { Fail 'Python 3 mancante. Installa Python e riapri PowerShell.' }
& $python @pythonArgs --version
if ($LASTEXITCODE -ne 0) { Fail 'Python 3 non funziona.' }

Step 'Controllo Android SDK API 35'
$sdkCandidates = @(
    [Environment]::GetEnvironmentVariable('ANDROID_HOME'),
    [Environment]::GetEnvironmentVariable('ANDROID_SDK_ROOT'),
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
)
$sdk = $null
foreach ($candidate in $sdkCandidates) {
    if ($candidate -and (Test-Path (Join-Path $candidate 'platforms\android-35\android.jar'))) {
        $sdk = $candidate
        break
    }
}
if (-not $sdk) {
    Fail 'SDK API 35 mancante. Android Studio > SDK Manager > Android 15 (API 35) e Build Tools 35.'
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
Write-Host ('SDK: ' + $sdk) -ForegroundColor Green

Step 'Controllo JDK'
$studioJbr = Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Android\Android Studio\jbr'
$javaCandidates = @($env:JAVA_HOME, $studioJbr)
$javaHome = $null
foreach ($candidate in $javaCandidates) {
    if ($candidate -and (Test-Path (Join-Path $candidate 'bin\javac.exe'))) {
        $javaHome = $candidate
        break
    }
}
if (-not $javaHome) { Fail 'JDK non trovato. Installa Android Studio oppure un JDK 17+ e configura JAVA_HOME.' }
$env:JAVA_HOME = $javaHome
$env:PATH = (Join-Path $javaHome 'bin') + ';' + $env:PATH
& (Join-Path $javaHome 'bin\java.exe') -version
if ($LASTEXITCODE -ne 0) { Fail 'Java non utilizzabile.' }

Step 'Gradle 8.9 portable con checksum SHA256 ufficiale'
$gradleHash = 'd725d707bfabd4dfdc958c624003b3c80accc03f7037b5122c4b1d0ef15cecab'
$tools = Join-Path $env:LOCALAPPDATA 'Glauka\BuildTools'
$gradleBat = Join-Path $tools 'gradle-8.9\bin\gradle.bat'
if (-not (Test-Path $gradleBat)) {
    New-Item -ItemType Directory -Force -Path $tools | Out-Null
    $zip = Join-Path $tools 'gradle-8.9-bin.zip'
    if (-not (Test-Path $zip)) {
        Write-Host 'Scarico Gradle 8.9 dal sito ufficiale.'
        Invoke-WebRequest -Uri 'https://services.gradle.org/distributions/gradle-8.9-bin.zip' -OutFile $zip -UseBasicParsing
    }
    $actual = (Get-FileHash -Path $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $gradleHash) {
        Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
        Fail 'Checksum Gradle errato: pacchetto eliminato senza eseguirlo.'
    }
    Expand-Archive -LiteralPath $zip -DestinationPath $tools -Force
}
if (-not (Test-Path $gradleBat)) { Fail 'Gradle 8.9 non disponibile dopo estrazione.' }

# -RunTests remains accepted for old commands, but tests can no longer be skipped.
Step 'Test JavaScript obbligatori prima della compilazione'
$npm = CommandPath 'npm.cmd'
if (-not $npm) { Fail 'Node.js/npm mancante. I test JavaScript sono obbligatori.' }
Push-Location $repo
try {
    & $npm test
    if ($LASTEXITCODE -ne 0) { Fail 'Test JavaScript falliti: nessun APK verra distribuito.' }
} finally { Pop-Location }

$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop -or -not (Test-Path $desktop)) { $desktop = $env:USERPROFILE }
$stage = Join-Path $desktop ('Glauka-Android-Stage-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $PID)
$outputDir = Join-Path $desktop 'Glauka-APK'
if ($stage.StartsWith($repo + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    Fail 'Output interno al repository non consentito.'
}

Step 'Compongo gli ultimi file Android (editor, PDF.js, OCR, interfaccia)'
Write-Host ('Cartella temporanea: ' + $stage)
Push-Location $repo
try {
    & $python @pythonArgs 'scripts/release/prepare.py' 'android' $stage
    if ($LASTEXITCODE -ne 0) { Fail 'Preparazione fallita. Leggi gli errori sopra, anche quelli di rete PDF.js/OCR.' }
} finally { Pop-Location }

# Gradle trova Android SDK anche se la configurazione e solo temporanea.
$sdkForGradle = $sdk.Replace('\','/')
# PowerShell 5.1 -Encoding UTF8 adds a BOM; Java Properties requires no BOM.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $stage 'local.properties'), ('sdk.dir=' + $sdkForGradle), $utf8NoBom)

Step 'Compilazione APK debug'
$log = Join-Path $stage 'glauka-apk-build.log'
Push-Location $stage
try {
    $ErrorActionPreference = 'Continue'
    & $gradleBat '--no-daemon' '--max-workers=2' ':app:testDebugUnitTest' ':app:assembleDebug' 2>&1 | Tee-Object -FilePath $log
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { Fail ('Gradle fallito (' + $code + '). Log: ' + $log) }
} finally {
    $ErrorActionPreference = 'Stop'
    Pop-Location
}

# A successful Gradle exit is insufficient if unit tests were skipped or reports are absent.
Step 'Verifica obbligatoria dei risultati Java nativi'
$reportDir = Join-Path $stage 'app\build\test-results\testDebugUnitTest'
$testValidator = 'from pathlib import Path; import sys; sys.path.insert(0, "scripts/release"); from build_android_local import verified_native_java_tests; print("Java tests:", verified_native_java_tests(Path(sys.argv[1])))'
Push-Location $repo
try {
    & $python @pythonArgs '-c' $testValidator $reportDir
    if ($LASTEXITCODE -ne 0) { Fail 'Test Java assenti, saltati o falliti: nessun APK verra distribuito.' }
} finally { Pop-Location }

$built = Join-Path $stage 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $built)) { Fail ('APK non trovato: ' + $built) }
if ((Get-Item -LiteralPath $built).Length -lt 1000000) {
    Fail 'APK troppo piccolo: compilazione da verificare.'
}
Step 'Verifico la firma prima di distribuire un aggiornamento'
$buildTools = Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Directory |
    Where-Object { (Test-Path (Join-Path $_.FullName 'apksigner.bat')) -and (Test-Path (Join-Path $_.FullName 'aapt.exe')) } |
    Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildTools) { Fail 'apksigner/aapt mancanti: installa Android SDK Build Tools 35.' }
$identityReport = Join-Path $stage 'preview-identity.json'
$signerArgs = @()
if ($AllowDifferentPreviewSigner) { $signerArgs += '--allow-different-signer' }
& $python @pythonArgs (Join-Path $repo 'scripts/release/verify_android_preview.py') '--apk' $built '--apksigner' (Join-Path $buildTools.FullName 'apksigner.bat') '--aapt' (Join-Path $buildTools.FullName 'aapt.exe') '--stage' $stage '--output' $identityReport @signerArgs
if ($LASTEXITCODE -ne 0) { Fail 'Verifica APK fallita: non viene distribuito. Controlla firma, versione, commit e risorse incorporate.' }
$verifiedIdentity = Get-Content -LiteralPath $identityReport -Raw | ConvertFrom-Json
if (-not $verifiedIdentity.updates066PreviewInPlace) {
    Write-Host 'FIRMA DIVERSA: questa build locale non aggiorna la preview esistente. Non disinstallare senza un backup completo verificato.' -ForegroundColor Yellow
}
# Do not publish a file if the checkout changed while Gradle/verification ran.
$revisionAfter = (& git -C $repo rev-parse HEAD | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $revisionAfter -ne $revisionFull) {
    Fail 'Il commit e cambiato durante la build: APK non distribuito.'
}
$dirtyAfter = (& git -C $repo status --porcelain | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $dirtyAfter) {
    Fail 'I sorgenti sono cambiati durante la build: APK non distribuito.'
}
if ($verifiedIdentity.sourceRevision -ne $revisionFull -or $verifiedIdentity.sourceDirty -ne $false) {
    Fail 'Identita del sorgente non corrispondente al commit iniziale.'
}
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$name = if ($PreviewBranch) { 'Glauka-Android-preview-' + $revision + '-debug.apk' } else { 'Glauka-Android-main-' + $revision + '-debug.apk' }
$final = Join-Path $outputDir $name
$partial = $final + '.partial'
Copy-Item -LiteralPath $built -Destination $partial -Force
$sha = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant()
if ($sha -ne [string]$verifiedIdentity.sha256) {
    Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
    Fail 'L APK copiato non corrisponde al file verificato: distribuzione interrotta.'
}
Move-Item -LiteralPath $partial -Destination $final -Force
if (Test-Path -LiteralPath $identityReport) { Copy-Item -LiteralPath $identityReport -Destination ($final + '.identity.json') -Force }
Set-Content -LiteralPath ($final + '.sha256.txt') -Value ($sha + '  ' + $name) -Encoding Ascii
Write-Host ''
Write-Host 'APK GLAUKA CREATO' -ForegroundColor Green
Write-Host ('File: ' + $final)
Write-Host ('Commit: ' + $revision)
Write-Host ('SHA256: ' + $sha)
Write-Host ('Log: ' + $log)
Write-Host 'APK debug firmato per test privati, non release Play Store.' -ForegroundColor Yellow
