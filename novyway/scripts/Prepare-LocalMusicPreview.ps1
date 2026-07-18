# Re-normalizes the site's own tracks (Media/music) to a consistent -18 LUFS
# loudness before they're served from media/music. Optional: the files that
# ship today are already close to this target, so re-run only if you drop in
# new masters.
param(
  [string]$Ffmpeg = "C:\Users\lolip\OneDrive\Documents\New project 2\.tools\ffmpeg\ffmpeg.exe",
  [string]$Source = (Join-Path $PSScriptRoot '..\media\music')
)

$ErrorActionPreference = 'Stop'
$destination = Join-Path $PSScriptRoot '..\.runtime\music-normalized'
New-Item -ItemType Directory -Force -Path $destination | Out-Null

$tracks = @(
  @{ In = '01.m4a'; Out = '01.m4a' },
  @{ In = '02.m4a'; Out = '02.m4a' },
  @{ In = '03.m4a'; Out = '03.m4a' },
  @{ In = '04.m4a'; Out = '04.m4a' },
  @{ In = '05.m4a'; Out = '05.m4a' },
  @{ In = '06.m4a'; Out = '06.m4a' },
  @{ In = '07.mp3'; Out = '07.mp3'; Codec = 'mp3' }
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
