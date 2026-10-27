@echo off
rem Why-Code - double-click launcher for Windows (DEMO MODE).
rem Runs startdemo.ps1 with a per-process execution-policy bypass (no system
rem settings changed) and keeps this window open when it ends, so any
rem error stays on screen instead of the window closing instantly.
rem
rem DEMO MODE: Uses offline fixture data for encode/httpx only.
rem For production mode with Neo4j, use startprod.bat instead.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0startdemo.ps1"
echo.
echo Why-Code (demo mode) stopped. Press any key to close this window.
pause >nul
