param(
    [Parameter(Mandatory = $true)]
    [string]$TargetModuleAddress,
    [string]$Profile = 'sovet-online-testnet',
    [string]$PlanPath,
    [string]$RecoveryBundleHash = '0x36dc0c233ea9f490f1900e8d7949ce2fb44f0e56baddcbfa663fefddfb0a136f',
    [string]$AptosCli,
    [switch]$Initialize,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($PlanPath)) { $PlanPath = Join-Path $PSScriptRoot '..\document-registry\publish-plan.v1.json' }
if ([string]::IsNullOrWhiteSpace($AptosCli)) { $AptosCli = Join-Path $PSScriptRoot '..\..\.tools\aptos\aptos.exe' }

function Convert-ToHex([string]$Value) {
    if ([string]::IsNullOrEmpty($Value)) { return 'hex:' }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    return 'hex:' + ([System.BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
}

function Convert-HashToHex([string]$Hash) {
    if ($Hash -eq '0x') { return 'hex:' }
    if ($Hash -notmatch '^0x[0-9a-fA-F]{64}$') { throw "Expected a 32-byte SHA-256 hash, got: $Hash" }
    return 'hex:' + $Hash.Substring(2)
}

if ($TargetModuleAddress -notmatch '^0x[0-9a-fA-F]+$') { throw 'TargetModuleAddress must be an Aptos address.' }
if ($RecoveryBundleHash -notmatch '^0x[0-9a-fA-F]{64}$') { throw 'RecoveryBundleHash must be a SHA-256 hash.' }
if (-not (Test-Path -LiteralPath $AptosCli)) { throw "Aptos CLI not found: $AptosCli" }
if (-not (Test-Path -LiteralPath $PlanPath)) { throw "Publish plan not found: $PlanPath" }
$plan = Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json

function Invoke-Move([string]$FunctionId, [string[]]$Arguments) {
    $command = @('move', 'run', '--profile', $Profile, '--function-id', $FunctionId, '--args') + $Arguments + @('--assume-yes')
    Write-Host "Submitting $FunctionId"
    if ($WhatIf) { Write-Host (($command | ForEach-Object { "[$_]" }) -join ' '); return }
    & $AptosCli @command
    if ($LASTEXITCODE -ne 0) { throw "Aptos command failed for $FunctionId" }
}

if ($Initialize) {
    Invoke-Move "$TargetModuleAddress`::document_anchor::initialize" @()
}

foreach ($document in $plan.documents) {
    Invoke-Move "$TargetModuleAddress`::document_anchor::anchor_document" @(
        (Convert-HashToHex $document.documentKey),
        (Convert-HashToHex $document.contentHash),
        (Convert-HashToHex $document.parentContentHash),
        (Convert-HashToHex $document.metadataHash),
        (Convert-HashToHex $RecoveryBundleHash),
        "u64:$($document.contentBytes)",
        (Convert-ToHex $document.mimeType),
        (Convert-ToHex $document.metadataUri),
        (Convert-ToHex $document.version)
    )
}

Write-Host 'Replay submits fresh logical operations. It does not and cannot replay old signed Aptos transactions.'
