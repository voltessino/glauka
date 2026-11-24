# Prepara la cartella anteprima per aggiornare quella già presente su OVH.
# Non esegue upload, non cambia password, non tocca GitHub Actions.
$ErrorActionPreference = "Stop"
$repository = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$desktop = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
if (-not $desktop -or -not (Test-Path $desktop)) { $desktop = $HOME }
$destination = Join-Path $desktop ("Glauka-Anteprima-" + $stamp)

Push-Location $repository
try {
    $script = Join-Path $repository "scripts\release\build_anteprima_update.py"
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3 $script --output $destination
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        & python $script --output $destination
    } else {
        throw "Python 3 non trovato. Installa Python e riprova."
    }
    if ($LASTEXITCODE -ne 0) { throw "Generazione anteprima non riuscita (exit $LASTEXITCODE)." }
    $archive = Join-Path $destination "aggiornamento-anteprima.zip"
    $folder = Join-Path $destination "anteprima"
    if (-not (Test-Path $archive) -or -not (Test-Path (Join-Path $folder "index.html"))) {
        throw "Pacchetto non completo: verifica il repository e i test."
    }
    Write-Host ""
    Write-Host "Cartella anteprima pronta:" -ForegroundColor Green
    Write-Host $folder
    Write-Host "ZIP pronto per FTP OVH:"
    Write-Host $archive
    Write-Host "Conserva il file .htaccess e la password già presenti online."
} finally {
    Pop-Location
}
