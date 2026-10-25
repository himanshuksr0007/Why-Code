@echo off
rem Why-Code - double-click launcher for Windows.
rem Runs start.ps1 with a per-process execution-policy bypass (no system
rem settings changed) and keeps this window open when it ends, so any
rem error stays on screen instead of the window closing instantly.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
echo.
echo Why-Code stopped. Press any key to close this window.
pause >nul
