param(
    [Parameter(Mandatory = $true)][string]$Bundle,
    [Parameter(Mandatory = $true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (-not (Test-Path -LiteralPath $Bundle)) { throw 'Recovery bundle was not found.' }
if (Test-Path -LiteralPath $Destination) { throw 'Destination already exists.' }
$tempZip = [IO.Path]::Combine([IO.Path]::GetTempPath(), ('sovet-recovery-' + [guid]::NewGuid().ToString('N') + '.zip'))
try {
    $secure = Read-Host 'Recovery passphrase' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        $env:SOVET_RECOVERY_PASSPHRASE = $plain
        & $node (Join-Path $PSScriptRoot 'recovery-crypto.mjs') decrypt (Resolve-Path -LiteralPath $Bundle) $tempZip
        if ($LASTEXITCODE -ne 0) { throw 'Recovery bundle decryption failed.' }
    } finally {
        Remove-Item Env:SOVET_RECOVERY_PASSPHRASE -ErrorAction SilentlyContinue
        if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        $plain = $null
    }
    Expand-Archive -LiteralPath $tempZip -DestinationPath $Destination
    Write-Host ('Bundle opened for inspection: ' + (Resolve-Path -LiteralPath $Destination))
    Write-Host 'No database or secret was restored automatically.'
} finally {
    if (Test-Path -LiteralPath $tempZip) { Remove-Item -LiteralPath $tempZip -Force }
}
