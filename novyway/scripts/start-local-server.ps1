param(
    [string]$HostAddress = '127.0.0.1',
    [int]$Port = 4176,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
try {
    $webRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    $distIndex = Join-Path $webRoot 'dist\index.html'
    $serverScript = Join-Path $webRoot 'server\static-server.mjs'
    $node = (Get-Command node.exe -ErrorAction Stop).Source

    if (-not $SkipBuild -or -not (Test-Path -LiteralPath $distIndex)) {
        $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
        Write-Host 'Building production site...'
        Push-Location $webRoot
        try {
            & $npm run build
            if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE" }
        } finally {
            Pop-Location
        }
    }

    Write-Host "Starting static site at http://$HostAddress`:$Port/"
    Write-Host 'Public address: https://novyway.com/'
    & $node $serverScript --host $HostAddress --port $Port --open
    exit $LASTEXITCODE
} catch {
    Write-Error $_
    exit 1
}
