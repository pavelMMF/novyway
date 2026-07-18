$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dataRoot = if ($env:SOVET_ONLINE_DATA_DIR) { $env:SOVET_ONLINE_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'SovetOnline' }
$configPath = Join-Path $dataRoot 'secrets\database.json'
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (-not (Test-Path -LiteralPath $configPath)) { throw 'PostgreSQL is not configured.' }
if (-not (Test-Path -LiteralPath $node)) { throw 'Node.js was not found.' }

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$pgDump = Join-Path $dataRoot 'PostgreSQL17\pgsql\bin\pg_dump.exe'
if (-not (Test-Path -LiteralPath $pgDump)) { throw 'pg_dump.exe was not found.' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $dataRoot 'backups'
$stage = Join-Path $backupRoot ('.recovery-' + [guid]::NewGuid().ToString('N'))
$plainZip = Join-Path $backupRoot ('.recovery-' + $stamp + '.zip')
$destination = Join-Path $backupRoot ('sovet-online-' + $stamp + '.sovetbackup')
New-Item -ItemType Directory -Force -Path $stage | Out-Null

try {
    $env:PGPASSWORD = $config.password
    & $pgDump --host $config.host --port $config.port --username $config.user --dbname $config.database --format custom --no-password --file (Join-Path $stage 'database.dump')
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

    Copy-Item -LiteralPath (Join-Path $dataRoot 'secrets') -Destination (Join-Path $stage 'secrets') -Recurse
    $files = Get-ChildItem -LiteralPath $stage -Recurse -File | ForEach-Object {
        [ordered]@{
            path = $_.FullName.Substring($stage.Length + 1).Replace('\', '/')
            bytes = $_.Length
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    [ordered]@{
        format = 'sovet-online-recovery-v1'
        createdAt = (Get-Date).ToUniversalTime().ToString('o')
        files = @($files)
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stage 'manifest.json') -Encoding UTF8

    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $plainZip -CompressionLevel Optimal
    $first = Read-Host 'Recovery passphrase (16+ characters)' -AsSecureString
    $second = Read-Host 'Repeat recovery passphrase' -AsSecureString
    $p1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
    $p2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
    try {
        $plain1 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p1)
        $plain2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p2)
        if ($plain1.Length -lt 16) { throw 'Passphrase must contain at least 16 characters.' }
        if ($plain1 -cne $plain2) { throw 'Passphrases do not match.' }
        $env:SOVET_RECOVERY_PASSPHRASE = $plain1
        & $node (Join-Path $PSScriptRoot 'recovery-crypto.mjs') encrypt $plainZip $destination
        if ($LASTEXITCODE -ne 0) { throw 'Recovery bundle encryption failed.' }
    } finally {
        Remove-Item Env:SOVET_RECOVERY_PASSPHRASE -ErrorAction SilentlyContinue
        if ($p1 -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p1) }
        if ($p2 -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p2) }
        $plain1 = $null
        $plain2 = $null
    }
    Write-Host ('Encrypted recovery bundle: ' + $destination)
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $plainZip) { Remove-Item -LiteralPath $plainZip -Force }
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
