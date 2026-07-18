param([switch]$IncludePrivateMusic)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$release = Join-Path $root 'release'
$stage = Join-Path $release ('.stage-' + [guid]::NewGuid().ToString('N'))
$suffix = if ($IncludePrivateMusic) { 'private-portable' } else { 'source' }
$archive = Join-Path $release ('sovet-online-' + $suffix + '.zip')
New-Item -ItemType Directory -Force -Path $release, $stage | Out-Null
try {
    $excluded = @('node_modules', '.git', '.runtime', 'release', 'output', '.playwright-cli', 'dist-single')
    if (-not $IncludePrivateMusic) {
        $excluded += (Join-Path $root 'media\music')
    }
    $arguments = @($root, $stage, '/E', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/XF', '*.log', '*.local', '/XD') + $excluded
    & robocopy.exe @arguments | Out-Null
    if ($LASTEXITCODE -ge 8) { throw ('robocopy failed with code ' + $LASTEXITCODE) }
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive -CompressionLevel Optimal
    Write-Host ('Portable archive: ' + $archive)
} finally {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
