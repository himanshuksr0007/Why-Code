@echo off
rem Why-Code - production mode launcher for Windows.
rem Runs startprod.ps1 with a per-process execution-policy bypass.
rem
rem PRODUCTION MODE: Requires Neo4j database and LLM credentials.
rem Configure these in backend\.env before running.
rem For demo mode with offline fixture data, use startdemo.bat instead.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0startprod.ps1"
echo.
echo Why-Code (production mode) stopped. Press any key to close this window.
pause >nul
