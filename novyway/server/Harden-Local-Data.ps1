param(
  [string]$DataRoot = $(if ($env:SOVET_ONLINE_DATA_DIR) { $env:SOVET_ONLINE_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'SovetOnline' })
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $DataRoot)) {
  Write-Host "Nothing to harden: $DataRoot does not exist."
  exit 0
}

$currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$grants = @(
  ('*{0}:(OI)(CI)F' -f $currentSid),
  '*S-1-5-18:(OI)(CI)F',
  '*S-1-5-32-544:(OI)(CI)F'
)

& icacls.exe $DataRoot /inheritance:r /grant:r $grants /C | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not protect $DataRoot" }

foreach ($name in @('secrets', 'backups', 'postgres-data', 'logs')) {
  $path = Join-Path $DataRoot $name
  if (-not (Test-Path -LiteralPath $path)) { continue }
  & icacls.exe $path /reset /T /C | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not protect $path" }
}

Write-Host "Local data is restricted to the current account, SYSTEM, and Administrators: $DataRoot"
