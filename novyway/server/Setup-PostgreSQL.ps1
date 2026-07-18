param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot),
  [int]$Port = 55432
)

$ErrorActionPreference = 'Stop'
$dataRoot = if ($env:SOVET_ONLINE_DATA_DIR) { $env:SOVET_ONLINE_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'SovetOnline' }
$postgresRoot = Join-Path $dataRoot 'PostgreSQL17'
$archive = Join-Path $dataRoot 'downloads\postgresql-17.10-1-windows-x64-binaries.zip'
$bin = Join-Path $postgresRoot 'pgsql\bin'
$cluster = Join-Path $dataRoot 'postgres-data'
$secrets = Join-Path $dataRoot 'secrets'
$logs = Join-Path $dataRoot 'logs'
$configPath = Join-Path $secrets 'database.json'
$downloadUrl = 'https://get.enterprisedb.com/postgresql/postgresql-17.10-1-windows-x64-binaries.zip'

function New-RandomSecret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+','-').Replace('/','_')
}

New-Item -ItemType Directory -Force -Path (Split-Path $archive), $postgresRoot, $cluster, $secrets, $logs | Out-Null

if (-not (Test-Path (Join-Path $bin 'postgres.exe')) -or -not (Test-Path (Join-Path $postgresRoot 'pgsql\share\postgres.bki'))) {
  if (-not (Test-Path $archive)) {
    Write-Host 'Downloading PostgreSQL 17.10 official EDB binaries...'
    Invoke-WebRequest $downloadUrl -OutFile $archive -UseBasicParsing
  }
  Write-Host 'Extracting PostgreSQL...'
  & tar.exe -xf $archive -C $postgresRoot
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL archive extraction failed' }
}

$appPassword = New-RandomSecret
$adminPassword = New-RandomSecret
$adminPwFile = Join-Path $env:TEMP ('sovet-pg-admin-' + [Guid]::NewGuid().ToString('N') + '.txt')
$appSqlFile = Join-Path $env:TEMP ('sovet-pg-app-' + [Guid]::NewGuid().ToString('N') + '.sql')

try {
  if (-not (Test-Path (Join-Path $cluster 'PG_VERSION'))) {
    Set-Content -LiteralPath $adminPwFile -Value $adminPassword -NoNewline -Encoding ascii
    & (Join-Path $bin 'initdb.exe') --pgdata=$cluster --username=sovet_postgres --pwfile=$adminPwFile --auth-host=scram-sha-256 --auth-local=scram-sha-256 --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }

    Add-Content -LiteralPath (Join-Path $cluster 'postgresql.conf') -Encoding ascii -Value "`nlisten_addresses = '127.0.0.1'`nport = $Port`npassword_encryption = 'scram-sha-256'`nmax_connections = 100`nshared_buffers = '128MB'`n"
  }

  & (Join-Path $bin 'pg_ctl.exe') status -D $cluster *> $null
  if ($LASTEXITCODE -ne 0) {
    & (Join-Path $bin 'pg_ctl.exe') start -D $cluster -l (Join-Path $logs 'postgresql.log') -w
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not start' }
  }

  if (-not (Test-Path $configPath)) {
    $escapedPassword = $appPassword.Replace("'", "''")
    @"
DO `$block`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sovet_app') THEN
    CREATE ROLE sovet_app LOGIN PASSWORD '$escapedPassword' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
`$block`$;
SELECT 'CREATE DATABASE sovet_online OWNER sovet_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sovet_online')\gexec
"@ | Set-Content -LiteralPath $appSqlFile -Encoding utf8
    $env:PGPASSWORD = $adminPassword
    & (Join-Path $bin 'psql.exe') -h 127.0.0.1 -p $Port -U sovet_postgres -d postgres -v ON_ERROR_STOP=1 -f $appSqlFile
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the application database' }

    @{ host = '127.0.0.1'; port = $Port; database = 'sovet_online'; user = 'sovet_app'; password = $appPassword; ssl = $false } |
      ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8
    @{ host = '127.0.0.1'; port = $Port; database = 'postgres'; user = 'sovet_postgres'; password = $adminPassword; ssl = $false } |
      ConvertTo-Json | Set-Content -LiteralPath (Join-Path $secrets 'database-admin.json') -Encoding utf8
  }
}
finally {
  Remove-Item -LiteralPath $adminPwFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $appSqlFile -Force -ErrorAction SilentlyContinue
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "PostgreSQL is ready on 127.0.0.1:$Port."
Write-Host "Application configuration: $configPath"
& (Join-Path $PSScriptRoot 'Harden-Local-Data.ps1') -DataRoot $dataRoot
