param(
    [Parameter(Mandatory = $true)]
    [string]$Directory
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path $Directory).Path
$manifestPath = Join-Path $root 'handover-manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw "Manifest not found: $manifestPath" }

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$failures = @()
foreach ($entry in $manifest.files) {
    $filePath = Join-Path $root ($entry.path -replace '/', '\\')
    if (-not (Test-Path -LiteralPath $filePath)) {
        $failures += "Missing: $($entry.path)"
        continue
    }
    $actual = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $entry.sha256) { $failures += "Hash mismatch: $($entry.path)" }
}

if ($failures.Count -gt 0) { throw ($failures -join [Environment]::NewLine) }
"Verified $($manifest.files.Count) files from $($manifest.schemaVersion)."
