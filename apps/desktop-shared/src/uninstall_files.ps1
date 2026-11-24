param(
    [Parameter(Mandatory=$true)][string]$InstallDir,
    [Parameter(Mandatory=$true)][string]$Executable,
    [int]$DelaySeconds=2,
    [int]$MaxRetries=30,
    [string]$ReportPath='',
    [ValidateSet('','NeuroMapArchitect','NeuroMapArchitectDeveloper')][string]$RegistryName='',
    [string[]]$ShortcutPaths=@()
)
$ErrorActionPreference='Stop'

function Write-UninstallReport([string]$Status, [string]$Detail) {
    if (!$ReportPath) { return }
    try {
        $parent=[IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ReportPath))
        [void][IO.Directory]::CreateDirectory($parent)
        [pscustomobject]@{
            time=[DateTime]::UtcNow.ToString('o')
            status=$Status
            detail=$Detail
        } | ConvertTo-Json -Compress | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    } catch { }
}

function Remove-OwnedRegistration([string]$SelectedExe, [string]$Name, [string[]]$Links) {
    $warnings=@()
    $registryOwned=$false
    if ($Name) {
        $uninstall='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\'+$Name
        $entry=Get-ItemProperty -LiteralPath $uninstall -ErrorAction SilentlyContinue
        $expected='"'+$SelectedExe+'" --uninstall'
        if ($entry -and ([string]$entry.UninstallString) -ieq $expected) {
            $registryOwned=$true
        } elseif ($entry) {
            $warnings+= 'Una versione più recente possiede il registro: mantenuto.'
        }
    }
    # Only links whose TargetPath is this exact EXE are ours.
    $shell=$null
    foreach($link in $Links) {
        if (!(Test-Path -LiteralPath $link -PathType Leaf)) { continue }
        try {
            if (!$shell) { $shell=New-Object -ComObject WScript.Shell }
            $shortcut=$shell.CreateShortcut($link)
            if ([string]::Equals([IO.Path]::GetFullPath($shortcut.TargetPath),
                                  $SelectedExe,[StringComparison]::OrdinalIgnoreCase)) {
                Remove-Item -LiteralPath $link -Force -ErrorAction Stop
            }
        } catch { $warnings+= 'Collegamento non rimosso: '+$_.Exception.Message }
    }
    if ($registryOwned) {
        $prog=if($Name -eq 'NeuroMapArchitectDeveloper'){'Glauka.Developer.Project'}else{'Glauka.Project'}
        $classes='HKCU:\Software\Classes'
        $key=Join-Path $classes ($prog+'\shell\open\command')
        $command=if(Test-Path -LiteralPath $key){[string](Get-Item -LiteralPath $key).GetValue('')}else{''}
        if ($command -ieq ('"'+$SelectedExe+'" "%1"')) {
            foreach($ext in @('.gk','.glk','.neuromap')) {
                $extPath=Join-Path $classes $ext
                if(Test-Path -LiteralPath $extPath){
                    if(([string](Get-Item -LiteralPath $extPath).GetValue('')) -eq $prog){
                        Set-Item -LiteralPath $extPath -Value ''
                    }
                    $openWith=Join-Path $extPath 'OpenWithProgids'
                    if(Test-Path -LiteralPath $openWith){
                        Remove-ItemProperty -LiteralPath $openWith -Name $prog -ErrorAction SilentlyContinue
                    }
                }
            }
            Remove-Item -LiteralPath (Join-Path $classes $prog) -Recurse -Force -ErrorAction Stop
        }
        try { Remove-Item -LiteralPath $uninstall -Recurse -Force -ErrorAction Stop }
        catch { $warnings+= 'Voce disinstallazione non rimossa: '+$_.Exception.Message }
    }
    return $warnings
}

try {
    # Never sweep an entire install folder: previous versions, future versions
    # and personal projects may coexist with this specific EXE.
    $folder=[IO.Path]::GetFullPath($InstallDir).TrimEnd([char[]]@('\','/'))
    $target=[IO.Path]::GetFullPath($Executable)
    if (![IO.Path]::IsPathRooted($InstallDir) -or ![IO.Path]::IsPathRooted($Executable)) {
        throw 'Disinstallazione annullata: percorso non assoluto.'
    }
    if (![string]::Equals([IO.Path]::GetDirectoryName($target).TrimEnd([char[]]@('\','/')),
                         $folder,[StringComparison]::OrdinalIgnoreCase)) {
        throw 'Disinstallazione annullata: il file non appartiene alla cartella.'
    }
    $filename=[IO.Path]::GetFileName($target)
    if ($filename -cnotmatch '^Glauka-[0-9]+\.[0-9]+(?:\.[0-9]+)?(?:-[0-9A-Za-z.+-]+)?-[0-9a-f]{12}\.exe$') {
        throw 'Disinstallazione annullata: nome file non riconosciuto.'
    }
    if ($MaxRetries -lt 1 -or $MaxRetries -gt 120 -or $DelaySeconds -lt 0 -or $DelaySeconds -gt 120) {
        throw 'Parametri di attesa non validi.'
    }
    if ($DelaySeconds -gt 0) { Start-Sleep -Seconds $DelaySeconds }
    if (!(Test-Path -LiteralPath $target -PathType Leaf)) {
        $warnings=@(Remove-OwnedRegistration $target $RegistryName $ShortcutPaths)
        Write-UninstallReport 'ok' 'Eseguibile già assente; controllate soltanto le registrazioni appartenenti a esso.'
        return
    }
    # Versioned installers include the SHA-256 prefix in the file name.
    # Never delete a file if its contents no longer match its identity.
    $expected=[regex]::Match($filename,'-([a-f0-9]{12})\.exe$').Groups[1].Value
    $lastError=''
    for($attempt=1;$attempt -le $MaxRetries;$attempt++) {
        try {
            $hash=(Get-FileHash -LiteralPath $target -Algorithm SHA256 -ErrorAction Stop).Hash.Substring(0,12).ToLowerInvariant()
            if ($hash -cne $expected) {
                throw 'Identità EXE non verificata (SHA-256 differente).'
            }
            Remove-Item -LiteralPath $target -Force -ErrorAction Stop
            if (Test-Path -LiteralPath $target) { throw 'Il file risulta ancora presente.' }
            $warnings=@()
            try { $warnings=@(Remove-OwnedRegistration $target $RegistryName $ShortcutPaths) }
            catch { $warnings+= 'Registrazioni non completamente rimosse: '+$_.Exception.Message }
            # An installation icon may be shared by multiple versioned EXEs.
            # Remove Glauka-generated icon files only when no EXE remains.
            if (@(Get-ChildItem -LiteralPath $folder -Filter '*.exe' -File).Count -eq 0) {
                Get-ChildItem -LiteralPath $folder -Filter 'Glauka-*.ico' -File |
                    Where-Object { $_.Name -match '^Glauka-[a-f0-9]{12}\.ico$' } |
                    ForEach-Object {
                        try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop }
                        catch { $warnings+= 'Icona non rimossa: '+$_.Exception.Message }
                    }
            }
            # Delete the directory only if it is genuinely empty.
            try { [IO.Directory]::Delete($folder) } catch { }
            if ($warnings.Count -gt 0) {
                Write-UninstallReport 'partial' ($warnings -join '; ')
            } else {
                Write-UninstallReport 'ok' 'Rimosso il file selezionato e solo le registrazioni ancora appartenenti a esso.'
            }
            return
        } catch {
            $lastError=$_.Exception.Message
            if ($lastError -like '*Identità EXE*') { throw }
            if ($attempt -lt $MaxRetries) { Start-Sleep -Seconds 1 }
        }
    }
    throw ('Impossibile rimuovere il file eseguibile dopo ' + $MaxRetries + ' tentativi: ' + $lastError)
} catch {
    Write-UninstallReport 'failed' $_.Exception.Message
    throw
}
