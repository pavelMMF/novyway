param(
    [string]$AptosCli = "aptos",
    [string]$DevAddress = "0x42"
)

$ErrorActionPreference = "Stop"
$PackageDir = Split-Path -Parent $PSScriptRoot

& $AptosCli move test `
    --package-dir $PackageDir `
    --named-addresses "aptos_voting=$DevAddress" `
    --coverage `
    --fail-on-warning

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
