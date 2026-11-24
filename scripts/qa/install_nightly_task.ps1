<#
 Register a local Windows scheduled task only when the owner executes this file.
 This file is NEVER invoked by nightly_windows.ps1 or during packaging.
 Example (run as the signed-in user, no admin necessary):
 powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\qa\install_nightly_task.ps1 -Time '23:30'
 Remove with: Unregister-ScheduledTask -TaskName 'NeuroMap Nightly QA' -Confirm:$false
#>
param(
 [string]$Time = '23:30',
 [string]$TaskName = 'NeuroMap Nightly QA',
 [switch]$SkipBrowserTests
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if($Time -notmatch '^([01]\d|2[0-3]):[0-5]\d$'){throw 'Time must be HH:mm (24-hour local clock).'}
if(-not (Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue)){
 throw 'Windows ScheduledTasks module is not available'
}
$script=Join-Path $PSScriptRoot 'nightly_windows.ps1'
if(-not(Test-Path -LiteralPath $script -PathType Leaf)){throw 'nightly_windows.ps1 missing'}
# Build arguments without interpolating any uncontrolled command or secret.
$arguments='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$script+'"'
if($SkipBrowserTests){$arguments+=' -SkipBrowserTests'}
$action=New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument $arguments
$clock=[datetime]::ParseExact($Time,'HH:mm',[Globalization.CultureInfo]::InvariantCulture)
$trigger=New-ScheduledTaskTrigger -Daily -At $clock
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 7) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$existing=Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if($existing){throw "Task '$TaskName' already exists. No changes made."}
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Local NeuroMap security, integrity, stress and browser checks with HTML report. No GitHub Actions.' | Out-Null
Write-Host "Scheduled: $TaskName, daily at $Time for the current logged-in Windows user."
Write-Host "Your PC must be awake and your user session signed in. Nothing uploads to GitHub."
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Write-Host "Reports: $(Join-Path (Split-Path -Parent $projectRoot) 'NeuroMap-Nightly-Reports')"
