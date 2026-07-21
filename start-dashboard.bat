@echo off
setlocal

cd /d "%~dp0"

echo Starting My Wiki dashboard...
echo.
call "%~dp0start-dashboard-background.bat"
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo Failed to start My Wiki dashboard. Exit code: %EXIT_CODE%
  echo Check tools\wiki-dashboard\vite.log for details.
  pause
  exit /b %EXIT_CODE%
)

echo My Wiki dashboard is running at:
echo http://127.0.0.1:5173/
echo.
echo You can close this window. The dashboard server keeps running in the background.
pause
