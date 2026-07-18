$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$csc = Join-Path $framework 'csc.exe'
if (-not (Test-Path -LiteralPath $csc)) { throw 'The .NET Framework x64 compiler was not found.' }
$launcherTarget = Join-Path $root 'Start-Sovet-Online.exe'
$launcherBuild = Join-Path $root 'Start-Sovet-Online.next.exe'
$operatorTarget = Join-Path $root 'Sovet-Online-Admin.exe'
$operatorBuild = Join-Path $root 'Sovet-Online-Admin.next.exe'

$launcherArgs = @(
    '/nologo', '/target:exe', '/optimize+',
    "/out:$launcherBuild",
    (Join-Path $PSScriptRoot 'Start-Sovet-Online.cs')
)
& $csc $launcherArgs
if ($LASTEXITCODE -ne 0) { throw 'Failed to build the service launcher.' }

$operatorArgs = @(
    '/nologo', '/target:winexe', '/optimize+',
    "/out:$operatorBuild",
    "/reference:$(Join-Path $framework 'System.dll')",
    "/reference:$(Join-Path $framework 'System.Core.dll')",
    "/reference:$(Join-Path $framework 'System.Web.Extensions.dll')",
    "/reference:$(Join-Path $framework 'WPF\PresentationCore.dll')",
    "/reference:$(Join-Path $framework 'WPF\PresentationFramework.dll')",
    "/reference:$(Join-Path $framework 'WPF\WindowsBase.dll')",
    "/reference:$(Join-Path $framework 'System.Xaml.dll')",
    (Join-Path $PSScriptRoot 'Sovet-Online-Operator.cs')
)
& $csc $operatorArgs
if ($LASTEXITCODE -ne 0) { throw 'Failed to build the operator application.' }

try { Move-Item -LiteralPath $launcherBuild -Destination $launcherTarget -Force }
catch { Write-Warning 'Start-Sovet-Online.exe is running. Start-Sovet-Online.next.exe will replace it during the controlled restart.' }
try { Move-Item -LiteralPath $operatorBuild -Destination $operatorTarget -Force }
catch { Write-Warning 'Sovet-Online-Admin.exe is running. Close it and run this build script again.' }

Write-Host 'Windows launchers were built.'
