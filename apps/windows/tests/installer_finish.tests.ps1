$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../installer/install_files.ps1')
$source=Join-Path ([IO.Path]::GetTempPath()) ('neuromap-finish-'+[guid]::NewGuid().ToString('N')+'.exe')
$script:launches=@()
function Start-Process { param($FilePath,$WorkingDirectory,$ErrorAction); $script:launches+=@{FilePath=$FilePath;WorkingDirectory=$WorkingDirectory} }
try {
 [IO.File]::WriteAllText($source,'test installed executable')
 Start-NeuroMapAfterInstall -Executable $source -Launch $false
 if($script:launches.Count -ne 0){throw 'Unchecked launch started a program'}
 Start-NeuroMapAfterInstall -Executable $source -Launch $true
 if($script:launches.Count -ne 1 -or $script:launches[0].FilePath -ne $source){throw 'Wrong executable launched'}
 if($script:launches[0].WorkingDirectory -ne (Split-Path -Parent $source)){throw 'Wrong working directory'}
 $failed=$false
 try {Start-NeuroMapAfterInstall -Executable ($source+'.missing') -Launch $true}catch{$failed=$true}
 if(!$failed -or $script:launches.Count -ne 1){throw 'Missing executable was launched'}
 $text=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../installer/install_ui.ps1'))
 $tokens=$null;$errors=$null
 [void][System.Management.Automation.Language.Parser]::ParseInput($text,[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'Installer UI syntax is invalid'}
 # Parse the actual markup too: broken XAML must fail before shipping the EXE.
 $markup=[regex]::Match($text,'(?s)\$xaml=@''\r?\n(.*?)\r?\n''@').Groups[1].Value
 if(!$markup){throw 'Installer markup missing'}
 $xml=[xml]$markup
 $manager=New-Object Xml.XmlNamespaceManager($xml.NameTable)
 $manager.AddNamespace('x','http://schemas.microsoft.com/winfx/2006/xaml')
 $seen=@{}
 foreach($element in $xml.SelectNodes('//*[@x:Name and not(ancestor::*[local-name()="ControlTemplate" or local-name()="DataTemplate"])]',$manager)) {
  $name=$element.GetAttribute('Name','http://schemas.microsoft.com/winfx/2006/xaml')
  if($seen.ContainsKey($name)){throw ('Duplicate installer control: '+$name)}
  $seen[$name]=$true
 }
 $namesText=[regex]::Match($text,'(?m)^\$names=@\((.*?)\)').Groups[1].Value
 foreach($match in [regex]::Matches($namesText,"'([^']+)'")) {
  if(!$seen.ContainsKey($match.Groups[1].Value)){throw ('Unbound installer control: '+$match.Groups[1].Value)}
 }

 if($text -notmatch 'x:Name="LaunchAfterInstall"[^>]*IsChecked="True"'){throw 'Launch checkbox missing'}
 if($text -notmatch 'Start-NeuroMapAfterInstall[^\r\n]+\r?\n\s*\$window.Close\(\)'){throw 'Successful installation does not close its window'}
 Write-Output 'PASS: optional installed-app launch, unchecked no-launch, missing EXE, installer syntax and completion close'
}finally{
 Remove-Item -LiteralPath $source -ErrorAction SilentlyContinue
 Remove-Item Function:Start-Process -ErrorAction SilentlyContinue
}
