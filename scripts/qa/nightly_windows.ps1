<#
.SYNOPSIS
 Local, read-only source checkout QA for NeuroMap, with HTML report.
.DESCRIPTION
 Runs selected existing tests without GitHub Actions and without compiling a
 Developer installer. Test fixtures run in temporary folders. Never alters
 projects, installs software, runs git pull/reset/clean or schedules itself.
 Reports are written outside the checkout to avoid dirtying git status.
.EXAMPLE
 powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\qa\nightly_windows.ps1
#>
param(
 [string]$ReportRoot = '',
 [string]$Python = 'python',
 [switch]$SkipBrowserTests,
 [switch]$SkipSecurityBackend
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if(-not $ReportRoot){$ReportRoot=Join-Path (Split-Path -Parent $root) 'NeuroMap-Nightly-Reports'}
$ReportRoot=[IO.Path]::GetFullPath($ReportRoot)
if($ReportRoot.TrimEnd('\') -ieq $root.TrimEnd('\') -or $ReportRoot.StartsWith($root.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){
 throw 'Report directory must be outside the tracked repository.'
}
$runId=(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8)
$directory=Join-Path $ReportRoot $runId
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$steps=New-Object System.Collections.Generic.List[object]
$started=Get-Date
$gitRevision='unknown'
$npm='npm.cmd'
function Add-Step([string]$Name,[string]$Group,[string]$Exe,[string[]]$Arguments) {
 $filename=($steps.Count+1).ToString('00')+'-'+($Name -replace '[^A-Za-z0-9_-]','_')+'.log'
 $log=Join-Path $directory $filename
 $start=Get-Date
 $status='PASS';$exitCode=0
 try{
  $exeFound=Get-Command $Exe -ErrorAction SilentlyContinue
  if(-not $exeFound){throw "Missing executable: $Exe"}
  Push-Location $root
  try {
   & $Exe @Arguments *> $log
   $exitCode=$LASTEXITCODE
   if($exitCode -ne 0){$status='FAIL'}
  } finally {Pop-Location}
 } catch {
  $status='FAIL';$exitCode=1
  ($_ | Out-String) | Out-File -LiteralPath $log -Append -Encoding UTF8
 }
 $duration=[math]::Round(((Get-Date)-$start).TotalSeconds,2)
 $steps.Add([pscustomobject]@{Name=$Name;Group=$Group;Status=$status;ExitCode=$exitCode;Seconds=$duration;Log=$filename})
 Write-Host ("{0}: {1} ({2}s)" -f $status,$Name,$duration)
}
try {
 Push-Location $root
 try{
  $gitRevision=(& git rev-parse HEAD 2>$null | Select-Object -First 1)
  if(-not $gitRevision){$gitRevision='unknown'}
 }finally{Pop-Location}
 $node=Get-Command node -ErrorAction SilentlyContinue
 if(-not $node){throw 'Node.js missing: install Node.js LTS first'}
 $npmCmd=Get-Command npm.cmd -ErrorAction SilentlyContinue
 if(-not $npmCmd){throw 'npm.cmd missing'}
 if(-not (Test-Path -LiteralPath (Join-Path $root 'node_modules\@playwright\test'))){
  Write-Warning 'Playwright dependencies absent; install once manually with npm ci --ignore-scripts.'
 }
 Add-Step 'unit-js' 'regression' $npm @('test')
 Add-Step 'python-release' 'security' $Python @('-m','unittest','discover','-s','scripts/release','-p','test_*.py','-v')
 Add-Step 'stress-core' 'performance' $npm @('run','test:stress')
 Add-Step 'stress-android' 'performance' $npm @('run','test:android:stress')
 Add-Step 'stress-knowledge' 'performance' $npm @('run','test:knowledge:stress')
 Add-Step 'stress-database' 'performance' $npm @('run','test:database:stress')
 if(-not $SkipBrowserTests){
  Add-Step 'browser-ui' 'interface' $npm @('run','test:browser')
  Add-Step 'android-ui' 'interface' $npm @('run','test:android:ui')
 } else {$steps.Add([pscustomobject]@{Name='browser-and-android-ui';Group='interface';Status='SKIP';ExitCode=0;Seconds=0;Log=''})}
 if(-not $SkipSecurityBackend){
  # Native build compiles in a temporary OUT-OF-TREE directory. Do not touch
  # the production installation, user data, GitHub or installed browser.
  Add-Step 'security-backend' 'security' $Python @('scripts/qa/nightly_backend_check.py','--report-dir',$directory)
 }else{$steps.Add([pscustomobject]@{Name='security-backend';Group='security';Status='SKIP';ExitCode=0;Seconds=0;Log=''})}
} catch {
 $errorFile=Join-Path $directory 'setup-error.log'
 ($_ | Out-String) | Out-File -LiteralPath $errorFile -Encoding UTF8
 $steps.Add([pscustomobject]@{Name='setup';Group='prerequisites';Status='FAIL';ExitCode=1;Seconds=0;Log='setup-error.log'})
} finally {
 $finished=Get-Date
 $summary=[pscustomobject]@{
  Project='NeuroMap';RunId=$runId;Revision=$gitRevision
  Started=$started.ToString('o');Finished=$finished.ToString('o')
  Host=$env:COMPUTERNAME;IsIndependentPenetrationTest=$false
  IsSignedInstallerVerification=$false
  Results=@($steps.ToArray())
 }
 $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $directory 'results.json') -Encoding UTF8
 $htmlFile=Join-Path $directory 'report.html'
 $safe=[System.Net.WebUtility]
 $escape={param($s) [System.Net.WebUtility]::HtmlEncode([string]$s)}
 $rows=foreach($item in $steps){
  $logLink=if($item.Log){'<a href="'+(& $escape $item.Log)+'">Apri log</a>'}else{'—'}
  '<tr><td>'+(& $escape $item.Group)+'</td><td>'+(& $escape $item.Name)+'</td><td class="'+(& $escape $item.Status)+'">'+(& $escape $item.Status)+'</td><td>'+(& $escape $item.Seconds)+'</td><td>'+$logLink+'</td></tr>'
 }
 $ok=@($steps|Where-Object Status -eq 'PASS').Count
 $failed=@($steps|Where-Object Status -eq 'FAIL').Count
 $skipped=@($steps|Where-Object Status -eq 'SKIP').Count
 $status=if($failed -gt 0){'ATTENZIONE: TEST FALLITI'}elseif($skipped -gt 0){'TEST PARZIALI'}else{'TUTTI I TEST ESEGUITI PASSATI'}
 $page=@"
<!doctype html><html lang="it"><head><meta charset="utf-8"><title>NeuroMap Nightly — $runId</title>
<style>body{background:#101827;color:#e8eef8;font:15px/1.55 Segoe UI,Arial,sans-serif;max-width:1100px;margin:35px auto;padding:0 22px}h1{font-size:29px} .panel{padding:20px;background:#1c2940;border:1px solid #384962;border-radius:15px;margin:18px 0} table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px 13px;border-bottom:1px solid #394760}a{color:#8fcafa}.PASS{color:#89e1ae}.FAIL{color:#ff9999}.SKIP{color:#f8d28f}small{color:#acbcd0}</style></head><body>
<h1>NeuroMap — rapporto notturno</h1><section class="panel"><h2>$status</h2><p><b>$ok</b> superati · <b>$failed</b> falliti · <b>$skipped</b> saltati</p>
<p>Revisione: $(& $escape $gitRevision)<br>Inizio: $(& $escape $started)<br>Fine: $(& $escape $finished)</p></section>
<section class="panel"><h2>Controlli eseguiti</h2><table><thead><tr><th>Area</th><th>Test</th><th>Esito</th><th>Secondi</th><th>Dettagli</th></tr></thead><tbody>$($rows -join [Environment]::NewLine)</tbody></table></section>
<p><small>Controlli automatici di sviluppo: NON costituiscono penetration test indipendente, firma verificata o certificazione di sicurezza. Gli script non inviano mappe online.</small></p>
</body></html>
"@
 [IO.File]::WriteAllText($htmlFile,$page,[Text.UTF8Encoding]::new($false))
 Write-Host "Rapporto HTML: $htmlFile"
 Write-Host "Risultati JSON: $(Join-Path $directory 'results.json')"
 if($failed -gt 0){exit 1}
 exit 0
}
