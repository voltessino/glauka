# NeuroMap versioned executable installer: keep running older versions intact.
function Install-NeuroMapBinary {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$SourceExe,
        [Parameter(Mandatory=$true)][string]$InstallDir,
        [Parameter(Mandatory=$true)][string]$Version
    )
    if ($Version -notmatch '^\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$') { throw 'Versione di installazione non valida.' }
    $InstallDir = Resolve-NeuroMapInstallDir $InstallDir
    if (!(Test-Path -LiteralPath $SourceExe -PathType Leaf)) { throw 'Eseguibile sorgente mancante.' }
    [void][IO.Directory]::CreateDirectory($InstallDir)
    $sourceHash = (Get-FileHash -LiteralPath $SourceExe -Algorithm SHA256).Hash.ToLowerInvariant()
    $fileName = ('Glauka-{0}-{1}.exe' -f $Version, $sourceHash.Substring(0, 12))
    $destination = Join-Path $InstallDir $fileName
    if (Test-Path -LiteralPath $destination) {
        $existingHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($existingHash -eq $sourceHash) { return $destination }
        throw 'Installazione precedente non integra: il file di destinazione non corrisponde al pacchetto.'
    }
    $temporary = $destination + '.staging-' + [guid]::NewGuid().ToString('N')
    try {
        Copy-Item -LiteralPath $SourceExe -Destination $temporary -ErrorAction Stop
        $stagedHash = (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($stagedHash -ne $sourceHash) { throw 'Verifica integrità fallita durante la copia.' }
        Move-Item -LiteralPath $temporary -Destination $destination -ErrorAction Stop
        return $destination
    } finally {
        if (Test-Path -LiteralPath $temporary) {
            Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
        }
    }
}

# Resolve the path once, before creating files or changing shortcuts.
function Resolve-NeuroMapInstallDir {
    param([Parameter(Mandatory=$true)][string]$Path)
    $candidate = [Environment]::ExpandEnvironmentVariables($Path.Trim())
    if (![IO.Path]::IsPathRooted($candidate)) { throw 'Scegli una cartella con un percorso completo.' }
    $full = [IO.Path]::GetFullPath($candidate).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $root = [IO.Path]::GetPathRoot($candidate).TrimEnd([IO.Path]::DirectorySeparatorChar)
    if ($full -eq $root) { throw 'Scegli una sottocartella dedicata a Glauka.' }
    foreach ($reserved in @($env:USERPROFILE, $env:LOCALAPPDATA, $env:APPDATA, $env:WINDIR, $env:ProgramFiles)) {
        if ($reserved -and $full -eq $reserved.TrimEnd([IO.Path]::DirectorySeparatorChar)) {
            throw 'Scegli una sottocartella dedicata a Glauka.'
        }
    }
    if ((Test-Path -LiteralPath $full) -and !(Test-Path -LiteralPath $full -PathType Container)) {
        throw 'Il percorso scelto indica un file, non una cartella.'
    }
    return $full
}

# Start only the installed, versioned executable, never the extracted payload.
# The UI closes after this returns, including when launch was not requested.
function Start-NeuroMapAfterInstall {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)][string]$Executable, [bool]$Launch=$true)
    if (!$Launch) { return }
    if (!(Test-Path -LiteralPath $Executable -PathType Leaf)) { throw 'Eseguibile installato non trovato.' }
    Start-Process -FilePath $Executable -WorkingDirectory (Split-Path -Parent $Executable) -ErrorAction Stop
}

# Associate Glauka map files per-user without replacing foreign defaults or UserChoice.
function Install-GlaukaFileAssociations {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$Executable,
        [Parameter(Mandatory=$true)][string]$Icon,
        [ValidateSet('Release','Developer')][string]$Edition='Release'
    )
    if (!(Test-Path -LiteralPath $Executable -PathType Leaf)) { throw 'Eseguibile Glauka mancante.' }
    if (!(Test-Path -LiteralPath $Icon -PathType Leaf)) { throw 'Icona Glauka mancante.' }
    $classes='HKCU:\Software\Classes'
    $progId=if($Edition -eq 'Developer'){'Glauka.Developer.Project'}else{'Glauka.Project'}
    $progKey=Join-Path $classes $progId
    New-Item -Path $progKey -Force | Out-Null
    Set-Item -Path $progKey -Value 'Progetto Glauka'
    $iconKey=Join-Path $progKey 'DefaultIcon'
    New-Item -Path $iconKey -Force | Out-Null
    Set-Item -Path $iconKey -Value ('"'+$Icon+'",0')
    $commandKey=Join-Path $progKey 'shell\open\command'
    New-Item -Path $commandKey -Force | Out-Null
    Set-Item -Path $commandKey -Value ('"'+$Executable+'" "%1"')
    foreach($extension in @('.gk','.glk','.neuromap')){
        $extensionKey=Join-Path $classes $extension
        New-Item -Path $extensionKey -Force | Out-Null
        $openWith=Join-Path $extensionKey 'OpenWithProgids'
        New-Item -Path $openWith -Force | Out-Null
        New-ItemProperty -Path $openWith -Name $progId -PropertyType String -Value '' -Force | Out-Null
        $current=[string](Get-Item -Path $extensionKey).GetValue('')
        $eligible=!$current -or $current -eq $progId
        if($Edition -eq 'Release' -and $current -in @('NeuroMapArchitect.Project','Glauka.Developer.Project')){
            $eligible=$true
        }
        if($eligible){Set-Item -Path $extensionKey -Value $progId}
    }
    # Refresh Explorer icon/association metadata without restarting Explorer.
    if(-not ('GlaukaAssocNotify' -as [type])){
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class GlaukaAssocNotify {
 [DllImport("shell32.dll")] public static extern void SHChangeNotify(int eventId, uint flags, IntPtr item1, IntPtr item2);
}
'@
    }
    [GlaukaAssocNotify]::SHChangeNotify(0x08000000,0,[IntPtr]::Zero,[IntPtr]::Zero)
}
