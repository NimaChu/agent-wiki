$ErrorActionPreference = "Stop"

& (Join-Path $PSScriptRoot "..\src\start-dashboard-server.ps1")
exit $LASTEXITCODE
