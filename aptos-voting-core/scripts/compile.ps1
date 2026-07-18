param(
    [Parameter(Mandatory = $true)]
    [string]$ModuleAddress,
    [string]$AptosCli = "aptos"
)

$ErrorActionPreference = "Stop"
$PackageDir = Split-Path -Parent $PSScriptRoot

& $AptosCli move compile `
    --package-dir $PackageDir `
    --named-addresses "aptos_voting=$ModuleAddress" `
    --fail-on-warning

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
