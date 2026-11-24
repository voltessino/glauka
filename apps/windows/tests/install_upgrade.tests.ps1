param([string]$Desktop='')
$ErrorActionPreference='Stop'
if($Desktop){
    $desktop=(Resolve-Path $Desktop).Path
    $helper=Join-Path $desktop 'setup/install_files.ps1'
    $ui=Join-Path $desktop 'setup/install_ui.ps1'
    $cleanup=Join-Path $desktop 'uninstall_files.ps1'
}else{
    $helper=Join-Path $PSScriptRoot '../installer/install_files.ps1'
    $ui=Join-Path $PSScriptRoot '../installer/install_ui.ps1'
    $cleanup=Join-Path $PSScriptRoot '../../desktop-shared/src/uninstall_files.ps1'
}
$tempRoot=[IO.Path]::GetTempPath()
foreach($file in @($helper,$ui,$cleanup)) {
    $tokens=$null; $errors=$null
    [void][System.Management.Automation.Language.Parser]::ParseFile($file,[ref]$tokens,[ref]$errors)
    if($errors.Count -ne 0) { throw "PowerShell syntax failure: $file : $($errors[0])" }
}
. $helper
$source=Join-Path $tempRoot ('neuromap-src-'+[guid]::NewGuid().ToString('N')+'.exe')
$dir=Join-Path $tempRoot ('neuromap-installer-test-'+[guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $dir -Force)
try {
    $legacy=Join-Path $dir 'NeuroMap-Architect.exe'
    $backup=$legacy+'.before-6.12'
    [IO.File]::WriteAllText($legacy,'LOCKED: running version 6.12')
    [IO.File]::WriteAllText($backup,'LOCKED: old backup')
    [IO.File]::WriteAllText($source,'NEW: version 6.16.0')
    $held=[IO.File]::Open($legacy,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
    $heldBackup=[IO.File]::Open($backup,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
    try {
        $new=Install-NeuroMapBinary -SourceExe $source -InstallDir $dir -Version '6.20.0-dev.4'
        if(!(Test-Path -LiteralPath $new)) { throw 'New binary missing' }
        if($new -eq $legacy) { throw 'Attempted to overwrite in-use executable' }
        if(!(Split-Path -Leaf $new).StartsWith('Glauka-6.20.0-dev.4-')) { throw 'Incorrect EXE filename' }
        $again=Install-NeuroMapBinary -SourceExe $source -InstallDir $dir -Version '6.20.0-dev.4'
        if($again -ne $new) { throw 'Same build was not idempotent' }
        [IO.File]::WriteAllText($source,'OTHER: 6.16.0 hotfix')
        $updated=Install-NeuroMapBinary -SourceExe $source -InstallDir $dir -Version '6.20.0-dev.4'
        if($updated -eq $new) { throw 'Distinct binaries overwrote each other' }
    } finally { $held.Dispose(); $heldBackup.Dispose() }
    if([IO.File]::ReadAllText($legacy) -ne 'LOCKED: running version 6.12') { throw 'Legacy EXE was corrupted' }
    if([IO.File]::ReadAllText($backup) -ne 'LOCKED: old backup') { throw 'Legacy backup was corrupted' }
    $txt=[IO.File]::ReadAllText($ui)
    $version=[regex]::Match($txt, '\$script:installerVersion=''([^'']+)''').Groups[1].Value
    if(!$version -or $txt -notmatch ('Text="'+[regex]::Escape($version)+'"')) { throw 'Installer badge/version mismatch' }
    $xaml=[regex]::Match($txt, '(?s)\$xaml=@''\s*(.*?)\r?\n''@').Groups[1].Value
    $document=[xml]$xaml
    foreach($name in @('InstallPath','BrowsePath','ResetPath','Repair')){
        $found=$document.SelectNodes('//*[@*[local-name()="Name"]="'+$name+'"]')
        if($found.Count -ne 1){throw "Missing/duplicate installer control $name"}
    }
    if($txt -notmatch 'Get-GlaukaMatchingInstall' -or $txt -notmatch 'UpdateInstallerMode' -or $txt -notmatch 'Apri Glauka' -or $txt -notmatch 'Ripara'){throw 'Installed app open/repair detection missing'}
    if($txt -notmatch [regex]::Escape("'Quit','Repair','Install'")){throw 'Repair control is not wired'}
    $pathField=$document.SelectSingleNode('//*[@*[local-name()="Name"]="InstallPath"]')
    if($pathField.LocalName -ne 'TextBox'){throw 'Install folder is not editable'}
    foreach($invalid in @('../escape','6.20.0/escape','6.20.0-dev.4;bad','bad','6.20.0-')){
        $rejected=$false
        try{Install-NeuroMapBinary -SourceExe $source -InstallDir $dir -Version $invalid | Out-Null}catch{$rejected=$true}
        if(!$rejected){throw "Unsafe version accepted: $invalid"}
    }
    foreach($version in @('6.20.0','6.20.0-dev.4','6.20.0-rc.1+build.5')){
        if(!(Test-Path -LiteralPath (Install-NeuroMapBinary -SourceExe $source -InstallDir $dir -Version $version))){throw 'Versioned install missing'}
    }
    $custom=Join-Path $dir 'Cartella scelta · NeuroMap'
    $installed=Install-NeuroMapBinary -SourceExe $source -InstallDir $custom -Version '6.20.0-dev.4'
    [IO.File]::WriteAllText((Join-Path $custom 'my-project.neuromap'),'preserve this project')
    $child=Join-Path $custom 'other-files';[void](New-Item -ItemType Directory -Path $child)
    [IO.File]::WriteAllText((Join-Path $child 'note.txt'),'preserve this note')
    & $cleanup -InstallDir $custom -Executable $installed -DelaySeconds 0
    if(Test-Path -LiteralPath $installed){throw 'NeuroMap executable was not removed'}
    if([IO.File]::ReadAllText((Join-Path $custom 'my-project.neuromap')) -ne 'preserve this project'){throw 'Project deleted'}
    if(!(Test-Path -LiteralPath (Join-Path $child 'note.txt'))){throw 'Unrelated folder deleted'}
    # Uninstall one specific version while preserving newer/older EXEs.
    $sideBySide=Join-Path $dir 'side-by-side'
    $first=Install-NeuroMapBinary -SourceExe $source -InstallDir $sideBySide -Version '6.20.0-dev.4'
    $second=Install-NeuroMapBinary -SourceExe $source -InstallDir $sideBySide -Version '6.21.0'
    $ownNote=Join-Path $sideBySide 'important.neuromap'
    [IO.File]::WriteAllText($ownNote,'user map')
    & $cleanup -InstallDir $sideBySide -Executable $first -DelaySeconds 0
    if(Test-Path -LiteralPath $first){throw 'Targeted EXE was not removed'}
    if(!(Test-Path -LiteralPath $second)){throw 'Another installed version was deleted'}
    if([IO.File]::ReadAllText($ownNote) -ne 'user map'){throw 'Project removed during targeted uninstall'}

    # Never delete an EXE that no longer matches its own version/hash filename.
    $tampered=Join-Path $dir 'tampered'
    $tamperedExe=Install-NeuroMapBinary -SourceExe $source -InstallDir $tampered -Version '6.21.1'
    [IO.File]::AppendAllText($tamperedExe,'unexpected change')
    $blocked=$false
    try { & $cleanup -InstallDir $tampered -Executable $tamperedExe -DelaySeconds 0 -MaxRetries 1 }
    catch { $blocked=$true }
    if(!$blocked -or !(Test-Path -LiteralPath $tamperedExe)){throw 'Modified executable was incorrectly removed'}
    # Mismatched paths must be rejected without touching either installation.
    $wrongPath=$false
    try { & $cleanup -InstallDir $sideBySide -Executable $tamperedExe -DelaySeconds 0 -MaxRetries 1 }
    catch { $wrongPath=$true }
    if(!$wrongPath -or !(Test-Path -LiteralPath $second)){throw 'Cross-install uninstall was accepted'}
    $empty=Join-Path $dir 'clean-install'
    $emptyExe=Install-NeuroMapBinary -SourceExe $source -InstallDir $empty -Version '6.20.0-dev.4'
    & $cleanup -InstallDir $empty -Executable $emptyExe -DelaySeconds 0
    if(Test-Path -LiteralPath $empty){throw 'Empty app folder not removed'}
    $rejected=$false;try{Resolve-NeuroMapInstallDir 'relative/path'|Out-Null}catch{$rejected=$true}
    if(!$rejected){throw 'Relative folder accepted'}
    if($txt -match '\.before-6\.12') { throw 'Legacy rename logic still exists in installer' }
    if($txt -notmatch 'DisplayVersion -Value \$script:installerVersion') { throw 'Registry version incorrect' }
    Write-Host 'PASS: selected EXE only, same-directory version preservation, hash/path rejection, concurrent locked 6.12 app, locked backup, side-by-side install, idempotence, PowerShell/XAML parsing, branding, prerelease versions, custom folder, unrelated file preservation'
} finally {
    Remove-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}
