$ErrorActionPreference = 'Stop'

$dataRoot = if ($env:SOVET_ONLINE_DATA_DIR) { $env:SOVET_ONLINE_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'SovetOnline' }
$secretsRoot = Join-Path $dataRoot 'secrets'
$configPath = Join-Path $secretsRoot 'mail.json'
New-Item -ItemType Directory -Force -Path $secretsRoot | Out-Null

Write-Host 'Novyway service email setup.'
Write-Host 'Create a separate mailbox first. Never use your normal account password.'
Write-Host '[1] Gmail or Google Workspace (application password)'
Write-Host '[2] Custom SMTP provider'
$provider = Read-Host 'Provider'
$email = Read-Host 'SMTP user / service mailbox'
$fromName = Read-Host 'Visible sender name (default: Novyway)'
if ([string]::IsNullOrWhiteSpace($fromName)) { $fromName = 'Novyway' }

if ($provider -eq '1') {
    $hostName = 'smtp.gmail.com'
    $port = 465
    $secure = $true
} elseif ($provider -eq '2') {
    $hostName = Read-Host 'SMTP host'
    $port = [int](Read-Host 'SMTP port (usually 465 or 587)')
    $secure = (Read-Host 'Use direct TLS? [y/N]') -match '^[Yy]'
} else {
    throw 'Unknown provider.'
}

$securePassword = Read-Host 'SMTP application password (hidden)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    [ordered]@{
        host = $hostName
        port = $port
        secure = $secure
        user = $email
        password = $password
        from = "$fromName <$email>"
    } | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
} finally {
    if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    $password = $null
}

& icacls.exe $configPath /inheritance:r /grant:r "${env:USERNAME}:F" '*S-1-5-18:F' '*S-1-5-32-544:F' | Out-Null
& (Join-Path $PSScriptRoot 'Harden-Local-Data.ps1') -DataRoot $dataRoot
Write-Host ('Mail configuration saved outside the repository: ' + $configPath)
$testRecipient = Read-Host 'Send a test code to this address (blank to skip)'
if (-not [string]::IsNullOrWhiteSpace($testRecipient)) {
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    & $node (Join-Path $PSScriptRoot 'Test-Mail.mjs') $testRecipient.Trim()
    if ($LASTEXITCODE -ne 0) { throw 'SMTP test failed. Check the application password and provider settings.' }
}
Write-Host 'Mail setup is complete. Restart the site from Sovet-Online-Admin.exe.'
Read-Host 'Press Enter to close this window' | Out-Null
