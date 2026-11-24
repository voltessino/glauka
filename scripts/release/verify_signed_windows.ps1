<#
.SYNOPSIS
  Fail-closed Authenticode release gate for locally built NeuroMap installers.
.DESCRIPTION
  Checks both portable and setup EXEs against their manifest SHA256, valid
  Windows trust chain, trusted signer certificate and Authenticode timestamp.
  Never claims unsigned Developer artifacts are release-ready. No GitHub Actions.
.EXAMPLE
  powershell -NoProfile -File scripts/release/verify_signed_windows.ps1 -BuildDirectory "C:\NeuroMap-Release"
#>
param(
 [Parameter(Mandatory=$true)][string]$BuildDirectory
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=(Resolve-Path -LiteralPath $BuildDirectory).Path
$manifestPath=Join-Path $root 'output\build-manifest.json'
if(-not(Test-Path -LiteralPath $manifestPath -PathType Leaf)){throw "Build manifest missing: $manifestPath"}
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if($manifest.target -ne 'windows' -or $manifest.edition -ne 'Release' -or
   $manifest.developerEntitlement -ne $false -or $manifest.sourceDirty -ne $false -or
   $manifest.distributionReady -ne $true -or $manifest.windowsSigning.status -ne 'verified'){
 throw 'Distribution denied: manifest is not a clean, signed production build.'
}
if(-not (Get-Command signtool.exe -ErrorAction SilentlyContinue)){
 throw 'Windows SDK signtool.exe not installed: independent Authenticode verification is unavailable.'
}
$certExpected=[string]$manifest.windowsSigning.certificateThumbprint
if($certExpected -notmatch '^[0-9A-Fa-f]{40}$'){throw 'Signed build manifest is missing its certificate fingerprint.'}
$exeCount=0
$names=@{}
foreach($artifact in $manifest.artifacts){
 $name=[string]$artifact.name
 if($name -match '^([A-Za-z]:|[/\\])' -or $name -match '(^|[/\\])\.\.([/\\]|$)'){
  throw "Unsafe artifact path in manifest"
 }
 if($names.ContainsKey($name)){throw "Duplicate artifact name in manifest"}
 $names[$name]=$true
 $filename=Join-Path (Join-Path $root 'output') $name
 if(-not(Test-Path -LiteralPath $filename -PathType Leaf)){throw "Missing artifact: $name"}
 $actual=(Get-FileHash -LiteralPath $filename -Algorithm SHA256).Hash.ToLowerInvariant()
 if($actual -ne [string]$artifact.sha256){throw "Artifact SHA256 mismatch: $name"}
 if([IO.Path]::GetExtension($filename).ToLowerInvariant() -ne '.exe'){continue}
 $exeCount++
 $signature=Get-AuthenticodeSignature -LiteralPath $filename
 if($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate){
  throw "Invalid Authenticode signature: $name ($($signature.Status))"
 }
 if($signature.SignerCertificate.Thumbprint -ne $certExpected){
  throw "Signer certificate does not match manifest: $name"
 }
 if($null -eq $signature.TimeStamperCertificate){
  throw "Authenticode timestamp missing: $name"
 }
 & signtool.exe verify /pa /all /tw $filename
 if($LASTEXITCODE -ne 0){throw "Windows SDK trust verification rejected: $name"}
 Write-Host "PASS signed: $name"
}
if($exeCount -ne 2){throw "Expected exactly portable EXE and setup EXE; found $exeCount"}
Write-Host "PASS: Two authentic, timestamped, trusted NeuroMap Release EXEs; all artifact hashes match."
