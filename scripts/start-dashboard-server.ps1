$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$dashboard = Join-Path $repo "tools\wiki-dashboard"
$log = Join-Path $dashboard "vite.log"

Start-Process -WindowStyle Hidden -FilePath "cmd.exe" -WorkingDirectory $dashboard -ArgumentList @(
  "/d",
  "/c",
  "npm run dev -- --port 5173 >> `"$log`" 2>>&1"
)
