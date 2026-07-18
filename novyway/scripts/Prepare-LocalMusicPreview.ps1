param(
  [string]$Ffmpeg = "C:\Users\lolip\OneDrive\Documents\New project 2\.tools\ffmpeg\ffmpeg.exe",
  [string]$Source = "C:\Users\lolip\Downloads"
)

$ErrorActionPreference = 'Stop'
$destination = Join-Path $PSScriptRoot '..\.runtime\music'
New-Item -ItemType Directory -Force -Path $destination | Out-Null

$tracks = @(
  @{ In = '01_Instrument of Surrender.mp3'; Out = '01-instrument-of-surrender.m4a' },
  @{ In = '02_Whirling-In-Rags, 8 AM.mp3'; Out = '02-whirling-in-rags-8-am.m4a' },
  @{ In = '03_Detective Arriving on the Scene.mp3'; Out = '03-detective-arriving-on-the-scene.m4a' },
  @{ In = '06_Precinct 41 Major Crime Unit.mp3'; Out = '06-precinct-41-major-crime-unit.m4a' },
  @{ In = '08_Polyhedrons.mp3'; Out = '08-polyhedrons.m4a' },
  @{ In = '15_Whirling-In-Rags, 8 PM.mp3'; Out = '15-whirling-in-rags-8-pm.m4a' },
  @{ In = 'Starfall - Sovietwave Mix.mp3'; Out = 'starfall-sovietwave-mix.mp3'; Codec = 'mp3' }
)

foreach ($track in $tracks) {
  $inputPath = Join-Path $Source $track.In
  $outputPath = Join-Path $destination $track.Out
  if (!(Test-Path -LiteralPath $inputPath)) { throw "Missing source: $inputPath" }
  if ($track.Codec -eq 'mp3') {
    & $Ffmpeg -hide_banner -loglevel warning -y -i $inputPath `
      -map_metadata -1 -vn -af 'loudnorm=I=-18:TP=-1.5:LRA=11' `
      -c:a libmp3lame -b:a 112k -ar 44100 -ac 2 $outputPath
  } else {
    & $Ffmpeg -hide_banner -loglevel warning -y -i $inputPath `
      -map_metadata -1 -vn -af 'loudnorm=I=-18:TP=-1.5:LRA=11' `
      -c:a aac -b:a 96k -ar 48000 -ac 2 -movflags +faststart $outputPath
  }
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed for $inputPath" }
}

Get-ChildItem -LiteralPath $destination -File | Select-Object Name, Length
