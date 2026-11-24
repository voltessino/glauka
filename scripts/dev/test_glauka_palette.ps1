<# Local-only Glauka theme audit. Never invokes GitHub Actions. #>
param([switch]$Capture)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $root
try {
  if (!(Test-Path 'node_modules/.bin/playwright.cmd')) {
    throw 'Playwright non installato: eseguire npm ci nel checkout locale.'
  }
  & node --test packages/editor-ui/tests/chrome-palette-contract.test.js
  if ($LASTEXITCODE -ne 0) { throw 'Controlli cromatici statici falliti.' }
  $old=$env:GLAUKA_PALETTE_CAPTURE
  try {
    if($Capture){$env:GLAUKA_PALETTE_CAPTURE='1'} else {$env:GLAUKA_PALETTE_CAPTURE='0'}
    & .\node_modules\.bin\playwright.cmd test tests/browser/glauka-compass-theme-contract.spec.js tests/browser/glauka-palette-surface-regressions.spec.js --reporter=list
    if($LASTEXITCODE -ne 0){throw 'Test visuali Playwright falliti.'}
  } finally { $env:GLAUKA_PALETTE_CAPTURE=$old }
  Write-Host 'PASS: 10 temi, due contrasti, 360/1440 px. Output test-results/.'
} finally { Pop-Location }
