param([Parameter(Mandatory=$true)][string]$SourceExe,[Parameter(Mandatory=$true)][string]$SourceIcon,[Parameter(Mandatory=$true)][string]$SourceLogo,[Parameter(Mandatory=$true)][string]$SourceLanguages,[ValidateSet("Release","Developer")][string]$Edition="Release")
$script:failureDetail=''
$script:installerResult = 2 # 0=installed; 2=cancelled; 1=failed
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'install_files.ps1')
$script:installerVersion='1.0.4'
$script:isDeveloper=($Edition -eq 'Developer')
$script:displayName=if($script:isDeveloper){'Glauka Developer'}else{'Glauka'}
$script:registryName=if($script:isDeveloper){'NeuroMapArchitectDeveloper'}else{'NeuroMapArchitect'}
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Windows.Forms
$xaml=@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Title="Glauka" Width="680" Height="760" MinWidth="440" MinHeight="430" WindowStartupLocation="CenterScreen" ResizeMode="CanResizeWithGrip" ShowActivated="True" UseLayoutRounding="True" Background="#FFFFFF" Foreground="#1B1B27" FontFamily="Segoe UI" ShowInTaskbar="True">
 <Window.Resources>
  <!-- Localized button captions may grow: wrap text instead of clipping it. -->
  <DataTemplate x:Key="NmButtonCaption"><TextBlock Text="{Binding}" TextWrapping="Wrap" TextAlignment="Center" VerticalAlignment="Center" FontFamily="Segoe UI"/></DataTemplate>
  <Style TargetType="Button" x:Key="PrimaryButton"><Setter Property="ContentTemplate" Value="{StaticResource NmButtonCaption}"/><Setter Property="Background" Value="#6441DF"/><Setter Property="Foreground" Value="White"/><Setter Property="FontSize" Value="15"/><Setter Property="FontWeight" Value="Bold"/><Setter Property="Padding" Value="15,12"/><Setter Property="BorderThickness" Value="1"/><Setter Property="BorderBrush" Value="#C7C0DD"/><Setter Property="Cursor" Value="Hand"/><Setter Property="Template"><Setter.Value><ControlTemplate TargetType="Button"><Border x:Name="ButtonFace" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="12" Padding="{TemplateBinding Padding}"><ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/></Border><ControlTemplate.Triggers><Trigger Property="IsMouseOver" Value="True"><Setter TargetName="ButtonFace" Property="Opacity" Value="0.88"/></Trigger><Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="ButtonFace" Property="BorderBrush" Value="#382087"/><Setter TargetName="ButtonFace" Property="BorderThickness" Value="2"/></Trigger><Trigger Property="IsPressed" Value="True"><Setter TargetName="ButtonFace" Property="Opacity" Value="0.72"/></Trigger><Trigger Property="IsEnabled" Value="False"><Setter TargetName="ButtonFace" Property="Opacity" Value="0.5"/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
  <Style TargetType="Button" x:Key="LightButton"><Setter Property="ContentTemplate" Value="{StaticResource NmButtonCaption}"/><Setter Property="FontFamily" Value="Segoe UI"/><Setter Property="FontSize" Value="13"/><Setter Property="FontWeight" Value="SemiBold"/><Setter Property="Background" Value="#F6F3FF"/><Setter Property="Foreground" Value="#1B1B27"/><Setter Property="Padding" Value="10,8"/><Setter Property="BorderThickness" Value="1"/><Setter Property="BorderBrush" Value="#C7C0DD"/><Setter Property="Cursor" Value="Hand"/><Setter Property="Template"><Setter.Value><ControlTemplate TargetType="Button"><Border x:Name="ButtonFace" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="10" Padding="{TemplateBinding Padding}"><ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/></Border><ControlTemplate.Triggers><Trigger Property="IsMouseOver" Value="True"><Setter TargetName="ButtonFace" Property="Opacity" Value="0.88"/></Trigger><Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="ButtonFace" Property="BorderBrush" Value="#382087"/><Setter TargetName="ButtonFace" Property="BorderThickness" Value="2"/></Trigger><Trigger Property="IsPressed" Value="True"><Setter TargetName="ButtonFace" Property="Opacity" Value="0.72"/></Trigger><Trigger Property="IsEnabled" Value="False"><Setter TargetName="ButtonFace" Property="Opacity" Value="0.5"/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
 </Window.Resources>
 <Border BorderBrush="#C7C0DD" BorderThickness="1" CornerRadius="16" Margin="10">
  <Grid>
   <Grid.RowDefinitions><RowDefinition Height="144"/><RowDefinition Height="*"/><RowDefinition Height="Auto"/></Grid.RowDefinitions>
   <Border Grid.Row="0" CornerRadius="14,14,0,0">
    <Border.Background><LinearGradientBrush StartPoint="0,0" EndPoint="1,1"><GradientStop Color="#F6F3FF" Offset="0"/><GradientStop Color="#EEE7FF" Offset="0.65"/><GradientStop Color="#FFFFFF" Offset="1"/></LinearGradientBrush></Border.Background>
    <Grid Margin="28,22"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
     <Border Background="#FFFFFF" CornerRadius="20" Padding="12" Margin="0,0,20,0" VerticalAlignment="Center"><Image x:Name="BrandLogo" Width="68" Height="68" Stretch="Uniform" FlowDirection="LeftToRight" AutomationProperties.Name="Glauka"/></Border>
     <StackPanel Grid.Column="1" VerticalAlignment="Center"><TextBlock Text="Glauka" Foreground="#6441DF" FontSize="32" FontWeight="Bold"/><TextBlock x:Name="Tagline" Text="Uno spazio. Tutte le tue idee." TextWrapping="Wrap" Foreground="#1B1B27" FontSize="15" Margin="0,4,0,0"/><TextBlock Text="1.0.4" Foreground="#625E70" FontSize="11" Margin="0,10,0,0"/></StackPanel>
    </Grid>
   </Border>
   <ScrollViewer Grid.Row="1" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled"><StackPanel Margin="28,18,28,8">
    <Grid><Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions><TextBlock x:Name="StepTitle" Text="01 / PERSONALIZZA" Foreground="#6441DF" FontSize="11" FontWeight="Bold" VerticalAlignment="Center"/><ComboBox Grid.Column="1" x:Name="Lang" Width="174" MinHeight="36" Padding="8,6" Margin="12,0,0,0" Background="#F6F3FF" Foreground="#1B1B27" BorderBrush="#C7C0DD" SelectedValuePath="Tag" FlowDirection="LeftToRight" AutomationProperties.Name="Language"/></Grid>
    <TextBlock x:Name="Headline" Text="Il tuo prossimo spazio di lavoro." TextWrapping="Wrap" Foreground="#1B1B27" FontSize="23" FontWeight="Bold" Margin="0,12,0,0"/>
    <TextBlock x:Name="BodyText" Text="Idee più chiare, studio più efficace, progetti organizzati." TextWrapping="Wrap" Foreground="#625E70" FontSize="13" LineHeight="20" Margin="0,7,0,16"/>
    <Grid Margin="0,0,0,18"><Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="*"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
     <Border Background="#F6F3FF" CornerRadius="10" Padding="10" Margin="0,0,5,0"><StackPanel><Path Data="M1,10 L10,10 M10,10 L18,2 M10,10 L18,18 M0,7 L5,7 5,13 0,13 Z M18,0 L24,0 24,5 18,5 Z M18,15 L24,15 24,20 18,20 Z" Stroke="#6441DF" StrokeThickness="1.5" Width="25" Height="22" HorizontalAlignment="Left"/><TextBlock x:Name="FeatureViews" Text="7 viste, un progetto" TextWrapping="Wrap" Foreground="#1B1B27" FontSize="12" FontWeight="SemiBold" Margin="0,8,0,0"/></StackPanel></Border>
     <Border Grid.Column="1" Background="#F6F3FF" CornerRadius="10" Padding="10" Margin="3,0,3,0"><StackPanel><Path Data="M12,0 L15,8 24,11 15,14 12,23 9,14 0,11 9,8 Z" Stroke="#6441DF" StrokeThickness="1.5" Width="25" Height="24" HorizontalAlignment="Left"/><TextBlock x:Name="FeatureAI" Text="AI per approfondire" TextWrapping="Wrap" Foreground="#1B1B27" FontSize="12" FontWeight="SemiBold" Margin="0,6,0,0"/></StackPanel></Border>
     <Border Grid.Column="2" Background="#F6F3FF" CornerRadius="10" Padding="10" Margin="5,0,0,0"><StackPanel><Path Data="M4,3 L24,3 24,20 4,20 Z M0,0 L20,0 M8,9 L20,9 M8,14 L16,14" Stroke="#6441DF" StrokeThickness="1.5" Width="25" Height="22" HorizontalAlignment="Left"/><TextBlock x:Name="FeatureCards" Text="Flashcard e ripasso" TextWrapping="Wrap" Foreground="#1B1B27" FontSize="12" FontWeight="SemiBold" Margin="0,8,0,0"/></StackPanel></Border>
    </Grid>
    <CheckBox x:Name="DesktopShortcut" Content="Crea un collegamento sul Desktop" IsChecked="True" Foreground="#1B1B27" FontSize="13" Margin="0,0,0,12"/>
    <CheckBox x:Name="LaunchAfterInstall" Content="Apri Glauka al termine" IsChecked="True" Foreground="#1B1B27" FontSize="13" Margin="0,0,0,8"/>
    <Expander x:Name="InstallOptions" Header="Percorso di installazione" Foreground="#625E70" FontSize="12" Margin="0,6,0,12"><Border Background="#F6F3FF" BorderBrush="#C7C0DD" BorderThickness="1" CornerRadius="10" Padding="12" Margin="0,8,0,0"><StackPanel><TextBlock x:Name="DestinationTitle" Text="CARTELLA DI INSTALLAZIONE" Foreground="#625E70" FontSize="10" FontWeight="Bold"/><TextBox x:Name="InstallPath" Text="..." FlowDirection="LeftToRight" Background="#FFFFFF" Foreground="#1B1B27" BorderBrush="#C7C0DD" Padding="9" FontSize="12" Margin="0,8,0,8" HorizontalScrollBarVisibility="Auto"/><WrapPanel><Button x:Name="BrowsePath" Content="Scegli cartella…" Style="{StaticResource LightButton}" MinHeight="40" Margin="0,0,8,6"/><Button x:Name="ResetPath" Content="Usa predefinita" Style="{StaticResource LightButton}" MinHeight="40" Margin="0,0,0,6"/></WrapPanel></StackPanel></Border></Expander>
    <TextBlock x:Name="PrivacyInfo" Text="Installazione per il tuo account. I progetti esistenti vengono conservati." Foreground="#625E70" TextWrapping="Wrap" FontSize="11" LineHeight="17"/>
    <TextBlock x:Name="FinishHint" Text="Al termine questa finestra si chiude automaticamente." Foreground="#625E70" TextWrapping="Wrap" FontSize="11" Margin="0,4,0,12"/>
   </StackPanel></ScrollViewer>
   <Border Grid.Row="2" Background="#FFFFFF" BorderBrush="#C7C0DD" BorderThickness="0,1,0,0" CornerRadius="0,0,13,13" Padding="26,10,26,11">
    <Grid><Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/></Grid.RowDefinitions>
     <ProgressBar Grid.Row="0" x:Name="Progress" Height="6" Minimum="0" Maximum="100" Value="0" Background="#EEE7FF" Foreground="#6441DF" BorderThickness="0" Margin="0,0,0,7"/>
     <TextBlock Grid.Row="1" x:Name="Status" Text="Pronto per l'installazione" TextWrapping="Wrap" Foreground="#625E70" FontSize="12" Margin="0,0,0,8"/>
     <Grid Grid.Row="2"><Grid.ColumnDefinitions><ColumnDefinition Width="1*"/><ColumnDefinition Width="1*"/><ColumnDefinition Width="2*"/></Grid.ColumnDefinitions><Button Grid.Column="0" x:Name="Quit" Content="Annulla" Style="{StaticResource LightButton}" MinHeight="46" Margin="0,0,8,0"/><Button Grid.Column="1" x:Name="Repair" Content="Ripara" Style="{StaticResource LightButton}" Visibility="Collapsed" MinHeight="46" Margin="0,0,8,0"/><Button Grid.Column="2" x:Name="Install" Content="Installa Glauka" IsDefault="True" Style="{StaticResource PrimaryButton}" MinHeight="46"/></Grid>
    </Grid>
   </Border>
  </Grid>
 </Border>
</Window>
'@
# Match the light Prisma surface while retaining native window controls.
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class GlaukaInstallerChrome {
 [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
 [DllImport("shell32.dll", CharSet=CharSet.Unicode)] public static extern int SetCurrentProcessExplicitAppUserModelID(string id);
 [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr LoadImage(IntPtr instance, string name, uint type, int cx, int cy, uint flags);
 [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
 [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
 [DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr icon);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int nCmdShow);
 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hwnd);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
 [DllImport("user32.dll")] static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
 static IntPtr largeIcon=IntPtr.Zero, smallIcon=IntPtr.Zero;
 public static void BringToFront(IntPtr hwnd) {
  if(hwnd==IntPtr.Zero) return;
  ShowWindow(hwnd,9);
  IntPtr fg=GetForegroundWindow();
  uint dummy;
  uint fgTid=(fg!=IntPtr.Zero)?GetWindowThreadProcessId(fg,out dummy):0;
  uint curTid=GetCurrentThreadId();
  bool attached=(fgTid!=0 && fgTid!=curTid) && AttachThreadInput(curTid,fgTid,true);
  try {
   SetForegroundWindow(hwnd);
   BringWindowToTop(hwnd);
  } finally {
   if(attached) AttachThreadInput(curTid,fgTid,false);
  }
 }
 public static void SetWindowIcons(IntPtr hwnd, string path) {
  largeIcon=LoadImage(IntPtr.Zero,path,1,GetSystemMetrics(11),GetSystemMetrics(12),0x10);
  smallIcon=LoadImage(IntPtr.Zero,path,1,GetSystemMetrics(49),GetSystemMetrics(50),0x10);
  if(largeIcon!=IntPtr.Zero) SendMessage(hwnd,0x80,new IntPtr(1),largeIcon);
  if(smallIcon!=IntPtr.Zero) SendMessage(hwnd,0x80,IntPtr.Zero,smallIcon);
 }
 public static void ReleaseIcons() {
  if(largeIcon!=IntPtr.Zero) { DestroyIcon(largeIcon);largeIcon=IntPtr.Zero; }
  if(smallIcon!=IntPtr.Zero) { DestroyIcon(smallIcon);smallIcon=IntPtr.Zero; }
 }
}
"@
# Establish an identity before creating any HWND: do not group the setup
# window under its hidden PowerShell host or under the running Glauka app.
$installerAppID=if($script:isDeveloper){'Glauka.Setup.Developer'}else{'Glauka.Setup'}
[void][GlaukaInstallerChrome]::SetCurrentProcessExplicitAppUserModelID($installerAppID)
$reader=[System.Xml.XmlNodeReader]::new([xml]$xaml)
$window=[Windows.Markup.XamlReader]::Load($reader)
$window.Add_SourceInitialized({
 $handle=([System.Windows.Interop.WindowInteropHelper]::new($window)).Handle
 [GlaukaInstallerChrome]::SetWindowIcons($handle,$SourceIcon)
 $dark=0
 if([GlaukaInstallerChrome]::DwmSetWindowAttribute($handle,20,[ref]$dark,4) -ne 0){[void][GlaukaInstallerChrome]::DwmSetWindowAttribute($handle,19,[ref]$dark,4)}
 $caption=0x00FFFFFF;[void][GlaukaInstallerChrome]::DwmSetWindowAttribute($handle,35,[ref]$caption,4)
})
$window.Add_Closed({[GlaukaInstallerChrome]::ReleaseIcons()})
$window.Add_ContentRendered({
 $window.ShowInTaskbar=$true
 $window.WindowState='Normal'
 $handle=([System.Windows.Interop.WindowInteropHelper]::new($window)).Handle
 $wasTopmost=$window.Topmost
 $window.Topmost=$true
 [void]$window.Activate()
 [GlaukaInstallerChrome]::BringToFront($handle)
 $window.Topmost=$wasTopmost
 [void]$window.Focus()
})
# Fit installer within current usable desktop area, even under 125/150% DPI scaling.
$work=[System.Windows.SystemParameters]::WorkArea
# WorkArea is already DPI-aware WPF layout units. Keep the chrome onscreen
# before calculating the minimum dimensions (old minimums could force overflow).
$usableWidth=[Math]::Max(240,$work.Width-28)
$usableHeight=[Math]::Max(280,$work.Height-28)
$window.MinWidth=[Math]::Min(440,$usableWidth)
$window.MinHeight=[Math]::Min(430,$usableHeight)
$window.Width=[Math]::Min(680,$usableWidth)
$window.Height=[Math]::Min(760,$usableHeight)
$window.Title=$script:displayName+' Setup'
$names=@('BrandLogo','FeatureViews','FeatureAI','FeatureCards','InstallOptions','Headline','Tagline','StepTitle','Lang','BodyText','DestinationTitle','InstallPath','BrowsePath','ResetPath','DesktopShortcut','LaunchAfterInstall','FinishHint','PrivacyInfo','Progress','Status','Quit','Repair','Install')
foreach($n in $names){Set-Variable -Name $n -Value $window.FindName($n)}
# Artwork and taskbar use the shared Glauka three-node mark.
$logoImage=New-Object System.Windows.Media.Imaging.BitmapImage
$logoImage.BeginInit()
$logoImage.UriSource=[System.Uri]::new($SourceLogo,[System.UriKind]::Absolute)
$logoImage.CacheOption=[System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
$logoImage.EndInit()
$BrandLogo.Source=$logoImage
$window.Icon=[System.Windows.Media.Imaging.BitmapFrame]::Create(([System.Uri]::new($SourceIcon,[System.UriKind]::Absolute)))
$defaultInstallDir=Join-Path $env:LOCALAPPDATA ('Programs\'+$script:displayName)
$InstallPath.Text=$defaultInstallDir
$previous=Get-ItemProperty -Path ('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\'+$script:registryName) -ErrorAction SilentlyContinue
if($previous.InstallLocation){$InstallPath.Text=$previous.InstallLocation}
$BrowsePath.Add_Click({
 $dialog=New-Object System.Windows.Forms.FolderBrowserDialog
 $dialog.Description=(Localize 'Choose the Glauka installation folder')
 $dialog.ShowNewFolderButton=$true
 if(Test-Path -LiteralPath $InstallPath.Text -PathType Container){$dialog.SelectedPath=$InstallPath.Text}
 $owner=New-Object System.Windows.Forms.NativeWindow
 $owner.AssignHandle(([System.Windows.Interop.WindowInteropHelper]::new($window)).Handle)
 try{if($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK){$InstallPath.Text=$dialog.SelectedPath}}finally{$owner.ReleaseHandle();$dialog.Dispose()}
})
$ResetPath.Add_Click({$InstallPath.Text=$defaultInstallDir})
$catalog=Get-Content -LiteralPath $SourceLanguages -Raw -Encoding UTF8 | ConvertFrom-Json
function Localize([string]$text) {
 $pack=$catalog.messages.PSObject.Properties[$script:locale].Value
 $property=$pack.PSObject.Properties[$text]
 if($null -ne $property){if($text.EndsWith(' ')){return ([string]$property.Value)+' '};return [string]$property.Value}
 return $text
}
$localePath=Join-Path $env:APPDATA 'NeuroMap Architect\ui-locale.json'
$culture=[Globalization.CultureInfo]::CurrentUICulture.Name
$script:locale=if($culture -like 'zh*'){'zh-CN'}else{$culture.Split('-')[0].ToLowerInvariant()}
$codes=@($catalog.languages | ForEach-Object {$_.code})
if($script:locale -notin $codes){$script:locale='en'}
try {
 if(Test-Path -LiteralPath $localePath){$savedLocale=(Get-Content -LiteralPath $localePath -Raw | ConvertFrom-Json).locale;if($savedLocale -in $codes){$script:locale=$savedLocale}}
} catch { } # A damaged preference must not prevent installation.
foreach($language in $catalog.languages){
 $item=New-Object System.Windows.Controls.ComboBoxItem
 $item.Content=$language.name;$item.Tag=$language.code;$item.FontFamily='Segoe UI'
 [void]$Lang.Items.Add($item)
}
$Lang.SelectedValue=$script:locale
function ApplyLanguage {
 [System.Windows.Automation.AutomationProperties]::SetName($Lang,(Localize 'Interface language'))
 $window.FlowDirection=if($script:locale -eq 'ar'){'RightToLeft'}else{'LeftToRight'}
 $Headline.Text=(Localize 'Your next workspace.')
 $Tagline.Text=(Localize 'One space. All your ideas.')
 $StepTitle.Text=(Localize '01 / MAKE IT YOURS')
 $FeatureViews.Text=(Localize '7 views, one project')
 $FeatureAI.Text=(Localize 'AI to understand more')
 $FeatureCards.Text=(Localize 'Flashcards and review')
 $InstallOptions.Header=(Localize 'Installation location')
 if($script:installerResult -eq 2){$Status.Text=(Localize 'Ready to install')}
 $BodyText.Text=(Localize 'Clearer ideas, more effective study, organized projects.')
 $DestinationTitle.Text=(Localize 'INSTALLATION FOLDER')
 $BrowsePath.Content=(Localize 'Choose folder…')
 $ResetPath.Content=(Localize 'Use default')
 $DesktopShortcut.Content=(Localize 'Create a Desktop shortcut')
 $LaunchAfterInstall.Content=(Localize 'Open Glauka when installation finishes')
 $FinishHint.Text=(Localize 'This window closes automatically when installation finishes.')
 $PrivacyInfo.Text=(Localize 'Default installation needs no administrator rights. A different folder must be writable. Existing projects are preserved.')
 if($script:installerResult -eq 1){$StepTitle.Text=(Localize 'INSTALLATION INCOMPLETE');$Status.Text=(Localize 'Installation failed: ')+$script:failureDetail}
 $Quit.Content=(Localize 'Cancel')
 $Repair.Content=(Localize 'Repair')
 if($Install.IsEnabled){UpdateInstallerMode}
}
$Lang.Add_SelectionChanged({if($Lang.SelectedValue){$script:locale=[string]$Lang.SelectedValue;ApplyLanguage}})
$Quit.Add_Click({$window.Close()})
function NewShortcut([string]$path,[string]$target,[string]$icon){$shell=New-Object -ComObject WScript.Shell;$shortcut=$shell.CreateShortcut($path);$shortcut.TargetPath=$target;$shortcut.WorkingDirectory=(Split-Path $target);$shortcut.IconLocation=$icon;$shortcut.Description='Glauka';$shortcut.Save()}
# Remove only known former shortcuts still targeting the recorded old installation.
function Remove-LegacyShortcut([string]$path,[string]$previousFolder) {
 if (!$previousFolder -or !(Test-Path -LiteralPath $path -PathType Leaf)) { return }
 try {
  $shell=New-Object -ComObject WScript.Shell
  $target=$shell.CreateShortcut($path).TargetPath
  if ((Split-Path -Leaf $target) -notmatch '^NeuroMap-Architect(?:-[0-9A-Za-z.+-]+-[a-f0-9]{12})?\.exe$') { return }
  $parent=[IO.Path]::GetFullPath((Split-Path -Parent $target)).TrimEnd('\')
  $previousPath=[IO.Path]::GetFullPath($previousFolder).TrimEnd('\')
  if ([string]::Equals($parent,$previousPath,[StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $path -Force }
 } catch { } # An inaccessible/custom shortcut must never abort installation.
}
# Exact hash match only: a similarly named or modified file must not be launched.
function Get-GlaukaMatchingInstall([string]$folder){
 try{
  $folder=Resolve-NeuroMapInstallDir $folder
  if(!(Test-Path -LiteralPath $folder -PathType Container)){return $null}
  $hash=(Get-FileHash -LiteralPath $SourceExe -Algorithm SHA256).Hash.ToLowerInvariant()
  $target=Join-Path $folder ('Glauka-{0}-{1}.exe' -f $script:installerVersion,$hash.Substring(0,12))
  if(!(Test-Path -LiteralPath $target -PathType Leaf)){return $null}
  if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash){return $null}
  return $target
 }catch{return $null}
}
function UpdateInstallerMode {
 if(!$Install.IsEnabled){return}
 $same=Get-GlaukaMatchingInstall $InstallPath.Text
 if($same){
  $Install.Content=(Localize 'Open Glauka')
  $Repair.Visibility='Visible'
  $Status.Text=(Localize 'Already installed. Open it without reinstalling, or repair shortcuts.')
 }else{
  $Repair.Visibility='Collapsed'
  $installed=$false
  try{
   $folder=Resolve-NeuroMapInstallDir $InstallPath.Text
   $installed=[bool](Get-ChildItem -LiteralPath $folder -Filter 'Glauka-*.exe' -File -ErrorAction SilentlyContinue | Select-Object -First 1)
  }catch{}
  $Install.Content=if($installed){(Localize 'Update Glauka')}else{(Localize 'Install Glauka')}
 }
}
$script:repairMode=$false
$Repair.Add_Click({
 $script:repairMode=$true
 try{$Install.RaiseEvent([System.Windows.RoutedEventArgs]::new([System.Windows.Controls.Button]::ClickEvent))}
 finally{$script:repairMode=$false}
})
$InstallPath.Add_TextChanged({UpdateInstallerMode})

$Install.Add_Click({
 # When this exact build is already installed, open it without copying files again.
 if(!$script:repairMode){
  $existing=Get-GlaukaMatchingInstall $InstallPath.Text
  if($existing){
   try {Start-NeuroMapAfterInstall -Executable $existing -Launch $true; $script:installerResult=0; $window.Close()}
   catch {$Status.Text=$_.Exception.Message; $Status.Foreground='#AD2039'; $script:installerResult=1}
   return
  }
  $script:repairMode=$true
 }
 $Install.IsEnabled=$false;$Repair.IsEnabled=$false;$Lang.IsEnabled=$false;$Quit.IsEnabled=$false
 $InstallPath.IsEnabled=$false;$BrowsePath.IsEnabled=$false;$ResetPath.IsEnabled=$false;$DesktopShortcut.IsEnabled=$false;$LaunchAfterInstall.IsEnabled=$false
 $Status.Foreground='#625E70'
 try {
  $StepTitle.Text=(Localize '02 / INSTALLING')
  $Progress.Value=12;$Status.Text=(Localize 'Preparing installation...')
  $window.Dispatcher.Invoke([action]{}, [System.Windows.Threading.DispatcherPriority]::Background)
  $installDir=Resolve-NeuroMapInstallDir $InstallPath.Text
  $InstallPath.Text=$installDir
  # Gracefully close any running instance in $installDir so the single-instance mutex
  # releases and launches the newly installed build instead of focusing the old window.
  try {
   $running=Get-Process -ErrorAction SilentlyContinue | Where-Object {
    try { $_.Path -and [string]::Equals((Split-Path -Parent $_.Path).TrimEnd('\'),$installDir,[StringComparison]::OrdinalIgnoreCase) } catch { $false }
   }
   foreach($proc in $running){ try { [void]$proc.CloseMainWindow() } catch {} }
   if($running){
    $deadline=(Get-Date).AddSeconds(4)
    while((Get-Date) -lt $deadline){
     if(!($running | Where-Object { !$_.HasExited })){ break }
     Start-Sleep -Milliseconds 150
    }
   }
  } catch {}
  # Install side by side; Windows may have the prior application open.
  # Never delete/rename a running EXE or a .before-* backup.
  $exe=Install-NeuroMapBinary -SourceExe $SourceExe -InstallDir $installDir -Version $script:installerVersion
  $iconHash=(Get-FileHash -LiteralPath $SourceIcon -Algorithm SHA256).Hash.Substring(0,12).ToLowerInvariant()
  $ico=Join-Path $installDir ('Glauka-'+$iconHash+'.ico')
  Copy-Item -LiteralPath $SourceIcon -Destination $ico -Force
  $Progress.Value=62
  $Status.Text=(Localize 'Creating shortcuts...')
  $window.Dispatcher.Invoke([action]{}, [System.Windows.Threading.DispatcherPriority]::Background)
  $startMenu=Join-Path $env:APPDATA ('Microsoft\Windows\Start Menu\Programs\'+$script:displayName+'.lnk')
  NewShortcut $startMenu $exe $ico
  if($DesktopShortcut.IsChecked){$desktop=[Environment]::GetFolderPath('DesktopDirectory');NewShortcut (Join-Path $desktop ($script:displayName+'.lnk')) $exe $ico}
  if($script:isDeveloper){
    Remove-LegacyShortcut (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\NeuroMap Architect Developer.lnk') $previous.InstallLocation
    if($DesktopShortcut.IsChecked){Remove-LegacyShortcut (Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'NeuroMap Architect Developer.lnk') $previous.InstallLocation}
  }
  $uninstall='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\'+$script:registryName
  New-Item -Path $uninstall -Force | Out-Null
  New-ItemProperty -Path $uninstall -Name DisplayName -Value $script:displayName -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstall -Name DisplayVersion -Value $script:installerVersion -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstall -Name InstallLocation -Value $installDir -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstall -Name DisplayIcon -Value $ico -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstall -Name Publisher -Value 'Glauka' -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $uninstall -Name UninstallString -Value ('"'+$exe+'" --uninstall') -PropertyType String -Force | Out-Null
  Install-GlaukaFileAssociations -Executable $exe -Icon $ico -Edition $Edition
  # Release/Developer have isolated ProgIDs. Windows UserChoice and
  # existing non-Glauka associations remain untouched.
  $localeFolder=Split-Path -Parent $localePath
  [void][IO.Directory]::CreateDirectory($localeFolder)
  $localeJSON=@{locale=$script:locale} | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($localePath,$localeJSON,[Text.UTF8Encoding]::new($false))
  $Progress.Value=100
  $StepTitle.Text=(Localize '03 / ALL SET')
  $Headline.Text=(Localize 'You are all set.')
  $Status.Text=(Localize 'Installation completed.')
  $Install.IsEnabled=$false;$Quit.IsEnabled=$true;$script:installerResult=0
  try {
   Start-NeuroMapAfterInstall -Executable $exe -Launch ([bool]$LaunchAfterInstall.IsChecked)
   $window.Close()
  } catch {
   # The install succeeded. A launch failure must not offer an unnecessary reinstall.
   $Status.Text=(Localize 'Installed, but Glauka could not open. Use the Start menu. ')+$_.Exception.Message
   $Quit.Content=(Localize 'Close')
  }
 } catch {
  $script:failureDetail=$_.Exception.Message
  $Status.Text=(Localize 'Installation failed: ')+$script:failureDetail
  $StepTitle.Text=(Localize 'INSTALLATION INCOMPLETE')
  $InstallOptions.IsExpanded=$true
  $Status.Foreground='#AD2039';$Quit.IsEnabled=$true;$Install.IsEnabled=$true;$Lang.IsEnabled=$true;$script:installerResult=1
  $InstallPath.IsEnabled=$true;$BrowsePath.IsEnabled=$true;$ResetPath.IsEnabled=$true;$DesktopShortcut.IsEnabled=$true;$LaunchAfterInstall.IsEnabled=$true;$Repair.IsEnabled=$true;UpdateInstallerMode
 }
})
# WPF does not need Windows.Forms.DoEvents; leave UI responsive during these quick local file operations.
ApplyLanguage
[void]$window.ShowDialog()
if($script:installerResult -eq 1){Write-Error 'Installazione non completata; controlla il messaggio mostrato nella finestra.';exit 1}
if($script:installerResult -eq 2){exit 2}
exit 0
