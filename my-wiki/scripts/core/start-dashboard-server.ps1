$ErrorActionPreference = "Stop"

$skill = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dashboard = Join-Path $skill "assets\dashboard"
$log = Join-Path $dashboard "vite.log"
$port = if ($env:MY_WIKI_DASHBOARD_PORT) { $env:MY_WIKI_DASHBOARD_PORT } else { "5173" }
$vite = Join-Path $dashboard "node_modules\vite\bin\vite.js"

Start-Process -WindowStyle Hidden -FilePath "node.exe" -WorkingDirectory $dashboard -ArgumentList @(
  $vite,
  "--host",
  "127.0.0.1",
  "--port",
  $port
) -RedirectStandardOutput $log -RedirectStandardError (Join-Path $dashboard "vite-error.log")
