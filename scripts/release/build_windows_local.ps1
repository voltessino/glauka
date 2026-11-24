<#
.SYNOPSIS
  Build and verify NeuroMap Windows locally. Public/production by default; Developer only with -Developer.
.DESCRIPTION
  Fails closed for dirty source, failing regression tests, compiler failures,
  stale embedded UI and mismatched SHA256 artifact hashes.
  Requires installed Git, Node/npm, Python 3, Go and Playwright Chromium.
  The build script may need a pre-populated Go modules cache or internet.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/release/build_windows_local.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/release/build_windows_local.ps1 -Python py
#>
param(
 [string]$Python = 'python',
 [string]$Output = '',
 [string]$SignThumbprint = '',
 [string]$LicenseURL = '',
 [switch]$SkipBrowserTests,
 [switch]$Developer
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
function Invoke-Checked {
 param([string]$Command,[string[]]$Arguments)
 Write-Host ('> ' + $Command + ' ' + ($Arguments -join ' '))
 & $Command @Arguments
 if($LASTEXITCODE -ne 0) { throw "$Command exited with code $LASTEXITCODE" }
}
Push-Location $root
try {
 if(-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git missing' }
 if(-not (Get-Command go -ErrorAction SilentlyContinue)) { throw 'Go compiler missing' }
 if(-not (Get-Command $Python -ErrorAction SilentlyContinue)) { throw "Python missing: $Python" }
 if(-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js missing' }
 $npm = if($env:OS -eq 'Windows_NT') {'npm.cmd'} else {'npm'}
 if(-not (Get-Command $npm -ErrorAction SilentlyContinue)) { throw 'npm missing' }
 $sha = (& git rev-parse HEAD).Trim()
 if($LASTEXITCODE -ne 0 -or $sha -notmatch '^[0-9a-f]{40}$') { throw 'Cannot resolve commit SHA' }
 $changes = @(& git status --porcelain)
 if($LASTEXITCODE -ne 0 -or $changes.Count -gt 0) {
  throw 'Git checkout has uncommitted or untracked files; build from a clean commit.'
 }
 if(-not $Output) {
  $Output = Join-Path (Split-Path -Parent $root) ('neuromap-windows-'+$sha.Substring(0,12)+'-'+[guid]::NewGuid().ToString('N').Substring(0,6))
 }
 if(Test-Path -LiteralPath $Output) { throw "Output directory already exists: $Output" }
 Write-Host "NeuroMap Windows source revision $sha"
 if(-not (Test-Path -LiteralPath (Join-Path $root 'node_modules'))) {
  Invoke-Checked $npm @('ci','--ignore-scripts')
 }
 Invoke-Checked $npm @('test')
 # Native backend tests are mandatory: they verify Time Machine snapshots,
 # compression, pinned versions and non-destructive file recovery.
 Push-Location (Join-Path $root 'apps/desktop-shared/src')
 try { Invoke-Checked 'go' @('test','./...') } finally { Pop-Location }
 Invoke-Checked $Python @('-m','unittest','discover','-s','scripts/release','-p','test_*.py','-v')
 if(-not $SkipBrowserTests) {
  $env:NEUROMAP_PYTHON=$Python
  Invoke-Checked $npm @('run','test:browser')
 } else {
  Write-Warning 'Browser UI tests were explicitly skipped; artifact is NOT fully QA-verified.'
 }
 $buildArguments=@('scripts/release/build_desktop.py','windows',$Output)
 if($Developer) { $buildArguments+='--developer' }
 if($SignThumbprint) { $buildArguments+=@('--windows-sign-thumbprint',$SignThumbprint) }
 if($LicenseURL) { $buildArguments+=@('--license-url',$LicenseURL) }
 Invoke-Checked $Python $buildArguments
 $manifestPath = Join-Path $Output 'output/build-manifest.json'
 if(-not (Test-Path -LiteralPath $manifestPath)) { throw 'Missing build manifest' }
 $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
 if($manifest.sourceRevision -ne $sha -or $manifest.sourceDirty -ne $false -or $manifest.target -ne 'windows' -or
    [bool]$manifest.developerEntitlement -ne [bool]$Developer) {
  throw 'Build manifest revision, clean state or target does not match source checkout'
 }
 $files=0
 foreach($item in $manifest.artifacts) {
  $file = Join-Path $Output ('output/'+$item.name)
  if(-not (Test-Path -LiteralPath $file)) { throw "Missing artifact: $file" }
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant()
  if($actual -ne [string]$item.sha256) { throw "SHA256 mismatch: $file" }
  $files++
 }
 if($files -lt 3) { throw 'Expected Portable EXE, Setup EXE and Windows ZIP' }
 Write-Host "PASS: $files artifacts match manifest and source revision $sha"
 Write-Host "Artifacts: $(Join-Path $Output 'output')"
 if($manifest.windowsSigning.status -ne 'verified') { Write-Warning 'Windows files are unsigned and must not be distributed as a trusted release.' }
 if(-not $Developer -and $SignThumbprint) {
  Invoke-Checked 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File',
   (Join-Path $root 'scripts/release/verify_signed_windows.ps1'),'-BuildDirectory',$Output)
 }
 if($Developer) { Write-Warning 'DEVELOPER BUILD: Pro testing bypass is compiled in. Do not distribute any generated artifacts.' }
 if($SkipBrowserTests) { Write-Warning 'Do not distribute as fully tested: browser suite skipped.' }
} finally {
 Pop-Location
}
