param(
    [string]$OutputDirectory,
    [string]$Label = (Get-Date -Format 'yyyyMMdd-HHmmss'),
    [switch]$KeepDirectory
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $PSScriptRoot '..\..\handover'
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$OutputDirectory = (Resolve-Path $OutputDirectory).Path

$coreRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workspaceRoot = (Resolve-Path (Join-Path $coreRoot '..')).Path
$siteRoot = Join-Path $workspaceRoot 'novyway'
$stageRoot = Join-Path $OutputDirectory "sovet-online-handover-$Label"
$archivePath = "$stageRoot.zip"
$hashPath = "$archivePath.sha256"

if (-not (Test-Path -LiteralPath $siteRoot)) { throw "Website source not found: $siteRoot" }
if (Test-Path -LiteralPath $stageRoot) { throw "Handover directory already exists: $stageRoot" }
if (Test-Path -LiteralPath $archivePath) { throw "Handover archive already exists: $archivePath" }

New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

function Copy-PortableTree([string]$Source, [string]$Destination, [string[]]$ExcludedDirectories, [string[]]$ExcludedFiles) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    & robocopy $Source $Destination /E /R:1 /W:1 /NFL /NDL /NJH /NJS /XD $ExcludedDirectories /XF $ExcludedFiles | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "robocopy failed for $Source with exit code $LASTEXITCODE" }
}

# The bundle must be reproducible but never contain an operator key or dependency cache.
Copy-PortableTree $coreRoot (Join-Path $stageRoot 'aptos-voting-core') @('.aptos', '.git', '.tmp', 'build', 'coverage_maps') @('.coverage_map.mvcov', '*.log')
Copy-PortableTree $siteRoot (Join-Path $stageRoot 'web') @('node_modules', 'dist', 'dist-single', '.git', '.tmp') @('.env.local', '*.log')

$manifestPath = Join-Path $stageRoot 'handover-manifest.json'
$entries = Get-ChildItem -LiteralPath $stageRoot -Recurse -File |
    Where-Object { $_.FullName -ne $manifestPath } |
    Sort-Object FullName |
    ForEach-Object {
        [pscustomobject]@{
            path = $_.FullName.Substring($stageRoot.Length).TrimStart('\') -replace '\\', '/'
            bytes = $_.Length
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }

$manifest = [ordered]@{
    schemaVersion = 'sovet-online-portable-handover-v1'
    createdAtUtc = [DateTime]::UtcNow.ToString('o')
    purpose = 'Static website deployment and public Aptos Testnet evidence. No credentials are included.'
    aptos = [ordered]@{
        network = 'testnet'
        moduleAddress = '0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411'
    }
    excluded = @('.aptos', '.env.local', 'node_modules', 'dist', '.git', '.tmp', 'build')
    files = @($entries)
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8

Compress-Archive -LiteralPath $stageRoot -DestinationPath $archivePath -CompressionLevel Optimal
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
"$archiveHash  $([System.IO.Path]::GetFileName($archivePath))" | Set-Content -LiteralPath $hashPath -Encoding ascii

if (-not $KeepDirectory) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }

[pscustomobject]@{
    archive = $archivePath
    sha256 = $archiveHash
    manifestEntries = @($entries).Count
    stagingDirectoryRetained = [bool]$KeepDirectory
} | Format-List
